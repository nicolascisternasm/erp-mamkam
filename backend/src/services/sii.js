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

async function consultarRCVPlaywright(rut, dv, clave, periodo, operacion) {
  const { chromium } = require('playwright')
  const operUp = (operacion || 'AMBOS').toUpperCase()

  const memMB = () => {
    const m = process.memoryUsage()
    return `rss=${Math.round(m.rss/1e6)}MB heap=${Math.round(m.heapUsed/1e6)}/${Math.round(m.heapTotal/1e6)}MB`
  }
  console.log(`[RCV] inicio consultarRCVPlaywright — memoria: ${memMB()}`)

  let browser
  const T          = 20000 // timeout por operación de UI (ms)
  const DELAY_RUT  = 200   // ms entre teclas del RUT para el reformateo JS

  const run = async () => {
    browser = await chromium.launch({
      headless: true,
      // --no-sandbox obligatorio en Railway (corre como root en container)
      // --disable-dev-shm-usage evita crashes por /dev/shm de 64 MB en Docker
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    })

    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      })
      const page = await context.newPage()

      // ── Paso 1: www.sii.cl ──
      console.log('[RCV] paso 1 — www.sii.cl')
      await page.goto('https://www.sii.cl', { waitUntil: 'domcontentloaded', timeout: 30000 })

      // ── Paso 2: misiir.sii.cl → redirige al formulario de login ──
      console.log('[RCV] paso 2 — misiir.sii.cl')
      await page.goto('https://misiir.sii.cl/cgi_misii/siihome.cgi', {
        referer: 'https://www.sii.cl',
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })

      if (!page.url().includes('InicioAutenticacion') && !page.url().includes('zeusr')) {
        const hrefLogin = await page.$eval(
          'a[href*="zeusr"], a[href*="InicioAutenticacion"], a[href*="AUT2000"]',
          a => a.href
        ).catch(() => null)
        if (hrefLogin) {
          await page.goto(hrefLogin, { referer: page.url(), waitUntil: 'domcontentloaded', timeout: 30000 })
        }
      }

      // ── Paso 3: completar formulario de login ──
      console.log('[RCV] paso 3 — login')
      await page.waitForSelector('#rutcntr', { timeout: 30000 })
      const rutCompleto = `${rut}${dv}`

      const teclearRut = async () => {
        const loc = page.locator('#rutcntr')
        await loc.click({ timeout: T })
        await page.keyboard.press('Control+a')
        await page.keyboard.press('Delete')
        await page.waitForTimeout(200)
        await loc.pressSequentially(rutCompleto, { delay: DELAY_RUT, timeout: T })
        await page.waitForTimeout(500)
        return (await loc.inputValue()).replace(/\D/g, '')
      }

      let digits = await teclearRut()
      if (digits !== rutCompleto) {
        digits = await teclearRut()
        if (digits !== rutCompleto) {
          throw new Error(`[RCV] RUT mal ingresado tras 2 intentos (dígitos obtenidos: "${digits}")`)
        }
      }

      await page.locator('input[type="password"]:visible').first()
        .pressSequentially(clave, { delay: 50, timeout: T })

      try {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
          page.locator('button:has-text("INGRESAR"), input[value="INGRESAR"], button:has-text("Ingresar")')
            .first().click({ timeout: T }),
        ])
      } catch (e) { /* probable autosubmit — no es un error */ }

      // waitForNavigation puede resolver en el primer 302 (zeusr.sii.cl) antes de que
      // ocurra la redirección final a misiir.sii.cl. Esperamos a salir del dominio de login.
      if (page.url().includes('zeusr.sii.cl/cgi_AUT2000')) {
        console.log('[RCV] post-login: todavía en login, esperando redirección final...')
        try {
          await page.waitForURL(
            url => !url.href.includes('zeusr.sii.cl/cgi_AUT2000'),
            { timeout: 15000 }
          )
        } catch { /* si no redirige en 15s lo detecta el chequeo de abajo */ }
      }

      console.log('[RCV] URL antes de avanzar al paso 4:', page.url())
      const urlPostLogin = page.url()
      console.log('[RCV] URL post-login:', urlPostLogin)
      if (urlPostLogin.includes('errorp') || urlPostLogin.includes('homer.sii.cl/errorp')) {
        throw new Error('Login SII rechazado — verifica SII_CLAVE')
      }
      if (urlPostLogin.includes('zeusr.sii.cl/cgi_AUT2000')) {
        throw new Error('Login SII incompleto — redirección post-submit no ocurrió a tiempo')
      }

      // ── Paso 4: capturar conversationId y consultar RCV ──
      // El conversationId DEBE ser el que la propia SPA del SII genera en getDatosInicio.
      // Un valor inventado es rechazado con "El token no es valido: NO Existen Datos".
      console.log('[RCV] paso 4 — navegando a consdcvinternetui')
      let sessionConversationId = null
      page.on('request', req => {
        if (req.url().includes('getDatosInicio') && !sessionConversationId) {
          try {
            const body = JSON.parse(req.postData())
            sessionConversationId = body?.metaData?.conversationId || null
          } catch (e) {}
        }
      })

      await page.goto('https://www4.sii.cl/consdcvinternetui/#/index', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })

      let waited = 0
      while (!sessionConversationId && waited < 5000) {
        await page.waitForTimeout(200)
        waited += 200
      }
      if (!sessionConversationId) {
        throw new Error('[RCV] no se pudo capturar conversationId de la SPA del SII')
      }
      console.log('[RCV] conversationId capturado')

      // Espera 2s para que la SPA termine getDcvEmpresasAutorizadas antes de nuestras llamadas
      await page.waitForTimeout(2000)

      // Helper: llama un endpoint del facadeService desde el contexto del browser.
      // credentials: 'include' envía las cookies de sesión automáticamente.
      const facadeCall = (endpoint, data) => page.evaluate(
        async ({ endpoint, conversationId, data }) => {
          const res = await fetch(
            `https://www4.sii.cl/consdcvinternetui/services/data/facadeService/${endpoint}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                metaData: {
                  namespace: `cl.sii.sdi.lob.diii.consdcv.data.api.interfaces.FacadeService/${endpoint}`,
                  conversationId,
                  transactionId: crypto.randomUUID(),
                  page: null,
                },
                data,
              }),
            }
          )
          return res.json()
        },
        { endpoint, conversationId: sessionConversationId, data }
      )

      const docs = []

      if (operUp === 'COMPRA' || operUp === 'AMBOS') {
        console.log('[RCV] consultando COMPRA — período:', periodo)
        const resumenCompra = await facadeCall('getResumen', {
          rutEmisor: rut, dvEmisor: dv, ptributario: periodo,
          estadoContab: 'REGISTRO', operacion: 'COMPRA', busquedaInicial: true,
        })
        console.log('[RCV] getResumen COMPRA codRespuesta:', resumenCompra?.codRespuesta)

        const tiposCompra = (resumenCompra?.data || [])
          .filter(i => i.dcvTipoIngresoDoc === 'DET_ELE' || i.dcvTipoIngresoDoc === 'DET_PAP')
          .map(i => i.rsmnTipoDocInteger)

        for (const codTipoDoc of tiposCompra) {
          const resp = await facadeCall('getDetalleCompra', {
            rutEmisor: rut, dvEmisor: dv, ptributario: periodo,
            codTipoDoc: String(codTipoDoc),
            operacion: 'COMPRA', estadoContab: 'REGISTRO',
            accionRecaptcha: 'RCV_DETC', tokenRecaptcha: 't-o-k-e-n-web',
          })
          console.log(`[RCV] getDetalleCompra tipo ${codTipoDoc}: ${resp?.data?.length ?? 0} docs`)
          if (Array.isArray(resp?.data)) docs.push(...resp.data)
        }
      }

      if (operUp === 'VENTA' || operUp === 'AMBOS') {
        console.log('[RCV] consultando VENTA — período:', periodo)
        const resumenVenta = await facadeCall('getResumen', {
          rutEmisor: rut, dvEmisor: dv, ptributario: periodo,
          estadoContab: 'REGISTRO', operacion: 'VENTA', busquedaInicial: true,
        })
        console.log('[RCV] getResumen VENTA codRespuesta:', resumenVenta?.codRespuesta)

        const tiposVenta = (resumenVenta?.data || [])
          .filter(i => i.dcvTipoIngresoDoc === 'DET_ELE' || i.dcvTipoIngresoDoc === 'DET_PAP')
          .map(i => i.rsmnTipoDocInteger)

        for (const codTipoDoc of tiposVenta) {
          const resp = await facadeCall('getDetalleVenta', {
            rutEmisor: rut, dvEmisor: dv, ptributario: periodo,
            codTipoDoc: String(codTipoDoc),
            operacion: '', estadoContab: '',
            accionRecaptcha: 'RCV_DETV', tokenRecaptcha: 't-o-k-e-n-web',
          })
          console.log(`[RCV] getDetalleVenta tipo ${codTipoDoc}: ${resp?.data?.length ?? 0} docs`)
          if (Array.isArray(resp?.data)) docs.push(...resp.data)
        }
      }

      console.log(`[RCV] total docs: ${docs.length} — memoria antes de cerrar: ${memMB()}`)
      return docs
    } finally {
      await browser.close().catch(() => {})
      console.log(`[RCV] browser cerrado — memoria final: ${memMB()}`)
    }
  }

  // Timeout global de 60s — cierra el browser si el flujo se queda colgado
  let timeoutId
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      if (browser) browser.close().catch(() => {})
      reject(new Error('consultarRCVPlaywright: timeout global (60s)'))
    }, 60000)
  })

  const runPromise = run()
  runPromise.catch(() => {}) // evita unhandled rejection si el timeout gana primero

  try {
    return await Promise.race([runPromise, timeoutPromise])
  } finally {
    clearTimeout(timeoutId)
  }
}

function newUUID() {
  const b = crypto.randomBytes(16)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = b.toString('hex')
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`
}

const parseFecha = s => {
  if (!s) return null
  const [d, m, y] = s.split('/')
  return `${y}-${m}-${d}`
}

const parseFechaHora = s => {
  if (!s?.trim()) return null
  const [fecha, hora] = s.trim().split(' ')
  const [d, m, y] = fecha.split('/')
  return `${y}-${m}-${d}T${hora}`
}

async function guardarDocumentosRCV(documentos, tipo, empresaId) {
  if (!Array.isArray(documentos) || !documentos.length) return { guardados: 0 }

  let guardados = 0

  for (const doc of documentos) {
    const valores = {
      empresa_id:          empresaId,
      tipo,
      tipo_doc:            String(doc.detTipoDoc),
      tipo_compra_venta:   '',
      folio:               String(doc.detNroDoc ?? ''),
      numero_interno:      '',
      rut_contraparte:     `${doc.detRutDoc}-${doc.detDvDoc}`,
      razon_social:        doc.detRznSoc ?? '',
      fecha:               parseFecha(doc.detFchDoc),
      fecha_recepcion:     parseFechaHora(doc.detFecRecepcion),
      monto_exento:        doc.detMntExe ?? 0,
      neto:                doc.detMntNeto ?? 0,
      iva:                 doc.detMntIVA ?? 0,
      iva_no_recuperable:  doc.detMntIVANoRec ?? 0,
      total:               doc.detMntTotal ?? 0,
      estado:              'vigente',
      sii_detalle_codigo:  doc.detCodigo ?? null,
      periodo:             String(doc.detPcarga ?? ''),
    }

    // Paso 1: buscar por sii_detalle_codigo
    if (doc.detCodigo != null) {
      const { data: existing } = await supabase
        .from('facturas_sii')
        .select('id')
        .eq('sii_detalle_codigo', doc.detCodigo)
        .maybeSingle()

      if (existing) {
        const { error } = await supabase
          .from('facturas_sii')
          .update(valores)
          .eq('id', existing.id)
        if (error) throw error
        guardados++
        continue
      }
    }

    // Paso 2: buscar por clave legada folio+empresa_id+tipo
    const folio = String(doc.detNroDoc ?? '')
    const { data: legacy } = await supabase
      .from('facturas_sii')
      .select('id')
      .eq('folio', folio)
      .eq('empresa_id', empresaId)
      .eq('tipo', tipo)
      .maybeSingle()

    if (legacy) {
      const { error } = await supabase
        .from('facturas_sii')
        .update(valores)
        .eq('id', legacy.id)
      if (error) throw error
      guardados++
      continue
    }

    // Paso 3: insertar nuevo
    const { error } = await supabase
      .from('facturas_sii')
      .insert({ id: newUUID(), ...valores })
    if (error) throw error
    guardados++
  }

  return { guardados }
}

module.exports = { obtenerToken, consultarRCVPlaywright, guardarDocumentosRCV, obtenerSemilla }
