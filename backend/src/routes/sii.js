const { Router } = require('express')
const { requireAuth } = require('../middleware/auth')
const { obtenerToken, consultarRCV, loginWebSII } = require('../services/sii')
const supabase = require('../lib/supabase')

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

// POST /api/sii/login — login web con clave tributaria; guarda cookies en sii_config
router.post('/login', requireAuth, async (req, res) => {
  try {
    const { clave } = req.body || {}
    if (!clave) return res.status(400).json({ error: { message: 'clave requerida' } })

    const empresaId = req.user.empresa_id
    const rut = process.env.SII_RUT || '78348727'

    console.log('[SII login] iniciando login web para empresa:', empresaId)
    const cookiesStr = await loginWebSII(rut, clave)

    const ultimoLogin = new Date().toISOString()
    const { error } = await supabase.from('sii_config').upsert(
      { empresa_id: empresaId, sii_cookies: cookiesStr, ultimo_login: ultimoLogin },
      { onConflict: 'empresa_id' }
    )
    if (error) throw new Error(error.message)

    console.log('[SII login] cookies guardadas para empresa:', empresaId)
    res.json({ data: { ok: true, ultimo_login: ultimoLogin } })
  } catch (err) {
    console.error('[SII login] error:', err.message)
    res.status(500).json({ error: { message: err.message } })
  }
})

// GET /api/sii/estado — estado de conexión SII de la empresa
router.get('/estado', requireAuth, async (req, res) => {
  try {
    const empresaId = req.user.empresa_id
    const { data } = await supabase
      .from('sii_config')
      .select('ultimo_login, sii_cookies')
      .eq('empresa_id', empresaId)
      .single()

    const conectado = !!(data?.sii_cookies && data?.ultimo_login)
    res.json({ data: { conectado, ultimo_login: data?.ultimo_login || null } })
  } catch (err) {
    console.error('[SII estado] error:', err.message)
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
    const data = await consultarRCV(rut, dv, periodo, tipo, req.user.empresa_id)
    res.json({ data })
  } catch (err) {
    console.error('[SII] Error RCV:', err.message)
    res.status(500).json({ error: { message: err.message } })
  }
})

module.exports = router
