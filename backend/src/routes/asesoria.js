const { Router } = require('express')
const supabase = require('../lib/supabase.js')
const { requireAuth } = require('../middleware/auth.js')

const router = Router()
router.use(requireAuth)

/* ── Helper: query segura que nunca lanza ─────────────────────────── */
async function safeQuery(promise) {
  try {
    const { data, error } = await promise
    if (error) console.warn('[asesoria/ctx] query warn:', error.message)
    return data || []
  } catch (e) {
    console.warn('[asesoria/ctx] query fail:', e.message)
    return []
  }
}
async function safeQuerySingle(promise) {
  try {
    const { data, error } = await promise
    if (error) console.warn('[asesoria/ctx] query warn:', error.message)
    return data || null
  } catch (e) {
    console.warn('[asesoria/ctx] query fail:', e.message)
    return null
  }
}

/* ── Recopila contexto completo de la empresa ─────────────────────── */
async function getContextoEmpresa(empresaId) {
  const hoy = new Date()
  const mesActual = hoy.toISOString().slice(0, 7)
  const today     = hoy.toISOString().slice(0, 10)

  // Rangos de fechas para queries históricas
  const hace3m = new Date(hoy); hace3m.setMonth(hace3m.getMonth() - 3)
  const hace2m = new Date(hoy); hace2m.setMonth(hace2m.getMonth() - 2)
  const mesMenos3 = hace3m.toISOString().slice(0, 7)
  const mesMenos2 = hace2m.toISOString().slice(0, 7)
  const inicioMes = `${mesActual}-01`

  // ── Batch 1: todas las queries con empresa_id ─────────────────────
  const [
    cots, ocs, gasts, trabs, projs, movs, cuentas, empresa,
    liqs, visitas, facturas, adelantos, bonos, proveedores,
  ] = await Promise.all([
    safeQuery(supabase.from('cotizaciones').select('estado, total, created_at, cliente, numero').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(100)),
    safeQuery(supabase.from('compras').select('estado, monto, proveedor, numero').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(100)),
    safeQuery(supabase.from('gastos').select('estado, monto, fecha_gasto, categoria, comercio').eq('empresa_id', empresaId).order('fecha_gasto', { ascending: false }).limit(200)),
    safeQuery(supabase.from('trabajadores').select('id, nombre, estado, app_activa, cargo').eq('empresa_id', empresaId)),
    safeQuery(supabase.from('proyectos').select('nombre, estado, porcentaje_avance, fecha_fin_est').eq('empresa_id', empresaId).neq('estado', 'eliminado')),
    safeQuery(supabase.from('movimientos').select('tipo, monto, conciliado, fecha, descripcion').eq('empresa_id', empresaId).order('fecha', { ascending: false }).limit(100)),
    safeQuery(supabase.from('cuentas_empresa').select('nombre, monto, periodicidad, activa, pagada, fecha_vencimiento, categoria').eq('empresa_id', empresaId)),
    safeQuerySingle(supabase.from('empresas').select('nombre, nombre_fantasia, giro').eq('id', empresaId).maybeSingle()),
    // Nuevos módulos
    safeQuery(supabase.from('liquidaciones').select('trabajador_nombre, trabajador_rut, periodo, sueldo_base, sueldo_liquido, costo_empresa, estado').eq('empresa_id', empresaId).gte('periodo', mesMenos3).order('periodo', { ascending: false }).limit(100)),
    safeQuery(supabase.from('visitas').select('cliente, vendedor_id, estado, fecha_agendada, resumen_ia, informe_enviado, created_at').eq('empresa_id', empresaId).order('created_at', { ascending: false }).limit(50)),
    safeQuery(supabase.from('facturas_sii').select('tipo, folio, total, estado, fecha, razon_social').eq('empresa_id', empresaId).order('fecha', { ascending: false }).limit(100)),
    safeQuery(supabase.from('adelantos').select('trabajador_id, tipo, monto, periodo, descontado').eq('empresa_id', empresaId).gte('periodo', mesMenos2)),
    safeQuery(supabase.from('bonos').select('trabajador_id, tipo, monto, periodo').eq('empresa_id', empresaId).gte('periodo', mesMenos2)),
    safeQuery(supabase.from('proveedores').select('id, nombre').eq('empresa_id', empresaId)),
  ])

  // ── Batch 2: queries que dependen de los IDs de trabajadores ─────
  const ids = (trabs || []).map(t => t.id)
  let solVacs = [], solPwds = [], solCols = [], marcaciones = []
  if (ids.length) {
    ;[solVacs, solPwds, solCols, marcaciones] = await Promise.all([
      safeQuery(supabase.from('solicitudes_vacaciones').select('estado, trabajador_nombre').in('trabajador_id', ids).eq('estado', 'pendiente')),
      safeQuery(supabase.from('solicitudes_password').select('estado').in('trabajador_id', ids).eq('estado', 'pendiente')),
      safeQuery(supabase.from('solicitudes_omitir_colacion').select('estado').in('trabajador_id', ids).eq('estado', 'pendiente')),
      safeQuery(supabase.from('marcaciones').select('trabajador_id, fecha, tipo, hora_marcacion').in('trabajador_id', ids).gte('fecha', inicioMes).order('fecha', { ascending: false }).limit(500)),
    ])
  }

  // ── Procesar módulos existentes ───────────────────────────────────
  const cotsData    = cots    || []
  const ocsData     = ocs     || []
  const gastsData   = gasts   || []
  const trabsData   = trabs   || []
  const projsData   = projs   || []
  const movsData    = movs    || []
  const cuentasData = cuentas || []

  const cotAprobadas   = cotsData.filter(c => c.estado === 'aprobada')
  const cotPendientes  = cotsData.filter(c => ['borrador', 'enviada'].includes(c.estado))
  const cotMesActual   = cotsData.filter(c => c.created_at?.startsWith(mesActual))
  const totalAprobado  = cotAprobadas.reduce((s, c) => s + (c.total || 0), 0)

  const ocPendientes = ocsData.filter(c => ['creada', 'pendiente'].includes(c.estado))
  const totalOC      = ocsData.reduce((s, c) => s + (c.monto || 0), 0)

  const gastsMes        = gastsData.filter(g => g.fecha_gasto?.startsWith(mesActual))
  const gastsPendientes = gastsData.filter(g => g.estado === 'pendiente')
  const totalGastsMes   = gastsMes.reduce((s, g) => s + (g.monto || 0), 0)

  const trabActivos = trabsData.filter(t => t.estado === 'activo')
  const trabConApp  = trabsData.filter(t => t.app_activa)

  const projActivos  = projsData.filter(p => p.estado === 'activo')
  const projVencidos = projActivos.filter(p => p.fecha_fin_est && p.fecha_fin_est < today && (p.porcentaje_avance || 0) < 100)

  const ingresosConc   = movsData.filter(m => m.tipo === 'ingreso' && m.conciliado)
  const ingresosPend   = movsData.filter(m => m.tipo === 'ingreso' && !m.conciliado)
  const egresosPagados = movsData.filter(m => m.tipo === 'egreso' && m.conciliado)
  const totalCobrado    = ingresosConc.reduce((s, m)   => s + (m.monto || 0), 0)
  const totalPorCobrar  = ingresosPend.reduce((s, m)   => s + (m.monto || 0), 0)
  const totalEgresosPag = egresosPagados.reduce((s, m) => s + (m.monto || 0), 0)
  const saldoReal       = totalCobrado - totalEgresosPag

  const cuentasFijas    = cuentasData.filter(c => c.periodicidad === 'mensual' && c.activa)
  const cuentasUnicas   = cuentasData.filter(c => c.periodicidad === 'unica' && !c.pagada)
  const costoFijoMens   = cuentasFijas.reduce((s, c) => s + (c.monto || 0), 0)
  const cuentasVencidas = cuentasUnicas.filter(c => c.fecha_vencimiento && c.fecha_vencimiento < today)

  // ── Procesar Remuneraciones ───────────────────────────────────────
  const liqsData       = liqs || []
  const liqsMesActual  = liqsData.filter(l => l.periodo === mesActual)
  const totalCostoEmp  = liqsMesActual.reduce((s, l) => s + (l.costo_empresa  || 0), 0)
  const totalLiquidos  = liqsMesActual.reduce((s, l) => s + (l.sueldo_liquido || 0), 0)
  const cantLiquidados = liqsMesActual.length
  const promedioLiq    = cantLiquidados > 0 ? Math.round(totalLiquidos / cantLiquidados) : 0

  const adelantosData     = adelantos || []
  const adelantosPend     = adelantosData.filter(a => !a.descontado)
  const totalAdelPend     = adelantosPend.reduce((s, a) => s + (a.monto || 0), 0)

  const bonosData         = bonos || []
  const bonosMesActual    = bonosData.filter(b => b.periodo === mesActual)
  const totalBonosMes     = bonosMesActual.reduce((s, b) => s + (b.monto || 0), 0)

  // ── Procesar Asistencia / Marcaciones ────────────────────────────
  const marcsData     = marcaciones || []
  const marcsHoy      = marcsData.filter(m => m.fecha === today)
  const trabsHoySet   = new Set(marcsHoy.map(m => m.trabajador_id))
  const salidasHoy    = new Set(marcsHoy.filter(m => m.tipo === 'salida').map(m => m.trabajador_id))
  const sinSalida     = [...trabsHoySet].filter(id => !salidasHoy.has(id)).length

  // Promedio horas: pares entrada-salida del mes
  let totalMinutos = 0, paresMes = 0
  const entradasMes = marcsData.filter(m => m.tipo === 'entrada')
  for (const ent of entradasMes) {
    const sal = marcsData.find(m => m.tipo === 'salida' && m.trabajador_id === ent.trabajador_id && m.fecha === ent.fecha)
    if (sal && ent.hora_marcacion && sal.hora_marcacion) {
      const [eh, em] = ent.hora_marcacion.slice(0, 5).split(':').map(Number)
      const [sh, sm] = sal.hora_marcacion.slice(0, 5).split(':').map(Number)
      const mins = (sh * 60 + sm) - (eh * 60 + em)
      if (mins > 0) { totalMinutos += mins; paresMes++ }
    }
  }
  const promedioHoras = paresMes > 0 ? +(totalMinutos / paresMes / 60).toFixed(1) : null

  // ── Procesar Visitas ─────────────────────────────────────────────
  const visitasData      = visitas || []
  const visitasComplet   = visitasData.filter(v => v.estado === 'completada').length
  const visitasEnCurso   = visitasData.filter(v => v.estado === 'en_curso').length
  const visitasAgendadas = visitasData.filter(v => v.estado === 'agendada').length
  const ultimaVisita     = visitasData[0] ? { cliente: visitasData[0].cliente, estado: visitasData[0].estado, fecha: visitasData[0].fecha_agendada } : null

  // ── Procesar Facturas SII ────────────────────────────────────────
  const facturasData   = facturas || []
  const factsVenta     = facturasData.filter(f => f.tipo === 'venta')
  const totalFactEmit  = factsVenta.length
  const montoFactTotal = factsVenta.reduce((s, f) => s + (f.total || 0), 0)
  const factsPendPago  = factsVenta.filter(f => f.estado === 'pendiente').length

  return {
    empresa:    empresa || {},
    fecha:      hoy.toLocaleDateString('es-CL'),
    mes_actual: mesActual,

    cotizaciones: {
      total: cotsData.length,
      aprobadas: cotAprobadas.length,
      pendientes_envio: cotPendientes.length,
      rechazadas: cotsData.filter(c => c.estado === 'rechazada').length,
      total_monto_aprobado: totalAprobado,
      creadas_este_mes: cotMesActual.length,
      ultimas_5: cotsData.slice(0, 5).map(c => ({ numero: c.numero, cliente: c.cliente, estado: c.estado, total: c.total })),
    },
    compras_oc: {
      total: ocsData.length,
      pendientes_pago: ocPendientes.length,
      monto_total: totalOC,
    },
    gastos: {
      total_mes_actual: totalGastsMes,
      pendientes_aprobar: gastsPendientes.length,
      aprobados: gastsData.filter(g => ['aprobado','aprobada'].includes(g.estado)).length,
    },
    trabajadores: {
      total: trabsData.length,
      activos: trabActivos.length,
      con_app_movil: trabConApp.length,
      lista: trabsData.map(t => ({ nombre: t.nombre, cargo: t.cargo, estado: t.estado })),
    },
    proyectos: {
      activos: projActivos.length,
      cerrados: projsData.filter(p => p.estado === 'cerrado').length,
      con_fecha_vencida: projVencidos.length,
      lista_activos: projActivos.map(p => ({ nombre: p.nombre, avance: p.porcentaje_avance, vence: p.fecha_fin_est })),
    },
    finanzas: {
      saldo_real: saldoReal,
      total_cobrado: totalCobrado,
      total_por_cobrar: totalPorCobrar,
      total_egresos_pagados: totalEgresosPag,
      costo_fijo_mensual: costoFijoMens,
      cuentas_fijas: cuentasFijas.map(c => ({ nombre: c.nombre, monto: c.monto, categoria: c.categoria })),
      obligaciones_pendientes: cuentasUnicas.map(c => ({ nombre: c.nombre, monto: c.monto, vence: c.fecha_vencimiento })),
      obligaciones_vencidas: cuentasVencidas.length,
    },
    solicitudes_pendientes: {
      vacaciones: solVacs.length,
      contrasenas: solPwds.length,
      colacion: solCols.length,
      total: solVacs.length + solPwds.length + solCols.length,
    },

    // ── Módulos nuevos ────────────────────────────────────────────
    remuneraciones: {
      mes_actual: {
        total_costo_empresa:    totalCostoEmp,
        total_sueldos_liquidos: totalLiquidos,
        trabajadores_liquidados: cantLiquidados,
        promedio_sueldo_liquido: promedioLiq,
        adelantos_pendientes:   totalAdelPend,
        total_bonos:            totalBonosMes,
      },
      ultimas_liquidaciones: liqsData.slice(0, 10).map(l => ({
        trabajador: l.trabajador_nombre,
        rut:        l.trabajador_rut,
        periodo:    l.periodo,
        liquido:    l.sueldo_liquido,
        costo:      l.costo_empresa,
        estado:     l.estado,
      })),
    },
    asistencia: {
      marcaciones_mes:         marcsData.length,
      trabajadores_activos_hoy: trabsHoySet.size,
      trabajadores_sin_salida:  sinSalida,
      promedio_horas_diarias:   promedioHoras,
    },
    visitas: {
      total:       visitasData.length,
      completadas: visitasComplet,
      en_curso:    visitasEnCurso,
      agendadas:   visitasAgendadas,
      ultima_visita: ultimaVisita,
    },
    facturas_sii: {
      total_emitidas:  totalFactEmit,
      monto_total:     montoFactTotal,
      pendientes_pago: factsPendPago,
      ultimas_5: factsVenta.slice(0, 5).map(f => ({ folio: f.folio, razon_social: f.razon_social, monto: f.total, estado: f.estado })),
    },
    adelantos_bonos: {
      adelantos_pendientes_total: totalAdelPend,
      bonos_mes_actual_total:     totalBonosMes,
    },
    proveedores: {
      total: (proveedores || []).length,
    },
  }
}

