const { Router } = require('express')
const { requireAuth } = require('../middleware/auth.js')
const supabase = require('../lib/supabase.js')

const router = Router()

const ESTADOS = ['nuevo', 'contactado', 'en_proceso', 'cerrado', 'perdido']

const fromCliente = (r) => ({
  id:            r.id,
  nombre:        r.nombre,
  email:         r.email,
  telefono:      r.telefono,
  mensaje:       r.mensaje,
  fuente:        r.fuente,
  fuenteDetalle: r.fuente_detalle,
  estado:        r.estado,
  createdAt:     r.created_at,
  updatedAt:     r.updated_at,
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

  console.log('[webhook-debug] token recibido:', JSON.stringify(token))
  console.log('[webhook-debug] token env:', JSON.stringify(process.env.META_VERIFY_TOKEN))
  console.log('[webhook-debug] son iguales:', token === process.env.META_VERIFY_TOKEN)

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

          const registro = {
            empresa_id:     process.env.META_EMPRESA_ID,
            nombre:         map.full_name || map.nombre || 'Sin nombre',
            email:          map.email || null,
            telefono:       map.phone_number || map.telefono || null,
            mensaje:        extraerMensaje(map),
            fuente:         'meta_leads',
            fuente_detalle: formName || formId || null,
            estado:         'nuevo',
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

/* ═══════════════════════════════════════════════════════════════
 * RUTAS AUTENTICADAS
 * ═════════════════════════════════════════════════════════════ */

router.use(requireAuth)

/* GET /api/crm/clientes — lista los clientes de la empresa */
router.get('/clientes', async (req, res) => {
  const empresaId = req.user.empresa_id
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[crm/clientes GET]', error.message)
    return res.status(500).json({ success: false, error: { message: error.message } })
  }
  res.json({ success: true, data: (data || []).map(fromCliente) })
})

/* PATCH /api/crm/clientes/:id — actualiza el estado de un cliente */
router.patch('/clientes/:id', async (req, res) => {
  const empresaId = req.user.empresa_id
  const { id } = req.params
  const { estado } = req.body

  if (!ESTADOS.includes(estado)) {
    return res.status(400).json({ success: false, error: { message: 'Estado inválido' } })
  }

  const { data, error } = await supabase
    .from('clientes')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .select()
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

module.exports = router
