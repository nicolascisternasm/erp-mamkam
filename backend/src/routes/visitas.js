const { Router } = require('express')
const { requireAuth } = require('../middleware/auth.js')
const supabase = require('../lib/supabase.js')

const router = Router()
router.use(requireAuth)

const SYSTEM_PROMPT =
  'Eres un experto en instalaciones comerciales y proyectos de construcción/decoración. ' +
  'Se te proporcionará información estructurada de una visita técnica de pre-instalación. ' +
  'Tu tarea es generar un resumen ejecutivo claro y profesional en español, ' +
  'redactado en párrafos fluidos (no en JSON ni en listas de puntos). ' +
  'El resumen debe ser útil para el equipo de instalación y para la gerencia.'

/* ── POST /api/visitas/:id/resumen-ia ───────────────────────── */

router.post('/:id/resumen-ia', async (req, res) => {
  try {
    const { id } = req.params

    /* 1. Leer visita */
    const { data: visita, error: visitaErr } = await supabase
      .from('visitas')
      .select('*')
      .eq('id', id)
      .single()

    if (visitaErr || !visita) {
      return res.status(404).json({ success: false, error: { message: 'Visita no encontrada' } })
    }

    /* 2. Leer checklist respondido */
    const { data: checklist } = await supabase
      .from('visita_checklist')
      .select('pregunta_label, respuesta, critical, unidad')
      .eq('visita_id', id)
      .not('respuesta', 'is', null)
      .neq('respuesta', '')
      .order('unidad')
      .order('created_at')

    /* 3. Contar fotos */
    const { count: fotosCount } = await supabase
      .from('visita_fotos')
      .select('*', { count: 'exact', head: true })
      .eq('visita_id', id)

    /* 4. Construir prompt */
    const productos = Array.isArray(visita.productos)
      ? visita.productos.join(', ')
      : visita.productos || '—'

    let checklistTexto = ''
    if (checklist && checklist.length > 0) {
      const porUnidad = {}
      checklist.forEach(row => {
        const u = row.unidad ?? 1
        if (!porUnidad[u]) porUnidad[u] = []
        porUnidad[u].push(row)
      })
      const unidades = Object.keys(porUnidad).sort((a, b) => Number(a) - Number(b))
      unidades.forEach(u => {
        if (unidades.length > 1) checklistTexto += `\n  [Toldo ${u}]\n`
        porUnidad[u].forEach(row => {
          const critica = row.critical ? ' [CRÍTICA]' : ''
          checklistTexto += `  - ${row.pregunta_label}${critica}: ${row.respuesta}\n`
        })
      })
    } else {
      checklistTexto = '  (Sin respuestas registradas)\n'
    }

    const userPrompt =
      `DATOS DE LA VISITA:\n` +
      `- Cliente: ${visita.cliente || '—'}\n` +
      `- Proyecto: ${visita.nombre_proyecto || '—'}\n` +
      `- Dirección: ${visita.direccion || '—'}, ${visita.comuna || '—'}\n` +
      `- Productos a instalar: ${productos}\n` +
      `- Fecha agendada: ${visita.fecha_agendada || '—'}\n` +
      `- Responsable de visita: ${visita.responsable_visita || '—'}\n` +
      `- Instalador asignado: ${visita.instalador_nombre || '—'}\n` +
      `- Estado: ${visita.estado || '—'}\n` +
      (visita.notas_previas ? `- Notas previas: ${visita.notas_previas}\n` : '') +
      `\nCHECKLIST RESPONDIDO (${checklist?.length || 0} preguntas con respuesta):\n` +
      checklistTexto +
      `\nFOTOS/VIDEOS ADJUNTOS: ${fotosCount ?? 0} archivo(s).\n\n` +
      `Genera un resumen ejecutivo con estas 4 secciones, en párrafos fluidos:\n` +
      `1. Introducción: cliente, proyecto, productos a instalar, fecha agendada y equipo responsable.\n` +
      `2. Estado del lugar: lo que reveló el checklist (medidas, condiciones del espacio, anclajes, materiales, etc.).\n` +
      `3. Observaciones críticas: respuestas a preguntas marcadas como [CRÍTICA] y puntos de atención especial.\n` +
      `4. Conclusión y recomendaciones concretas para el equipo de instalación.\n\n` +
      `Redacta en español. Máximo 4 párrafos. No uses bullet points ni numeración.`

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return res.status(500).json({ success: false, error: { message: 'ANTHROPIC_API_KEY no configurada en el servidor' } })
    }

    /* 5. Llamar a Claude */
    let anthropicRes
    try {
      anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
          'content-type':      'application/json',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-4-6',
          max_tokens: 1000,
          system:     SYSTEM_PROMPT,
          messages:   [{ role: 'user', content: userPrompt }],
        }),
      })
    } catch (netErr) {
      console.error('[visitas/resumen-ia] Error de red:', netErr.message)
      return res.status(502).json({ success: false, error: { message: 'No se pudo contactar el servicio de IA' } })
    }

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      console.error('[visitas/resumen-ia] Anthropic error:', anthropicRes.status, errText)
      return res.status(502).json({ success: false, error: { message: `Error de IA (${anthropicRes.status})` } })
    }

    const claudeJson = await anthropicRes.json()
    const resumen = (claudeJson.content || [])
      .filter(b => b?.type === 'text' && typeof b.text === 'string')
      .map(b => b.text)
      .join('')
      .trim()

    /* 6. Guardar en visitas.resumen_ia */
    await supabase.from('visitas').update({ resumen_ia: resumen }).eq('id', id)

    return res.json({ success: true, data: { resumen } })
  } catch (fatalError) {
    console.error('[visitas/resumen-ia] ERROR FATAL:', fatalError.message)
    return res.status(500).json({ success: false, error: { message: 'Error interno: ' + fatalError.message } })
  }
})

module.exports = router
