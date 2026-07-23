const { Router } = require('express')
const { requireAuth } = require('../middleware/auth.js')
const supabase = require('../lib/supabase.js')

const router = Router()
router.use(requireAuth)

/* ── Mapper snake_case → camelCase ──────────────────────────── */

const fromAmonestacion = (r) => ({
  id:                r.id,
  trabajadorId:      r.trabajador_id,
  trabajadorNombre:  r.trabajador_nombre,
  codigo:            r.codigo,
  fecha:             r.fecha,
  descripcionAdmin:  r.descripcion_admin,
  descripcionIa:     r.descripcion_ia,
  articulo:          r.articulo_reglamento,
  titulo:            r.titulo_reglamento,
  pagina:            r.pagina_reglamento,
  fotoUrl:           r.foto_url,
  pdfUrl:            r.pdf_url,
  estado:            r.estado,
  createdAt:         r.created_at,
})

/* ── Prompt para Claude ─────────────────────────────────────── */

const SYSTEM_PROMPT =
  'Eres un experto en derecho laboral chileno. Se te proporciona el reglamento ' +
  'interno de una empresa (PDF adjunto) y una descripción de una falta cometida ' +
  'por un trabajador.\n\n' +
  'Analiza el reglamento y:\n' +
  '1. Reescribe la descripción de la falta de forma formal y jurídicamente correcta.\n' +
  '2. Identifica el artículo, título y página del reglamento que fue infringido.\n' +
  '3. Cita textualmente el párrafo relevante del reglamento.\n\n' +
  'Responde SOLO con un JSON válido (sin texto adicional ni backticks) con estos campos exactos:\n' +
  '{\n' +
  '  "descripcion_formal": "texto reescrito formalmente",\n' +
  '  "articulo": "Artículo XX",\n' +
  '  "titulo": "Título del artículo",\n' +
  '  "pagina": "X",\n' +
  '  "cita_reglamento": "texto citado del reglamento",\n' +
  '  "gravedad": "leve|grave|muy_grave"\n' +
  '}\n\n' +
  'Si no puedes identificar un artículo específico, usa el más cercano posible e indícalo ' +
  'en la descripción formal. El campo "gravedad" debe ser exactamente uno de: leve, grave, muy_grave.'

/* ── GET /api/amonestaciones ────────────────────────────────── */

router.get('/', async (req, res) => {
  const empresaId = req.user.empresa_id
  if (!empresaId) {
    return res.status(400).json({ success: false, error: { message: 'Usuario sin empresa asociada' } })
  }
  const { data, error } = await supabase
    .from('amonestaciones')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[amonestaciones GET]', error.message)
    return res.status(500).json({ success: false, error: { message: error.message } })
  }
  res.json({ success: true, data: (data || []).map(fromAmonestacion) })
})

/* ── POST /api/amonestaciones/generar ───────────────────────── */

