const { Router } = require('express')
const { requireAuth, requireAdmin } = require('../middleware/auth.js')
const supabase = require('../lib/supabase.js')

const router = Router()

const ESTADOS = ['nuevo', 'contactado', 'en_proceso', 'cerrado', 'perdido']

const FULL_SELECT = '*, crm_formularios(producto, nombre_formulario), cliente_etiquetas(etiqueta_id, crm_etiquetas(id, nombre, color))'

const fromCliente = (r) => ({
  id:               r.id,
  nombre:           r.nombre,
  email:            r.email,
  telefono:         r.telefono,
  mensaje:          r.mensaje,
  fuente:           r.fuente,
  fuenteDetalle:    r.fuente_detalle,
  formId:           r.form_id,
  producto:         r.crm_formularios?.producto || null,
  nombreFormulario: r.crm_formularios?.nombre_formulario || null,
  datosAdicionales: r.datos_adicionales,
  estado:           r.estado,
  fechaRecordatorio: r.fecha_recordatorio || null,
  etiquetas:        (r.cliente_etiquetas || []).map((ce) => ce.crm_etiquetas).filter(Boolean),
  createdAt:        r.created_at,
  updatedAt:        r.updated_at,
})

/* ═══════════════════════════════════════════════════════════════
 * WEBHOOK DE META LEAD ADS (sin autenticación)
 * Definido antes de router.use(requireAuth) para que sea público.
 * ═════════════════════════════════════════════════════════════ */

/* GET /api/crm/webhook — verificación del webhook de Meta */
router.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode']
  const token     = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge)
  }

  return res.sendStatus(403)
})

/* Extrae { name → valor } desde el field_data que devuelve Graph */
function mapFieldData(fieldData) {
  const map = {}
  for (const f of fieldData || []) {
    if (f?.name) map[f.name] = Array.isArray(f.values) ? f.values[0] : f.values
  }
  return map
}

/* Busca un campo tipo "mensaje" entre los datos del formulario */
function extraerMensaje(map) {
  const claves = Object.keys(map)
  const hit = claves.find((k) => /mensaje|message|comentario|comment|consulta/i.test(k))
  return hit ? map[hit] : null
}

/* Descarga los datos completos de un lead desde la Graph API */
async function fetchLead(leadgenId, token) {
  const url = `https://graph.facebook.com/v18.0/${leadgenId}?access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Graph lead ${leadgenId}: ${res.status} ${await res.text()}`)
  return res.json()
}

