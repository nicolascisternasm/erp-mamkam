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

// ── Reporte de Liberaciones ───────────────────────────────────────────────────

async function generarYDescargarReporte(diasAtras) {
  const TOKEN = process.env.MP_ACCESS_TOKEN
  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  }

  const ahora = new Date()
  const inicio = new Date(ahora)
  inicio.setDate(inicio.getDate() - diasAtras)

  const pad = n => String(n).padStart(2, '0')
  const formatMP = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}Z`
  const begin_date = formatMP(inicio)
  const end_date   = formatMP(ahora)

  // 1. Solicitar generación del reporte
  console.log('[MP] Período:', begin_date, '→', end_date)
  console.log('[MP] Solicitando generación del reporte de liberaciones...')
  const genRes = await fetch('https://api.mercadopago.com/v1/account/release_report', {
    method: 'POST',
    headers,
    body: JSON.stringify({ begin_date, end_date }),
  })

  if (!genRes.ok) {
    const err = await genRes.text()
    console.error('[MP] Error generando reporte:', err)
    throw new Error('Error generando reporte de MP')
  }

  const genData = await genRes.json()
  console.log('[MP] Reporte solicitado:', genData.file_name || 'pendiente')

  // 2. Polling hasta que el reporte esté listo (máx 60 seg)
  let fileName = genData.file_name
  if (!fileName) {
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 5000))
      const listRes = await fetch('https://api.mercadopago.com/v1/account/release_report/list', {
        headers: { 'Authorization': `Bearer ${TOKEN}` },
      })
      const lista = await listRes.json()
      const reciente = Array.isArray(lista)
        ? lista.find(r => new Date(r.date_created) >= new Date(begin_date))
        : null
      if (reciente?.file_name) {
        fileName = reciente.file_name
        console.log('[MP] Reporte listo:', fileName)
        break
      }
    }
  }

  if (!fileName) throw new Error('Timeout esperando reporte de MP')

  // 3. Descargar el CSV
  const csvRes = await fetch(`https://api.mercadopago.com/v1/account/release_report/${fileName}`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` },
  })
  if (!csvRes.ok) throw new Error('Error descargando CSV de MP')

  const csvText = await csvRes.text()
  return parsearCSVMercadoPago(csvText)
}

function parsearCSVMercadoPago(csvText) {
  const lineas = csvText.split('\n').filter(Boolean)
  const headerIdx = lineas.findIndex(l =>
    l.toUpperCase().includes('DATE') || l.toUpperCase().includes('FECHA')
  )
  if (headerIdx < 0) return []

  const header = lineas[headerIdx].split(',').map(h => h.trim().replace(/"/g, '').toUpperCase())
  const movimientos = []

  for (let i = headerIdx + 1; i < lineas.length; i++) {
    const cols = lineas[i].split(',').map(c => c.trim().replace(/"/g, ''))
    if (cols.length < 3) continue

    const get = (keys) => {
      for (const k of keys) {
        const idx = header.findIndex(h => h.includes(k))
        if (idx >= 0) return cols[idx] || ''
      }
      return ''
    }

    const fecha      = get(['DATE', 'FECHA', 'DATE_CREATED'])
    const monto      = parseFloat(get(['NET_CREDIT_AMOUNT', 'SETTLEMENT_NET_AMOUNT', 'NET_AMOUNT', 'AMOUNT']) || '0')
    const descripcion = get(['DESCRIPTION', 'PAYMENT_METHOD', 'TRANSACTION_TYPE', 'TYPE'])
    const sourceId   = get(['SOURCE_ID', 'PAYMENT_ID', 'ID'])

    if (!fecha || isNaN(monto) || monto === 0) continue

    movimientos.push({
      id: `mp-rel-${sourceId || i}`,
      fecha: fecha.slice(0, 10),
      descripcion: `MP: ${descripcion}`,
      monto: Math.abs(monto),
      tipo: monto > 0 ? 'abono' : 'cargo',
      glosa: 'Mercado Pago - Liberaciones',
    })
  }

  return movimientos
}

// ── Helpers legacy (usados solo por el webhook) ───────────────────────────────

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

// ── POST /webhook — sin requireAuth, MP no manda JWT ─────────────────────────
router.post('/webhook', async (req, res) => {
  res.sendStatus(200) // responder INMEDIATAMENTE

  try {
    const { type, data } = req.body || {}
    if (type !== 'payment' || !data?.id) return

    const empresaId = await getEmpresaId()
    if (!empresaId) return

    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    })
    if (!payRes.ok) return

    const payment = await payRes.json()
    if (payment.status !== 'approved') return

    const { error } = await supabase
      .from('movimientos')
      .upsert(buildMovimientoFromPayment(payment, empresaId), { onConflict: 'id' })

    if (error) { console.error('[MP webhook] upsert error:', error.message); return }

    await intentarConciliacion(payment.transaction_amount, empresaId)
  } catch (err) {
    console.error('[MP webhook] error:', err.message)
  }
})

// ── GET /sync — requiere auth ─────────────────────────────────────────────────
router.get('/sync', requireAuth, async (req, res) => {
  req.setTimeout(90000)
  res.setTimeout(90000)

  try {
    const empresaId = await getEmpresaId()
    if (!empresaId) throw new Error('No se encontró empresa_id para la cuenta MP')

    const movimientos = await generarYDescargarReporte(30)

    let sincronizados = 0
    for (const m of movimientos) {
      const row = {
        id: m.id,
        empresa_id: empresaId,
        fecha: m.fecha,
        descripcion: m.descripcion,
        tipo: m.tipo,
        monto: m.monto,
        conciliado: false,
        cuenta_bancaria_id: MP_CUENTA_ID,
        glosa: m.glosa,
        archivo_origen: 'mercadopago_webhook',
      }
      const { error } = await supabase
        .from('movimientos')
        .upsert(row, { onConflict: 'id' })
      if (error) console.error('[MP sync] upsert error:', error.message, row.id)
      else sincronizados++
    }

    res.json({ data: { sincronizados, total: movimientos.length, fuente: 'release_report' } })
  } catch (err) {
    console.error('[MP sync] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
