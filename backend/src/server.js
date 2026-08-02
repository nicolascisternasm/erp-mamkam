process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message, err.stack)
})
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

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

app.use(cors({
  origin: [
    'https://www.mamkam.cl',
    'https://mamkam.cl',
    'http://localhost:5173',
    'http://localhost:3000',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-cron-job'],
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

const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
  console.log(`🚀 ERP MAMKAM API corriendo en http://localhost:${PORT}`)
})
