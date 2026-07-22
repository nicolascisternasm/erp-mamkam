const { Router } = require('express')
const supabase = require('../lib/supabase.js')
const { requireAuth } = require('../middleware/auth.js')

const router = Router()
router.use(requireAuth)

/* ── GET /api/finanzas/cuentas-contables ─────────────────────────── */
router.get('/cuentas-contables', async (req, res) => {
  try {
    let q = supabase
      .from('cuentas_contables')
      .select('id, codigo, nombre, tipo, activa')
      .eq('empresa_id', req.user.empresa_id)
      .order('codigo')
    if (!req.query.all) q = q.eq('activa', true)
    const { data, error } = await q
    if (error) throw error
    const sorted = (data || []).sort((a, b) => {
      const ai = parseInt(a.codigo) || 999
      const bi = parseInt(b.codigo) || 999
      return ai - bi || (a.nombre || '').localeCompare(b.nombre || '')
    })
    res.json({ success: true, data: sorted })
  } catch (err) {
    console.error('[finanzas/cuentas-contables GET]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

/* ── POST /api/finanzas/cuentas-contables ────────────────────────── */
router.post('/cuentas-contables', async (req, res) => {
  try {
    const { codigo, nombre, tipo } = req.body
    if (!nombre?.trim()) return res.status(400).json({ success: false, error: 'El nombre es requerido.' })
    const { data, error } = await supabase
      .from('cuentas_contables')
      .insert({
        codigo: codigo?.trim() || null,
        nombre: nombre.trim(),
        tipo: tipo || 'ambos',
        empresa_id: req.user.empresa_id,
        activa: true,
      })
      .select()
      .single()
    if (error) throw error
    res.json({ success: true, data })
  } catch (err) {
    console.error('[finanzas/cuentas-contables POST]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

/* ── PUT /api/finanzas/cuentas-contables/:id ─────────────────────── */
router.put('/cuentas-contables/:id', async (req, res) => {
  try {
    const { codigo, nombre, tipo, activa } = req.body
    const { data, error } = await supabase
      .from('cuentas_contables')
      .update({ codigo: codigo?.trim() || null, nombre: nombre?.trim(), tipo, activa })
      .eq('id', req.params.id)
      .eq('empresa_id', req.user.empresa_id)
      .select()
      .single()
    if (error) throw error
    res.json({ success: true, data })
  } catch (err) {
    console.error('[finanzas/cuentas-contables PUT]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

/* ── DELETE /api/finanzas/cuentas-contables/:id ──────────────────── */
router.delete('/cuentas-contables/:id', async (req, res) => {
  try {
    const { data: movs } = await supabase
      .from('movimientos')
      .select('id')
      .eq('empresa_id', req.user.empresa_id)
      .eq('cuenta_contable_id', req.params.id)
      .limit(1)
    if (movs?.length > 0) {
      return res.status(409).json({ success: false, error: 'Esta cuenta tiene movimientos asociados y no puede eliminarse.' })
    }
    const { error } = await supabase
      .from('cuentas_contables')
      .delete()
      .eq('id', req.params.id)
      .eq('empresa_id', req.user.empresa_id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('[finanzas/cuentas-contables DELETE]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

/* ── GET /api/finanzas/tipos-documento ───────────────────────────── */
router.get('/tipos-documento', async (req, res) => {
  try {
    let q = supabase
      .from('tipos_documento')
      .select('id, nombre, activo')
      .eq('empresa_id', req.user.empresa_id)
      .order('nombre')
    if (!req.query.all) q = q.eq('activo', true)
    const { data, error } = await q
    if (error) throw error
    res.json({ success: true, data: data || [] })
  } catch (err) {
    console.error('[finanzas/tipos-documento GET]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

/* ── POST /api/finanzas/tipos-documento ──────────────────────────── */
router.post('/tipos-documento', async (req, res) => {
  try {
    const { nombre } = req.body
    if (!nombre?.trim()) return res.status(400).json({ success: false, error: 'El nombre es requerido.' })
    const { data, error } = await supabase
      .from('tipos_documento')
      .insert({ nombre: nombre.trim(), empresa_id: req.user.empresa_id, activo: true })
      .select()
      .single()
    if (error) throw error
    res.json({ success: true, data })
  } catch (err) {
    console.error('[finanzas/tipos-documento POST]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

/* ── PUT /api/finanzas/tipos-documento/:id ───────────────────────── */
router.put('/tipos-documento/:id', async (req, res) => {
  try {
    const { nombre, activo } = req.body
    const { data, error } = await supabase
      .from('tipos_documento')
      .update({ nombre: nombre?.trim(), activo })
      .eq('id', req.params.id)
      .eq('empresa_id', req.user.empresa_id)
      .select()
      .single()
    if (error) throw error
    res.json({ success: true, data })
  } catch (err) {
    console.error('[finanzas/tipos-documento PUT]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

/* ── DELETE /api/finanzas/tipos-documento/:id ────────────────────── */
router.delete('/tipos-documento/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('tipos_documento')
      .delete()
      .eq('id', req.params.id)
      .eq('empresa_id', req.user.empresa_id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('[finanzas/tipos-documento DELETE]', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
