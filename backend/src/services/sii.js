const forge = require('node-forge')
const axios = require('axios')
const https = require('https')
const { SignedXml } = require('xml-crypto')
const crypto = require('crypto')
const supabase = require('../lib/supabase')

// Agent TLS dedicado para *.sii.cl — resuelve incompatibilidad RSA-PSS en
// servidores gubernamentales antiguos con OpenSSL 3.x (Node 18+).
// SSL_OP_LEGACY_SERVER_CONNECT permite negociar con padding no estándar.
// rejectUnauthorized sigue en true — no desactivamos validación de certificado.
const siiAgent = new https.Agent({
  secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3',
  rejectUnauthorized: true,
})

const SII_AMBIENTE = 'https://palena.sii.cl' // producción
// const SII_AMBIENTE = 'https://maullin.sii.cl' // certificación

async function obtenerSemilla() {
  const url = 'https://palena.sii.cl/DTEWS/CrSeed.jws'
  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <getSeed/>
  </soapenv:Body>
</soapenv:Envelope>`

  const response = await axios.post(url, soapEnvelope, {
    httpsAgent: siiAgent,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': '',
    },
  })

  console.log('[SII] Respuesta semilla status:', response.status)
  console.log('[SII] Respuesta semilla data:', response.data.substring(0, 500))

  const rawXml = response.data
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')

  console.log('[SII] XML desescapado (primeros 500):', rawXml.substring(0, 500))

  const match = rawXml.match(/<(?:SII:)?SEMILLA>(\d+)<\/(?:SII:)?SEMILLA>/)
  if (!match) throw new Error('No se pudo obtener semilla del SII')
  return match[1]
}

async function firmarSemilla(semilla) {
  const pfxBase64 = process.env.SII_CERT_PFX
  const pfxPassword = process.env.SII_CERT_PASSWORD || ''

  if (!pfxBase64) throw new Error('SII_CERT_PFX no configurado')

  const pfxDer = Buffer.from(pfxBase64, 'base64').toString('binary')
  const p12Asn1 = forge.asn1.fromDer(pfxDer)
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, pfxPassword)

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })

  const privateKeyObj = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key
  const certificate = certBags[forge.pki.oids.certBag][0].cert

  const privateKeyPem = forge.pki.privateKeyToPem(privateKeyObj)
  const certPem = forge.pki.certificateToPem(certificate)

  const certBase64 = certPem
    .split('\n')
    .filter(line => !line.startsWith('-----'))
    .join('')
    .trim()

  const xmlToSign = `<getToken><item><Semilla>${semilla}</Semilla></item></getToken>`

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  })

  sig.addReference({
    xpath: '/getToken',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
  })

  sig.keyInfoProvider = {
    getKeyInfo: () => `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`,
  }

  sig.computeSignature(xmlToSign)
  let xmlFirmado = sig.getSignedXml()

  const keyInfo = `<KeyInfo><X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data></KeyInfo>`
  xmlFirmado = xmlFirmado.replace('</Signature>', `${keyInfo}</Signature>`)

  console.log('[SII] XML firmado completo:', xmlFirmado)
  return xmlFirmado
}

async function obtenerToken() {
  const semilla = await obtenerSemilla()
  console.log('[SII] Semilla obtenida:', semilla)

  const xmlFirmado = await firmarSemilla(semilla)

  const url = 'https://palena.sii.cl/DTEWS/GetTokenFromSeed.jws'
  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <getToken>
      <pszXml>${xmlFirmado.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pszXml>
    </getToken>
  </soapenv:Body>
</soapenv:Envelope>`

  const response = await axios.post(url, soapEnvelope, {
    httpsAgent: siiAgent,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': '',
    },
  })

  console.log('[SII] Respuesta token status:', response.status)
  console.log('[SII] Respuesta token data:', response.data.substring(0, 500))

  const rawTokenXml = response.data
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')

  console.log('[SII] Token XML desescapado COMPLETO:', rawTokenXml)

  const match = rawTokenXml.match(/<(?:SII:)?TOKEN>([^<]+)<\/(?:SII:)?TOKEN>/)
  if (!match) {
    const errorMatch = rawTokenXml.match(/<(?:SII:)?DESCRIPCION>([^<]+)<\/(?:SII:)?DESCRIPCION>/)
    const errorDesc = errorMatch ? errorMatch[1] : 'sin descripción'
    throw new Error(`SII rechazó el token: ${errorDesc}`)
  }

  console.log('[SII] Token obtenido exitosamente')
  return match[1]
}

