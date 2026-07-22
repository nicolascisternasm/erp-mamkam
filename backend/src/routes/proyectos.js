const { Router } = require('express')
const supabase = require('../lib/supabase.js')
const { requireAuth } = require('../middleware/auth.js')

const router = Router()
router.use(requireAuth)

const fromTarea = (r) => ({
  id:                r.id,
  nombre:            r.nombre,
  descripcion:       r.descripcion,
  fase:              r.fase,
  fechaInicio:       r.fecha_inicio,
  fechaFin:          r.fecha_fin,
  responsableId:     r.responsable_id,
  responsableNombre: r.responsable_nombre,
  estado:            r.estado,
  orden:             r.orden,
  creadoEn:          r.creado_en,
})

const fromProyecto = (r) => ({
  id: r.id,
  codigo: r.codigo,
  nombre: r.nombre,
  descripcion: r.descripcion,
  cliente: r.cliente,
  responsableId: r.responsable_id,
  responsableNombre: r.responsable_nombre,
  estado: r.estado,
  porcentajeAvance: r.porcentaje_avance ?? 0,
  fechaInicioEst: r.fecha_inicio_est,
  fechaFinEst: r.fecha_fin_est,
  fechaInicioReal: r.fecha_inicio_real,
  fechaFinReal: r.fecha_fin_real,
  creadoEn: r.creado_en,
  calculadoraPdfUrl:    r.calculadora_pdf_url    ?? null,
  calculadoraPdfNombre: r.calculadora_pdf_nombre ?? null,
  analisisIa:           r.analisis_ia            ?? null,
  analisisIaFecha:      r.analisis_ia_fecha      ?? null,
  chatIa:               r.chat_ia                ?? [],
})

