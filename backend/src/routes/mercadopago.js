const { Router } = require('express')
const supabase = require('../lib/supabase.js')
const { requireAuth } = require('../middleware/auth.js')

const router = Router()

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN
const MP_CUENTA_ID = '73be7928-7f1f-4227-94d5-9a24c2265e3b'

async function fetchMPPayment(paymentId) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  })
  if (!res.ok) throw new Error(`MP API error: ${res.status}`)
  return res.json()
}

async function getEmpresaId() {
  const { data } = await supabase
    .from('cuentas_bancarias')
    .select('empresa_id')
    .eq('id', MP_CUENTA_ID)
    .single()
  return data?.empresa_id
}

function buildMovimiento(payment, empresaId) {
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

async function intentarConciliacion(payment, empresaId) {
  const monto = payment.transaction_amount
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
  res.sendStatus(200) // responder INMEDIATAMENTE antes de procesar

  try {
    const { type, data } = req.body || {}
    if (type !== 'payment' || !data?.id) return

    const payment = await fetchMPPayment(data.id)
    if (payment.status !== 'approved') return

    const empresaId = await getEmpresaId()
    if (!empresaId) return

    const { error } = await supabase
      .from('movimientos')
      .upsert(buildMovimiento(payment, empresaId), { onConflict: 'id' })

    if (error) { console.error('[MP webhook] upsert error:', error.message); return }

    await intentarConciliacion(payment, empresaId)
  } catch (err) {
    console.error('[MP webhook] error:', err.message)
  }
})

// GET /sync — requiere auth
router.get('/sync', requireAuth, async (req, res) => {
  try {
    const now = new Date()
    const hace30dias = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const url = `https://api.mercadopago.com/v1/payments/search?range=date_created&begin_date=${encodeURIComponent(hace30dias.toISOString())}&end_date=${encodeURIComponent(now.toISOString())}&status=approved&limit=100`

    const mpRes = await fetch(url, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    })
    if (!mpRes.ok) {
      const err = await mpRes.json().catch(() => ({}))
      throw new Error(`MP API error ${mpRes.status}: ${err.message || ''}`)
    }

    const { results = [] } = await mpRes.json()
    const empresaId = await getEmpresaId()
    if (!empresaId) throw new Error('No se encontró empresa_id para la cuenta MP')

    let sincronizados = 0
    for (const payment of results) {
      const { error } = await supabase
        .from('movimientos')
        .upsert(buildMovimiento(payment, empresaId), { onConflict: 'id' })
      if (error) console.error('[MP sync] upsert error:', error.message)
      else sincronizados++
    }

    res.json({ sincronizados, total: results.length })
  } catch (err) {
    console.error('[MP sync] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