router.post('/generar', async (req, res) => {
  console.log('[amonestaciones] API key disponible:', !!process.env.ANTHROPIC_API_KEY)

  const empresaId = req.user.empresa_id
  if (!empresaId) {
    return res.status(400).json({ success: false, error: { message: 'Usuario sin empresa asociada' } })
  }

  const { descripcion_admin, url_reglamento, trabajador_nombre, fecha } = req.body
  if (!descripcion_admin?.trim()) {
    return res.status(400).json({ success: false, error: { message: 'descripcion_admin es requerido' } })
  }
  if (!url_reglamento) {
    return res.status(400).json({ success: false, error: { message: 'No hay un reglamento interno cargado para la empresa' } })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[amonestaciones/generar] ANTHROPIC_API_KEY no configurada')
    return res.status(500).json({ success: false, error: { message: 'ANTHROPIC_API_KEY no configurada en el servidor' } })
  }

  /* 1) Descargar el reglamento y convertirlo a base64 */
  let pdfBase64
  try {
    const pdfRes = await fetch(url_reglamento)
    if (!pdfRes.ok) throw new Error(`status ${pdfRes.status}`)
    const arrayBuf = await pdfRes.arrayBuffer()
    pdfBase64 = Buffer.from(arrayBuf).toString('base64')
  } catch (err) {
    console.error('[amonestaciones/generar] Error al descargar reglamento:', err.message)
    return res.status(400).json({ success: false, error: { message: 'No se pudo descargar el PDF del reglamento' } })
  }

  /* 2) Llamar a Claude con el reglamento + la descripción del admin */
  const requestBody = {
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          {
            type: 'text',
            text:
              `Descripción de la falta cometida por el trabajador${trabajador_nombre ? ` ${trabajador_nombre}` : ''}:\n` +
              `"${descripcion_admin}"\n\n` +
              'Analiza el reglamento interno adjunto y responde SOLO con el JSON solicitado.',
          },
        ],
      },
    ],
  }

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
    console.error('[amonestaciones/generar] ❌ Error de red al llamar a Anthropic')
    console.error('  modelo:', requestBody.model, '| tamaño PDF (base64):', pdfBase64.length)
    console.error('  message:', networkErr.message)
    console.error('  stack:', networkErr.stack)
    return res.status(502).json({ success: false, error: { message: 'No se pudo contactar el servicio de IA' } })
  }

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text()
    console.error('[amonestaciones/generar] ❌ Anthropic devolvió un error')
    console.error('  status:', anthropicRes.status, anthropicRes.statusText)
    console.error('  request-id:', anthropicRes.headers.get('request-id'))
    console.error('  retry-after:', anthropicRes.headers.get('retry-after'))
    console.error('  modelo:', requestBody.model, '| tamaño PDF (base64):', pdfBase64.length)
    console.error('  body:', errText)
    try {
      const errJson = JSON.parse(errText)
      console.error('  error.type:', errJson?.error?.type)
      console.error('  error.message:', errJson?.error?.message)
    } catch { /* el body no era JSON */ }
    return res.status(502).json({ success: false, error: { message: 'El servicio de IA devolvió un error' } })
  }

  const json = await anthropicRes.json()
  console.log('[amonestaciones/generar] Anthropic stop_reason:', json.stop_reason)
  const content = (json.content || [])
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
    .trim()

  /* 3) Extraer y parsear el JSON de la respuesta */
  let cleaned = content
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) cleaned = fenceMatch[1].trim()
  const jsonStart = cleaned.indexOf('{')
  const jsonEnd = cleaned.lastIndexOf('}')
  if (jsonStart >= 0 && jsonEnd > jsonStart) cleaned = cleaned.slice(jsonStart, jsonEnd + 1)

  let analisis
  try {
    analisis = JSON.parse(cleaned)
  } catch (parseErr) {
    console.error('[amonestaciones/generar] No se pudo parsear el JSON de la IA:', cleaned)
    return res.status(502).json({ success: false, error: { message: 'La IA no devolvió un resultado válido. Intenta nuevamente.' } })
  }

  /* 4) Generar el código correlativo del año en curso */
  const year = new Date().getFullYear()
  const { count, error: countErr } = await supabase
    .from('amonestaciones')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .like('codigo', `AMONEST-${year}-%`)
  if (countErr) {
    console.error('[amonestaciones/generar] Error al contar correlativo:', countErr.message)
    return res.status(500).json({ success: false, error: { message: 'No se pudo generar el código de la amonestación' } })
  }
  const correlativo = String((count || 0) + 1).padStart(3, '0')
  const codigo = `AMONEST-${year}-${correlativo}`

  return res.json({
    success: true,
    data: {
      descripcion_formal: analisis.descripcion_formal ?? '',
      articulo:           analisis.articulo ?? '',
      titulo:             analisis.titulo ?? '',
      pagina:             analisis.pagina != null ? String(analisis.pagina) : '',
      cita_reglamento:    analisis.cita_reglamento ?? '',
      gravedad:           ['leve', 'grave', 'muy_grave'].includes(analisis.gravedad) ? analisis.gravedad : 'leve',
      codigo,
    },
  })
})

module.exports = router
