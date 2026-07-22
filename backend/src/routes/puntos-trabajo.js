const { Router } = require('express')
const supabase = require('../lib/supabase.js')
const { requireAuth } = require('../middleware/auth.js')

const router = Router()
router.use(requireAuth)

const fromPunto = (r) => ({
  id:                   r.id,
  nombreLugar:          r.nombre_lugar,
  direccion:            r.direccion,
  latitud:              r.latitud,
  longitud:             r.longitud,
  radioPermitidoMetros: r.radio_permitido_metros,
  activo:               r.activo ?? true,
})

/* ── GET /api/puntos-trabajo ──────────────────────────────────────── */

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('puntos_trabajo')
    .select('*')
    .order('nombre_lugar')

  if (error) {
    console.error('[puntos-trabajo GET]', error)
    return res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: error.message },
    })
  }

  res.json({ success: true, data: (data || []).map(fromPunto) })
})

/* ── POST /api/puntos-trabajo ─────────────────────────────────────── */

router.post('/', async (req, res) => {
  const { nombreLugar, direccion, latitud, longitud, radioPermitidoMetros, activo } = req.body

  const { data, error } = await supabase
    .from('puntos_trabajo')
    .insert([{
      nombre_lugar:           nombreLugar?.trim(),
      direccion:              direccion?.trim(),
      latitud,
      longitud,
      radio_permitido_metros: radioPermitidoMetros,
      activo:                 activo ?? true,
    }])
    .select('*')
    .single()

  if (error) {
    console.error('[puntos-trabajo POST]', error)
    return res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: error.message },
    })
  }

  res.status(201).json({ success: true, data: fromPunto(data) })
})

/* ── PATCH /api/puntos-trabajo/:id ───────────────────────────────── */

router.patch('/:id', async (req, res) => {
  const { id } = req.params
  const { nombreLugar, direccion, latitud, longitud, radioPermitidoMetros, activo } = req.body

  const updates = {}
  if (nombreLugar          !== undefined) updates.nombre_lugar           = nombreLugar.trim()
  if (direccion            !== undefined) updates.direccion              = direccion.trim()
  if (latitud              !== undefined) updates.latitud                = latitud
  if (longitud             !== undefined) updates.longitud               = longitud
  if (radioPermitidoMetros !== undefined) updates.radio_permitido_metros = radioPermitidoMetros
  if (activo               !== undefined) updates.activo                 = activo

  const { data, error } = await supabase
    .from('puntos_trabajo')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[puntos-trabajo PATCH]', error)
    return res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: error.message },
    })
  }

  res.json({ success: true, data: fromPunto(data) })
})

/* ── PATCH /api/puntos-trabajo/:id/toggle ────────────────────────── */

router.patch('/:id/toggle', async (req, res) => {
  const { id } = req.params
  const { activo } = req.body

  const { data, error } = await supabase
    .from('puntos_trabajo')
    .update({ activo })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[puntos-trabajo TOGGLE]', error)
    return res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: error.message },
    })
  }

  res.json({ success: true, data: fromPunto(data) })
})

module.exports = router
