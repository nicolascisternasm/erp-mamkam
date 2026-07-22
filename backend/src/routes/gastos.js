const { Router } = require('express')
const supabase = require('../lib/supabase.js')
const { requireAuth } = require('../middleware/auth.js')

const router = Router()
router.use(requireAuth)

const fromGasto = (r) => ({
  id:              r.id,
  trabajadorId:    r.trabajador_id,
  trabajadorNombre: r.trabajador_nombre,
  fecha:           r.fecha_gasto,
  monto:           r.monto,
  moneda:          r.moneda,
  categoria:       r.categoria,
  comercio:        r.comercio,
  rutComercio:     r.rut_comercio,
  numeroDocumento: r.numero_documento,
  tipoDocumento:   r.tipo_documento,
  descripcion:     r.descripcion,
  fotoUrl:         r.foto_url,
  estado:          r.estado,
  latitud:         r.latitud,
  longitud:        r.longitud,
  creadoEn:        r.creado_en,
  tipo_movimiento:        r.tipo_movimiento        ?? 'egreso',
  subtipo:                r.subtipo                ?? null,
  cuenta_origen_id:       r.cuenta_origen_id       ?? null,
  cuenta_destino_id:      r.cuenta_destino_id      ?? null,
  cuenta_contable_id:     r.cuenta_contable_id     ?? null,
  cuenta_contable_nombre: r.cuentas_contables?.nombre ?? null,
})

/* ── GET /api/gastos ────────────────────────────────────────────────── */

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('gastos')
      .select('*, cuentas_contables(id, nombre, tipo)')
      .eq('empresa_id', req.user.empresa_id)
      .order('fecha_gasto', { ascending: false })
    if (error) throw error
    res.json({ success: true, data: (data || []).map(fromGasto) })
  } catch (err) {
    console.error('[gastos GET]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── PATCH /api/gastos/:id/estado ───────────────────────────────────── */

router.patch('/:id/estado', async (req, res) => {
  const { id } = req.params
  const { estado, proyecto_id, cuenta_contable_id, cuenta_contable_nombre, cuenta_bancaria_id } = req.body
  console.log('[gastos PATCH estado] id:', id, 'estado:', estado, 'proyecto_id:', proyecto_id)
  try {
    const updateFields = { estado }

    if (estado === 'aprobado') {
      updateFields.tipo_movimiento   = 'egreso'
      updateFields.cuenta_contable_id = cuenta_contable_id  ?? null
      updateFields.subtipo            = cuenta_contable_nombre ?? null
      updateFields.cuenta_origen_id   = cuenta_bancaria_id  ?? null
    }

    const { data, error } = await supabase
      .from('gastos')
      .update(updateFields)
      .eq('id', id)
      .select('*, cuentas_contables(id, nombre, tipo)')
      .single()
    if (error) throw error

    if (proyecto_id) {
      const { error: pgError } = await supabase
        .from('proyecto_gastos')
        .upsert(
          { proyecto_id, gasto_id: id },
          { onConflict: 'proyecto_id,gasto_id', ignoreDuplicates: true }
        )
      if (pgError) console.error('[gastos] proyecto_gastos error:', pgError.message)
    }

    res.json({ success: true, data: fromGasto(data) })
  } catch (err) {
    console.error('[gastos PATCH estado]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

module.exports = router