/* ── GET /api/asesoria/contexto ───────────────────────────────────── */
router.get('/contexto', async (req, res) => {
  try {
    const data = await getContextoEmpresa(req.user.empresa_id)
    res.json({ success: true, data })
  } catch (err) {
    console.error('[asesoria/contexto]', err)
    res.status(500).json({ error: 'Error al obtener contexto' })
  }
})

/* ── GET /api/asesoria/conversaciones ────────────────────────────── */
router.get('/conversaciones', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('asesoria_conversaciones')
      .select('id, titulo, created_at, updated_at')
      .eq('empresa_id', req.user.empresa_id)
      .eq('usuario_id', String(req.user.id))
      .order('updated_at', { ascending: false })
      .limit(10)
    if (error) throw error
    res.json({ success: true, data: data || [] })
  } catch (err) {
    console.error('[asesoria/conversaciones]', err)
    res.status(500).json({ error: 'Error al obtener conversaciones' })
  }
})

/* ── GET /api/asesoria/conversaciones/:id/mensajes ───────────────── */
router.get('/conversaciones/:id/mensajes', async (req, res) => {
  try {
    const { data: conv } = await supabase
      .from('asesoria_conversaciones')
      .select('id')
      .eq('id', req.params.id)
      .eq('empresa_id', req.user.empresa_id)
      .maybeSingle()
    if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' })

    const { data, error } = await supabase
      .from('asesoria_mensajes')
      .select('id, rol, contenido, created_at')
      .eq('conversacion_id', req.params.id)
      .order('created_at', { ascending: true })
    if (error) throw error
    res.json({ success: true, data: data || [] })
  } catch (err) {
    console.error('[asesoria/mensajes]', err)
    res.status(500).json({ error: 'Error al obtener mensajes' })
  }
})

