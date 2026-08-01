const { Router } = require('express')
const supabase = require('../lib/supabase.js')
const { requireAuth } = require('../middleware/auth.js')

const router = Router()

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN
const MP_CUENTA_ID = '73be7928-7f1f-4227-94d5-9a24c2265e3b'

async function getEmpresaId() {
  const { data } = await supabase
    .from('cuentas_bancarias')
    .select('empresa_id')
    .eq('id', MP_CUENTA_ID)
    .single()
  return data?.empresa_id
}

// Convierte un movimiento de /v1/account/movements/search al formato de la tabla
function buildMovimientoFromMovement(movement, empresaId) {
  const fecha = (movement.date_created || new Date().toISOString()).slice(0, 10)
  const monto = Math.abs(movement.amount || 0)
  const tipo = (movement.amount || 0) >= 0 ? 'abono' : 'cargo'
  return {
    id: `mp-mov-${movement.id}`,
    empresa_id: empresaId,
    fecha,
    descripcion: `MP: ${movement.description || movement.reference_id || ''}`,
    tipo,
    monto,
    conciliado: false,
    cuenta_bancaria_id: MP_CUENTA_ID,
    glosa: `Mercado Pago - ${movement.type_description || movement.type || ''}`,
    archivo_origen: 'mercadopago_webhook',
  }
}

// Convierte un pago de /v1/payments/{id} al formato de la tabla (legacy webhook)
function buildMovimientoFromPayment(payment, empresaId) {
  const fecha = payment.date_approved
    ? payment.date_approved.slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  const payerEmail = payment.payer?.email || ''
  return {
    id: `mp-${payment.id}`,
    empresa_id: empresaId,
    fecha,
    descripcion: `MP: ${payment.description || ''} - ${payerEmail}`,
    tipo: 'abono',
    monto: payment.transaction_amount,
    conciliado: false,
    cuenta_bancaria_id: MP_CUENTA_ID,
    glosa: `Mercado Pago - ${payment.payment_type_id || ''}`,
    archivo_origen: 'mercadopago_webhook',
  }
}

// Descarga movimientos de /v1/account/movements/search para un rango de días.
// Si el endpoint devuelve 404/error, hace fallback a /v1/payments/search.
// Retorna { movimientos: [...], fuente: 'movements'|'payments' }
async function fetchMovimientosRango(diasAtras) {
  const now = new Date()
  const desde = new Date(now.getTime() - diasAtras * 24 * 60 * 60 * 1000)
  const beginDate = desde.toISOString()
  const endDate = now.toISOString()

  const movUrl = `https://api.mercadopago.com/v1/account/movements/search?limit=100&offset=0&begin_date=${encodeURIComponent(beginDate)}&end_date=${encodeURIComponent(endDate)}`
  const movRes = await fetch(movUrl, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  })

  if (movRes.ok) {
    const body = await movRes.json()
    const movimientos = (body.movements || body.results || []).filter(
      m => m.status === 'approved' || m.status === 'settled'
    )
    return { movimientos, fuente: 'movements' }
  }

  // Fallback si movements/search no está disponible
  console.log('[MP] movements/search no disponible, usando payments/search como fallback')
  const payUrl = `https://api.mercadopago.com/v1/payments/search?range=date_created&begin_date=${encodeURIComponent(beginDate)}&end_date=${encodeURIComponent(endDate)}&status=approved&limit=100`
  const payRes = await fetch(payUrl, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  })
  if (!payRes.ok) {
    const err = await payRes.json().catch(() => ({}))
    throw new Error(`MP API error ${payRes.status}: ${err.message || ''}`)
  }
  const payBody = await payRes.json()
  return { movimientos: payBody.results || [], fuente: 'payments' }
}

async function upsertMovimientos(movimientos, empresaId, fuente) {
  let sincronizados = 0
  for (const m of movimientos) {
    const row = fuente === 'payments'
      ? buildMovimientoFromPayment(m, empresaId)
      : buildMovimientoFromMovement(m, empresaId)
    const { error } = await supabase
      .from('movimientos')
      .upsert(row, { onConflict: 'id' })
    if (error) console.error('[MP] upsert error:', error.message, row.id)
    else sincronizados++
  }
  return sincronizados
}

async function intentarConciliacion(monto, empresaId) {
  const min = monto * 0.95
  const max = monto * 1.05
  const { data: cots } = await supabase
    .from('cotizaciones')
    .select('id, numero, condiciones_pago')
    .eq('empresa_id', empresaId)
    .in('estado', ['aprobada', 'en_ejecucion'])
  if (!cots) return
  for (const cot of cots) {
    for (const cp of cot.condiciones_pago || []) {
      if (!cp.movimiento_id && cp.monto >= min && cp.monto <= max) {
        console.log(`[MP] conciliación posible con cotización ${cot.numero} (condición ${cp.monto})`)
      }
    }
  }
}

// POST /webhook — sin requireAuth, MP no manda JWT
router.post('/webhook', async (req, res) => {
  res.sendStatus(200) // responder INMEDIATAMENTE

  try {
    const { type, data } = req.body || {}
    if (type !== 'payment' || !data?.id) return

    const empresaId = await getEmpresaId()
    if (!empresaId) return

    // Mini-sync de últimos 2 días para capturar transferencias además del pago notificado
    const { movimientos, fuente } = await fetchMovimientosRango(2)
    const sincronizados = await upsertMovimientos(movimientos, empresaId, fuente)
    console.log(`[MP webhook] mini-sync: ${sincronizados} movimientos (fuente: ${fuente})`)

    // Buscar conciliaciones posibles por el monto del pago notificado
    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    })
    if (payRes.ok) {
      const payment = await payRes.json()
      if (payment.status === 'approved' && payment.transaction_amount) {
        await intentarConciliacion(payment.transaction_amount, empresaId)
      }
    }
  } catch (err) {
    console.error('[MP webhook] error:', err.message)
  }
})

// GET /sync — requiere auth
router.get('/sync', requireAuth, async (req, res) => {
  try {
    const empresaId = await getEmpresaId()
    if (!empresaId) throw new Error('No se encontró empresa_id para la cuenta MP')

    const { movimientos, fuente } = await fetchMovimientosRango(30)
    const sincronizados = await upsertMovimientos(movimientos, empresaId, fuente)

    res.json({ sincronizados, total: movimientos.length, fuente })
  } catch (err) {
    console.error('[MP sync] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
