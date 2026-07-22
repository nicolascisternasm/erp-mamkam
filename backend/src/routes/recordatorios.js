const express = require('express')
const router  = express.Router()
const { createClient } = require('@supabase/supabase-js')
const { enviarMensaje } = require('../services/whatsapp')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function enviarRecordatorios(telefonos) {
  const hoy = new Date()
  const fechaObjetivo = new Date(hoy)
  fechaObjetivo.setDate(hoy.getDate() + 5)
  const fechaStr = fechaObjetivo.toISOString().split('T')[0]

  const { data: pagos, error } = await supabase
    .from('pagos_cuentas_empresa')
    .select('*, cuentas_empresa(nombre, monto)')
    .eq('estado', 'pendiente')
    .eq('fecha_vencimiento', fechaStr)

  if (error) throw error

  if (!pagos || pagos.length === 0) {
    return { success: true, mensaje: 'No hay pagos próximos a vencer', enviados: 0 }
  }

  const resultados = []
  for (const pago of pagos) {
    const nombre = pago.cuentas_empresa?.nombre || 'Pago'
    const monto  = `$${Number(pago.cuentas_empresa?.monto || 0).toLocaleString('es-CL')}`
    const fecha  = new Date(pago.fecha_vencimiento + 'T12:00:00')
      .toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })

    for (const telefono of telefonos) {
      if (!telefono?.trim()) continue
      try {
        await enviarMensaje(telefono, 'recordatorio_pago', ['Equipo MKM', nombre, monto, fecha])
        resultados.push({ telefono, pago: nombre, ok: true })
      } catch (err) {
        console.error('[recordatorios] error:', err.message)
        resultados.push({ telefono, pago: nombre, ok: false, error: err.message })
      }
    }
  }

  return { success: true, enviados: resultados.filter(r => r.ok).length, resultados }
}

/* POST /api/recordatorios/cuentas — requiere auth desde el frontend */
router.post('/cuentas', async (req, res) => {
  try {
    const { telefonos } = req.body
    if (!telefonos || telefonos.length === 0) {
      return res.status(400).json({ error: 'telefonos requeridos' })
    }
    const resultado = await enviarRecordatorios(telefonos)
    res.json(resultado)
  } catch (err) {
    console.error('[recordatorios/cuentas]', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

/* GET /api/recordatorios/cron — endpoint público para cPanel cron job
   Uso: https://www.mamkam.cl/api/recordatorios/cron?telefonos=+56912345678,+56987654321 */
router.get('/cron', async (req, res) => {
  try {
    const telefonos = (req.query.telefonos || '').split(',').filter(Boolean)
    if (telefonos.length === 0) {
      return res.status(400).json({ error: 'Parámetro telefonos requerido' })
    }
    const resultado = await enviarRecordatorios(telefonos)
    res.json(resultado)
  } catch (err) {
    console.error('[recordatorios/cron]', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
