process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message, err.stack)
})
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

// Generar host key para SFTP si no existe
const fs = require('fs')
if (!fs.existsSync('/tmp/host.key')) {
  try {
    const { generateKeyPairSync } = require('crypto')
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    })
    fs.writeFileSync('/tmp/host.key', privateKey)
    console.log('[SFTP] Host key RSA generada con crypto')
  } catch (e) {
    console.error('[SFTP] Error generando host key:', e.message)
  }
}

// Iniciar servidor SFTP
const { iniciarSFTPServer } = require('./sftp-server')
const mpRoutes = require('./routes/mercadopago')

iniciarSFTPServer(async (fileName, csvText) => {
  console.log(`[SFTP] Procesando reporte: ${fileName}`)
  const movimientos = mpRoutes.parsearBankReportCSV(csvText)
  const procesados  = await mpRoutes.procesarMovimientosMP(movimientos)
  console.log(`[SFTP] ${procesados} movimientos procesados desde ${fileName}`)
})

const express = require('express')
const cors = require('cors')
const authRoutes = require('./routes/auth.js')
const usuariosRoutes = require('./routes/usuarios.js')
const aiRoutes = require('./routes/ai.js')
const trabajadoresRoutes = require('./routes/trabajadores.js')
const puntosTrabajosRoutes = require('./routes/puntos-trabajo.js')
const solicitudesRoutes    = require('./routes/solicitudes.js')
const gastosRoutes         = require('./routes/gastos.js')
const proyectosRoutes      = require('./routes/proyectos.js')
const asesoriaRoutes       = require('./routes/asesoria.js')
const facturasRoutes         = require('./routes/facturas.js')
const remuneracionesRoutes   = require('./routes/remuneraciones.js')
const whatsappRoutes         = require('./routes/whatsapp.js')
const finanzasRoutes         = require('./routes/finanzas.js')
const notificationsRoutes    = require('./routes/notifications.js')
const comprasRoutes          = require('./routes/compras.js')
const cotizacionesRoutes     = require('./routes/cotizaciones.js')
const recordatoriosRoutes    = require('./routes/recordatorios.js')
const movContablesRoutes     = require('./routes/movimientosContables')
const amonestacionesRoutes   = require('./routes/amonestaciones.js')
const crmRoutes              = require('./routes/crm.js')
const integracionesRoutes    = require('./routes/integraciones.js')
const visitasRoutes          = require('./routes/visitas.js')
const mercadoPagoRoutes      = require('./routes/mercadopago.js')
const { requireAuth }        = require('./middleware/auth.js')

const app = express()
const PORT = process.env.PORT || 4000

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map(s => s.trim())
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true)
    else cb(new Error(`CORS: origin ${origin} no permitido`))
  },
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.get('/api/health', (_, res) => res.json({ ok: true, env: process.env.NODE_ENV }))

app.use('/api/auth', authRoutes)
app.use('/api/usuarios', usuariosRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/trabajadores', trabajadoresRoutes)
app.use('/api/puntos-trabajo', puntosTrabajosRoutes)
app.use('/api/solicitudes',   solicitudesRoutes)
app.use('/api/gastos',        gastosRoutes)
app.use('/api/proyectos',    proyectosRoutes)
app.use('/api/asesoria',    asesoriaRoutes)
app.use('/api/facturas',        facturasRoutes)
app.use('/api/remuneraciones', remuneracionesRoutes)
app.use('/api/whatsapp',      whatsappRoutes)
app.use('/api/finanzas',     finanzasRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/compras',      comprasRoutes)
app.use('/api/cotizaciones',  cotizacionesRoutes)
app.use('/api/recordatorios',         recordatoriosRoutes)
app.use('/api/movimientos-contables', movContablesRoutes)
app.use('/api/amonestaciones',        amonestacionesRoutes)
app.use('/api/crm',                   crmRoutes)
app.use('/api/integraciones',         requireAuth, integracionesRoutes)
app.use('/api/visitas',               visitasRoutes)
app.use('/api/mercadopago',          mercadoPagoRoutes)

app.use((req, res, next) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` })
})

app.use((err, req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor' })
})

app.listen(PORT, () => {
  console.log(`🚀 ERP MAMKAM API corriendo en http://localhost:${PORT}`)
})
