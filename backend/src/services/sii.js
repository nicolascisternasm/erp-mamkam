const forge = require('node-forge')
const axios = require('axios')
const { SignedXml } = require('xml-crypto')
const tough = require('tough-cookie')
const { wrapper } = require('axios-cookiejar-support')
const crypto = require('crypto')

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
  const cookieJar = new tough.CookieJar()
  const axiosSession = wrapper(axios.create({ jar: cookieJar }))

  await axiosSession.get('https://zeusr.sii.cl/AUT2000/InicioAutenticacion.html', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': 'https://www.sii.cl/',
    },
  })

  const loginData = new URLSearchParams({
    rut,
    dv: '6',
    clave,
    referencia: 'https://www4.sii.cl/consdcvinternetui/#/index',
  })

  const loginResponse = await axiosSession.post(
    'https://herculesr.sii.cl/cgi_AUT2000/autInicio.cgi',
    loginData.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://zeusr.sii.cl/AUT2000/InicioAutenticacion.html',
        'Origin': 'https://zeusr.sii.cl',
      },
      maxRedirects: 5,
    }
  )

  console.log('[SII Login] status:', loginResponse.status)

  await axiosSession.get('https://www4.sii.cl/consdcvinternetui/#/index', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.sii.cl/',
    },
  })

  return { axiosSession, cookieJar }
}

async function consultarRCV(rut, dv, periodo, tipo = 'COMPRA') {
  const token = await obtenerToken()

  const claveSII = process.env.SII_CLAVE
  const { axiosSession } = await loginWebSII(rut, claveSII)

  await axiosSession.get(
    'https://www4.sii.cl/consdcvinternetui/services/data/facadeService/getResumen'
  ).catch(() => {})

  const transactionId = crypto.randomUUID()

  const response = await axiosSession.post(
    'https://www4.sii.cl/consdcvinternetui/services/data/facadeService/getResumen',
    {
      metaData: {
        namespace: 'cl.sii.sdi.lob.diii.consdcv.data.api.interfaces.FacadeService/getResumen',
        conversationId: token,
        transactionId,
        page: null,
      },
      data: {
        rutEmisor: rut,
        dvEmisor: dv,
        ptributario: periodo,
        estadoContab: 'REGISTRO',
        operacion: tipo,
        busquedaInicial: true,
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www4.sii.cl',
        'Referer': 'https://www4.sii.cl/consdcvinternetui/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': `TOKEN=${token}; CSESSIONID=${token}`,
      },
    }
  )

  console.log('[SII RCV] status:', response.status)
  console.log('[SII RCV] data:', JSON.stringify(response.data).substring(0, 500))

  return response.data
}

module.exports = { obtenerToken, consultarRCV, obtenerSemilla }