/* Obtiene el nombre del formulario (best-effort) */
async function fetchFormName(formId, token) {
  if (!formId) return null
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${formId}?fields=name&access_token=${token}`)
    if (!res.ok) return null
    const json = await res.json()
    return json?.name || null
  } catch {
    return null
  }
}

/* POST /api/crm/webhook — recepción de leads de Meta.
 * SIEMPRE responde 200 (Meta reintenta si no recibe 200). */
router.post('/webhook', async (req, res) => {
  // Responder de inmediato para no dejar a Meta esperando.
  res.sendStatus(200)

  try {
    const token = process.env.META_PAGE_ACCESS_TOKEN
    const entries = req.body?.entry || []

    for (const entry of entries) {
      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen') continue
        const value = change.value || {}
        const leadgenId = value.leadgen_id
        if (!leadgenId) continue

        try {
          const lead = await fetchLead(leadgenId, token)
          const map  = mapFieldData(lead.field_data)

          const formId   = lead.form_id || value.form_id || null
          const formName = await fetchFormName(formId, token)

          // Guarda todos los campos no estándar del formulario en datos_adicionales
          const camposEstandar = ['full_name', 'email', 'phone_number', 'phone',
                                  'nombre', 'telefono', 'first_name', 'last_name',
                                  'correo_electrónico', 'correo_electronico', 'correo',
                                  'número_de_teléfono', 'numero_de_telefono',
                                  'nombre_completo']
          const datosAdicionales = {}
          for (const [key, val] of Object.entries(map)) {
            if (!camposEstandar.some(c => key.toLowerCase().includes(c))) {
              datosAdicionales[key] = val
            }
          }

          const registro = {
            empresa_id:        process.env.META_EMPRESA_ID,
            nombre:            map.full_name ||
                               map.nombre_completo ||
                               `${map.first_name || ''} ${map.last_name || ''}`.trim() ||
                               null,
            email:             map.email ||
                               map['correo_electrónico'] ||
                               map.correo_electronico ||
                               null,
            telefono:          map.phone_number ||
                               map.phone ||
                               map['número_de_teléfono'] ||
                               map.numero_de_telefono ||
                               null,
            mensaje:           extraerMensaje(map),
            fuente:            'meta_leads',
            fuente_detalle:    formName || formId || null,
            form_id:           formId,
            leadgen_id:        leadgenId,
            datos_adicionales: Object.keys(datosAdicionales).length > 0 ? datosAdicionales : null,
            estado:            'nuevo',
          }

          const { error } = await supabase.from('clientes').insert(registro)
          if (error) console.error('[crm/webhook] Error al insertar lead:', error.message)
          else console.log('[crm/webhook] Lead insertado:', registro.nombre)
        } catch (leadErr) {
          console.error('[crm/webhook] Error procesando leadgen_id', leadgenId, leadErr.message)
        }
      }
    }
  } catch (err) {
    console.error('[crm/webhook] Error general procesando webhook:', err.message)
  }
})

/* Sincroniza todos los leads históricos de un formulario de Meta,
 * paginando la Graph API e insertando solo los que no existan (por leadgen_id). */
async function syncFormLeads(formId, token, empresaId) {
  let url = `https://graph.facebook.com/v19.0/${formId}/leads?fields=id,created_time,field_data&limit=100&access_token=${token}`
  let total = 0
  let insertados = 0

  while (url) {
    const res = await fetch(url)
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)

    for (const lead of data.data || []) {
      total++
      // Verificar si ya existe por leadgen_id
      const { data: existe } = await supabase
        .from('clientes')
        .select('id')
        .eq('leadgen_id', lead.id)
        .maybeSingle()

      if (existe) continue

      const map = mapFieldData(lead.field_data)
      const camposEstandar = ['full_name', 'email', 'phone_number', 'phone',
        'nombre', 'telefono', 'first_name', 'last_name',
        'nombre_completo', 'correo_electrónico', 'correo_electronico',
        'número_de_teléfono', 'numero_de_telefono']

      const datosAdicionales = {}
      for (const [key, val] of Object.entries(map)) {
        if (!camposEstandar.some(c => key.toLowerCase().includes(c))) {
          datosAdicionales[key] = val
        }
      }

      const registro = {
        empresa_id: empresaId,
        leadgen_id: lead.id,
        nombre: map.nombre_completo || map.full_name ||
                `${map.first_name || ''} ${map.last_name || ''}`.trim() || null,
        email: map.email || map['correo_electrónico'] || map.correo_electronico || null,
        telefono: map.phone_number || map.phone ||
                  map['número_de_teléfono'] || map.numero_de_telefono || null,
        mensaje: extraerMensaje(map),
        fuente: 'meta_leads',
        fuente_detalle: formId,
        form_id: formId,
        estado: 'nuevo',
        datos_adicionales: Object.keys(datosAdicionales).length > 0 ? datosAdicionales : null,
        created_at: new Date(lead.created_time).toISOString()
      }

      const { error } = await supabase.from('clientes').insert(registro)
      if (!error) insertados++
    }

    url = data.paging?.next || null
  }

  return { total, insertados }
}

/* ═══════════════════════════════════════════════════════════════
 * RUTAS AUTENTICADAS
 * ═════════════════════════════════════════════════════════════ */

router.use(requireAuth)

/* GET /api/crm/clientes — lista los clientes de la empresa */
router.get('/clientes', async (req, res) => {
  const empresaId = req.user.empresa_id
  const { data, error } = await supabase
    .from('clientes')
    .select(FULL_SELECT)
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[crm/clientes GET]', error.message)
    return res.status(500).json({ success: false, error: { message: error.message } })
  }
  res.json({ success: true, data: (data || []).map(fromCliente) })
})

