const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const TOKEN = process.env.WHATSAPP_TOKEN
const API_URL = `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`

async function enviarMensaje(telefono, templateName, variables) {
  const numero = telefono.replace(/\s/g, '').replace(/^0/, '')
  const numeroFormateado = numero.startsWith('+') ? numero : `+56${numero}`

  const body = {
    messaging_product: 'whatsapp',
    to: numeroFormateado,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'es_CL' },
      components: [{
        type: 'body',
        parameters: Array.isArray(variables)
          ? variables.map(value => ({ type: 'text', text: String(value) }))
          : Object.values(variables).map(value => ({ type: 'text', text: String(value) })),
      }],
    },
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'Error WhatsApp')
  return data
}

async function enviarDocumento(telefono, documentUrl, filename, caption) {
  const numero = telefono.replace(/\s/g, '').replace(/^0/, '')
  const numeroFormateado = numero.startsWith('+') ? numero : `+56${numero}`

  const body = {
    messaging_product: 'whatsapp',
    to: numeroFormateado,
    type: 'document',
    document: {
      link: documentUrl,
      filename: filename || 'documento.pdf',
      caption: caption || '',
    },
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'Error WhatsApp')
  return data
}

module.exports = { enviarMensaje, enviarDocumento }
