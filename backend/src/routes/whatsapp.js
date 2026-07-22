const { Router } = require('express')
const { requireAuth } = require('../middleware/auth.js')
const { enviarMensaje, enviarDocumento } = require('../services/whatsapp.js')

const router = Router()
router.use(requireAuth)

router.post('/recordatorio-tarea', async (req, res) => {
  try {
    const { telefono, nombre, proyecto, tarea, fecha } = req.body
    if (!telefono) throw new Error('Teléfono requerido')
    await enviarMensaje(telefono, 'recordatorio_tarea', { nombre, proyecto, tarea, fecha })
    res.json({ success: true })
  } catch (err) {
    console.error('[whatsapp/recordatorio-tarea]', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/cotizacion', async (req, res) => {
  try {
    const { telefono, nombre, numero, total, fecha } = req.body
    if (!telefono) throw new Error('Teléfono requerido')
    await enviarMensaje(telefono, 'cotizacion_cliente', { nombre, numero, total, fecha })
    res.json({ success: true })
  } catch (err) {
    console.error('[whatsapp/cotizacion]', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/resumen-visita', async (req, res) => {
  try {
    const { telefono, nombre, fecha, direccion, productos } = req.body
    if (!telefono) throw new Error('Teléfono requerido')
    await enviarMensaje(telefono, 'resumen_visita', { nombre, fecha, direccion, productos })
    res.json({ success: true })
  } catch (err) {
    console.error('[whatsapp/resumen-visita]', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/cotizacion-pdf', async (req, res) => {
  try {
    const { telefono, nombre, numero, total, fecha, pdfUrl } = req.body
    if (!telefono) throw new Error('Teléfono requerido')
    if (!pdfUrl) throw new Error('URL del PDF requerida')
    console.log('[cotizacion-pdf] telefono recibido:', telefono)
    console.log('[cotizacion-pdf] nombre:', nombre, 'numero:', numero)

    try {
      await enviarMensaje(telefono, 'cotizacion_cliente', { nombre, numero, total, fecha })
      console.log('[cotizacion-pdf] template enviado OK')
    } catch (templateErr) {
      console.error('[cotizacion-pdf] template error completo:', JSON.stringify(templateErr))
    }

    const docResult = await enviarDocumento(telefono, pdfUrl, `Cotizacion_${numero}.pdf`, `Cotización ${numero} - ${total}`)
    console.log('[cotizacion-pdf] documento enviado:', JSON.stringify(docResult))
    res.json({ success: true })
  } catch (err) {
    console.error('[whatsapp/cotizacion-pdf]', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
