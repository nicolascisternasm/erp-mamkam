const { Router } = require('express')
const { randomBytes } = require('crypto')
const supabase = require('../lib/supabase.js')

function newUUID() {
  const b = randomBytes(16)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = b.toString('hex')
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`
}
const { requireAuth } = require('../middleware/auth.js')

const router = Router()
router.use(requireAuth)

const fromRow = (r) => ({
  id:               r.id,
  tipo:             r.tipo ?? 'compra',
  tipoDoc:          r.tipo_doc ?? 'FACTURA',
  tipoCompraVenta:  r.tipo_compra_venta ?? '',
  folio:            r.folio ?? '',
  rutContraparte:   r.rut_contraparte ?? r.rut_emisor ?? '',
  razonSocial:      r.razon_social ?? '',
  fecha:            r.fecha,
  fechaRecepcion:   r.fecha_recepcion ?? null,
  montoExento:      r.monto_exento ?? 0,
  neto:             r.neto ?? 0,
  iva:              r.iva ?? 0,
  ivaNR:            r.iva_no_recuperable ?? 0,
  total:            r.total ?? 0,
  estado:           r.estado ?? 'vigente',
  numeroInterno:    r.numero_interno ?? '',
  createdAt:        r.created_at,
})

const toRow = (f, empresaId) => ({
  id:                  f.id ?? newUUID(),
  empresa_id:          empresaId,
  tipo:                f.tipo ?? 'compra',
  tipo_doc:            f.tipoDoc ?? 'FACTURA',
  tipo_compra_venta:   f.tipoCompraVenta ?? '',
  folio:               String(f.folio ?? ''),
  numero_interno:      f.numeroInterno ?? '',
  rut_contraparte:     f.rutContraparte ?? '',
  razon_social:        f.razonSocial ?? '',
  fecha:               f.fecha,
  fecha_recepcion:     f.fechaRecepcion ?? null,
  monto_exento:        f.montoExento ?? 0,
  neto:                f.neto ?? 0,
  iva:                 f.iva ?? 0,
  iva_no_recuperable:  f.ivaNR ?? 0,
  total:               f.total ?? 0,
  estado:              f.estado ?? 'vigente',
})

/* ── GET /api/facturas ─────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  const { tipo, mes, anio } = req.query
  try {
    let q = supabase
      .from('facturas_sii')
      .select('*')
      .eq('empresa_id', req.user.empresa_id)

    if (tipo) q = q.eq('tipo', tipo)

    if (anio && mes) {
      const mesNum  = mes.padStart(2, '0')
      const desde   = `${anio}-${mesNum}-01`
      const diasMes = new Date(Number(anio), Number(mes), 0).getDate()
      const hasta   = `${anio}-${mesNum}-${String(diasMes).padStart(2, '0')}`
      q = q.gte('fecha', desde).lte('fecha', hasta)
    }

    const { data, error } = await q.order('fecha', { ascending: false })
    if (error) throw error
    res.json({ success: true, data: (data || []).map(fromRow) })
  } catch (err) {
    console.error('[facturas GET]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── GET /api/facturas/resumen ─────────────────────────────────────── */
router.get('/resumen', async (req, res) => {
  const { mes, anio } = req.query
  try {
    let q = supabase
      .from('facturas_sii')
      .select('tipo, neto, iva, iva_no_recuperable, total')
      .eq('empresa_id', req.user.empresa_id)

    if (anio && mes) {
      const mesNum  = mes.padStart(2, '0')
      const desde   = `${anio}-${mesNum}-01`
      const diasMes = new Date(Number(anio), Number(mes), 0).getDate()
      const hasta   = `${anio}-${mesNum}-${String(diasMes).padStart(2, '0')}`
      q = q.gte('fecha', desde).lte('fecha', hasta)
    }

    const { data, error } = await q
    if (error) throw error
    const rows    = data || []
    const ventas  = rows.filter((r) => r.tipo === 'venta')
    const compras = rows.filter((r) => r.tipo === 'compra')
    const sum     = (arr, field) => arr.reduce((a, r) => a + (r[field] ?? 0), 0)

    const ventasNeto  = sum(ventas,  'neto')
    const ventasIVA   = sum(ventas,  'iva')
    const comprasNeto = sum(compras, 'neto')
    const comprasIVA  = sum(compras, 'iva')
    const ivaAPagar   = ventasIVA - comprasIVA

    res.json({ success: true, data: { ventasNeto, ventasIVA, comprasNeto, comprasIVA, ivaAPagar } })
  } catch (err) {
    console.error('[facturas GET resumen]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── POST /api/facturas ────────────────────────────────────────────── */
router.post('/', async (req, res) => {
  try {
    const row = toRow(req.body, req.user.empresa_id)
    const { data, error } = await supabase
      .from('facturas_sii')
      .insert(row)
      .select()
      .single()
    if (error) throw error
    res.json({ success: true, data: fromRow(data) })
  } catch (err) {
    console.error('[facturas POST]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── POST /api/facturas/importar ───────────────────────────────────── */
router.post('/importar', async (req, res) => {
  const { filas, tipo } = req.body
  if (!Array.isArray(filas) || !filas.length) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_DATA', message: 'No hay filas para importar' } })
  }
  try {
    const rows = filas.map((f) => toRow({ ...f, tipo: tipo || f.tipo || 'compra' }, req.user.empresa_id))
    console.log('[facturas] primer row a insertar:', JSON.stringify(rows[0]))
    const { data, error } = await supabase
      .from('facturas_sii')
      .upsert(rows, { onConflict: 'folio,empresa_id,tipo', ignoreDuplicates: false })
      .select()
    if (error) throw error
    res.json({ success: true, data: { importados: data?.length ?? 0 } })
  } catch (err) {
    console.error('[facturas POST importar]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── PATCH /api/facturas/:id ───────────────────────────────────────── */
router.patch('/:id', async (req, res) => {
  try {
    const updates = toRow(req.body, req.user.empresa_id)
    delete updates.id         // no sobreescribir PK
    delete updates.empresa_id // no sobreescribir empresa al actualizar
    const { data, error } = await supabase
      .from('facturas_sii')
      .update(updates)
      .eq('id', req.params.id)
      .eq('empresa_id', req.user.empresa_id)
      .select()
      .single()
    if (error) throw error
    res.json({ success: true, data: fromRow(data) })
  } catch (err) {
    console.error('[facturas PATCH]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── DELETE /api/facturas/:id ──────────────────────────────────────── */
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('facturas_sii')
      .delete()
      .eq('id', req.params.id)
      .eq('empresa_id', req.user.empresa_id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('[facturas DELETE]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

module.exports = router
