const { Router } = require('express')

const router = Router()

const SYSTEM_PROMPT =
  'Eres un asistente especializado en leer boletas y facturas chilenas. ' +
  'Extrae los datos y responde SOLO con un JSON sin texto adicional ni backticks ' +
  'con estos campos: monto (número entero en pesos chilenos sin puntos ni símbolos), ' +
  'comercio (nombre del negocio), ' +
  'rut_comercio (RUT con formato XX.XXX.XXX-X o vacío si no aparece), ' +
  'numero_documento (número de boleta o factura), ' +
  'tipo_documento (boleta, factura u otro), ' +
  'fecha (formato YYYY-MM-DD o vacío si no se ve claramente), ' +
  'descripcion (descripción breve de lo comprado), ' +
  'categoria (elige el valor más apropiado según lo que veas en la boleta entre: ' +
  'combustible, alimentacion, alojamiento, materiales, transporte, herramientas, otros; ' +
  'usa "otros" si ninguno encaja con claridad)'

const ALLOWED_ORIGINS = [
  'https://www.mamkam.cl',
  'https://mamkam.cl',
  'http://localhost:5173',
  'http://localhost:8081',
]

router.options('/ocr-boleta', (req, res) => {
  const origin = req.headers.origin ?? ''
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.sendStatus(204)
})

router.post('/ocr-boleta', async (req, res) => {
  const origin = req.headers.origin ?? ''
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  console.log('[ai/ocr-boleta] ✅ Request recibido')
  console.log('[ai/ocr-boleta] method:', req.method, '| origin:', origin || '(sin origin)')

  const { imagen_base64, media_type } = req.body
  if (!imagen_base64) {
    console.log('[ai/ocr-boleta] ❌ Falta imagen_base64 en el body')
    return res.status(400).json({ error: 'imagen_base64 es requerido' })
  }
  console.log('[ai/ocr-boleta] imagen_base64 presente, longitud:', imagen_base64.length)
  console.log('[ai/ocr-boleta] media_type:', media_type ?? 'no enviado (se usará image/jpeg)')

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[ai/ocr-boleta] ❌ ANTHROPIC_API_KEY no está definida en process.env')
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada en el servidor' })
  }
  console.log('[ai/ocr-boleta] ANTHROPIC_API_KEY cargada, longitud:', apiKey.length)

  const requestBody = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: media_type || 'image/jpeg',
              data: imagen_base64,
            },
          },
          { type: 'text', text: 'Analiza esta boleta o factura.' },
        ],
      },
    ],
  }

  console.log('[ai/ocr-boleta] Enviando request a Anthropic con modelo:', requestBody.model)

  let anthropicRes
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
  } catch (networkErr) {
    console.error('[ai/ocr-boleta] ❌ Error de red al llamar a Anthropic:', networkErr.message)
    return res.status(502).json({ error: 'no_se_pudo_leer' })
  }

  console.log('[ai/ocr-boleta] Anthropic status:', anthropicRes.status, anthropicRes.statusText)

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text()
    console.error('[ai/ocr-boleta] ❌ Anthropic devolvió error:')
    console.error('  status:', anthropicRes.status)
    console.error('  body:', errText)
    return res.status(502).json({ error: 'no_se_pudo_leer' })
  }

  const json = await anthropicRes.json()
  console.log('[ai/ocr-boleta] Anthropic stop_reason:', json.stop_reason)
  console.log('[ai/ocr-boleta] content blocks recibidos:', json.content?.length ?? 0)

  const content = (json.content || [])
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
    .trim()

  console.log('[ai/ocr-boleta] Texto extraído de Anthropic:', content)

  let cleaned = content
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) cleaned = fenceMatch[1].trim()
  const jsonStart = cleaned.indexOf('{')
  const jsonEnd = cleaned.lastIndexOf('}')
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    cleaned = cleaned.slice(jsonStart, jsonEnd + 1)
  }

  let data
  try {
    data = JSON.parse(cleaned)
    console.log('[ai/ocr-boleta] ✅ JSON parseado correctamente:', JSON.stringify(data))
  } catch (parseErr) {
    console.error('[ai/ocr-boleta] ❌ Error al parsear JSON de Anthropic:', parseErr.message)
    console.error('[ai/ocr-boleta]   texto que falló:', cleaned)
    return res.json({ error: 'no_se_pudo_leer' })
  }

  return res.json(data)
})

module.exports = router
