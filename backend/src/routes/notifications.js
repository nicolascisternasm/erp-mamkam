const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
)

async function sendExpoPushNotification(token, title, body, data = {}) {
  if (!token || !token.startsWith('ExponentPushToken')) return

  const message = {
    to: token,
    sound: 'default',
    title,
    body,
    data,
    channelId: data.tipo === 'gasto' ? 'gastos' : 'marcaciones',
    priority: 'high',
  }

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify(message),
  })

  const result = await response.json()
  console.log('[Push] Resultado:', JSON.stringify(result))
  return result
}

async function getAdminTokens(empresaId) {
  const { data } = await supabase
    .from('usuarios')
    .select('expo_push_token, nombre')
    .eq('rol', 'admin')
    .not('expo_push_token', 'is', null)

  return data || []
}

// POST /api/notifications/marcacion
router.post('/marcacion', async (req, res) => {
  try {
    const { trabajador_nombre, tipo_marcacion, hora, empresa_id } = req.body

    const tipoTexto = {
      'entrada': '📍 Entrada',
      'salida': '🏠 Salida',
      'salida_colacion': '🍽️ Salida colación',
      'regreso_colacion': '↩️ Regreso colación',
    }[tipo_marcacion] || tipo_marcacion

    const admins = await getAdminTokens(empresa_id)

    for (const admin of admins) {
      if (admin.expo_push_token) {
        await sendExpoPushNotification(
          admin.expo_push_token,
          `${tipoTexto} — ${trabajador_nombre}`,
          `Marcó ${tipoTexto.toLowerCase()} a las ${hora}`,
          { tipo: 'marcacion', tipo_marcacion }
        )
      }
    }

    res.json({ ok: true, enviadas: admins.length })
  } catch (error) {
    console.error('[Push] Error marcacion:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /api/notifications/gasto
router.post('/gasto', async (req, res) => {
  try {
    const { trabajador_nombre, monto, comercio, categoria, empresa_id } = req.body

    const montoFormateado = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
    }).format(monto)

    const admins = await getAdminTokens(empresa_id)

    for (const admin of admins) {
      if (admin.expo_push_token) {
        await sendExpoPushNotification(
          admin.expo_push_token,
          `💰 Nuevo gasto — ${trabajador_nombre}`,
          `${montoFormateado} en ${comercio || categoria || 'Sin comercio'}`,
          { tipo: 'gasto' }
        )
      }
    }

    res.json({ ok: true, enviadas: admins.length })
  } catch (error) {
    console.error('[Push] Error gasto:', error)
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
