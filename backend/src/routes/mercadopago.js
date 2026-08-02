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

// ── Bank Report ───────────────────────────────────────────────────────────────

async function obtenerUltimoBankReport(diasAtras) {
  const TOKEN = process.env.MP_ACCESS_TOKEN
  const headers = { 'Authorization': `Bearer ${TOKEN}` }

  const listRes = await fetch('https://api.mercadopago.com/v1/account/bank_report/list', { headers })
  if (!listRes.ok) throw new Error('Error listando bank_reports de MP')
  const lista = await listRes.json()

  if (!Array.isArray(lista) || lista.length === 0) {
    console.log('[MP] No hay bank_reports, generando uno nuevo...')
    return await generarYDescargarBankReport(diasAtras)
  }

  const reciente = lista.sort((a, b) => new Date(b.date_created) - new Date(a.date_created))[0]
  console.log('[MP] Usando bank_report:', reciente.file_name)

  const csvRes = await fetch(
    `https://api.mercadopago.com/v1/account/bank_report/${reciente.file_name}`,
    { headers }
  )
  if (!csvRes.ok) throw new Error('Error descargando bank_report CSV')
  const csvText = await csvRes.text()
  return parsearBankReportCSV(csvText)
}

async function generarYDescargarBankReport(diasAtras) {
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

  console.log('[MP] Generando bank_report para:', begin_date, '→', end_date)

  const genRes = await fetch('https://api.mercadopago.com/v1/account/bank_report', {
    method: 'POST',
    headers,
    body: JSON.stringify({ begin_date, end_date }),
  })

  if (!genRes.ok) {
    const err = await genRes.text()
    throw new Error(`Error generando bank_report: ${err}`)
  }

  const genData = await genRes.json()
  let fileName = genData.file_name

  if (!fileName) {
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 5000))
      const listRes = await fetch(
        'https://api.mercadopago.com/v1/account/bank_report/list',
        { headers: { 'Authorization': `Bearer ${TOKEN}` } }
      )
      const lista = await listRes.json()
      const reciente = Array.isArray(lista)
        ? lista.sort((a, b) => new Date(b.date_created) - new Date(a.date_created))[0]
        : null
      if (reciente?.file_name) {
        fileName = reciente.file_name
        console.log('[MP] bank_report listo:', fileName)
        break
      }
    }
  }

  if (!fileName) throw new Error('Timeout esperando bank_report de MP')

  const csvRes = await fetch(
    `https://api.mercadopago.com/v1/account/bank_report/${fileName}`,
    { headers: { 'Authorization': `Bearer ${TOKEN}` } }
  )
  if (!csvRes.ok) throw new Error('Error descargando CSV del bank_report')
  const csvText = await csvRes.text()
  return parsearBankReportCSV(csvText)
}

const COLUMN_MAP = {
  'ID DE OPERACIÓN EN MERCADO PAGO': 'SOURCE_ID',
  'CÓDIGO DE REFERENCIA':            'EXTERNAL_REFERENCE',
  'TIPO DE MEDIO DE PAGO':           'PAYMENT_METHOD_TYPE',
  'TIPO DE OPERACIÓN':               'TRANSACTION_TYPE',
  'VALOR DE LA COMPRA':              'TRANSACTION_AMOUNT',
  'MONTO NETO DE LA OPERACIÓN':      'REAL_AMOUNT',
  'COMISIONES + IVA':                'FEE_AMOUNT',
  'FECHA DE ORIGEN':                 'TRANSACTION_DATE',
  'FECHA CORTA DE APROBACIÓN':       'SETTLEMENT_DATE_SHORT',
  'BANCO DE ORIGEN':                 'POI_BANK_NAME',
  'MONTO NETO DE LA OPERACIÓN QUE IMPACTÓ EN TU DINERO': 'SETTLEMENT_NET_AMOUNT',
  'DATOS EXTRA':                     'METADATA',
  'FECHA DE APROBACIÓN':             'SETTLEMENT_DATE',
  'MEDIO DE PAGO':                   'PAYMENT_METHOD',
}

