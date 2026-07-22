const { Router } = require('express')
const supabase = require('../lib/supabase.js')
const { requireAuth } = require('../middleware/auth.js')

const router = Router()
router.use(requireAuth)

async function getTrabajadorIds(empresaId) {
  const { data, error } = await supabase
    .from('trabajadores')
    .select('id')
    .eq('empresa_id', empresaId)
  if (error) throw error
  return (data || []).map((r) => r.id)
}

async function getTrabajadoresMap(empresaId) {
  const { data, error } = await supabase
    .from('trabajadores')
    .select('id, nombre')
    .eq('empresa_id', empresaId)
  if (error) throw error
  const ids = (data || []).map((r) => r.id)
  const map = Object.fromEntries((data || []).map((r) => [r.id, r.nombre]))
  return { ids, map }
}

const fromVacacion = (r) => ({
  id:              r.id,
  trabajadorId:    r.trabajador_id,
  trabajadorNombre: r.trabajador_nombre,
  fechaDesde:      r.fecha_desde,
  fechaHasta:      r.fecha_hasta,
  diasHabiles:     r.dias_habiles,
  motivo:          r.motivo,
  estado:          r.estado || 'pendiente',
  comentarioAdmin: r.comentario_admin,
  resueltaEn:      r.resuelto_en,
  resueltaPor:     r.resuelto_por,
  creadoEn:        r.creado_en,
})

const fromColacion = (r) => ({
  id:              r.id,
  trabajadorId:    r.trabajador_id,
  trabajadorNombre: r.trabajador_nombre,
  fecha:           r.fecha,
  motivo:          r.motivo,
  estado:          r.estado || 'pendiente',
  resueltaEn:      r.resuelto_en,
  resueltaPor:     r.resuelto_por,
  creadoEn:        r.creado_en,
})

const fromPassword = (r, trabMap = {}) => ({
  id:               r.id,
  trabajadorId:     r.trabajador_id,
  trabajadorNombre: trabMap[r.trabajador_id] ?? null,
  rut:              r.rut,
  telefono:         r.telefono,
  estado:           r.estado,
  fechaSolicitud:   r.fecha_solicitud,
  fechaResolucion:  r.fecha_resolucion,
  resueltoPor:      r.resuelto_por,
  comentario:       r.comentario,
})

/* ── GET /api/solicitudes/vacaciones ────────────────────────────────── */

router.get('/vacaciones', async (req, res) => {
  try {
    console.log('[vacaciones] empresa_id JWT:', req.user?.empresa_id)
    const ids = await getTrabajadorIds(req.user.empresa_id)
    console.log('[vacaciones] trabajador ids:', ids)
    if (!ids.length) return res.json({ success: true, data: [] })
    const { data, error } = await supabase
      .from('solicitudes_vacaciones')
      .select('*')
      .in('trabajador_id', ids)
      .order('creado_en', { ascending: false })
    if (error) throw error
    console.log('[vacaciones] solicitudes encontradas:', data?.length)
    res.json({ success: true, data: (data || []).map(fromVacacion) })
  } catch (err) {
    console.error('[solicitudes/vacaciones GET]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── PATCH /api/solicitudes/vacaciones/:id ──────────────────────────── */

router.patch('/vacaciones/:id', async (req, res) => {
  const { id } = req.params
  const { estado, comentario_admin, resuelto_por } = req.body
  const ahora = new Date().toISOString()
  try {
    const { data, error } = await supabase
      .from('solicitudes_vacaciones')
      .update({
        estado,
        comentario_admin: comentario_admin ?? null,
        resuelto_en:      ahora,
        resuelto_por:     resuelto_por ?? null,
      })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    res.json({ success: true, data: fromVacacion(data) })
  } catch (err) {
    console.error('[solicitudes/vacaciones PATCH]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── GET /api/solicitudes/colacion ──────────────────────────────────── */

router.get('/colacion', async (req, res) => {
  try {
    const ids = await getTrabajadorIds(req.user.empresa_id)
    if (!ids.length) return res.json({ success: true, data: [] })
    const { data, error } = await supabase
      .from('solicitudes_omitir_colacion')
      .select('*')
      .in('trabajador_id', ids)
      .order('creado_en', { ascending: false })
    if (error) throw error
    res.json({ success: true, data: (data || []).map(fromColacion) })
  } catch (err) {
    console.error('[solicitudes/colacion GET]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── PATCH /api/solicitudes/colacion/:id ────────────────────────────── */

router.patch('/colacion/:id', async (req, res) => {
  const { id } = req.params
  const { estado, resuelto_por } = req.body
  const ahora = new Date().toISOString()
  try {
    const { data, error } = await supabase
      .from('solicitudes_omitir_colacion')
      .update({
        estado,
        resuelto_en:  ahora,
        resuelto_por: resuelto_por ?? null,
      })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    res.json({ success: true, data: fromColacion(data) })
  } catch (err) {
    console.error('[solicitudes/colacion PATCH]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── GET /api/solicitudes/password ──────────────────────────────────── */

router.get('/password', async (req, res) => {
  try {
    const { ids, map: trabMap } = await getTrabajadoresMap(req.user.empresa_id)
    if (!ids.length) return res.json({ success: true, data: [] })
    const { data, error } = await supabase
      .from('solicitudes_password')
      .select('*')
      .in('trabajador_id', ids)
      .order('fecha_solicitud', { ascending: false })
    if (error) throw error
    res.json({ success: true, data: (data || []).map((r) => fromPassword(r, trabMap)) })
  } catch (err) {
    console.error('[solicitudes/password GET]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── PATCH /api/solicitudes/password/:id ────────────────────────────── */

router.patch('/password/:id', async (req, res) => {
  const { id } = req.params
  const { estado, resuelto_por } = req.body
  const ahora = new Date().toISOString()
  try {
    const { data, error } = await supabase
      .from('solicitudes_password')
      .update({
        estado,
        fecha_resolucion: ahora,
        resuelto_por:     resuelto_por ?? null,
      })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    res.json({ success: true, data: fromPassword(data) })
  } catch (err) {
    console.error('[solicitudes/password PATCH]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

module.exports = router
