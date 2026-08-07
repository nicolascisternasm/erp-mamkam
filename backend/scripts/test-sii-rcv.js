/**
 * Script standalone para probar consultarRCV sin necesidad de Express ni Supabase.
 * Sirve para descartar si el problema es un bloqueo de IP de Railway.
 *
 * USO:
 *   node backend/scripts/test-sii-rcv.js <periodo> <tipo> "<cookies>"
 *
 * Ejemplos:
 *   node backend/scripts/test-sii-rcv.js 202607 COMPRA "PHPSESSID=abc123; siiSession=xyz"
 *   SII_COOKIES="PHPSESSID=abc..." node backend/scripts/test-sii-rcv.js 202607 VENTA
 *
 * Dónde obtener las cookies:
 *   1. Abre https://www4.sii.cl/consdcvinternetui/ en Chrome con tu clave tributaria
 *   2. DevTools → Application → Cookies → www4.sii.cl
 *   3. Copia todos los pares nombre=valor separados por "; "
 *   O bien copia el valor completo del header "Cookie:" desde DevTools → Network
 *   (cualquier request al dominio sii.cl después de hacer login)
 */

'use strict'
const https = require('https')
const { randomUUID } = require('crypto')

const [,, periodoArg, tipoArg, cookiesArg] = process.argv

const periodo    = periodoArg || process.env.SII_PERIODO || '202607'
const tipoUp     = (tipoArg  || process.env.SII_TIPO    || 'COMPRA').toUpperCase()
const cookiesStr = cookiesArg || process.env.SII_COOKIES || ''

// RUT hardcodeado igual que en services/sii.js — cámbialo si tu empresa tiene otro
const rut = process.env.SII_RUT || '78348727'
const dv  = process.env.SII_DV  || '6'

if (!cookiesStr) {
  console.error('\nERROR: Falta el argumento de cookies.\n')
  console.error('Uso:')
  console.error('  node backend/scripts/test-sii-rcv.js <periodo> <tipo> "<cookies>"')
  console.error('  SII_COOKIES="..." node backend/scripts/test-sii-rcv.js 202607 COMPRA\n')
  process.exit(1)
}

const endpoint  = tipoUp === 'VENTA' ? 'getDetalleVenta' : 'getDetalleCompra'
const namespace = `cl.sii.sdi.lob.diii.consdcv.data.api.interfaces.FacadeService/${endpoint}`

const body = JSON.stringify({
  metaData: {
    namespace,
    conversationId: randomUUID(),
    transactionId:  randomUUID(),
    page: null,
  },
  data: {
    rutEmisor:    rut,
    dvEmisor:     dv,
    ptributario:  periodo,
    estadoContab: 'REGISTRO',
    codTipoDoc:   0,
    operacion:    tipoUp,
  },
})

const options = {
  hostname: 'www4.sii.cl',
  path:     `/consdcvinternetui/services/data/facadeService/${endpoint}`,
  method:   'POST',
  headers: {
    'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Referer':          'https://www4.sii.cl/consdcvinternetui/',
    'Origin':           'https://www4.sii.cl',
    'Accept':           'application/json, text/plain, */*',
    'Content-Type':     'application/json;charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Length':   Buffer.byteLength(body),
    'Cookie':           cookiesStr,
  },
}

console.log('\n=== test-sii-rcv ===')
console.log('RUT:      ', rut + '-' + dv)
console.log('Período:  ', periodo)
console.log('Tipo:     ', tipoUp)
console.log('Endpoint: ', `https://www4.sii.cl${options.path}`)
console.log('Cookies presentes:', cookiesStr.length > 0 ? 'SÍ (' + cookiesStr.length + ' chars)' : 'NO')
console.log('====================\n')

const req = https.request(options, (res) => {
  console.log('HTTP status:', res.statusCode)
  console.log('Headers respuesta:', JSON.stringify(res.headers, null, 2))

  let raw = ''
  res.setEncoding('utf8')
  res.on('data', (chunk) => { raw += chunk })
  res.on('end', () => {
    console.log('\n--- Body completo (' + raw.length + ' chars) ---')
    console.log(raw)

    try {
      const parsed = JSON.parse(raw)
      console.log('\n--- JSON parseado ---')
      console.log(JSON.stringify(parsed, null, 2))
    } catch {
      console.log('\n(El body no es JSON válido)')
    }
  })
})

req.on('error', (err) => {
  console.error('\nERROR de red:', err.code, err.message)
  if (err.code === 'ECONNRESET' || err.message.includes('socket hang up')) {
    console.error('→ Socket hang up: el servidor cerró la conexión.')
    console.error('  Posible bloqueo de IP o sesión expirada.')
  }
})

req.setTimeout(30000, () => {
  console.error('\nERROR: Timeout de 30s alcanzado.')
  req.destroy()
})

req.write(body)
req.end()