async function loginWebSII(rut, clave) {
  const resp1 = await axios.get('https://zeusr.sii.cl/AUT2000/InicioAutenticacion.html', {
    httpsAgent: siiAgent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    maxRedirects: 5,
  })

  const cookies1 = (resp1.headers['set-cookie'] || []).join('; ')
  console.log('[SII Login] cookies iniciales:', cookies1.substring(0, 100))

  const loginData = new URLSearchParams({
    rut,
    dv: '6',
    clave,
    referencia: 'https://www4.sii.cl/consdcvinternetui/#/index',
  })

  const resp2 = await axios.post(
    'https://herculesr.sii.cl/cgi_AUT2000/autInicio.cgi',
    loginData.toString(),
    {
      httpsAgent: siiAgent,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://zeusr.sii.cl/AUT2000/InicioAutenticacion.html',
        'Origin': 'https://zeusr.sii.cl',
        'Cookie': cookies1,
      },
      maxRedirects: 5,
      validateStatus: s => s < 500,
    }
  )

  const cookies2 = [cookies1, ...(resp2.headers['set-cookie'] || [])].join('; ')
  console.log('[SII Login] status login:', resp2.status)
  console.log('[SII Login] cookies tras login:', cookies2.substring(0, 200))

  const resp3 = await axios.get('https://www4.sii.cl/consdcvinternetui/', {
    httpsAgent: siiAgent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Cookie': cookies2,
      'Referer': 'https://www.sii.cl/',
    },
    maxRedirects: 5,
    validateStatus: s => s < 500,
  })

  const cookiesFinal = [cookies2, ...(resp3.headers['set-cookie'] || [])].join('; ')
  console.log('[SII Login] cookies finales:', cookiesFinal.substring(0, 300))
  return cookiesFinal
}

async function consultarRCV(rut, dv, periodo, tipo = 'COMPRA', empresaId = null) {
  const tipoUp = tipo.toUpperCase()
  console.log('[SII] consultarRCV iniciado - tipo:', tipoUp, 'periodo:', periodo)

  let cookiesStr = null

  // Leer cookies de sesión web desde sii_config (obtenidas con loginWebSII)
  if (empresaId) {
    const { data: cfg } = await supabase
      .from('sii_config')
      .select('sii_cookies')
      .eq('empresa_id', empresaId)
      .single()
    cookiesStr = cfg?.sii_cookies || null
    console.log('[SII] cookies desde sii_config:', cookiesStr ? 'OK (no vacías)' : 'no encontradas')
  }

  // Fallback: login directo con SII_CLAVE de env
  if (!cookiesStr) {
    const claveSII = process.env.SII_CLAVE
    if (!claveSII) throw new Error('No hay cookies de sesión SII ni SII_CLAVE configurada')
    console.log('[SII] sin cookies guardadas, haciendo login con SII_CLAVE')
    cookiesStr = await loginWebSII(rut, claveSII)
  }

  // Seleccionar endpoint según tipo — NO usamos token SOAP aquí, solo cookies web
  const endpoint  = tipoUp === 'VENTA' ? 'getDetalleVenta' : 'getDetalleCompra'
  const url       = `https://www4.sii.cl/consdcvinternetui/services/data/facadeService/${endpoint}`
  const namespace = `cl.sii.sdi.lob.diii.consdcv.data.api.interfaces.FacadeService/${endpoint}`

  const body = {
    metaData: {
      namespace,
      conversationId: crypto.randomUUID(),
      transactionId:  crypto.randomUUID(),
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
  }

  console.log('[SII RCV] URL:', url)
  console.log('[SII RCV] body:', JSON.stringify(body))
  console.log('[SII RCV] cookiesStr presente:', !!cookiesStr)

  const axiosConfig = {
    httpsAgent: siiAgent,
    headers: {
      'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Referer':          'https://www4.sii.cl/consdcvinternetui/',
      'Origin':           'https://www4.sii.cl',
      'Accept':           'application/json, text/plain, */*',
      'Content-Type':     'application/json;charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie':           cookiesStr,
    },
    timeout: 30000,
    validateStatus: () => true,
  }

  // Un reintento automático solo en errores de conexión (socket hang up / ECONNRESET)
  let response
  try {
    response = await axios.post(url, body, axiosConfig)
  } catch (err) {
    const esConexion = err.code === 'ECONNRESET' || String(err.message).includes('socket hang up')
    if (!esConexion) throw err
    console.log('[SII RCV] socket hang up — reintentando una vez...')
    response = await axios.post(url, body, axiosConfig)
  }

  console.log('[SII RCV] status:', response.status)
  console.log('[SII RCV] response.data (primeros 1000):', JSON.stringify(response.data).substring(0, 1000))

  if (response.status >= 400) {
    throw new Error(`SII respondió con status ${response.status} para ${endpoint}: ${JSON.stringify(response.data).substring(0, 300)}`)
  }

  return response.data
}

module.exports = { obtenerToken, consultarRCV, obtenerSemilla, loginWebSII }