function parsearBankReportCSV(csvText) {
  const lineas = csvText.split('\n').filter(l => l.trim())
  if (lineas.length < 2) return []

  const sep = lineas[0].includes(';') ? ';' : ','
  const header = lineas[0].split(sep).map(h => {
    const normalizado = h.trim().replace(/"/g, '').toUpperCase()
    return COLUMN_MAP[normalizado] || normalizado
  })

  console.log('[MP bank_report] columnas:', header)
  console.log('[MP bank_report] filas de datos:', lineas.length - 1)

  const movimientos = []

  for (let i = 1; i < lineas.length; i++) {
    const cols = lineas[i].split(sep).map(c => c.trim().replace(/"/g, ''))

    const get = (key) => {
      const idx = header.indexOf(key)
      return idx >= 0 ? (cols[idx] || '') : ''
    }

    const sourceId      = get('SOURCE_ID')
    const transAmount   = parseFloat(get('TRANSACTION_AMOUNT') || get('REAL_AMOUNT') || '0')
    const fecha         = get('TRANSACTION_DATE') || get('SETTLEMENT_DATE')
    const paymentMethod = get('PAYMENT_METHOD_TYPE')
    const transType     = get('TRANSACTION_TYPE')
    const feeAmount     = parseFloat(get('FEE_AMOUNT') || '0')

    if (!fecha || isNaN(transAmount) || transAmount === 0) continue

    let descripcion = `MP: ${transType}`
    if (paymentMethod === 'bank_transfer')    descripcion = 'MP: Transferencia bancaria'
    else if (paymentMethod === 'credit_card') descripcion = 'MP: Pago tarjeta crédito'
    else if (paymentMethod === 'debit_card')  descripcion = 'MP: Pago tarjeta débito'
    else if (paymentMethod === 'available_money') descripcion = 'MP: Movimiento cuenta'

    movimientos.push({
      id: `mp-bank-${sourceId || i}`,
      fecha: fecha.slice(0, 10),
      descripcion,
      monto: Math.abs(transAmount),
      tipo: transAmount > 0 ? 'abono' : 'cargo',
      glosa: `MP ${paymentMethod}${feeAmount !== 0 ? ` | comisión: $${Math.abs(feeAmount)}` : ''}`.trim(),
    })
  }

  console.log('[MP bank_report] movimientos parseados:', movimientos.length)
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

// ── POST /report-webhook — notificación de reporte listo (sin auth) ──────────
router.post('/report-webhook', async (req, res) => {
  res.sendStatus(200) // responder INMEDIATAMENTE

  try {
    const secret    = process.env.MP_WEBHOOK_SECRET
    const signature = req.headers['x-signature']
    if (signature && secret) {
      console.log('[MP report-webhook] firma recibida:', signature)
    }

    const fileName =
      req.body?.data?.id ||
      req.body?.file_name ||
      req.body?.files?.find(f => f.type === 'file/csv')?.name ||
      null

    if (!fileName) {
      console.log('[MP report-webhook] sin fileName en body:', JSON.stringify(req.body))
      return
    }

    console.log('[MP report-webhook] descargando reporte:', fileName)

    const TOKEN = process.env.MP_ACCESS_TOKEN
    const endpoints = [
      `https://api.mercadopago.com/v1/account/settlement_report/${fileName}`,
      `https://api.mercadopago.com/v1/account/bank_report/${fileName}`,
      `https://api.mercadopago.com/v1/account/release_report/${fileName}`,
    ]

    let csvText = null
    for (const url of endpoints) {
      const r = await fetch(url, { headers: { 'Authorization': `Bearer ${TOKEN}` } })
      if (r.ok) {
        csvText = await r.text()
        console.log(`[MP report-webhook] descargado desde: ${url}`)
        break
      }
      console.log(`[MP report-webhook] falló: ${url} → ${r.status}`)
    }

    if (!csvText) {
      console.error('[MP report-webhook] no se pudo descargar el CSV de ningún endpoint')
      return
    }

    const movimientos = parsearBankReportCSV(csvText)
    const empresaId   = await getEmpresaId()
    if (!empresaId) return

    let procesados = 0
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
      if (error) console.error('[MP report-webhook] upsert error:', error.message, row.id)
      else procesados++
    }

    console.log(`[MP report-webhook] procesados ${procesados} movimientos de ${fileName}`)
  } catch (err) {
    console.error('[MP report-webhook] error:', err.message)
  }
})

// ── GET /setup — activa reporte diario automático (llamar una vez) ────────────
router.get('/setup', requireAuth, async (req, res) => {
  try {
    const setupRes = await fetch('https://api.mercadopago.com/v1/account/bank_report/config', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scheduled: true, frequency: { hour: 6, type: 'daily' } }),
    })
    const config = await setupRes.json()
    if (!setupRes.ok) throw new Error(config.message || `MP error ${setupRes.status}`)
    res.json({ data: { ok: true, config } })
  } catch (err) {
    console.error('[MP setup] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

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

    const movimientos = await obtenerUltimoBankReport(30)

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

    res.json({ data: { sincronizados, total: movimientos.length, fuente: 'bank_report' } })
  } catch (err) {
    console.error('[MP sync] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
