const forge = require('node-forge')
const axios = require('axios')

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

  const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key
  const certificate = certBags[forge.pki.oids.certBag][0].cert

  const xmlToSign = `<?xml version="1.0"?>
<getToken>
  <item>
    <Semilla>${semilla}</Semilla>
  </item>
</getToken>`

  const md = forge.md.sha1.create()
  md.update(xmlToSign, 'utf8')
  const signature = forge.util.encode64(privateKey.sign(md))

  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes()
  const certBase64 = forge.util.encode64(certDer)

  const xmlFirmado = `<?xml version="1.0"?>
<getToken>
  <item>
    <Semilla>${semilla}</Semilla>
  </item>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
      <Reference URI="">
        <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
        <DigestValue>${signature}</DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>${signature}</SignatureValue>
    <KeyInfo>
      <X509Data>
        <X509Certificate>${certBase64}</X509Certificate>
      </X509Data>
    </KeyInfo>
  </Signature>
</getToken>`

  console.log('[SII] XML a firmar (primeros 200 chars):', xmlFirmado.substring(0, 200))
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

  console.log('[SII] Token XML desescapado:', rawTokenXml.substring(0, 500))

  const match = rawTokenXml.match(/<(?:SII:)?TOKEN>([^<]+)<\/(?:SII:)?TOKEN>/)
  if (!match) {
    const errorMatch = rawTokenXml.match(/<(?:SII:)?DESCRIPCION>([^<]+)<\/(?:SII:)?DESCRIPCION>/)
    const errorDesc = errorMatch ? errorMatch[1] : 'sin descripción'
    throw new Error(`SII rechazó el token: ${errorDesc}`)
  }

  console.log('[SII] Token obtenido exitosamente')
  return match[1]
}

async function consultarRCV(rut, periodo, tipo = 'COMPRA') {
  // rut: '78348727' (sin dígito verificador ni puntos)
  // periodo: '202407' (YYYYMM)
  // tipo: 'COMPRA' o 'VENTA'

  const token = await obtenerToken()

  const url = `${SII_AMBIENTE}/cgi_dte/UF_SerachEngine.cgi`
  const params = new URLSearchParams({
    rutEmisor: rut,
    dvEmisor: '6',
    periodoTributario: periodo,
    tipoDte: '0',
    token,
  })

  const response = await axios.get(`${url}?${params}`, {
    headers: { Cookie: `TOKEN=${token}` },
  })

  return response.data
}

module.exports = { obtenerToken, consultarRCV, obtenerSemilla }