/* ── POST /api/asesoria/chat ─────────────────────────────────────── */
router.post('/chat', async (req, res) => {
  try {
    const { mensaje, conversacion_id } = req.body
    if (!mensaje?.trim()) return res.status(400).json({ error: 'Mensaje requerido' })

    const empresaId = req.user.empresa_id
    const usuarioId = String(req.user.id)

    // Crear o reusar conversación
    let convId = conversacion_id
    if (!convId) {
      const titulo = mensaje.length > 60 ? mensaje.slice(0, 60) + '...' : mensaje
      const { data: nueva, error } = await supabase
        .from('asesoria_conversaciones')
        .insert({ empresa_id: empresaId, usuario_id: usuarioId, titulo })
        .select('id')
        .single()
      if (error) throw error
      convId = nueva.id
    } else {
      await supabase.from('asesoria_conversaciones')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', convId)
    }

    // Historial (últimos 50)
    const { data: historial } = await supabase
      .from('asesoria_mensajes')
      .select('rol, contenido')
      .eq('conversacion_id', convId)
      .order('created_at', { ascending: true })
      .limit(50)

    // Contexto de la empresa
    const contexto = await getContextoEmpresa(empresaId)
    const nombreEmpresa = contexto.empresa?.nombre_fantasia || contexto.empresa?.nombre || 'la empresa'

    const systemPrompt = `Eres ARIA (Asistente de Recursos e Inteligencia Administrativa), la asesora financiera y administrativa de ${nombreEmpresa}. Tu rol es analizar la situación integral de la empresa, detectar problemas, oportunidades de mejora y dar recomendaciones concretas y accionables. Responde siempre en español, de forma clara y profesional. Cuando detectes problemas urgentes, márcalos con ⚠️. Cuando des recomendaciones positivas usa ✅. Al inicio de cada conversación nueva, saluda al usuario por nombre (${req.user.nombre}) y presenta un resumen ejecutivo del estado actual de la empresa destacando lo más importante.

Tienes acceso completo y actualizado a los siguientes módulos de la empresa:
- **Finanzas**: cotizaciones, órdenes de compra, gastos, movimientos de caja y cuentas bancarias
- **Proyectos**: estado, avance y rentabilidad de proyectos activos
- **Remuneraciones**: liquidaciones de los últimos 3 meses, costos de empresa, sueldos líquidos, adelantos y bonos del período
- **Asistencia**: marcaciones del mes, trabajadores activos hoy, trabajadores sin salida registrada y promedio de horas diarias
- **Visitas comerciales**: visitas agendadas, en curso y completadas, con resúmenes de cada una
- **Facturación SII**: facturas emitidas, montos totales y pendientes de pago
- **Proveedores**: listado y total de proveedores activos
- **Equipo**: trabajadores activos, solicitudes de vacaciones y colaciones

Datos actuales de ${nombreEmpresa} al ${contexto.fecha}:
${JSON.stringify(contexto, null, 2)}`

    const messages = [
      ...(historial || []).map(m => ({ role: m.rol, content: m.contenido })),
      { role: 'user', content: mensaje },
    ]

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada en el servidor')

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages,
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      console.error('[asesoria/chat] Anthropic error:', errText)
      throw new Error('Error al contactar con la IA')
    }

    const json = await anthropicRes.json()
    const respuesta = json.content?.find(b => b.type === 'text')?.text || 'No pude generar una respuesta.'

    // Guardar ambos mensajes
    await supabase.from('asesoria_mensajes').insert([
      { conversacion_id: convId, rol: 'user',      contenido: mensaje   },
      { conversacion_id: convId, rol: 'assistant', contenido: respuesta },
    ])

    res.json({ success: true, data: { respuesta, conversacion_id: convId } })
  } catch (err) {
    console.error('[asesoria/chat]', err)
    res.status(500).json({ error: err.message || 'Error al procesar el mensaje' })
  }
})

module.exports = router
