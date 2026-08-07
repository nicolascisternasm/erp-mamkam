const { Router } = require('express')
const { requireAuth } = require('../middleware/auth')
const { obtenerToken, consultarRCVPlaywright } = require('../services/sii')
const supabase = require('../lib/supabase')

const router = Router()

// GET /api/sii/test — verifica autenticación SOAP con palena.sii.cl (para emisión DTE futura)
router.get('/test', requireAuth, async (req, res) => {
  try {
    console.log('[SII] Probando autenticación SOAP...')
    const token = await obtenerToken()
    res.json({ data: { ok: true, token: token.substring(0, 20) + '...' } })
  } catch (err) {
    console.error('[SII] Error:', err.message)
    res.status(500).json({ error: { message: err.message } })
  }
})

// GET /api/sii/estado — chequea si sii_config.clave_sii está configurada para la empresa
router.get('/estado', requireAuth, async (req, res) => {
  try {
    const { data } = await supabase
      .from('sii_config')
      .select('clave_sii')
      .eq('empresa_id', req.user.empresa_id)
      .maybeSingle()
    res.json({ data: { conectado: !!(data?.clave_sii), modo: 'playwright' } })
  } catch {
    res.json({ data: { conectado: false, modo: 'playwright' } })
  }
})

// PATCH /api/sii/clave — guarda o actualiza la clave tributaria en sii_config
router.patch('/clave', requireAuth, async (req, res) => {
  const { clave } = req.body
  if (!clave?.trim()) return res.status(400).json({ error: { message: 'clave requerida' } })
  try {
    const { error } = await supabase
      .from('sii_config')
      .upsert({ empresa_id: req.user.empresa_id, clave_sii: clave.trim() }, { onConflict: 'empresa_id' })
    if (error) throw error
    res.json({ data: { ok: true } })
  } catch (err) {
    res.status(500).json({ error: { message: err.message } })
  }
})

// GET /api/sii/rcv?periodo=202407&tipo=COMPRA|VENTA
// Lanza un browser Playwright headless, hace login con la clave almacenada en sii_config,
// y extrae los documentos del RCV para el período solicitado.
router.get('/rcv', requireAuth, async (req, res) => {
  try {
    const { periodo, tipo = 'COMPRA' } = req.query
    if (!periodo) return res.status(400).json({ error: { message: 'periodo requerido (ej: 202407)' } })

    const rut = process.env.SII_RUT || '78348727'
    const dv  = process.env.SII_DV  || '6'

    const { data: config } = await supabase
      .from('sii_config')
      .select('clave_sii')
      .eq('empresa_id', req.user.empresa_id)
      .maybeSingle()

    if (!config?.clave_sii) {
      return res.status(503).json({ error: { message: 'Clave SII no configurada — ingrésala en Configuración > Integraciones' } })
    }

    const docs = await consultarRCVPlaywright(rut, dv, config.clave_sii, periodo, tipo)
    res.json({ data: docs })
  } catch (err) {
    console.error('[SII] Error RCV:', err.message)
    res.status(500).json({ error: { message: err.message } })
  }
})

module.exports = router
