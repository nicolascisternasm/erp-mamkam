const { Router } = require('express')
const supabase = require('../lib/supabase.js')
const { requireAuth } = require('../middleware/auth.js')

const router = Router()
router.use(requireAuth)

const fromTrab = (r) => ({
  id:                  r.id,
  nombre:              r.nombre        ?? '',
  rut:                 r.rut           ?? '',
  email:               r.email         ?? '',
  telefono:            r.telefono      ?? '',
  cargo:               r.cargo         ?? '',
  sueldo:              r.sueldo        ?? 0,
  sueldoMinimo:        r.sueldo_minimo ?? 539000,
  sueldoEsLiquido:     r.sueldo_es_liquido ?? false,
  fechaIngreso:        r.fecha_ingreso ?? null,
  estado:              r.estado        ?? 'activo',
  appActiva:           r.app_activa          ?? false,
  puedeCotizar:        r.puede_cotizar        ?? false,
  puedeOC:             r.puede_oc             ?? false,
  puedeRRHH:           r.puede_rrhh           ?? false,
  puedeFinanzas:       r.puede_finanzas       ?? false,
  puedeProyectos:      r.puede_proyectos      ?? false,
  puedeAsesoria:       r.puede_asesoria       ?? false,
  puedeRemuneraciones: r.puede_remuneraciones ?? false,
  puedeFacturas:       r.puede_facturas       ?? false,
  puedeProductos:      r.puede_productos      ?? false,
  puedeMarcaciones:    r.puede_marcaciones    ?? false,
  puedeVacaciones:     r.puede_vacaciones     ?? false,
  puedeGastos:         r.puede_gastos         ?? false,
  puedeVisitas:        r.puede_visitas        ?? false,
  puedeVisitasApp:     r.puede_visitas_app    ?? false,
  puedePlanificacion:  r.puede_planificacion  ?? false,
  usuarioId:           r.usuario_id           ?? null,
  montoHonorarios:     r.monto_honorarios     ?? null,
})

/* ── GET /api/trabajadores ────────────────────────────────────────── */

router.get('/', async (req, res) => {
  const { empresa_id } = req.user
  console.log('[trabajadores] empresa_id JWT:', empresa_id)

  const { data, error } = await supabase
    .from('trabajadores')
    .select('*')
    .eq('empresa_id', empresa_id)
    .order('nombre')

  if (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: 'Error al obtener trabajadores' },
    })
  }

  console.log('[trabajadores] total rows:', data?.length)
  console.log('[trabajadores] rows empresa_id:', data?.map(r => r.empresa_id))
  res.json({ success: true, data: (data || []).map(fromTrab) })
})

/* ── GET /api/trabajadores/:id ────────────────────────────────────── */

router.get('/:id', async (req, res) => {
  const { empresa_id } = req.user
  const { id } = req.params

  const { data, error } = await supabase
    .from('trabajadores')
    .select('*')
    .eq('id', id)
    .eq('empresa_id', empresa_id)
    .maybeSingle()

  if (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: 'Error al obtener trabajador' },
    })
  }
  if (!data) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Trabajador no encontrado' },
    })
  }

  res.json({ success: true, data: fromTrab(data) })
})

module.exports = router
