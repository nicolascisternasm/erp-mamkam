const { Router } = require('express')
const { randomBytes } = require('crypto')
const supabase = require('../lib/supabase.js')
const { requireAuth } = require('../middleware/auth.js')

const router = Router()
router.use(requireAuth)

/* ── UUID helper ────────────────────────────────────────────────────── */
function newUUID() {
  const b = randomBytes(16)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = b.toString('hex')
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`
}

/* ── Tasas legales Chile 2026 ────────────────────────────────────────── */
const AFP_TASAS = {
  Capital:   10.44,
  Cuprum:    10.58,
  Habitat:   10.27,
  Modelo:    10.58,
  PlanVital: 10.58,
  ProVida:   10.58,
  Uno:       10.49,
}
const FONASA_PCT              = 7.0
const CESANTIA_TRAB_INDEF     = 0.6
const CESANTIA_EMP_INDEF      = 2.4
const CESANTIA_EMP_PLAZO_FIJO = 3.0
const MUTUAL_PCT              = 0.93
const SIS_PCT                 = 1.71  // Seguro de Invalidez y Sobrevivencia (aporte empleador)
const IMM                     = 500000
const TOPE_IMPONIBLE          = 3471550
const SUELDO_MINIMO_2026      = 539000

/* ── Mappers ────────────────────────────────────────────────────────── */
const fromTrab = (r) => ({
  id:              r.id,
  nombre:          r.nombre,
  rut:             r.rut,
  cargo:           r.cargo,
  sueldo:          r.sueldo           ?? 0,
  sueldoMinimo:    r.sueldo_minimo    ?? SUELDO_MINIMO_2026,
  estado:          r.estado,
  tipoContrato:    r.tipo_contrato    ?? 'indefinido',
  afp:             r.afp              ?? 'Habitat',
  porcentajeAfp:   r.porcentaje_afp   ?? 10.27,
  previsionSalud:  r.prevision_salud  ?? 'Fonasa',
  isapre:          r.isapre           ?? '',
  montoIsapre:     r.monto_isapre     ?? 0,
  bonoFijo:        r.bono_fijo        ?? 0,
  colacion:        r.colacion         ?? 0,
  movilizacion:    r.movilizacion     ?? 0,
  sueldoEsLiquido: r.sueldo_es_liquido ?? true,
  email:           r.email             ?? '',
})

const fromLiq = (r) => ({
  id:                    r.id,
  trabajadorId:          r.trabajador_id,
  trabajadorNombre:      r.trabajador_nombre,
  trabajadorRut:         r.trabajador_rut,
  periodo:               r.periodo,
  estado:                r.estado           ?? 'borrador',
  sueldoBase:            r.sueldo_base      ?? 0,
  bonoFijo:              r.bono_fijo        ?? 0,
  comision:              r.comision         ?? 0,
  gratificacion:         r.gratificacion    ?? 0,
  colacion:              r.colacion         ?? 0,
  movilizacion:          r.movilizacion     ?? 0,
  otrosHaberes:          r.otros_haberes    ?? 0,
  sueldoBruto:           r.sueldo_bruto     ?? 0,
  baseImponible:         r.base_imponible   ?? 0,
  afp:                   r.afp,
  porcentajeAfp:         r.porcentaje_afp   ?? 0,
  descuentoAfp:          r.descuento_afp    ?? 0,
  previsionSalud:        r.prevision_salud,
  porcentajeSalud:       r.porcentaje_salud ?? 0,
  descuentoSalud:        r.descuento_salud  ?? 0,
  descuentoCesantiaTrab: r.descuento_cesantia_trab ?? 0,
  otrosDescuentos:       r.otros_descuentos ?? 0,
  totalDescuentos:       r.total_descuentos ?? 0,
  sueldoLiquido:         r.sueldo_liquido   ?? 0,
  cesantiaEmpleador:     r.cesantia_empleador   ?? 0,
  mutualEmpleador:       r.mutual_empleador     ?? 0,
  costoEmpresa:          r.costo_empresa        ?? 0,
  diasTrabajados:        r.dias_trabajados      ?? 30,
  tipoContrato:          r.tipo_contrato        ?? 'indefinido',
  sueldoEsLiquido:       r.sueldo_es_liquido    ?? false,
  sueldoLiquidoPactado:  r.sueldo_liquido_pactado ?? 0,
  createdAt:             r.created_at,
  emailEnviado:          r.email_enviado   ?? false,
  emailFecha:            r.email_fecha     ?? null,
  emailMensaje:          r.email_mensaje   ?? null,
  pdfUrl:                r.pdf_url         ?? null,
  comprobanteUrl:        r.comprobante_url ?? null,
})

const toLiq = (liq, empresaId) => ({
  id:                      liq.id ?? newUUID(),
  empresa_id:              empresaId,
  trabajador_id:           liq.trabajadorId,
  trabajador_nombre:       liq.trabajadorNombre,
  trabajador_rut:          liq.trabajadorRut,
  periodo:                 liq.periodo,
  estado:                  liq.estado          ?? 'borrador',
  sueldo_base:             liq.sueldoBase      ?? 0,
  bono_fijo:               liq.bonoFijo        ?? 0,
  comision:                liq.comision        ?? 0,
  gratificacion:           liq.gratificacion   ?? 0,
  colacion:                liq.colacion        ?? 0,
  movilizacion:            liq.movilizacion    ?? 0,
  otros_haberes:           liq.otrosHaberes    ?? 0,
  sueldo_bruto:            liq.sueldoBruto     ?? 0,
  base_imponible:          liq.baseImponible   ?? 0,
  afp:                     liq.afp,
  porcentaje_afp:          liq.porcentajeAfp   ?? 0,
  descuento_afp:           liq.descuentoAfp    ?? 0,
  prevision_salud:         liq.previsionSalud,
  porcentaje_salud:        liq.porcentajeSalud ?? 0,
  descuento_salud:         liq.descuentoSalud  ?? 0,
  descuento_cesantia_trab: liq.descuentoCesantiaTrab ?? 0,
  otros_descuentos:        liq.otrosDescuentos ?? 0,
  total_descuentos:        liq.totalDescuentos ?? 0,
  sueldo_liquido:          liq.sueldoLiquido   ?? 0,
  cesantia_empleador:      liq.cesantiaEmpleador  ?? 0,
  mutual_empleador:        liq.mutualEmpleador    ?? 0,
  costo_empresa:           liq.costoEmpresa       ?? 0,
  dias_trabajados:         liq.diasTrabajados     ?? 30,
  tipo_contrato:           liq.tipoContrato       ?? 'indefinido',
  sueldo_es_liquido:       liq.sueldoEsLiquido    ?? false,
  sueldo_liquido_pactado:  liq.sueldoLiquidoPactado ?? 0,
})

/* ── Cálculo de liquidación ─────────────────────────────────────────── */
function calcular(trab, params = {}) {
  console.log('[CALC] trab recibido:', JSON.stringify({
    id: trab.id || trab.trabajadorId,
    nombre: trab.nombre,
    sueldo: trab.sueldo,
    sueldoMinimo: trab.sueldoMinimo,
    sueldoEsLiquido: trab.sueldoEsLiquido,
  }))

  const {
    periodo         = '',
    comision        = 0,
    otrosHaberes    = 0,
    diasTrabajados  = 30,
    otrosDescuentos = 0,
    faltasDescuento = 0,
  } = params

  const factor       = Math.min(diasTrabajados, 30) / 30
  const tipo         = trab.tipoContrato  ?? 'indefinido'
  const colacion     = trab.colacion      ?? 0
  const movilizacion = trab.movilizacion  ?? 0
  const bono_fijo    = Math.round((trab.bonoFijo ?? 0) * factor)
  const tope_gratif  = Math.round(IMM * 4.75 / 12)
  const pct_afp      = trab.porcentajeAfp ?? AFP_TASAS[trab.afp] ?? 10.27
  const esIsapre     = trab.previsionSalud === 'Isapre'

  // Sueldo base = sueldo mínimo legal vigente del trabajador (fallback a constante 2026)
  const sueldo_minimo_vigente = (trab.sueldoMinimo && trab.sueldoMinimo > 0) ? trab.sueldoMinimo : SUELDO_MINIMO_2026
  const sueldo_base   = Math.round(sueldo_minimo_vigente * factor)
  const gratificacion = Math.min(Math.round(sueldo_base * 0.25), tope_gratif)

  // Total imponible: solo sueldo mínimo + gratificación + bono fijo + comisión
  const total_imponible = sueldo_base + gratificacion + bono_fijo + Math.round(comision)
  const base_imponible  = Math.min(total_imponible, TOPE_IMPONIBLE)

  // Descuentos legales (sobre base imponible)
  const desc_afp = Math.round(base_imponible * pct_afp / 100)
  let desc_salud = 0, pct_salud = 0
  if (esIsapre) {
    desc_salud = trab.montoIsapre ?? 0
    pct_salud  = 0
  } else {
    pct_salud  = FONASA_PCT
    desc_salud = Math.round(base_imponible * FONASA_PCT / 100)
  }
  const desc_ces_trab = tipo === 'indefinido'
    ? Math.round(base_imponible * CESANTIA_TRAB_INDEF / 100)
    : 0

  const total_desc_legales = desc_afp + desc_salud + desc_ces_trab

  // Líquido del mínimo (sin colación ni no imponibles)
  const liquido_minimo = total_imponible - total_desc_legales

  // Sueldo líquido pactado por contrato (prorrateado)
  const sueldo_liquido_pactado = Math.round((trab.sueldo ?? 0) * factor)

  // Bono Herramienta: complemento no imponible para alcanzar el líquido pactado
  const bono_herramienta = Math.max(
    0,
    sueldo_liquido_pactado - sueldo_base,
  )

  // Haberes no imponibles totales
  const no_imponibles = colacion + movilizacion + Math.round(otrosHaberes) + bono_herramienta

  // sueldo_bruto = parte imponible (para tabla y cálculo de costo)
  const sueldo_bruto = total_imponible

  // Sueldo líquido final = pactado menos otros descuentos y faltas
  const total_desc = total_desc_legales + Math.round(otrosDescuentos) + Math.round(faltasDescuento)
  const sueldo_liq = sueldo_liquido_pactado - Math.round(otrosDescuentos) - Math.round(faltasDescuento)

  // Aportes empleador
  const sis           = Math.round(base_imponible * SIS_PCT               / 100)
  const pct_ces_emp   = tipo === 'plazo_fijo' ? CESANTIA_EMP_PLAZO_FIJO : CESANTIA_EMP_INDEF
  const ces_emp       = Math.round(base_imponible * pct_ces_emp            / 100)
  const mutual        = Math.round(base_imponible * MUTUAL_PCT             / 100)
  const costo_empresa = sueldo_bruto + no_imponibles + sis + ces_emp + mutual

  return {
    trabajadorId:          trab.id,
    trabajadorNombre:      trab.nombre,
    trabajadorRut:         trab.rut,
    periodo,
    estado:                'borrador',
    sueldoBase:            sueldo_base,
    bonoFijo:              bono_fijo,
    comision:              Math.round(comision),
    gratificacion,
    colacion,
    movilizacion,
    otrosHaberes:          Math.round(otrosHaberes),
    sueldoBruto:           sueldo_bruto,
    baseImponible:         base_imponible,
    afp:                   trab.afp ?? 'Habitat',
    porcentajeAfp:         pct_afp,
    descuentoAfp:          desc_afp,
    previsionSalud:        trab.previsionSalud ?? 'Fonasa',
    porcentajeSalud:       pct_salud,
    descuentoSalud:        desc_salud,
    descuentoCesantiaTrab: desc_ces_trab,
    otrosDescuentos:       Math.round(otrosDescuentos),
    totalDescuentos:       total_desc,
    sueldoLiquido:         sueldo_liq,
    cesantiaEmpleador:     ces_emp,
    mutualEmpleador:       mutual,
    costoEmpresa:          costo_empresa,
    diasTrabajados,
    tipoContrato:          tipo,
    sueldoEsLiquido:       true,
    sueldoLiquidoPactado:  sueldo_liquido_pactado,
  }
}

/* ── GET /api/remuneraciones/trabajadores ───────────────────────────── */
router.get('/trabajadores', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('trabajadores')
      .select('id, nombre, rut, cargo, email, sueldo, sueldo_minimo, estado, tipo_contrato, afp, porcentaje_afp, prevision_salud, isapre, monto_isapre, bono_fijo, colacion, movilizacion, sueldo_es_liquido')
      .eq('empresa_id', req.user.empresa_id)
      .eq('estado', 'activo')
      .order('nombre')
    if (error) throw error
    res.json({ success: true, data: (data || []).map(fromTrab) })
  } catch (err) {
    console.error('[remuneraciones GET trabajadores]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── PATCH /api/remuneraciones/trabajadores/:id ─────────────────────── */
router.patch('/trabajadores/:id', async (req, res) => {
  const { id } = req.params
  const {
    tipoContrato, afp, porcentajeAfp, previsionSalud,
    isapre, montoIsapre, bonoFijo, colacion, movilizacion,
  } = req.body
  try {
    const { data, error } = await supabase
      .from('trabajadores')
      .update({
        tipo_contrato:   tipoContrato   ?? 'indefinido',
        afp:             afp            ?? 'Habitat',
        porcentaje_afp:  porcentajeAfp  ?? 10.27,
        prevision_salud: previsionSalud ?? 'Fonasa',
        isapre:          isapre         ?? null,
        monto_isapre:    montoIsapre    ?? 0,
        bono_fijo:       bonoFijo       ?? 0,
        colacion:        colacion       ?? 0,
        movilizacion:    movilizacion   ?? 0,
      })
      .eq('id', id)
      .eq('empresa_id', req.user.empresa_id)
      .select('id, nombre, rut, cargo, email, sueldo, sueldo_minimo, estado, tipo_contrato, afp, porcentaje_afp, prevision_salud, isapre, monto_isapre, bono_fijo, colacion, movilizacion, sueldo_es_liquido')
      .single()
    if (error) throw error
    res.json({ success: true, data: fromTrab(data) })
  } catch (err) {
    console.error('[remuneraciones PATCH trabajador]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── GET /api/remuneraciones/trabajadores-activos ───────────────────── */
router.get('/trabajadores-activos', async (req, res) => {
  const { periodo } = req.query
  try {
    const { data: trabajadores, error: trabError } = await supabase
      .from('trabajadores')
      .select('id, nombre, rut, cargo, email, sueldo, sueldo_minimo, estado, tipo_contrato, afp, porcentaje_afp, prevision_salud, isapre, monto_isapre, bono_fijo, colacion, movilizacion, sueldo_es_liquido')
      .eq('empresa_id', req.user.empresa_id)
      .eq('estado', 'activo')
      .order('nombre')
    if (trabError) throw trabError

    let liquidaciones = []
    if (periodo) {
      const { data: liqData, error: liqError } = await supabase
        .from('liquidaciones')
        .select('*')
        .eq('empresa_id', req.user.empresa_id)
        .eq('periodo', periodo)
      if (liqError) throw liqError
      liquidaciones = liqData || []
    }

    const liqByTrab = {}
    ;(liquidaciones || []).forEach(l => { liqByTrab[l.trabajador_id] = l })

    const result = (trabajadores || []).map(t => ({
      trabajador:  fromTrab(t),
      liquidacion: liqByTrab[t.id] ? fromLiq(liqByTrab[t.id]) : null,
    }))

    res.json({ success: true, data: result })
  } catch (err) {
    console.error('[remuneraciones GET trabajadores-activos]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── POST /api/remuneraciones/calcular ──────────────────────────────── */
router.post('/calcular', async (req, res) => {
  const { trabajador_id, periodo, comision, otrosHaberes, diasTrabajados, otrosDescuentos } = req.body
  try {
    const { data: trab, error } = await supabase
      .from('trabajadores')
      .select('id, nombre, rut, sueldo, sueldo_minimo, tipo_contrato, afp, porcentaje_afp, prevision_salud, isapre, monto_isapre, bono_fijo, colacion, movilizacion, sueldo_es_liquido')
      .eq('id', trabajador_id)
      .eq('empresa_id', req.user.empresa_id)
      .single()
    if (error) throw error

    // ── Faltas confirmadas del período ───────────────────────────────
    let faltasCount = 0, descuentoFaltas = 0, detalleFaltas = []
    if (periodo) {
      const [yearStr, monthStr] = periodo.split('-')
      const year  = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10)
      const inicioPeriodo = `${yearStr}-${monthStr}-01`
      const ultimoDia = new Date(year, month, 0).getDate()
      const finPeriodo = `${yearStr}-${monthStr}-${String(ultimoDia).padStart(2, '0')}`

      const { data: faltasData } = await supabase
        .from('marcaciones')
        .select('fecha_hora_servidor, asistencia_observacion')
        .eq('trabajador_id', trabajador_id)
        .eq('tipo_marcacion', 'falta')
        .eq('asistencia_confirmada', false)
        .gte('fecha_hora_servidor', `${inicioPeriodo}T00:00:00.000Z`)
        .lte('fecha_hora_servidor', `${finPeriodo}T23:59:59.999Z`)

      if (faltasData && faltasData.length > 0) {
        const { data: feriadosData } = await supabase
          .from('feriados')
          .select('fecha')
          .gte('fecha', inicioPeriodo)
          .lte('fecha', finPeriodo)
          .or('empresa_id.is.null')
        const feriadosSet = new Set((feriadosData || []).map(f => f.fecha))

        let diasHabilesMes = 0
        for (let d = 1; d <= ultimoDia; d++) {
          const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay()
          if (dow !== 0 && dow !== 6) {
            const fStr = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`
            if (!feriadosSet.has(fStr)) diasHabilesMes++
          }
        }

        const sueldoBase = (trab.sueldo_minimo > 0 ? trab.sueldo_minimo : SUELDO_MINIMO_2026)
        const valorDia   = diasHabilesMes > 0 ? Math.round(sueldoBase / diasHabilesMes) : 0
        const CHILE_MS   = 4 * 60 * 60 * 1000

        faltasCount     = faltasData.length
        descuentoFaltas = Math.round(faltasCount * valorDia)
        detalleFaltas   = faltasData.map(f => {
          const chileMs = new Date(f.fecha_hora_servidor).getTime() - CHILE_MS
          const d       = new Date(chileMs)
          const fecha   = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
          return { fecha, observacion: f.asistencia_observacion, valorDescuento: valorDia }
        })
      }
    }

    const resultado = calcular(fromTrab(trab), { periodo, comision, otrosHaberes, diasTrabajados, otrosDescuentos, faltasDescuento: descuentoFaltas })
    resultado.faltas         = faltasCount
    resultado.descuentoFaltas = descuentoFaltas
    resultado.detalleFaltas  = detalleFaltas

    res.json({ success: true, data: resultado })
  } catch (err) {
    console.error('[remuneraciones POST calcular]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── POST /api/remuneraciones/liquidaciones ─────────────────────────── */
router.post('/liquidaciones', async (req, res) => {
  try {
    const row = toLiq(req.body, req.user.empresa_id)
    const { data, error } = await supabase
      .from('liquidaciones')
      .upsert(row, { onConflict: 'trabajador_id,periodo,empresa_id' })
      .select()
      .single()
    if (error) throw error
    res.json({ success: true, data: fromLiq(data) })
  } catch (err) {
    console.error('[remuneraciones POST liquidacion]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── GET /api/remuneraciones/liquidaciones ──────────────────────────── */
router.get('/liquidaciones', async (req, res) => {
  const { periodo } = req.query
  try {
    let q = supabase
      .from('liquidaciones')
      .select('*')
      .eq('empresa_id', req.user.empresa_id)
    if (periodo) q = q.eq('periodo', periodo)
    const { data, error } = await q.order('trabajador_nombre')
    if (error) throw error
    res.json({ success: true, data: (data || []).map(fromLiq) })
  } catch (err) {
    console.error('[remuneraciones GET liquidaciones]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── GET /api/remuneraciones/liquidaciones/:id ──────────────────────── */
router.get('/liquidaciones/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('id', req.params.id)
      .eq('empresa_id', req.user.empresa_id)
      .single()
    if (error) throw error
    res.json({ success: true, data: fromLiq(data) })
  } catch (err) {
    console.error('[remuneraciones GET liquidacion/:id]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── PATCH /api/remuneraciones/liquidaciones/:id ────────────────────── */
router.patch('/liquidaciones/:id', async (req, res) => {
  const { estado } = req.body
  try {
    const { data, error } = await supabase
      .from('liquidaciones')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('empresa_id', req.user.empresa_id)
      .select()
      .single()
    if (error) throw error
    res.json({ success: true, data: fromLiq(data) })
  } catch (err) {
    console.error('[remuneraciones PATCH liquidacion]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── SMTP transporter (igual que cotizaciones) ───────────────────────── */
function createTransporter() {
  const nodemailer = require('nodemailer')
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

function fmtCLP(n) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n ?? 0)
}

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
function periodoLabel(p) {
  if (!p) return ''
  const [y, m] = p.split('-')
  return m ? `${MESES_ES[parseInt(m, 10) - 1]} ${y}` : p
}

/* ── Storage helper ─────────────────────────────────────────────────── */
async function uploadToStorage(liq, pdfBase64, comprobante) {
  let pdfUrl = null
  let comprobanteUrl = null
  try {
    if (pdfBase64) {
      const path = `${liq.empresa_id}/${liq.periodo}/${liq.trabajador_id}_liquidacion.pdf`
      await supabase.storage.from('liquidaciones-pdfs').upload(path, Buffer.from(pdfBase64, 'base64'), {
        contentType: 'application/pdf', upsert: true,
      })
      const { data } = supabase.storage.from('liquidaciones-pdfs').getPublicUrl(path)
      pdfUrl = data.publicUrl
    }
    if (comprobante?.base64) {
      const ext = (comprobante.nombre || 'file').split('.').pop() || 'pdf'
      const path = `${liq.empresa_id}/${liq.periodo}/${liq.trabajador_id}_comprobante.${ext}`
      await supabase.storage.from('liquidaciones-pdfs').upload(path, Buffer.from(comprobante.base64, 'base64'), {
        contentType: comprobante.tipo || 'application/octet-stream', upsert: true,
      })
      const { data } = supabase.storage.from('liquidaciones-pdfs').getPublicUrl(path)
      comprobanteUrl = data.publicUrl
    }
  } catch (e) {
    console.error('[remuneraciones] Storage upload error:', e.message)
  }
  return { pdfUrl, comprobanteUrl }
}

/* ── POST /api/remuneraciones/liquidaciones/:id/enviar-email ────────── */
router.post('/liquidaciones/:id/enviar-email', async (req, res) => {
  try {
    const { id } = req.params
    const { mensaje, pdfBase64, comprobante } = req.body

    const { data: liq, error: liqErr } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', req.user.empresa_id)
      .single()
    if (liqErr || !liq) return res.status(404).json({ success: false, error: { message: 'Liquidación no encontrada' } })

    const { data: trab, error: trabErr } = await supabase
      .from('trabajadores')
      .select('email, nombre')
      .eq('id', liq.trabajador_id)
      .single()
    if (trabErr || !trab?.email) {
      return res.status(400).json({ success: false, error: { message: 'El trabajador no tiene email registrado' } })
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      const { pdfUrl, comprobanteUrl } = await uploadToStorage(liq, pdfBase64, comprobante)
      await supabase.from('liquidaciones').update({
        email_enviado:   true,
        email_fecha:     new Date().toISOString(),
        email_mensaje:   mensaje || null,
        pdf_url:         pdfUrl,
        comprobante_url: comprobanteUrl,
      }).eq('id', id)
      return res.json({ success: true, modo: 'sin_smtp', warning: 'SMTP no configurado: estado actualizado pero email no enviado.' })
    }

    const periodo = periodoLabel(liq.periodo)
    const htmlBody = `
      <p>${mensaje || `Estimado/a ${trab.nombre}, adjunto encontrará su liquidación de sueldo correspondiente al período ${periodo}.`}</p>
      <p>Líquido a pagar: ${fmtCLP(liq.sueldo_liquido)}</p>
      <br>
      <p>Saludos,<br>Equipo MAMKAM<br>contacto@mamkam.cl</p>
    `

    const attachments = []
    if (pdfBase64) {
      attachments.push({
        filename:    `Liquidacion-${(liq.trabajador_nombre || 'trabajador').replace(/\s+/g, '-')}-${liq.periodo}.pdf`,
        content:     Buffer.from(pdfBase64, 'base64'),
        contentType: 'application/pdf',
      })
    }
    if (comprobante?.base64) {
      attachments.push({
        filename:    comprobante.nombre || 'comprobante',
        content:     Buffer.from(comprobante.base64, 'base64'),
        contentType: comprobante.tipo || 'application/octet-stream',
      })
    }

    const transporter = createTransporter()
    await transporter.sendMail({
      from:    `"MAMKAM" <${process.env.SMTP_USER}>`,
      to:      trab.email,
      cc:      'contacto@mamkam.cl',
      subject: `Liquidación de sueldo ${periodo} - MAMKAM`,
      html:    htmlBody,
      attachments,
    })

    const { pdfUrl, comprobanteUrl } = await uploadToStorage(liq, pdfBase64, comprobante)
    await supabase
      .from('liquidaciones')
      .update({
        email_enviado:   true,
        email_fecha:     new Date().toISOString(),
        email_mensaje:   mensaje || null,
        pdf_url:         pdfUrl,
        comprobante_url: comprobanteUrl,
      })
      .eq('id', id)

    return res.json({ success: true, mensaje: 'Liquidación enviada correctamente' })
  } catch (err) {
    console.error('[remuneraciones POST enviar-email]', err)
    return res.status(500).json({ success: false, error: { message: err.message } })
  }
})

/* ── DELETE /api/remuneraciones/liquidaciones/:id ───────────────────── */
router.delete('/liquidaciones/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('liquidaciones')
      .delete()
      .eq('id', req.params.id)
      .eq('empresa_id', req.user.empresa_id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('[remuneraciones DELETE liquidacion]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── GET /api/remuneraciones/horas-extras/:trabajador_id/:periodo ───── */
router.get('/horas-extras/:trabajador_id/:periodo', async (req, res) => {
  const { trabajador_id, periodo } = req.params
  const [yearStr, monthStr] = periodo.split('-')
  const year  = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  if (!year || !month) {
    return res.status(400).json({ success: false, error: { message: 'Período inválido' } })
  }

  try {
    // Verificar que el trabajador pertenece a esta empresa y obtener sueldo
    const { data: trab, error: trabError } = await supabase
      .from('trabajadores')
      .select('id, sueldo, sueldo_minimo')
      .eq('id', trabajador_id)
      .eq('empresa_id', req.user.empresa_id)
      .single()
    if (trabError) throw trabError

    const sueldo_min_trab = (trab.sueldo_minimo && trab.sueldo_minimo > 0) ? trab.sueldo_minimo : SUELDO_MINIMO_2026
    const valor_hora = Math.round(sueldo_min_trab / 30 / 8)

    // Horario del trabajador
    const { data: horarioRow } = await supabase
      .from('horarios_trabajadores')
      .select('*')
      .eq('trabajador_id', trabajador_id)
      .maybeSingle()
    // Marcaciones del período con buffer para UTC-4
    const startUTC = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString()
    const endUTC   = new Date(Date.UTC(year, month, 2, 4, 0, 0)).toISOString()
    const { data: marcaciones, error: marcError } = await supabase
      .from('marcaciones')
      .select('tipo_marcacion, fecha_hora_servidor')
      .eq('trabajador_id', trabajador_id)
      .gte('fecha_hora_servidor', startUTC)
      .lt('fecha_hora_servidor', endUTC)
      .order('fecha_hora_servidor')
    if (marcError) throw marcError

    if (!marcaciones || marcaciones.length === 0) {
      return res.json({
        success: true,
        data: { total_horas_extra: 0, total_minutos_extra: 0, monto_horas_extra: 0, valor_hora, sin_marcaciones: true, detalle_por_dia: [] },
      })
    }

    // Agrupar por día Chile (UTC-4 = restar 4h al timestamp UTC)
    const CHILE_OFFSET_MS = 4 * 60 * 60 * 1000
    const DIAS_MAP = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado']
    const minutos_colacion_horario = horarioRow?.minutos_colacion ?? 60

    const byDay = {}
    for (const m of marcaciones) {
      const chileMs   = new Date(m.fecha_hora_servidor).getTime() - CHILE_OFFSET_MS
      const chileDate = new Date(chileMs)
      const ky = chileDate.getUTCFullYear()
      const km = chileDate.getUTCMonth() + 1
      if (ky !== year || km !== month) continue
      const dateKey = `${ky}-${String(km).padStart(2,'0')}-${String(chileDate.getUTCDate()).padStart(2,'0')}`
      if (!byDay[dateKey]) byDay[dateKey] = []
      byDay[dateKey].push({ tipo: m.tipo_marcacion, chileMs })
    }

    const detalle_por_dia = []
    let total_minutos_extra = 0

    for (const [dateKey, marcsDia] of Object.entries(byDay)) {
      const entrada        = marcsDia.find(m => m.tipo === 'entrada')
      const salida         = marcsDia.find(m => m.tipo === 'salida')
      if (!entrada || !salida) continue

      const salida_colacion  = marcsDia.find(m => m.tipo === 'salida_colacion')
      const regreso_colacion = marcsDia.find(m => m.tipo === 'regreso_colacion')

      const minutos_trabajados = (salida.chileMs - entrada.chileMs) / 60000
      const minutos_colacion   = (salida_colacion && regreso_colacion)
        ? (regreso_colacion.chileMs - salida_colacion.chileMs) / 60000
        : minutos_colacion_horario
      const minutos_efectivos  = minutos_trabajados - minutos_colacion

      // Jornada planificada según día de semana
      const dayOfWeek = new Date(entrada.chileMs).getUTCDay()
      const diaNombre = DIAS_MAP[dayOfWeek]
      let minutos_jornada_planificada = 0
      if (horarioRow && horarioRow[diaNombre]) {
        const h_ent = (horarioRow[`${diaNombre}_entrada`] || '08:30').slice(0, 5)
        const h_sal = (horarioRow[`${diaNombre}_salida`]  || '17:30').slice(0, 5)
        const [eh, em] = h_ent.split(':').map(Number)
        const [sh, sm] = h_sal.split(':').map(Number)
        minutos_jornada_planificada = (sh * 60 + sm) - (eh * 60 + em) - minutos_colacion_horario
      }

      const minutos_diff = Math.round(minutos_efectivos - minutos_jornada_planificada)
      total_minutos_extra += minutos_diff

      detalle_por_dia.push({
        fecha: dateKey,
        dia: diaNombre,
        hora_entrada: new Date(entrada.chileMs).toISOString().substring(11, 16),
        hora_salida:  new Date(salida.chileMs).toISOString().substring(11, 16),
        minutos_trabajados:         Math.round(minutos_trabajados),
        minutos_colacion:           Math.round(minutos_colacion),
        minutos_efectivos:          Math.round(minutos_efectivos),
        minutos_jornada_planificada,
        minutos_extra: minutos_diff,
      })
    }

    const total_minutos_extra_neto = Math.max(0, total_minutos_extra)
    const total_horas_extra = Math.round(total_minutos_extra_neto / 60 * 100) / 100
    const monto_horas_extra = Math.round((total_minutos_extra_neto / 60) * valor_hora * 1.5)

    res.json({
      success: true,
      data: {
        total_horas_extra,
        total_minutos_extra: total_minutos_extra_neto,
        monto_horas_extra,
        valor_hora,
        sin_marcaciones: false,
        minutos_deficit: Math.min(0, total_minutos_extra),
        detalle_por_dia: detalle_por_dia.sort((a, b) => a.fecha.localeCompare(b.fecha)),
      },
    })
  } catch (err) {
    console.error('[remuneraciones GET horas-extras]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

/* ── GET /api/remuneraciones/resumen/:periodo ───────────────────────── */
router.get('/resumen/:periodo', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('liquidaciones')
      .select('*')
      .eq('empresa_id', req.user.empresa_id)
      .eq('periodo', req.params.periodo)
      .order('trabajador_nombre')
    if (error) throw error
    const liqs = (data || []).map(fromLiq)
    const sum  = (field) => liqs.reduce((a, l) => a + (l[field] ?? 0), 0)
    res.json({
      success: true,
      data: {
        liquidaciones:      liqs,
        totalLiquidos:      sum('sueldoLiquido'),
        totalDescuentosAfp: sum('descuentoAfp'),
        totalDescuentosSalud: sum('descuentoSalud'),
        totalCesantiaTrab:  sum('descuentoCesantiaTrab'),
        totalCesantiaEmp:   sum('cesantiaEmpleador'),
        totalMutual:        sum('mutualEmpleador'),
        totalPrevired:      sum('descuentoAfp') + sum('descuentoSalud') + sum('descuentoCesantiaTrab') + sum('cesantiaEmpleador') + sum('mutualEmpleador'),
        totalCostoEmpresa:  sum('costoEmpresa'),
      },
    })
  } catch (err) {
    console.error('[remuneraciones GET resumen]', err)
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } })
  }
})

module.exports = router