/* ── GET /api/proyectos ─────────────────────────────────────────── */

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('proyectos')
      .select('*')
      .eq('empresa_id', req.user.empresa_id)
      .neq('estado', 'eliminado')
      .order('fecha_inicio_est', { ascending: false })
    if (error) throw error

    const ids = (data || []).map((p) => p.id)
    let vencidasSet = new Set()
    if (ids.length > 0) {
      const today = new Date().toISOString().slice(0, 10)
      const { data: vencidas } = await supabase
        .from('proyecto_tareas')
        .select('proyecto_id')
        .in('proyecto_id', ids)
        .lt('fecha_fin', today)
        .neq('estado', 'completada')
      vencidasSet = new Set((vencidas || []).map((t) => t.proyecto_id))
    }

    // Enriquecer con datos financieros
    const financieroMap = {}
    if (ids.length > 0) {
      try {
        const [{ data: proyectoCots }, { data: proyectoOCs }, { data: proyectoGastos }] = await Promise.all([
          supabase.from('proyecto_cotizaciones').select('proyecto_id, cotizacion_id').in('proyecto_id', ids),
          supabase.from('proyecto_oc').select('proyecto_id, oc_id').in('proyecto_id', ids),
          supabase.from('proyecto_gastos').select('proyecto_id, gasto_id').in('proyecto_id', ids),
        ])

        const cotIds   = (proyectoCots   || []).map((r) => r.cotizacion_id)
        const ocIds    = (proyectoOCs    || []).map((r) => r.oc_id)
        const gastoIds = [...new Set((proyectoGastos || []).map((r) => r.gasto_id).filter(Boolean))]

        const [{ data: cotizaciones }, { data: ocs }] = await Promise.all([
          cotIds.length > 0
            ? supabase.from('cotizaciones').select('id, numero, cliente, condiciones_pago, iva').in('id', cotIds)
            : Promise.resolve({ data: [] }),
          ocIds.length > 0
            ? supabase.from('compras').select('id, monto, comprobantes').in('id', ocIds)
            : Promise.resolve({ data: [] }),
        ])

        let gastosData = []
        if (gastoIds.length > 0) {
          const { data } = await supabase.from('gastos').select('id, monto').in('id', gastoIds)
          gastosData = data || []
        }

        const cotMap   = {}
        ;(cotizaciones || []).forEach((c) => { cotMap[c.id] = c })
        const ocMap    = {}
        ;(ocs || []).forEach((o) => { ocMap[o.id] = o })
        const gastoMap = {}
        ;(gastosData || []).forEach((g) => { gastoMap[g.id] = g })

        // Ids de todas las condiciones de pago para cruzar con movimientos
        const condicionIds = []
        ;(cotizaciones || []).forEach((cot) => {
          ;(cot.condiciones_pago || []).forEach((cp) => {
            if (cp.id != null) condicionIds.push(String(cp.id))
          })
        })

        let movsCobros = []
        if (condicionIds.length > 0) {
          const { data: movsData } = await supabase
            .from('movimientos')
            .select('gasto_id, monto, gasto_descripcion')
            .in('gasto_id', condicionIds)
            .eq('empresa_id', req.user.empresa_id)
          movsCobros = movsData || []
        }

        ids.forEach((proyId) => {
          const misCots = (proyectoCots || []).filter((r) => r.proyecto_id === proyId)
          let cobrado = 0, porCobrar = 0, iva = 0, totalAcordado = 0
          const condicionIdsDelProyecto = []
          const numerosCotizacion = []
          misCots.forEach((rel) => {
            const cot = cotMap[rel.cotizacion_id]
            if (!cot) return
            iva += cot.iva || 0
            if (cot.numero != null) numerosCotizacion.push(String(cot.numero))
            ;(cot.condiciones_pago || []).forEach((cp) => {
              totalAcordado += cp.monto || 0
              if (cp.id != null) condicionIdsDelProyecto.push(String(cp.id))
            })
          })
          const movsDelProyecto = movsCobros.filter((m) =>
            condicionIdsDelProyecto.includes(m.gasto_id) &&
            numerosCotizacion.some((num) => (m.gasto_descripcion || '').includes(num))
          )
          cobrado = movsDelProyecto.reduce((s, m) => s + (m.monto || 0), 0)
          porCobrar = Math.max(0, totalAcordado - cobrado)

          const misOCs = (proyectoOCs || []).filter((r) => r.proyecto_id === proyId)
          let pagado = 0, porPagar = 0
          misOCs.forEach((rel) => {
            const oc = ocMap[rel.oc_id]
            if (!oc) return
            const monto = oc.monto || 0
            const tieneMovimiento = (oc.comprobantes || []).some((c) => c.movimiento_id)
            if (tieneMovimiento) pagado += monto
            else porPagar += monto
          })

          const misGastos = (proyectoGastos || []).filter((r) => r.proyecto_id === proyId)
          let gastos = 0
          misGastos.forEach((rel) => {
            const g = gastoMap[rel.gasto_id]
            if (g) gastos += g.monto || 0
          })

          const cotizacionesDelProy = misCots
            .map((rel) => cotMap[rel.cotizacion_id])
            .filter(Boolean)
            .map((cot) => ({ id: cot.id, numero: cot.numero, nombre: cot.cliente }))

          financieroMap[proyId] = { cobrado, porCobrar, pagado, porPagar, iva, gastos, cotizaciones: cotizacionesDelProy }
        })
      } catch (e) {
        console.warn('[proyectos GET financiero]', e.message)
      }
    }

    res.json({
      success: true,
      data: (data || []).map((p) => ({
        ...fromProyecto(p),
        tieneTareasVencidas: vencidasSet.has(p.id),
        financiero: financieroMap[p.id] ?? { cobrado: 0, porCobrar: 0, pagado: 0, porPagar: 0 },
      })),
    })
  } catch (err) {
    console.error('[proyectos GET]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── GET /api/proyectos/gastos-asignados ────────────────────────── */

router.get('/gastos-asignados', async (req, res) => {
  try {
    const { data: proyIds, error: e1 } = await supabase
      .from('proyectos')
      .select('id')
      .eq('empresa_id', req.user.empresa_id)
    if (e1) throw e1
    if (!proyIds?.length) return res.json({ success: true, data: [] })
    const { data, error } = await supabase
      .from('proyecto_gastos')
      .select('gasto_id')
      .in('proyecto_id', proyIds.map((p) => p.id))
    if (error) throw error
    res.json({ success: true, data: (data || []).map((r) => r.gasto_id) })
  } catch (err) {
    console.error('[proyectos GET gastos-asignados]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── GET /api/proyectos/planificacion ───────────────────────────── */

router.get('/planificacion', async (req, res) => {
  try {
    const { data: proyData, error: eProys } = await supabase
      .from('proyectos')
      .select('id, nombre, codigo, cliente, estado, fecha_inicio_est, fecha_fin_est, fecha_inicio_real, fecha_fin_real, porcentaje_avance')
      .eq('empresa_id', req.user.empresa_id)
      .neq('estado', 'eliminado')
      .order('fecha_inicio_est', { ascending: true })
    if (eProys) throw eProys

    const proyectos = (proyData || []).map(fromProyecto)
    const proyMap = {}
    proyectos.forEach((p) => { proyMap[p.id] = { nombre: p.nombre, cliente: p.cliente } })

    const proyIds = proyectos.map((p) => p.id)
    let tareas = []
    if (proyIds.length > 0) {
      const { data: tareasData, error: eTareas } = await supabase
        .from('proyecto_tareas')
        .select('*')
        .in('proyecto_id', proyIds)
        .order('fecha_inicio', { ascending: true })
      if (eTareas) throw eTareas

      const tareasRaw = tareasData || []
      const respIds = [...new Set(tareasRaw.map((t) => t.responsable_id).filter(Boolean))]
      let userMap = {}
      if (respIds.length > 0) {
        const { data: users } = await supabase.from('usuarios').select('id, nombre').in('id', respIds)
        if (users) users.forEach((u) => { userMap[u.id] = u.nombre })
      }

      tareas = tareasRaw.map((t) => ({
        ...fromTarea({ ...t, responsable_nombre: t.responsable_nombre || userMap[t.responsable_id] || null }),
        proyectoId:      t.proyecto_id,
        proyectoNombre:  proyMap[t.proyecto_id]?.nombre ?? '—',
        cliente:         proyMap[t.proyecto_id]?.cliente ?? null,
        porcentajeAvance: t.porcentaje_avance ?? null,
      }))
    }

    res.json({ success: true, data: { proyectos, tareas } })
  } catch (err) {
    console.error('[proyectos GET planificacion]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── GET /api/proyectos/:id ─────────────────────────────────────── */

router.get('/:id', async (req, res) => {
  const { id } = req.params
  try {
    const [{ data: proyecto, error: eProyecto }, { data: cots }, { data: trabs }, { data: ocs }, { data: gastos }, { data: tareas }] =
      await Promise.all([
        supabase.from('proyectos').select('*').eq('id', id).eq('empresa_id', req.user.empresa_id).single(),
        supabase.from('proyecto_cotizaciones').select('*').eq('proyecto_id', id),
        supabase.from('proyecto_trabajadores').select('*').eq('proyecto_id', id),
        supabase.from('proyecto_oc').select('*').eq('proyecto_id', id),
        supabase.from('proyecto_gastos').select('*').eq('proyecto_id', id),
        supabase.from('proyecto_tareas').select('*').eq('proyecto_id', id).order('orden', { ascending: true }),
      ])
    if (eProyecto) throw eProyecto

    // Enriquecer tareas con nombre de responsable vía JOIN a usuarios
    const tareasList = tareas || []
    const respIds = [...new Set(tareasList.map((t) => t.responsable_id).filter(Boolean))]
    let userMap = {}
    if (respIds.length > 0) {
      const { data: users } = await supabase.from('usuarios').select('id, nombre').in('id', respIds)
      if (users) users.forEach((u) => { userMap[u.id] = u.nombre })
    }

    res.json({
      success: true,
      data: {
        ...fromProyecto(proyecto),
        cotizacionIds: (cots || []).map((r) => r.cotizacion_id),
        trabajadorIds: (trabs || []).map((r) => ({ trabajadorId: r.trabajador_id, rol: r.rol })),
        ocIds: (ocs || []).map((r) => r.oc_id),
        gastoIds: (gastos || []).map((r) => r.gasto_id),
        tareas: tareasList.map((t) => fromTarea({ ...t, responsable_nombre: userMap[t.responsable_id] || null })),
      },
    })
  } catch (err) {
    console.error('[proyectos GET :id]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── POST /api/proyectos ────────────────────────────────────────── */

router.post('/', async (req, res) => {
  const { nombre, descripcion, cliente, responsable_id, fecha_inicio_est, fecha_fin_est, cotizacion_ids, trabajador_ids } = req.body
  try {
    // Generar código automático PROY-YYYY-NNN
    const year = new Date().getFullYear()
    const prefix = `PROY-${year}-`
    const { data: existing } = await supabase
      .from('proyectos')
      .select('codigo')
      .eq('empresa_id', req.user.empresa_id)
      .like('codigo', `${prefix}%`)
      .order('codigo', { ascending: false })
      .limit(1)

    let nextNum = 1
    if (existing && existing.length > 0) {
      const last = existing[0].codigo
      const parts = last.split('-')
      const lastNum = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(lastNum)) nextNum = lastNum + 1
    }
    const codigo = `${prefix}${String(nextNum).padStart(3, '0')}`

    const { data: proyecto, error: eInsert } = await supabase
      .from('proyectos')
      .insert({
        empresa_id: req.user.empresa_id,
        codigo,
        nombre,
        descripcion,
        cliente,
        responsable_id: responsable_id != null ? String(responsable_id) : null,
        fecha_inicio_est,
        fecha_fin_est,
        estado: 'borrador',
        porcentaje_avance: 0,
      })
      .select('*')
      .single()
    if (eInsert) throw eInsert

    // Asociar cotizaciones
    if (cotizacion_ids && cotizacion_ids.length > 0) {
      await supabase.from('proyecto_cotizaciones').insert(
        cotizacion_ids.map((cid) => ({ proyecto_id: proyecto.id, cotizacion_id: cid }))
      )
    }

    // Asociar trabajadores
    if (trabajador_ids && trabajador_ids.length > 0) {
      await supabase.from('proyecto_trabajadores').insert(
        trabajador_ids.map((tid) => ({ proyecto_id: proyecto.id, trabajador_id: tid }))
      )
    }

    res.status(201).json({ success: true, data: fromProyecto(proyecto) })
  } catch (err) {
    console.error('[proyectos POST]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── PATCH /api/proyectos/:id ───────────────────────────────────── */

router.patch('/:id', async (req, res) => {
  const { id } = req.params
  const { nombre, descripcion, cliente, responsable_id, fecha_inicio_est, fecha_fin_est,
          calculadora_pdf_url, calculadora_pdf_nombre } = req.body
  try {
    const updates = {}
    if (nombre !== undefined) updates.nombre = nombre
    if (descripcion !== undefined) updates.descripcion = descripcion
    if (cliente !== undefined) updates.cliente = cliente
    if (responsable_id !== undefined) updates.responsable_id = responsable_id != null ? String(responsable_id) : null
    if (fecha_inicio_est !== undefined) updates.fecha_inicio_est = fecha_inicio_est
    if (fecha_fin_est !== undefined) updates.fecha_fin_est = fecha_fin_est
    if (calculadora_pdf_url !== undefined) updates.calculadora_pdf_url = calculadora_pdf_url
    if (calculadora_pdf_nombre !== undefined) updates.calculadora_pdf_nombre = calculadora_pdf_nombre

    const { data, error } = await supabase
      .from('proyectos')
      .update(updates)
      .eq('id', id)
      .eq('empresa_id', req.user.empresa_id)
      .select('*')
      .single()
    if (error) throw error
    res.json({ success: true, data: fromProyecto(data) })
  } catch (err) {
    console.error('[proyectos PATCH]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── DELETE /api/proyectos/:id ──────────────────────────────────── */

router.delete('/:id', async (req, res) => {
  const { id } = req.params
  try {
    const { data, error } = await supabase
      .from('proyectos')
      .update({ estado: 'cancelado' })
      .eq('id', id)
      .eq('empresa_id', req.user.empresa_id)
      .select('*')
      .single()
    if (error) throw error
    res.json({ success: true, data: fromProyecto(data) })
  } catch (err) {
    console.error('[proyectos DELETE]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── POST /api/proyectos/:id/cotizaciones ───────────────────────── */

router.post('/:id/cotizaciones', async (req, res) => {
  const { id } = req.params
  const { cotizacion_id } = req.body
  try {
    const { data, error } = await supabase
      .from('proyecto_cotizaciones')
      .insert({ proyecto_id: id, cotizacion_id })
      .select('*')
      .single()
    if (error) throw error
    res.status(201).json({ success: true, data })
  } catch (err) {
    console.error('[proyectos POST cotizaciones]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── DELETE /api/proyectos/:id/cotizaciones/:cotizacion_id ──────── */

router.delete('/:id/cotizaciones/:cotizacion_id', async (req, res) => {
  const { id, cotizacion_id } = req.params
  try {
    const { error } = await supabase
      .from('proyecto_cotizaciones')
      .delete()
      .eq('proyecto_id', id)
      .eq('cotizacion_id', cotizacion_id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('[proyectos DELETE cotizaciones]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── POST /api/proyectos/:id/oc ─────────────────────────────────── */

router.post('/:id/oc', async (req, res) => {
  const { id } = req.params
  const { oc_id } = req.body
  try {
    const { data, error } = await supabase
      .from('proyecto_oc')
      .insert({ proyecto_id: id, oc_id })
      .select('*')
      .single()
    if (error) throw error
    res.status(201).json({ success: true, data })
  } catch (err) {
    console.error('[proyectos POST oc]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── DELETE /api/proyectos/:id/oc/:oc_id ───────────────────────── */

router.delete('/:id/oc/:oc_id', async (req, res) => {
  const { id, oc_id } = req.params
  try {
    const { error } = await supabase
      .from('proyecto_oc')
      .delete()
      .eq('proyecto_id', id)
      .eq('oc_id', oc_id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('[proyectos DELETE oc]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── POST /api/proyectos/:id/trabajadores ───────────────────────── */

router.post('/:id/trabajadores', async (req, res) => {
  const { id } = req.params
  const { trabajador_id, rol } = req.body
  try {
    const { data, error } = await supabase
      .from('proyecto_trabajadores')
      .insert({ proyecto_id: id, trabajador_id, rol: rol || null })
      .select('*')
      .single()
    if (error) throw error
    res.status(201).json({ success: true, data })
  } catch (err) {
    console.error('[proyectos POST trabajadores]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── DELETE /api/proyectos/:id/trabajadores/:trabajador_id ──────── */

router.delete('/:id/trabajadores/:trabajador_id', async (req, res) => {
  const { id, trabajador_id } = req.params
  try {
    const { error } = await supabase
      .from('proyecto_trabajadores')
      .delete()
      .eq('proyecto_id', id)
      .eq('trabajador_id', trabajador_id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('[proyectos DELETE trabajadores]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── PATCH /api/proyectos/:id/estado ────────────────────────────── */

router.patch('/:id/estado', async (req, res) => {
  const { id } = req.params
  const { estado } = req.body
  try {
    const { data, error } = await supabase
      .from('proyectos')
      .update({ estado })
      .eq('id', id)
      .eq('empresa_id', req.user.empresa_id)
      .select('*')
      .single()
    if (error) throw error
    res.json({ success: true, data: fromProyecto(data) })
  } catch (err) {
    console.error('[proyectos PATCH estado]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── PATCH /api/proyectos/:id/avance ────────────────────────────── */

router.patch('/:id/avance', async (req, res) => {
  const { id } = req.params
  const { porcentaje_avance } = req.body
  try {
    const { data, error } = await supabase
      .from('proyectos')
      .update({ porcentaje_avance })
      .eq('id', id)
      .eq('empresa_id', req.user.empresa_id)
      .select('*')
      .single()
    if (error) throw error
    res.json({ success: true, data: fromProyecto(data) })
  } catch (err) {
    console.error('[proyectos PATCH avance]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── POST /api/proyectos/:id/tareas ─────────────────────────────── */

router.post('/:id/tareas', async (req, res) => {
  const { id } = req.params
  const { nombre, descripcion, fase, fecha_inicio, fecha_fin, responsable_id, estado, orden } = req.body
  if (!nombre?.trim() || !fecha_fin) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'nombre y fecha_fin son requeridos' } })
  }
  try {
    const { data, error } = await supabase
      .from('proyecto_tareas')
      .insert({
        proyecto_id: id,
        nombre: nombre.trim(),
        descripcion: descripcion || null,
        fase: fase || null,
        fecha_inicio: fecha_inicio || null,
        fecha_fin,
        responsable_id: responsable_id || null,
        estado: estado || 'pendiente',
        orden: orden ?? null,
      })
      .select('*')
      .single()
    if (error) throw error

    // Obtener nombre del responsable vía JOIN a usuarios
    let responsableNombre = null
    if (data.responsable_id) {
      const { data: user } = await supabase.from('usuarios').select('nombre').eq('id', data.responsable_id).single()
      responsableNombre = user?.nombre || null
    }

    res.status(201).json({ success: true, data: fromTarea({ ...data, responsable_nombre: responsableNombre }) })
  } catch (err) {
    console.error('[proyectos POST tareas]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── PATCH /api/proyectos/:id/tareas/:tarea_id ───────────────────── */

router.patch('/:id/tareas/:tarea_id', async (req, res) => {
  const { tarea_id } = req.params
  const allowed = ['nombre', 'descripcion', 'fase', 'fecha_inicio', 'fecha_fin', 'responsable_id', 'estado', 'orden']
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)))
  try {
    const { data, error } = await supabase
      .from('proyecto_tareas')
      .update(updates)
      .eq('id', tarea_id)
      .select('*')
      .single()
    if (error) throw error

    // Obtener nombre del responsable vía JOIN a usuarios
    let responsableNombre = null
    if (data.responsable_id) {
      const { data: user } = await supabase.from('usuarios').select('nombre').eq('id', data.responsable_id).single()
      responsableNombre = user?.nombre || null
    }

    res.json({ success: true, data: fromTarea({ ...data, responsable_nombre: responsableNombre }) })
  } catch (err) {
    console.error('[proyectos PATCH tarea]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── DELETE /api/proyectos/:id/tareas/:tarea_id ──────────────────── */

router.delete('/:id/tareas/:tarea_id', async (req, res) => {
  const { tarea_id } = req.params
  try {
    const { error } = await supabase
      .from('proyecto_tareas')
      .delete()
      .eq('id', tarea_id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('[proyectos DELETE tarea]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── POST /api/proyectos/:id/gastos ─────────────────────────────── */

router.post('/:id/gastos', async (req, res) => {
  const { id } = req.params
  const { gasto_ids } = req.body
  try {
    if (!gasto_ids || !gasto_ids.length) {
      return res.json({ success: true, data: [] })
    }
    const rows = gasto_ids.map((gid) => ({ proyecto_id: id, gasto_id: gid }))
    const { data, error } = await supabase
      .from('proyecto_gastos')
      .insert(rows)
      .select('*')
    if (error) throw error
    res.status(201).json({ success: true, data })
  } catch (err) {
    console.error('[proyectos POST gastos]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── DELETE /api/proyectos/:id/gastos/:gasto_id ─────────────────── */

router.delete('/:id/gastos/:gasto_id', async (req, res) => {
  const { id, gasto_id } = req.params
  try {
    const { error } = await supabase
      .from('proyecto_gastos')
      .delete()
      .eq('proyecto_id', id)
      .eq('gasto_id', gasto_id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('[proyectos DELETE gastos]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── POST /api/proyectos/:id/bitacora ───────────────────────────── */

router.post('/:id/bitacora', async (req, res) => {
  const { id } = req.params
  const { contenido, tipo, archivos } = req.body
  try {
    const { data, error } = await supabase
      .from('proyecto_bitacora')
      .insert({
        proyecto_id: id,
        usuario_id: req.user.id,
        usuario_nombre: req.user.nombre || req.user.email || null,
        contenido,
        tipo: tipo || 'nota',
        archivos: archivos ?? [],
      })
      .select('*')
      .single()
    if (error) throw error
    res.status(201).json({ success: true, data })
  } catch (err) {
    console.error('[proyectos POST bitacora]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── GET /api/proyectos/:id/bitacora ────────────────────────────── */

router.get('/:id/bitacora', async (req, res) => {
  const { id } = req.params
  try {
    const { data, error } = await supabase
      .from('proyecto_bitacora')
      .select('*')
      .eq('proyecto_id', id)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ success: true, data: data || [] })
  } catch (err) {
    console.error('[proyectos GET bitacora]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── PATCH /api/proyectos/:id/bitacora/:entradaId ───────────────── */

router.patch('/:id/bitacora/:entradaId', async (req, res) => {
  const { id, entradaId } = req.params
  const { contenido, tipo } = req.body
  try {
    const { data: entrada, error: fetchErr } = await supabase
      .from('proyecto_bitacora')
      .select('usuario_id')
      .eq('id', entradaId)
      .eq('proyecto_id', id)
      .single()
    if (fetchErr || !entrada) return res.status(404).json({ success: false, error: { message: 'Registro no encontrado' } })
    if (entrada.usuario_id !== req.user.id && req.user.rol !== 'admin') {
      return res.status(403).json({ success: false, error: { message: 'Sin permiso para editar este registro' } })
    }
    const { data, error } = await supabase
      .from('proyecto_bitacora')
      .update({ contenido, tipo })
      .eq('id', entradaId)
      .select('*')
      .single()
    if (error) throw error
    res.json({ success: true, data })
  } catch (err) {
    console.error('[proyectos PATCH bitacora]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── DELETE /api/proyectos/:id/bitacora/:entradaId ──────────────── */

router.delete('/:id/bitacora/:entradaId', async (req, res) => {
  const { id, entradaId } = req.params
  try {
    const { data: entrada, error: fetchErr } = await supabase
      .from('proyecto_bitacora')
      .select('usuario_id')
      .eq('id', entradaId)
      .eq('proyecto_id', id)
      .single()
    if (fetchErr || !entrada) return res.status(404).json({ success: false, error: { message: 'Registro no encontrado' } })
    if (entrada.usuario_id !== req.user.id && req.user.rol !== 'admin') {
      return res.status(403).json({ success: false, error: { message: 'Sin permiso para eliminar este registro' } })
    }
    const { error } = await supabase.from('proyecto_bitacora').delete().eq('id', entradaId)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('[proyectos DELETE bitacora]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── DELETE /api/proyectos/:id ──────────────────────────────────── */

router.delete('/:id', async (req, res) => {
  const { id } = req.params
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ success: false, error: { message: 'Solo administradores pueden eliminar proyectos' } })
  }
  try {
    // Verificar que el proyecto pertenece a la empresa
    const { data: proyecto, error: fetchErr } = await supabase
      .from('proyectos')
      .select('id')
      .eq('id', id)
      .eq('empresa_id', req.user.empresa_id)
      .single()
    if (fetchErr || !proyecto) return res.status(404).json({ success: false, error: { message: 'Proyecto no encontrado' } })

    // Eliminar registros relacionados (CASCADE puede manejar el resto)
    await supabase.from('proyecto_bitacora').delete().eq('proyecto_id', id)
    await supabase.from('proyecto_tareas').delete().eq('proyecto_id', id)
    await supabase.from('proyecto_cotizaciones').delete().eq('proyecto_id', id)
    await supabase.from('proyecto_trabajadores').delete().eq('proyecto_id', id)
    await supabase.from('proyecto_oc').delete().eq('proyecto_id', id)
    await supabase.from('proyecto_gastos').delete().eq('proyecto_id', id)

    const { error } = await supabase.from('proyectos').delete().eq('id', id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('[proyectos DELETE :id]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── POST /api/proyectos/:id/analizar ───────────────────────────── */

router.post('/:id/analizar', async (req, res) => {
  try {
    const { id } = req.params
    console.log('[Analisis] Iniciando para proyecto:', id)

    const { data: proyecto, error: eProyecto } = await supabase
      .from('proyectos').select('*').eq('id', id).single()
    if (eProyecto) throw eProyecto
    console.log('[Analisis] PDF URL:', proyecto.calculadora_pdf_url)
    if (!proyecto.calculadora_pdf_url) {
      return res.status(400).json({ success: false, error: { code: 'NO_PDF', message: 'No hay PDF de calculadora cargado' } })
    }

    // PROBLEMA 1: proyecto_tareas es la tabla directa, sin join
    const { data: tareasFlat } = await supabase
      .from('proyecto_tareas').select('*').eq('proyecto_id', id)

    // PROBLEMA 2: proyecto_oc solo tiene oc_id; datos reales en compras
    const { data: proyOcs } = await supabase
      .from('proyecto_oc').select('oc_id').eq('proyecto_id', id)
    const ocIds = (proyOcs || []).map((r) => r.oc_id).filter(Boolean)
    let ocsFlat = []
    if (ocIds.length > 0) {
      const { data: comprasData } = await supabase
        .from('compras').select('id, numero, proveedor, monto, estado, items, fecha').in('id', ocIds)
      ocsFlat = comprasData || []
    }

    // proyecto_gastos solo tiene gasto_id; datos reales en gastos
    const { data: proyGastos } = await supabase
      .from('proyecto_gastos').select('gasto_id').eq('proyecto_id', id)
    const gastoIds = (proyGastos || []).map((r) => r.gasto_id).filter(Boolean)
    let gastosFlat = []
    if (gastoIds.length > 0) {
      const { data: gastosData } = await supabase
        .from('gastos').select('id, descripcion, monto, categoria, fecha').in('id', gastoIds)
      gastosFlat = gastosData || []
    }

    console.log('[Analisis] Datos BD - OCs:', ocsFlat.length, '| Gastos:', gastosFlat.length, '| Tareas:', tareasFlat?.length ?? 0)

    const pdfResponse = await fetch(proyecto.calculadora_pdf_url)
    if (!pdfResponse.ok) throw new Error(`No se pudo descargar el PDF (HTTP ${pdfResponse.status})`)
    const pdfBuffer = await pdfResponse.arrayBuffer()
    console.log('[Analisis] PDF descargado, tamaño:', pdfBuffer.byteLength, 'bytes')
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64')

    console.log('[Analisis] Cargando @anthropic-ai/sdk...')
    const Anthropic = require('@anthropic-ai/sdk')
    console.log('[Analisis] SDK cargado, tipo Anthropic.default:', typeof Anthropic.default)
    const client    = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY })
    console.log('[Analisis] Cliente creado, ANTHROPIC_API_KEY presente:', !!process.env.ANTHROPIC_API_KEY)

    const completadas = (tareasFlat || []).filter((t) => t.estado === 'completada').length

    // PROBLEMA 3: prompt con datos completos y detallados
    const prompt = `Eres un analista financiero experto en proyectos.
Analiza el PDF adjunto que es una calculadora de costos de proyecto.

El PDF tiene esta estructura específica:
- COSTOS DE MATERIALES: tabla con productos, $/KG, KG y Total Neto
  * "TOTAL NETO materiales" = suma neta de materiales SIN IVA
  * "TOTAL BRUTO" = total materiales CON IVA (no usar este para presupuesto)
- COSTOS OPERATIVOS: tabla con conceptos como ayudantes, flete, viáticos
  * "TOTAL OPERATIVO" = suma de todos los costos operativos
- RESUMEN FINANCIERO al final:
  * "Neto venta" = precio de venta al cliente
  * "Costos materiales" = costo neto materiales (mismo que TOTAL NETO materiales)
  * "Costos operativos" = costos operativos (mismo que TOTAL OPERATIVO)
  * "Total costos" = materiales + operativos
  * "Utilidad bruta" y "Utilidad neta" = ganancias

DATOS ACTUALES DEL PROYECTO:
- Nombre: ${proyecto.nombre}
- Estado: ${proyecto.estado}

ÓRDENES DE COMPRA (${ocsFlat.length} OC):
${ocsFlat.map((o) => {
      const items = (o.items || []).map((i) =>
        `    * ${i.descripcion || i.producto || i.nombre} x${i.cantidad} @ $${i.precio_unitario || i.precio}`
      ).join('\n')
      return `- ${o.numero} | ${o.proveedor} | $${o.monto} | ${o.estado}\n${items}`
    }).join('\n')}

GASTOS DE TERRENO (${gastosFlat.length} gastos):
Total: $${gastosFlat.reduce((s, g) => s + (g.monto || 0), 0)}
${gastosFlat.map((g) => `- ${g.descripcion} | $${g.monto} | ${g.fecha}`).join('\n')}

TAREAS (${(tareasFlat || []).length}):
${(tareasFlat || []).map((t) => `- ${t.nombre} | ${t.estado}`).join('\n')}

INSTRUCCIONES PARA EL JSON:
- presupuesto_total: usar el valor "Neto venta" del PDF (precio al cliente)
- Para "materiales.presupuestados": leer cada fila de COSTOS DE MATERIALES con su cantidad en KG y costo unitario $/KG
- gastado_oc: suma de monto de todas las OC
- gastado_terreno: suma de gastos de terreno
- disponible: presupuesto_total - gastado_oc - gastado_terreno
- porcentaje_ejecutado: (gastado_oc + gastado_terreno) / presupuesto_total * 100
- En alertas comparar materiales presupuestados en PDF vs OCs creadas
- presupuesto_materiales: valor "Costos materiales" del PDF (TOTAL NETO materiales)
- presupuesto_operativo: valor "Total operativo" del PDF (TOTAL OPERATIVO)

Responde ÚNICAMENTE con JSON válido, sin texto adicional ni backticks:
{
  "resumen_ejecutivo": "texto",
  "estado_financiero": {
    "presupuesto_total": número,
    "presupuesto_materiales": número,
    "presupuesto_operativo": número,
    "gastado_oc": número,
    "gastado_terreno": número,
    "disponible": número,
    "porcentaje_ejecutado": número
  },
  "materiales": {
    "presupuestados": [{"nombre":"...","cantidad":0,"costo_unitario":0,"total":0}],
    "comprados": [{"nombre":"...","monto_oc":0}],
    "pendientes": [{"nombre":"...","estimado":0}]
  },
  "alertas": [{"tipo":"warning|danger|ok","mensaje":"..."}],
  "recomendaciones": ["..."],
  "avance_proyecto": {
    "tareas_total": número,
    "tareas_completadas": número,
    "porcentaje": número
  }
}`

    console.log('[Analisis] Llamando a Anthropic (modelo: claude-haiku-4-5-20251001)...')
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 }
          },
          { type: 'text', text: prompt }
        ]
      }]
    })
    console.log('[Analisis] Respuesta IA recibida, stop_reason:', response.stop_reason)

    const texto     = response.content[0].text
    console.log('[Analisis] Texto respuesta (primeros 200 chars):', texto.slice(0, 200))
    const jsonMatch = texto.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('La IA no devolvió un JSON válido')
    const analisis = JSON.parse(jsonMatch[0])
    console.log('[Analisis] JSON parseado OK, claves:', Object.keys(analisis).join(', '))

    const { error: eUpdate } = await supabase.from('proyectos').update({
      analisis_ia:      analisis,
      analisis_ia_fecha: new Date().toISOString()
    }).eq('id', id)
    if (eUpdate) throw eUpdate
    console.log('[Analisis] Guardado en BD correctamente')

    res.json({ data: { analisis, fecha: new Date().toISOString() } })
  } catch (err) {
    console.error('[Analisis] ERROR:', err.message)
    console.error('[Analisis] STACK:', err.stack)
    res.status(500).json({ success: false, error: { code: 'ANALISIS_ERROR', message: err.message } })
  }
})

/* ── Helper: genera contexto enriquecido del proyecto para ARIA ─── */

async function generarContextoProyecto(proyecto, tareasFlat, ocsFlat, gastosFlat, pdfBase64, anthropicClient) {
  console.log('[Contexto] pdfBase64 existe:', !!pdfBase64, 'largo:', pdfBase64?.length)
  const analisis = proyecto.analisis_ia || {}
  const ef = analisis.estado_financiero || {}

  const tareasResumen = (tareasFlat || []).map((t) =>
    `- ${t.nombre} [${t.estado}]`
  ).join('\n') || 'Sin tareas'

  const ocsResumen = ocsFlat.map((oc) => {
    const items = (oc.items || []).map((i) =>
      `${i.cantidad || ''} ${i.descripcion || i.nombre || ''}`.trim()
    ).join(', ')
    return `- ${oc.numero} | ${oc.proveedor} | $${(oc.monto || 0).toLocaleString('es-CL')} | ${oc.estado} | Items: ${items}`
  }).join('\n') || 'Sin OCs'

  const gastosResumen = gastosFlat.map((g) =>
    `- ${g.descripcion} | $${(g.monto || 0).toLocaleString('es-CL')} | ${g.categoria}`
  ).join('\n') || 'Sin gastos'

  const alertasResumen = (analisis.alertas || []).map((a) =>
    `[${a.tipo?.toUpperCase()}] ${a.mensaje}`
  ).join('\n') || 'Sin alertas'

  // Si hay PDF, pedirle a Claude que lo resuma primero
  let resumenPdf = 'Sin documento de cálculo adjunto.'
  if (pdfBase64) {
    try {
      const resp = await anthropicClient.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: 'Extrae y resume en español todos los datos clave de este documento: materiales con cantidades y costos, costos operativos, totales, márgenes y cualquier dato relevante para gestión del proyecto. Sé exhaustivo con los números.' },
          ],
        }],
      })
      resumenPdf = resp.content[0].text
      console.log('[Contexto] resumenPdf generado:', resumenPdf.substring(0, 200))
    } catch (e) {
      console.log('[Contexto] ERROR resumiendo PDF:', e.message, e.status)
    }
  }

  return `=== CONTEXTO COMPLETO DEL PROYECTO "${proyecto.nombre}" ===

ESTADO FINANCIERO:
- Presupuesto total: $${(ef.presupuesto_total || 0).toLocaleString('es-CL')}
- Gastado en OCs: $${(ef.gastado_oc || 0).toLocaleString('es-CL')}
- Gastado en terreno: $${(ef.gastado_terreno || 0).toLocaleString('es-CL')}
- Disponible: $${(ef.disponible || 0).toLocaleString('es-CL')}
- % Ejecutado: ${ef.porcentaje_ejecutado || 0}%

ÓRDENES DE COMPRA:
${ocsResumen}

GASTOS DE TERRENO:
${gastosResumen}

TAREAS:
${tareasResumen}

ALERTAS ACTIVAS:
${alertasResumen}

DOCUMENTO DE CÁLCULO (PDF):
${resumenPdf}

=== FIN DE CONTEXTO ===`
}

/* ── POST /api/proyectos/:id/chat ───────────────────────────────── */

router.post('/:id/chat', async (req, res) => {
  try {
    const { id } = req.params
    const { mensaje, historial = [] } = req.body
    if (!mensaje) return res.status(400).json({ error: 'mensaje requerido' })

    // Leer proyecto
    const { data: proyecto, error: eProyecto } = await supabase
      .from('proyectos').select('*').eq('id', id).single()
    if (eProyecto) throw eProyecto

    // Tareas
    const { data: tareasFlat } = await supabase
      .from('proyecto_tareas').select('*').eq('proyecto_id', id)

    // OCs
    const { data: proyOcs } = await supabase
      .from('proyecto_oc').select('oc_id').eq('proyecto_id', id)
    const ocIds = (proyOcs || []).map((r) => r.oc_id).filter(Boolean)
    let ocsFlat = []
    if (ocIds.length > 0) {
      const { data: comprasData } = await supabase
        .from('compras').select('id, numero, proveedor, monto, estado, items, fecha').in('id', ocIds)
      ocsFlat = comprasData || []
    }

    // Gastos
    const { data: proyGastos } = await supabase
      .from('proyecto_gastos').select('gasto_id').eq('proyecto_id', id)
    const gastoIds = (proyGastos || []).map((r) => r.gasto_id).filter(Boolean)
    let gastosFlat = []
    if (gastoIds.length > 0) {
      const { data: gastosData } = await supabase
        .from('gastos').select('id, descripcion, monto, categoria, fecha').in('id', gastoIds)
      gastosFlat = gastosData || []
    }

    // PDF (opcional)
    let pdfBase64 = null
    if (proyecto.calculadora_pdf_url) {
      try {
        const pdfResp = await fetch(proyecto.calculadora_pdf_url)
        if (pdfResp.ok) pdfBase64 = Buffer.from(await pdfResp.arrayBuffer()).toString('base64')
      } catch (e) {
        console.warn('[Chat] No se pudo descargar PDF:', e.message)
      }
    }

    // Inicializar cliente Anthropic
    const Anthropic = require('@anthropic-ai/sdk')
    const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Determinar si necesitamos generar contexto inicial
    let historialActual = [...historial]
    const necesitaContexto = historialActual.length === 0 || !historialActual[0]?.esContexto

    console.log('[Chat] calculadora_pdf_url:', proyecto.calculadora_pdf_url)
    console.log('[Chat] pdfBase64 antes de generar contexto:', !!pdfBase64)
    console.log('[Chat] necesitaContexto:', necesitaContexto)
    console.log('[Chat] historial.length:', historial.length)

    if (necesitaContexto) {
      console.log('[Chat] Generando contexto enriquecido...')
      const contexto = await generarContextoProyecto(proyecto, tareasFlat, ocsFlat, gastosFlat, pdfBase64, client)
      const mensajeContexto = {
        role: 'user',
        content: contexto,
        esContexto: true,
        oculto: true,
      }
      const respuestaContexto = {
        role: 'assistant',
        content: 'Contexto del proyecto recibido y procesado. Listo para responder preguntas.',
        esContexto: true,
        oculto: true,
      }
      historialActual = [mensajeContexto, respuestaContexto, ...historialActual]
    }

    // Construir mensajes para Claude (todos como texto simple)
    const mensajesApi = historialActual.map((msg) => ({
      role: msg.role === 'user' || msg.role === 'assistant' ? msg.role : 'user',
      content: String(msg.content),
    }))
    mensajesApi.push({ role: 'user', content: mensaje })

    const systemPrompt = `Eres ARIA, asistente de gestión de proyectos del ERP Mamkam.
Responde siempre en español. Usa el contexto del proyecto que tienes en el historial para responder con precisión.
Si detectas pendientes o acciones a realizar, agrégalos al final con:
PENDIENTES_DETECTADOS: [pendiente1] | [pendiente2]
Si no hay pendientes, NO incluyas esa línea.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages: mensajesApi,
    })

    const textoCompleto = response.content[0].text

    // Separar pendientes del texto
    let respuesta = textoCompleto
    let pendientes = []
    const pendientesMatch = textoCompleto.match(/PENDIENTES_DETECTADOS:\s*(.*)$/m)
    if (pendientesMatch) {
      respuesta = textoCompleto.slice(0, pendientesMatch.index).trim()
      const raw = pendientesMatch[1].trim()
      if (raw && raw !== '[]') {
        pendientes = raw.split('|').map((p) => p.trim()).filter(Boolean)
      }
    }

    // Historial completo (incluye contexto oculto para próximas llamadas)
    const historialParaGuardar = [
      ...historialActual,
      { role: 'user', content: mensaje },
      { role: 'assistant', content: respuesta, pendientes },
    ]

    // Historial visible (sin mensajes ocultos) para el frontend
    const historialParaFrontend = historialParaGuardar.filter((m) => !m.oculto)

    await supabase.from('proyectos').update({ chat_ia: historialParaGuardar }).eq('id', id)

    res.json({ data: { respuesta, pendientes, historial: historialParaFrontend } })
  } catch (err) {
    console.error('[Chat] ERROR:', err.message)
    res.status(500).json({ error: { message: err.message } })
  }
})

module.exports = router