/* PATCH /api/crm/clientes/:id — actualiza estado y/o fecha_recordatorio */
router.patch('/clientes/:id', async (req, res) => {
  const empresaId = req.user.empresa_id
  const { id } = req.params
  const { estado, fecha_recordatorio } = req.body

  const updates = { updated_at: new Date().toISOString() }

  if (estado !== undefined) {
    if (!ESTADOS.includes(estado)) {
      return res.status(400).json({ success: false, error: { message: 'Estado inválido' } })
    }
    updates.estado = estado
  }
  if ('fecha_recordatorio' in req.body) {
    updates.fecha_recordatorio = fecha_recordatorio || null
  }

  const { data, error } = await supabase
    .from('clientes')
    .update(updates)
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .select(FULL_SELECT)
    .maybeSingle()

  if (error) {
    console.error('[crm/clientes PATCH]', error.message)
    return res.status(500).json({ success: false, error: { message: error.message } })
  }
  if (!data) {
    return res.status(404).json({ success: false, error: { message: 'Cliente no encontrado' } })
  }
  res.json({ success: true, data: fromCliente(data) })
})

/* GET /api/crm/clientes/:id/comentarios — comentarios del cliente (más nuevos primero) */
router.get('/clientes/:id/comentarios', async (req, res) => {
  const { id } = req.params
  const { data, error } = await supabase
    .from('crm_comentarios')
    .select('*')
    .eq('cliente_id', id)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[crm/comentarios GET]', error.message)
    return res.status(500).json({ success: false, error: { message: error.message } })
  }
  res.json({ success: true, data: data || [] })
})

/* POST /api/crm/clientes/:id/comentarios — agrega un comentario al cliente */
router.post('/clientes/:id/comentarios', async (req, res) => {
  const { id } = req.params
  const { comentario } = req.body

  if (!comentario || !comentario.trim()) {
    return res.status(400).json({ success: false, error: { message: 'El comentario no puede estar vacío' } })
  }

  const registro = {
    cliente_id:     id,
    empresa_id:     req.user.empresa_id,
    usuario_id:     req.user.id,
    usuario_nombre: `${req.user.nombre} ${req.user.apellidos || ''}`.trim(),
    comentario:     comentario.trim(),
  }

  const { data, error } = await supabase
    .from('crm_comentarios')
    .insert(registro)
    .select()
    .maybeSingle()

  if (error) {
    console.error('[crm/comentarios POST]', error.message)
    return res.status(500).json({ success: false, error: { message: error.message } })
  }
  res.json({ success: true, data })
})

/* PATCH /api/crm/clientes/:id/comentarios/:comentarioId — edita un comentario (solo autor) */
router.patch('/clientes/:id/comentarios/:comentarioId', async (req, res) => {
  const { comentarioId } = req.params
  const { comentario } = req.body

  if (!comentario || !comentario.trim()) {
    return res.status(400).json({ success: false, error: { message: 'El comentario no puede estar vacío' } })
  }

  const { data: existente } = await supabase
    .from('crm_comentarios')
    .select('usuario_id')
    .eq('id', comentarioId)
    .maybeSingle()

  if (!existente) {
    return res.status(404).json({ success: false, error: { message: 'Comentario no encontrado' } })
  }
  if (existente.usuario_id !== req.user.id) {
    return res.status(403).json({ success: false, error: { message: 'Solo el autor puede editar este comentario' } })
  }

  const { data, error } = await supabase
    .from('crm_comentarios')
    .update({ comentario: comentario.trim(), editado_at: new Date().toISOString() })
    .eq('id', comentarioId)
    .select()
    .maybeSingle()

  if (error) {
    console.error('[crm/comentarios PATCH]', error.message)
    return res.status(500).json({ success: false, error: { message: error.message } })
  }
  res.json({ success: true, data })
})

