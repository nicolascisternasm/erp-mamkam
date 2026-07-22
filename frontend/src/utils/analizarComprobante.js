export async function analizarComprobanteIA(file) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) return null

  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  let contentBlock
  if (file.type.startsWith('image/')) {
    contentBlock = { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } }
  } else if (file.type === 'application/pdf') {
    contentBlock = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
  } else {
    return null
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          contentBlock,
          {
            type: 'text',
            text: `Analiza este comprobante de pago bancario/transferencia.
Responde SOLO con un JSON válido sin texto adicional ni backticks:
{
  "monto": numero sin puntos ni comas,
  "fecha": "YYYY-MM-DD",
  "banco_origen": "nombre banco emisor o null",
  "banco_destino": "nombre banco receptor o null",
  "numero_transferencia": "numero operacion o null",
  "glosa": "descripcion o concepto del pago",
  "tipo_documento": "Transferencia" o "Deposito" o "Cheque"
}`,
          },
        ],
      }],
    }),
  })

  if (!response.ok) return null
  const data = await response.json()
  const text = data.content?.[0]?.text || ''
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    return null
  }
}
