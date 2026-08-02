const { Router } = require('express')
const { requireAuth } = require('../middleware/auth')
const { obtenerToken, consultarRCV } = require('../services/sii')

const router = Router()

// GET /api/sii/test — probar autenticación con el SII
router.get('/test', requireAuth, async (req, res) => {
  try {
    console.log('[SII] Probando autenticación...')
    const token = await obtenerToken()
    res.json({ data: { ok: true, token: token.substring(0, 20) + '...' } })
  } catch (err) {
    console.error('[SII] Error:', err.message)
    res.status(500).json({ error: { message: err.message } })
  }
})

// GET /api/sii/rcv?periodo=202407&tipo=COMPRA
router.get('/rcv', requireAuth, async (req, res) => {
  try {
    const { periodo, tipo = 'COMPRA' } = req.query
    if (!periodo) return res.status(400).json({ error: { message: 'periodo requerido (ej: 202407)' } })

    const rut = process.env.SII_RUT || '78348727'
    const dv  = process.env.SII_DV  || '6'
    const data = await consultarRCV(rut, dv, periodo, tipo)
    res.json({ data })
  } catch (err) {
    console.error('[SII] Error RCV:', err.message)
    res.status(500).json({ error: { message: err.message } })
  }
})

module.exports = router
