const { Router } = require('express')
const supabase = require('../lib/supabase.js')

const router = Router()

const META_APP_ID = '1681505619081822'

/* No exponemos access_token al frontend */
const fromIntegracion = (r) => ({
  id:             r.id,
  proveedor:      r.proveedor,
  pageId:         r.page_id,
  pageName:       r.page_name,
  tokenExpiresAt: r.token_expires_at,
  activo:         r.activo,
  createdAt:      r.created_at,
})

/* GET /api/integraciones — integraciones activas de la empresa */
router.get('/', async (req, res) => {
  const empresaId = req.user.empresa_id
  const { data, error } = await supabase
    .from('integraciones')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[integraciones GET]', error.message)
    return res.status(500).json({ success: false, error: { message: error.message } })
  }
  res.json({ success: true, data: (data || []).map(fromIntegracion) })
})

/* GET /api/integraciones/meta/callback — intercambio del code de OAuth.
 * Lo invoca el frontend (con el token JWT vía apiClient) pasando el `code`
 * que Meta entregó en la redirección. Responde JSON; el frontend redirige. */
router.get('/meta/callback', async (req, res) => {
  const empresaId = req.user.empresa_id
  const { code } = req.query

  if (!code) {
    return res.status(400).json({ success: false, error: { message: 'Falta el parámetro code de OAuth' } })
  }
  if (!process.env.META_APP_SECRET) {
    console.error('[integraciones/meta/callback] META_APP_SECRET no configurada')
    return res.status(500).json({ success: false, error: { message: 'META_APP_SECRET no configurada en el servidor' } })
  }

  const redirectUri = `${process.env.FRONTEND_URL}/configuracion/integraciones/meta/callback`

  try {
    // 1) code → user access_token
    const tokenUrl =
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${META_APP_ID}` +
      `&client_secret=${process.env.META_APP_SECRET}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${encodeURIComponent(code)}`
    const tokenRes  = await fetch(tokenUrl)
    const tokenJson = await tokenRes.json()
    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error('[integraciones/meta/callback] error al obtener token:', JSON.stringify(tokenJson))
      return res.status(502).json({ success: false, error: { message: tokenJson.error?.message || 'No se pudo obtener el token de Meta' } })
    }
    const userToken = tokenJson.access_token
    const expiresIn = tokenJson.expires_in // segundos (puede faltar)

    // 2) páginas del usuario
    const pagesRes  = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${userToken}`)
    const pagesJson = await pagesRes.json()
    const page = pagesJson.data?.[0]
    if (!page) {
      console.error('[integraciones/meta/callback] sin páginas:', JSON.stringify(pagesJson))
      return res.status(400).json({ success: false, error: { message: 'No se encontraron páginas de Facebook asociadas a esta cuenta' } })
    }

    const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null

    // 3) guardar: desactiva integraciones Meta previas de la empresa y crea la nueva
    await supabase.from('integraciones').update({ activo: false }).eq('empresa_id', empresaId).eq('proveedor', 'meta')
    const { error: insErr } = await supabase.from('integraciones').insert({
      empresa_id:       empresaId,
      proveedor:        'meta',
      access_token:     page.access_token || userToken, // token de PÁGINA (el que sirve para leadgen)
      page_id:          page.id,
      page_name:        page.name,
      token_expires_at: tokenExpiresAt,
      activo:           true,
    })
    if (insErr) throw insErr

    return res.json({ success: true, data: { pageId: page.id, pageName: page.name } })
  } catch (err) {
    console.error('[integraciones/meta/callback]', err.message)
    return res.status(500).json({ success: false, error: { message: err.message } })
  }
})

/* DELETE /api/integraciones/:id — desactiva la integración */
router.delete('/:id', async (req, res) => {
  const empresaId = req.user.empresa_id
  const { id } = req.params
  const { error } = await supabase
    .from('integraciones')
    .update({ activo: false })
    .eq('id', id)
    .eq('empresa_id', empresaId)
  if (error) {
    console.error('[integraciones DELETE]', error.message)
    return res.status(500).json({ success: false, error: { message: error.message } })
  }
  res.json({ success: true })
})

module.exports = router