/* DELETE /api/crm/clientes/:id/comentarios/:comentarioId — elimina un comentario (autor o admin) */
router.delete('/clientes/:id/comentarios/:comentarioId', async (req, res) => {
  const { comentarioId } = req.params

  const { data: existente } = await supabase
    .from('crm_comentarios')
    .select('usuario_id')
    .eq('id', comentarioId)
    .maybeSingle()

  if (!existente) {
    return res.status(404).json({ success: false, error: { message: 'Comentario no encontrado' } })
  }
  if (existente.usuario_id !== req.user.id && req.user.rol !== 'admin') {
    return res.status(403).json({ success: false, error: { message: 'Sin permisos para eliminar este comentario' } })
  }

  const { error } = await supabase
    .from('crm_comentarios')
    .delete()
    .eq('id', comentarioId)

  if (error) {
    console.error('[crm/comentarios DELETE]', error.message)
    return res.status(500).json({ success: false, error: { message: error.message } })
  }
  res.json({ success: true })
})

/* ── ETIQUETAS ──────────────────────────────────────────────────── */

router.get('/etiquetas', async (req, res) => {
  const { data, error } = await supabase
    .from('crm_etiquetas')
    .select('*')
    .eq('empresa_id', req.user.empresa_id)
    .order('nombre')
  if (error) return res.status(500).json({ success: false, error: { message: error.message } })
  res.json({ success: true, data: data || [] })
})

router.post('/etiquetas', async (req, res) => {
  const { nombre, color } = req.body
  if (!nombre?.trim() || !color) {
    return res.status(400).json({ success: false, error: { message: 'nombre y color requeridos' } })
  }
  const { data, error } = await supabase
    .from('crm_etiquetas')
    .insert({ empresa_id: req.user.empresa_id, nombre: nombre.trim(), color })
    .select()
    .single()
  if (error) return res.status(500).json({ success: false, error: { message: error.message } })
  res.json({ success: true, data })
})

router.patch('/etiquetas/:id', async (req, res) => {
  const { nombre, color } = req.body
  const updates = {}
  if (nombre !== undefined) updates.nombre = nombre.trim()
  if (color !== undefined) updates.color = color
  const { data, error } = await supabase
    .from('crm_etiquetas')
    .update(updates)
    .eq('id', req.params.id)
    .eq('empresa_id', req.user.empresa_id)
    .select()
    .single()
  if (error) return res.status(500).json({ success: false, error: { message: error.message } })
  res.json({ success: true, data })
})

router.delete('/etiquetas/:id', async (req, res) => {
  const { error } = await supabase
    .from('crm_etiquetas')
    .delete()
    .eq('id', req.params.id)
    .eq('empresa_id', req.user.empresa_id)
  if (error) return res.status(500).json({ success: false, error: { message: error.message } })
  res.json({ success: true })
})

router.post('/clientes/:id/etiquetas', async (req, res) => {
  const { etiqueta_id } = req.body
  if (!etiqueta_id) return res.status(400).json({ success: false, error: { message: 'etiqueta_id requerido' } })
  const { error } = await supabase
    .from('cliente_etiquetas')
    .insert({ cliente_id: req.params.id, etiqueta_id })
  if (error) return res.status(500).json({ success: false, error: { message: error.message } })
  res.json({ success: true })
})

router.delete('/clientes/:id/etiquetas/:etiquetaId', async (req, res) => {
  const { error } = await supabase
    .from('cliente_etiquetas')
    .delete()
    .eq('cliente_id', req.params.id)
    .eq('etiqueta_id', req.params.etiquetaId)
  if (error) return res.status(500).json({ success: false, error: { message: error.message } })
  res.json({ success: true })
})

/* POST /api/crm/sync-leads — importa los leads históricos de un formulario (solo admin) */
router.post('/sync-leads', requireAdmin, async (req, res) => {
  try {
    const { form_id } = req.body
    if (!form_id) return res.status(400).json({ error: 'form_id requerido' })

    const token = process.env.META_PAGE_ACCESS_TOKEN
    const empresaId = process.env.META_EMPRESA_ID

    const resultado = await syncFormLeads(form_id, token, empresaId)
    res.json({ success: true, ...resultado })
  } catch (err) {
    console.error('[sync-leads]', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
