const { Router }      = require('express')
const supabase        = require('../lib/supabase.js')
const { requireAuth } = require('../middleware/auth.js')

const router = Router()

router.post('/', async (req, res) => {
  try {
    const {
      empresa_id,
      fecha, tipo_movimiento, subtipo,
      cuenta_origen_id, cuenta_destino_id,
      monto, descripcion, categoria,
      tipo_documento, numero_documento,
      trabajador_id, cotizacion_id,
      comprobante_url, ia_procesado, ia_datos_extraidos,
      creado_por,
    } = req.body

    if (!empresa_id) {
      return res.status(400).json({ success: false, error: 'empresa_id requerido' })
    }

    // 1. Insertar movimiento principal
    const { data: movimiento, error: movErr } = await supabase
      .from('movimientos_contables')
      .insert({
        empresa_id, fecha, tipo_movimiento,
        subtipo: subtipo || null,
        cuenta_origen_id:  cuenta_origen_id  || null,
        cuenta_destino_id: cuenta_destino_id || null,
        monto, descripcion, categoria,
        tipo_documento, numero_documento,
        trabajador_id:      trabajador_id      || null,
        cotizacion_id:      cotizacion_id      || null,
        comprobante_url:    comprobante_url    || null,
        creado_por:         creado_por         || null,
        ia_procesado:       ia_procesado       || false,
        ia_datos_extraidos: ia_datos_extraidos || null,
        estado: 'borrador',
      })
      .select()
      .single()

    if (movErr) throw movErr

    // 2. Generar asientos de doble entrada
    const asientos = []

    if (cuenta_origen_id) {
      asientos.push({
        movimiento_id: movimiento.id,
        cuenta_id:     cuenta_origen_id,
        tipo:          'debe',
        monto,
        descripcion,
      })
    }

    if (cuenta_destino_id) {
      asientos.push({
        movimiento_id: movimiento.id,
        cuenta_id:     cuenta_destino_id,
        tipo:          'haber',
        monto,
        descripcion,
      })
    }

    if (asientos.length > 0) {
      const { error: asErr } = await supabase
        .from('asientos_contables')
        .insert(asientos)
      if (asErr) console.error('[movimientos] error asientos:', asErr.message)
    }

    res.json({ success: true, data: movimiento })
  } catch (err) {
    console.error('[movimientos-contables POST]', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/saldos', requireAuth, async (req, res) => {
  try {
    const empresa_id = req.user.empresa_id

    const { data: gastos, error } = await supabase
      .from('gastos')
      .select('monto, tipo_movimiento')
      .eq('empresa_id', empresa_id)

    if (error) throw error

    const rows = gastos || []
    const total_debe  = rows
      .filter(g => g.tipo_movimiento === 'egreso' || g.tipo_movimiento === 'traspaso')
      .reduce((s, g) => s + (g.monto || 0), 0)
    const total_haber = rows
      .filter(g => g.tipo_movimiento === 'ingreso')
      .reduce((s, g) => s + (g.monto || 0), 0)

    res.json({ success: true, data: { total_debe, total_haber } })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/', requireAuth, async (req, res) => {
  try {
    const empresa_id = req.user.empresa_id
    const { data, error } = await supabase
      .from('gastos')
      .select(`
        id, trabajador_id, trabajador_nombre, fecha_gasto,
        monto, comercio, descripcion, categoria, tipo_documento,
        numero_documento, foto_url, estado, tipo_movimiento, subtipo,
        cuenta_origen_id, cuenta_destino_id, creado_en
      `)
      .eq('empresa_id', empresa_id)
      .order('fecha_gasto', { ascending: false })

    if (error) throw error
    res.json({ success: true, data: data || [] })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
