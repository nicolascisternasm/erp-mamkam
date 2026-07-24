const express = require('express')
const app = express()

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'mamkam_meta_2026'

app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode']
  const token     = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  console.log('[webhook] mode:', mode)
  console.log('[webhook] token recibido:', token)
  console.log('[webhook] token env:', VERIFY_TOKEN)
  console.log('[webhook] match:', token === VERIFY_TOKEN)

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[webhook] ✅ OK')
    return res.status(200).send(challenge)
  }
  return res.sendStatus(403)
})

app.listen(process.env.PORT || 3000, () => {
  console.log('Webhook server corriendo')
})
