import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

/* ── Mappers: fila DB → objeto JS ───────────────────────────────── */
const fromCot  = r => ({ id: r.id, numero: r.numero, fecha: r.fecha, cliente: r.cliente, comuna: r.comuna, direccion: r.direccion, telefono: r.telefono, email: r.email, estado: r.estado, observaciones: r.observaciones, enviadoWhatsapp: r.enviado_whatsapp, enviadoEmail: r.enviado_email, items: r.items ?? [], neto: r.neto, iva: r.iva, total: r.total, condicionesPago: r.condiciones_pago ?? [], glosa: r.glosa ?? '', fechaExpiracion: r.fecha_expiracion ?? null, descuentoTipo: r.descuento_tipo ?? 'porcentaje', descuentoValor: r.descuento_valor ?? 0, usuarioId: r.usuario_id ?? null, creadoPor: r.creado_por ?? null, estadoTotal: r.estado_total ?? 'pendiente', productos_asociados: r.productos_asociados ?? [], pagosComprobantes: r.pagos_comprobantes ?? [] })
const fromProv = r => ({ id: r.id, nombre: r.nombre, rut: r.rut, email: r.email, telefono: r.telefono, direccion: r.direccion, comuna: r.comuna })
const fromOC   = r => ({ id: r.id, numero: r.numero, fecha: r.fecha, proveedorId: r.proveedor_id, proveedor: r.proveedor, proveedorRut: r.proveedor_rut, cotizacionId: r.cotizacion_id, cotizacionNumero: r.cotizacion_numero, cotizacionCliente: r.cotizacion_cliente, estado: r.estado, observaciones: r.observaciones, items: r.items ?? [], monto: r.monto, voucher: r.voucher, facturaVerificada: r.factura_verificada, facturaProveedorUrl: r.factura_proveedor_url ?? null, facturaProveedorNombre: r.factura_proveedor_nombre ?? null, comprobantes: r.comprobantes ?? [], facturas: r.facturas ?? [] })
const fromFac  = r => ({ id: r.id, tipo: r.tipo ?? 'compra', tipoDocumento: r.tipo_documento ?? 'FACTURA', folio: r.folio, rutEmisor: r.rut_emisor ?? r.proveedor_rut ?? '', razonSocial: r.razon_social ?? r.proveedor ?? '', fecha: r.fecha, neto: r.neto ?? 0, iva: r.iva ?? 0, total: r.total ?? 0, estado: r.estado ?? 'vigente' })
export const fromTrab = r => ({ id: r.id, nombre: r.nombre, rut: r.rut, email: r.email, telefono: r.telefono, cargo: r.cargo, sueldo: r.sueldo, sueldoMinimo: r.sueldo_minimo ?? 539000, fechaIngreso: r.fecha_ingreso, estado: r.estado, tipoContrato: r.tipo_contrato ?? 'indefinido', afp: r.afp ?? 'Habitat', porcentajeAfp: r.porcentaje_afp ?? 10.27, previsionSalud: r.prevision_salud ?? 'Fonasa', isapre: r.isapre ?? '', montoIsapre: r.monto_isapre ?? 0, bonoFijo: r.bono_fijo ?? 0, colacion: r.colacion ?? 0, movilizacion: r.movilizacion ?? 0, fechaNacimiento: r.fecha_nacimiento ?? '', nacionalidad: r.nacionalidad ?? 'Chilena', estadoCivil: r.estado_civil ?? 'soltero', tipoDocumento: r.tipo_documento ?? 'RUT', numeroDocumento: r.numero_documento ?? '', fechaVencimientoVisa: r.fecha_vencimiento_visa ?? '', direccion: r.direccion ?? '', numero: r.numero ?? '', comuna: r.comuna ?? '', ciudad: r.ciudad ?? '', region: r.region ?? '', banco: r.banco ?? '', tipoCuenta: r.tipo_cuenta ?? '', numeroCuenta: r.numero_cuenta ?? '', appActiva: r.app_activa ?? false, puedeCotizar: r.puede_cotizar ?? false, puedeOC: r.puede_oc ?? false, puedeRRHH: r.puede_rrhh ?? false, puedeFinanzas: r.puede_finanzas ?? false, puedeProyectos: r.puede_proyectos ?? false, puedeAsesoria: r.puede_asesoria ?? false, puedeRemuneraciones: r.puede_remuneraciones ?? false, puedeFacturas: r.puede_facturas ?? false, puedeVisitas: r.puede_visitas ?? false, puedeVisitasApp: r.puede_visitas_app ?? false, puedeProductos: r.puede_productos ?? false, puedeMarcaciones: r.puede_marcaciones ?? false, puedeVacaciones: r.puede_vacaciones ?? false, puedeGastos: r.puede_gastos ?? false, puedePlanificacion: r.puede_planificacion ?? false, usuarioId: r.usuario_id ?? null, montoHonorarios: r.monto_honorarios ?? null, cuentaGastosId: r.cuenta_gastos_id ?? null })
const fromMov    = r => ({ id: r.id, fecha: r.fecha, descripcion: r.descripcion, glosa: r.glosa ?? null, tipo: r.tipo, monto: r.monto, conciliado: r.conciliado, gasto_id: r.gasto_id ?? null, gasto_descripcion: r.gasto_descripcion ?? null })
const fromEmpresa = r => ({ id: r.id, rut: r.rut, nombre: r.nombre, nombreFantasia: r.nombre_fantasia, giro: r.giro, direccion: r.direccion, comuna: r.comuna, ciudad: r.ciudad, region: r.region, pais: r.pais, telefono: r.telefono, email: r.email, sitioWeb: r.sitio_web, logoUrl: r.logo_url, activa: r.activa ?? true })
const fromDoc  = r => ({ id: r.id, trabajadorId: r.trabajador_id, tipo: r.tipo, nombre: r.nombre, fecha: r.fecha, tamaño: r.tamano, url: r.url ?? null, urlExterna: r.url_externa ?? null })
const fromVacacion = r => ({
  id: r.id,
  trabajadorId: r.trabajador_id,
  trabajadorNombre: r.trabajador_nombre,
  fechaDesde: r.fecha_desde,
  fechaHasta: r.fecha_hasta,
  diasHabiles: r.dias_habiles,
  motivo: r.motivo,
  estado: r.estado || 'pendiente',
  comentarioAdmin: r.comentario_admin,
  resueltaEn: r.resuelto_en,
  resueltaPor: r.resuelto_por,
  creadoEn: r.creado_en,
})

const fromColacion = r => ({
  id: r.id,
  trabajadorId: r.trabajador_id,
  trabajadorNombre: r.trabajador_nombre,
  fecha: r.fecha,
  motivo: r.motivo,
  estado: r.estado || 'pendiente',
  resueltaEn: r.resuelto_en,
  resueltaPor: r.resuelto_por,
  creadoEn: r.creado_en,
})

const fromMarcacion = r => ({
  id: r.id,
  trabajadorId: r.trabajador_id,
  tipoMarcacion: r.tipo_marcacion,
  fechaHoraServidor: r.fecha_hora_servidor,
})

const fromHorarioRow = r => ({
  trabajadorId: r.trabajador_id,
  lunes: r.lunes, lunesEntrada: r.lunes_entrada, lunesSalida: r.lunes_salida,
  martes: r.martes, martesEntrada: r.martes_entrada, martesSalida: r.martes_salida,
  miercoles: r.miercoles, miercolesEntrada: r.miercoles_entrada, miercolesSalida: r.miercoles_salida,
  jueves: r.jueves, juevesEntrada: r.jueves_entrada, juevesSalida: r.jueves_salida,
  viernes: r.viernes, viernesEntrada: r.viernes_entrada, viernesSalida: r.viernes_salida,
  sabado: r.sabado, sabadoEntrada: r.sabado_entrada, sabadoSalida: r.sabado_salida,
  domingo: r.domingo, domingoEntrada: r.domingo_entrada, domingoSalida: r.domingo_salida,
  minutosColacion: r.minutos_colacion,
})

const fromCuenta = r => ({
  id: r.id,
  nombre: r.nombre,
  monto: r.monto ?? 0,
  categoria: r.categoria ?? 'otro',
  periodicidad: r.periodicidad ?? 'mensual',
  diaMes: r.dia_mes ?? null,
  fechaVencimiento: r.fecha_vencimiento ?? null,
  activa: r.activa ?? true,
  pagada: r.pagada ?? false,
  telefonosRecordatorio: r.telefonos_recordatorio ?? [],
  creadoEn: r.created_at,
})

const fromPagoCuenta = (r) => ({
  id:                r.id,
  cuentaId:          r.cuenta_id,
  empresaId:         r.empresa_id,
  fechaVencimiento:  r.fecha_vencimiento,
  estado:            r.estado,
  monto:             r.monto,
  comprobanteUrl:    r.comprobante_url,
  comprobanteNombre: r.comprobante_nombre,
  creadoEn:          r.created_at,
})

const fromGasto = r => ({
  id: r.id,
  trabajadorId: r.trabajador_id,
  trabajadorNombre: r.trabajador_nombre,
  fecha: r.fecha_gasto,
  monto: r.monto,
  moneda: r.moneda,
  categoria: r.categoria,
  comercio: r.comercio,
  rutComercio: r.rut_comercio,
  numeroDocumento: r.numero_documento,
  tipoDocumento: r.tipo_documento,
  descripcion: r.descripcion,
  fotoUrl: r.foto_url,
  estado: r.estado,
  latitud: r.latitud,
  longitud: r.longitud,
  creadoEn: r.creado_en,
})

/* ── Mappers: objeto JS → fila DB ───────────────────────────────── */
const toCot  = (c, eId) => ({ id: c.id, empresa_id: eId, numero: c.numero, fecha: c.fecha, cliente: c.cliente, comuna: c.comuna, direccion: c.direccion, telefono: c.telefono, email: c.email, estado: c.estado, observaciones: c.observaciones, enviado_whatsapp: c.enviadoWhatsapp, enviado_email: c.enviadoEmail, items: c.items, neto: c.neto, iva: c.iva, total: c.total, condiciones_pago: c.condicionesPago?.length ? c.condicionesPago : null, glosa: c.glosa || null, fecha_expiracion: c.fechaExpiracion || null, descuento_tipo: c.descuentoTipo ?? 'porcentaje', descuento_valor: c.descuentoValor ?? 0, usuario_id: c.usuarioId || null, creado_por: c.creadoPor || null, estado_total: c.estadoTotal ?? 'pendiente', productos_asociados: c.productos_asociados ?? [], pagos_comprobantes: c.pagosComprobantes?.length ? c.pagosComprobantes : null })
const toProv = (p, eId) => ({ id: p.id, empresa_id: eId, nombre: p.nombre, rut: p.rut, email: p.email, telefono: p.telefono, direccion: p.direccion, comuna: p.comuna })
const toOC   = (c, eId) => ({ id: c.id, empresa_id: eId, numero: c.numero, fecha: c.fecha, proveedor_id: c.proveedorId, proveedor: c.proveedor, proveedor_rut: c.proveedorRut, cotizacion_id: c.cotizacionId, cotizacion_numero: c.cotizacionNumero, cotizacion_cliente: c.cotizacionCliente, estado: c.estado, observaciones: c.observaciones, items: c.items, monto: c.monto, voucher: c.voucher, factura_verificada: c.facturaVerificada, factura_proveedor_url: c.facturaProveedorUrl || null, factura_proveedor_nombre: c.facturaProveedorNombre || null, comprobantes: c.comprobantes ?? [], facturas: c.facturas ?? [] })
const toFac  = (f, eId) => ({ id: f.id, empresa_id: eId, tipo: f.tipo ?? 'compra', tipo_documento: f.tipoDocumento ?? 'FACTURA', folio: f.folio, rut_emisor: f.rutEmisor ?? '', razon_social: f.razonSocial ?? '', proveedor: f.razonSocial ?? '', proveedor_rut: f.rutEmisor ?? '', fecha: f.fecha, neto: f.neto ?? 0, iva: f.iva ?? 0, total: f.total ?? 0, estado: f.estado ?? 'vigente' })
const toTelefonoCanonical = (raw) => {
  const digits = String(raw ?? '').replace(/\D/g, '')
  const last8 = digits.startsWith('569') ? digits.slice(3) : digits.startsWith('56') ? digits.slice(2) : digits
  return last8 ? `+569${last8}` : ''
}
const toTrab = (t, eId) => ({ id: t.id, empresa_id: eId, nombre: t.nombre, rut: t.rut, email: t.email, telefono: toTelefonoCanonical(t.telefono), cargo: t.cargo, sueldo: t.sueldo, sueldo_minimo: t.sueldoMinimo ?? 539000, fecha_ingreso: t.fechaIngreso, estado: t.estado, tipo_contrato: t.tipoContrato ?? 'indefinido', afp: t.afp ?? 'Habitat', porcentaje_afp: t.porcentajeAfp ?? 10.27, prevision_salud: t.previsionSalud ?? 'Fonasa', isapre: t.isapre ?? null, monto_isapre: t.montoIsapre ?? 0, bono_fijo: t.bonoFijo ?? 0, colacion: t.colacion ?? 0, movilizacion: t.movilizacion ?? 0, fecha_nacimiento: t.fechaNacimiento || null, nacionalidad: t.nacionalidad ?? 'Chilena', estado_civil: t.estadoCivil ?? 'soltero', tipo_documento: t.tipoDocumento ?? 'RUT', numero_documento: t.numeroDocumento || null, fecha_vencimiento_visa: t.fechaVencimientoVisa || null, direccion: t.direccion || null, numero: t.numero || null, comuna: t.comuna || null, ciudad: t.ciudad || null, region: t.region || null, banco: t.banco || null, tipo_cuenta: t.tipoCuenta || null, numero_cuenta: t.numeroCuenta || null, app_activa: t.appActiva, puede_cotizar: t.puedeCotizar, puede_oc: t.puedeOC, puede_rrhh: t.puedeRRHH, puede_finanzas: t.puedeFinanzas, puede_proyectos: t.puedeProyectos, puede_asesoria: t.puedeAsesoria, puede_remuneraciones: t.puedeRemuneraciones, puede_facturas: t.puedeFacturas, puede_visitas: t.puedeVisitas, puede_visitas_app: t.puedeVisitasApp, puede_productos: t.puedeProductos, puede_marcaciones: t.puedeMarcaciones ?? false, puede_vacaciones: t.puedeVacaciones ?? false, puede_gastos: t.puedeGastos ?? false, puede_planificacion: t.puedePlanificacion ?? false, usuario_id: t.usuario_id ?? null, monto_honorarios: t.montoHonorarios ? Number(t.montoHonorarios) : null, cuenta_gastos_id: t.cuentaGastosId ?? null })
const toMov  = (m, eId) => ({ id: m.id, empresa_id: eId, fecha: m.fecha, descripcion: m.descripcion, tipo: m.tipo, monto: m.monto, conciliado: m.conciliado })
const toDoc    = (d, eId) => ({ id: d.id, empresa_id: eId, trabajador_id: d.trabajadorId, tipo: d.tipo, nombre: d.nombre, fecha: d.fecha, tamano: d.tamaño, url: d.url || null, url_externa: d.urlExterna || null })
const toCuenta = (c, eId) => ({
  id: c.id, empresa_id: eId, nombre: c.nombre, monto: c.monto,
  categoria: c.categoria ?? 'otro', periodicidad: c.periodicidad ?? 'mensual',
  dia_mes: c.diaMes ?? null, fecha_vencimiento: c.fechaVencimiento ?? null,
  activa: c.activa ?? true, pagada: c.pagada ?? false,
})

const q = (table) => supabase.from(table)

export const SupabaseAPI = {
  /* Cotizaciones */
  getCotizaciones: async (eId) => {
    const [{ data, error }, { data: users }] = await Promise.all([
      q('cotizaciones').select('*').eq('empresa_id', eId).order('created_at', { ascending: false }),
      q('usuarios').select('id, nombre').eq('empresa_id', eId).is('deleted_at', null),
    ])
    if (error) throw error
    const userMap = Object.fromEntries((users || []).map(u => [String(u.id), u.nombre]))
    return data.map(r => {
      const cot = fromCot(r)
      if (!cot.creadoPor && r.usuario_id) cot.creadoPor = userMap[String(r.usuario_id)] ?? null
      return cot
    })
  },
  insertCotizacion: (c, eId)    => q('cotizaciones').insert(toCot(c, eId)),
  updateCotizacion: (c, eId)    => q('cotizaciones').update(toCot(c, eId)).eq('id', c.id),
  deleteCotizacion: (id)        => q('cotizaciones').delete().eq('id', id),

  /* Proveedores */
  getProveedores:  async (eId) => { const { data, error } = await q('proveedores').select('*').eq('empresa_id', eId).order('nombre'); if (error) throw error; return data.map(fromProv) },
  insertProveedor: (p, eId)    => q('proveedores').insert(toProv(p, eId)),
  updateProveedor: (p, eId)    => q('proveedores').update(toProv(p, eId)).eq('id', p.id),
  deleteProveedor: (id)        => q('proveedores').delete().eq('id', id),

  /* Compras */
  getCompras:  async (eId) => { const { data, error } = await q('compras').select('*').eq('empresa_id', eId).order('created_at', { ascending: false }); if (error) throw error; return data.map(fromOC) },
  insertCompra: (c, eId)   => q('compras').insert(toOC(c, eId)),
  updateCompra: (c, eId)   => q('compras').update(toOC(c, eId)).eq('id', c.id),
  deleteCompra: (id)        => q('compras').delete().eq('id', id),

  /* Facturas SII */
  getFacturasSII:    async (eId) => { const { data, error } = await q('facturas_sii').select('*').eq('empresa_id', eId).order('fecha', { ascending: false }); if (error) throw error; return data.map(fromFac) },
  insertFacturaSII:  (f, eId)   => q('facturas_sii').insert(toFac(f, eId)),
  updateFacturaSII:  (f, eId)   => q('facturas_sii').update(toFac(f, eId)).eq('id', f.id),
  deleteFacturaSII:  (id)       => q('facturas_sii').delete().eq('id', id),
  bulkInsertFacturasSII: async (rows, eId) => {
    const payload = rows.map(f => toFac({ ...f, id: f.id || crypto.randomUUID() }, eId))
    const { error } = await q('facturas_sii').upsert(payload, { onConflict: 'id' })
    if (error) throw error
  },

  /* Trabajadores */
  getTrabajadores:  async (eId) => { const { data, error } = await q('trabajadores').select('*').eq('empresa_id', eId).order('nombre'); if (error) throw error; return data.map(fromTrab) },
  getTrabajadorById: async (id) => { const { data, error } = await q('trabajadores').select('*').eq('id', id).single(); if (error) throw error; return fromTrab(data) },
  insertTrabajador: (t, eId)    => q('trabajadores').insert(toTrab(t, eId)),
  updateTrabajador: (t, eId)    => { const payload = toTrab(t, eId); return q('trabajadores').update(payload).eq('id', t.id).select().single() },
  deleteTrabajador: (id)        => q('trabajadores').delete().eq('id', id),

  /* Puntos de trabajo + asignaciones (compartidos con app móvil) */
  getPuntosTrabajo: async (eId) => {
    // Trae todos los puntos (activos e inactivos). El caller filtra si necesita
    // solo activos (ej. selector de asignación en TrabajadorForm).
    let query = q('puntos_trabajo').select('*').order('nombre_lugar')
    if (eId) query = query.eq('empresa_id', eId)
    const { data, error } = await query
    if (error) throw error
    return (data || []).map(r => ({
      id: r.id,
      nombreLugar: r.nombre_lugar,
      direccion: r.direccion,
      latitud: r.latitud,
      longitud: r.longitud,
      radioPermitidoMetros: r.radio_permitido_metros,
      activo: r.activo,
    }))
  },
  createPuntoTrabajo: async (data, eId) => {
    const payload = {
      nombre_lugar: data.nombreLugar?.trim(),
      direccion: data.direccion?.trim(),
      latitud: data.latitud,
      longitud: data.longitud,
      radio_permitido_metros: data.radioPermitidoMetros,
      activo: data.activo ?? true,
    }
    if (eId) payload.empresa_id = eId
    const { data: row, error } = await q('puntos_trabajo').insert(payload).select('*').single()
    if (error) throw error
    return {
      id: row.id,
      nombreLugar: row.nombre_lugar,
      direccion: row.direccion,
      latitud: row.latitud,
      longitud: row.longitud,
      radioPermitidoMetros: row.radio_permitido_metros,
      activo: row.activo,
    }
  },
  updatePuntoTrabajo: async (id, data) => {
    const payload = {}
    if (data.nombreLugar !== undefined) payload.nombre_lugar = data.nombreLugar.trim()
    if (data.direccion !== undefined) payload.direccion = data.direccion.trim()
    if (data.latitud !== undefined) payload.latitud = data.latitud
    if (data.longitud !== undefined) payload.longitud = data.longitud
    if (data.radioPermitidoMetros !== undefined) payload.radio_permitido_metros = data.radioPermitidoMetros
    if (data.activo !== undefined) payload.activo = data.activo
    const { data: row, error } = await q('puntos_trabajo').update(payload).eq('id', id).select('*').single()
    if (error) throw error
    return {
      id: row.id,
      nombreLugar: row.nombre_lugar,
      direccion: row.direccion,
      latitud: row.latitud,
      longitud: row.longitud,
      radioPermitidoMetros: row.radio_permitido_metros,
      activo: row.activo,
    }
  },
  togglePuntoTrabajo: async (id, activo) => {
    const { error } = await q('puntos_trabajo').update({ activo }).eq('id', id)
    if (error) throw error
  },
  getAsignacionActiva: async (trabajadorId) => {
    const { data, error } = await q('asignaciones_trabajo')
      .select('*')
      .eq('trabajador_id', trabajadorId)
      .eq('activo', true)
      .order('fecha_desde', { ascending: false })
      .limit(1)
    if (error) throw error
    return (data && data[0]) || null
  },
  setAsignacionTrabajador: async (trabajadorId, puntoTrabajoId) => {
    // Desactiva la asignación previa y crea la nueva si corresponde.
    const { error: deactErr } = await q('asignaciones_trabajo')
      .update({ activo: false, fecha_hasta: new Date().toISOString().slice(0, 10) })
      .eq('trabajador_id', trabajadorId)
      .eq('activo', true)
    if (deactErr) throw deactErr
    if (!puntoTrabajoId) return null
    const { data, error } = await q('asignaciones_trabajo')
      .insert({
        trabajador_id: trabajadorId,
        punto_trabajo_id: puntoTrabajoId,
        fecha_desde: new Date().toISOString().slice(0, 10),
        fecha_hasta: null,
        activo: true,
      })
      .select('*')
      .single()
    if (error) throw error
    return data
  },

  /* Movimientos */
  getMovimientos:  async (eId) => { const { data, error } = await q('movimientos').select('*').eq('empresa_id', eId).order('fecha', { ascending: false }); if (error) throw error; return data.map(fromMov) },
  insertMovimiento: (m, eId)   => q('movimientos').insert(toMov(m, eId)),
  updateMovimiento: (m, eId)   => q('movimientos').update(toMov(m, eId)).eq('id', m.id),
  deleteMovimiento: (id)       => q('movimientos').delete().eq('id', id),

  /* Documentos */
  getDocumentos:  async (eId) => { const { data, error } = await q('documentos').select('*').eq('empresa_id', eId); if (error) throw error; return data.map(fromDoc) },
  insertDocumento: (d, eId)   => q('documentos').insert(toDoc(d, eId)),
  deleteDocumento: (id)        => q('documentos').delete().eq('id', id),

  /* Empresas */
  getEmpresas: async (ids) => {
    let query = q('empresas').select('*').order('nombre')
    if (ids?.length) query = query.in('id', ids)
    const { data, error } = await query
    if (error) throw error
    return data.map(fromEmpresa)
  },
  insertEmpresa: async (empresa) => {
    const toRow = (e) => ({
      id:             e._id || crypto.randomUUID(),
      nombre:         e.nombre.trim(),
      rut:            e.rut.trim(),
      nombre_fantasia: e.nombreFantasia?.trim() || null,
      giro:           e.giro?.trim()            || null,
      direccion:      e.direccion?.trim()        || null,
      comuna:         e.comuna?.trim()           || null,
      ciudad:         e.ciudad?.trim()           || null,
      region:         e.region?.trim()           || null,
      pais:           e.pais?.trim()             || 'Chile',
      telefono:       e.telefono?.trim()         || null,
      email:          e.email?.toLowerCase().trim() || null,
      sitio_web:      e.sitioWeb?.trim()         || null,
      activa:         e.activa ?? true,
      logo_url:       e.logoUrl || null,
    })
    const { data, error } = await q('empresas').insert(toRow(empresa)).select('*').single()
    if (error) throw error
    return fromEmpresa(data)
  },
  uploadVoucherPago: async (empresaId, ocId, file) => {
    const ext  = file.name.split('.').pop().toLowerCase()
    const path = `${empresaId}/${ocId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('pago_proveedores')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw error
    return supabase.storage.from('pago_proveedores').getPublicUrl(path).data.publicUrl
  },

  uploadFacturaProveedor: async (ocId, file) => {
    const path = `compras/${ocId}/${Date.now()}_${file.name.replace(/\s/g, '_')}`
    const { error } = await supabase.storage
      .from('documentos')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw error
    return supabase.storage.from('documentos').getPublicUrl(path).data.publicUrl
  },

  uploadComprobante: async (empresaId, ocId, file) => {
    const ext  = file.name.split('.').pop().toLowerCase()
    const path = `${empresaId}/${ocId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('pago_proveedores')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw error
    return supabase.storage.from('pago_proveedores').getPublicUrl(path).data.publicUrl
  },

  deleteFacturaProveedor: async (url) => {
    const marker = '/storage/v1/object/public/documentos/'
    const path = url.split(marker)[1]
    if (path) {
      const { error } = await supabase.storage.from('documentos').remove([decodeURIComponent(path)])
      if (error) throw error
    }
  },

  uploadLogoEmpresa: async (empresaId, file) => {
    const ext  = file.name.split('.').pop().toLowerCase()
    const path = `${empresaId}/logo.${ext}`
    const { error } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw error
    return supabase.storage.from('logos').getPublicUrl(path).data.publicUrl
  },
  updateEmpresa: async (empresa) => {
    const { error } = await q('empresas').update({
      nombre:          empresa.nombre.trim(),
      rut:             empresa.rut.trim(),
      nombre_fantasia: empresa.nombreFantasia?.trim() || null,
      giro:            empresa.giro?.trim()            || null,
      direccion:       empresa.direccion?.trim()        || null,
      comuna:          empresa.comuna?.trim()           || null,
      ciudad:          empresa.ciudad?.trim()           || null,
      region:          empresa.region?.trim()           || null,
      pais:            empresa.pais?.trim()             || null,
      telefono:        empresa.telefono?.trim()         || null,
      email:           empresa.email?.toLowerCase().trim() || null,
      sitio_web:       empresa.sitioWeb?.trim()         || null,
      activa:          empresa.activa ?? true,
      logo_url:        empresa.logoUrl ?? null,
    }).eq('id', empresa.id)
    if (error) throw error
  },

  /* Solicitudes vacaciones */
  getSolicitudesVacaciones: async (trabajadorIds) => {
    if (!trabajadorIds.length) return []
    const { data, error } = await q('solicitudes_vacaciones')
      .select('*').in('trabajador_id', trabajadorIds).order('creado_en', { ascending: false })
    if (error) throw error
    return data.map(fromVacacion)
  },
  updateSolicitudVacacion: (id, updates) => q('solicitudes_vacaciones').update(updates).eq('id', id),

  /* Solicitudes omitir colación */
  getSolicitudesColacion: async (trabajadorIds) => {
    if (!trabajadorIds.length) return []
    const { data, error } = await q('solicitudes_omitir_colacion')
      .select('*').in('trabajador_id', trabajadorIds).order('creado_en', { ascending: false })
    if (error) throw error
    return data.map(fromColacion)
  },
  updateSolicitudColacion: (id, updates) => q('solicitudes_omitir_colacion').update(updates).eq('id', id),

  /* Solicitudes de reset de contraseña (creadas por la app móvil) */
  getSolicitudesPassword: async (trabIds) => {
    if (!trabIds || !trabIds.length) return []
    const { data, error } = await q('solicitudes_password')
      .select('*')
      .in('trabajador_id', trabIds)
      .order('fecha_solicitud', { ascending: false })
    if (error) throw error
    return (data || []).map(r => ({
      id: r.id,
      trabajadorId: r.trabajador_id,
      trabajadorNombre: null,
      rut: r.rut,
      telefono: r.telefono,
      estado: r.estado,
      fechaSolicitud: r.fecha_solicitud,
      fechaResolucion: r.fecha_resolucion,
      resueltoPor: r.resuelto_por,
      comentario: r.comentario,
    }))
  },
  resolverSolicitudPassword: async (id, estado, resueltoPor) => {
    const { data, error } = await q('solicitudes_password')
      .update({
        estado,
        fecha_resolucion: new Date().toISOString(),
        resuelto_por: resueltoPor ?? null,
      })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data
  },

  /* Marcaciones */
  getMarcaciones: async (trabajadorIds) => {
    if (!trabajadorIds.length) return []
    const primerDia = new Date()
    primerDia.setDate(1); primerDia.setHours(0, 0, 0, 0)
    const { data, error } = await q('marcaciones')
      .select('id, trabajador_id, tipo_marcacion, fecha_hora_servidor')
      .in('trabajador_id', trabajadorIds)
      .gte('fecha_hora_servidor', primerDia.toISOString())
      .order('fecha_hora_servidor', { ascending: true })
    if (error) throw error
    return data.map(fromMarcacion)
  },

  /* Horarios trabajadores */
  getHorario: async (trabajadorId) => {
    const { data, error } = await q('horarios_trabajadores')
      .select('*').eq('trabajador_id', trabajadorId).maybeSingle()
    if (error) throw error
    if (!data) return null
    return {
      id: data.id, trabajadorId: data.trabajador_id, empresaId: data.empresa_id,
      lunes: data.lunes, lunesEntrada: data.lunes_entrada, lunesSalida: data.lunes_salida,
      martes: data.martes, martesEntrada: data.martes_entrada, martesSalida: data.martes_salida,
      miercoles: data.miercoles, miercolesEntrada: data.miercoles_entrada, miercolesSalida: data.miercoles_salida,
      jueves: data.jueves, juevesEntrada: data.jueves_entrada, juevesSalida: data.jueves_salida,
      viernes: data.viernes, viernesEntrada: data.viernes_entrada, viernesSalida: data.viernes_salida,
      sabado: data.sabado, sabadoEntrada: data.sabado_entrada, sabadoSalida: data.sabado_salida,
      domingo: data.domingo, domingoEntrada: data.domingo_entrada, domingoSalida: data.domingo_salida,
      minutosColacion: data.minutos_colacion,
    }
  },
  getHorarios: async (trabajadorIds) => {
    if (!trabajadorIds.length) return []
    const { data, error } = await q('horarios_trabajadores')
      .select('*').in('trabajador_id', trabajadorIds)
    if (error) throw error
    return data.map(fromHorarioRow)
  },

  upsertHorario: async (h, empresaId) => {
    const { error } = await q('horarios_trabajadores').upsert({
      trabajador_id: h.trabajadorId, empresa_id: empresaId,
      lunes: h.lunes, lunes_entrada: h.lunesEntrada, lunes_salida: h.lunesSalida,
      martes: h.martes, martes_entrada: h.martesEntrada, martes_salida: h.martesSalida,
      miercoles: h.miercoles, miercoles_entrada: h.miercolesEntrada, miercoles_salida: h.miercolesSalida,
      jueves: h.jueves, jueves_entrada: h.juevesEntrada, jueves_salida: h.juevesSalida,
      viernes: h.viernes, viernes_entrada: h.viernesEntrada, viernes_salida: h.viernesSalida,
      sabado: h.sabado, sabado_entrada: h.sabadoEntrada, sabado_salida: h.sabadoSalida,
      domingo: h.domingo, domingo_entrada: h.domingoEntrada, domingo_salida: h.domingoSalida,
      minutos_colacion: h.minutosColacion, updated_at: new Date().toISOString(),
    }, { onConflict: 'trabajador_id' })
    if (error) throw error
  },

  /* Usuarios sin trabajador vinculado */
  getUsuariosSinTrabajador: async (empresaId) => {
    // 1) IDs ya vinculados en trabajadores de esta empresa
    const { data: vinculados } = await q('trabajadores')
      .select('usuario_id')
      .eq('empresa_id', empresaId)
      .not('usuario_id', 'is', null)
    const idsVinculados = (vinculados || []).map(t => t.usuario_id).filter(Boolean)

    // 2) RUTs de todos los trabajadores de esta empresa (para cruzar con usuarios
    //    cuyos empresa_id puede estar null por no haber pasado por sincronizarUsuarioTrabajador)
    const { data: trabsEmpresa } = await q('trabajadores')
      .select('rut')
      .eq('empresa_id', empresaId)
      .not('rut', 'is', null)
    const rutsEmpresa = (trabsEmpresa || []).map(t => t.rut).filter(Boolean)

    // 3) Usuarios que pertenecen a la empresa: empresa_id correcto OR rut conocido en esta empresa
    let query = q('usuarios')
      .select('id, nombre, nombres, apellidos, email, rol, cargo, rut, telefono')
      .order('nombre')

    if (rutsEmpresa.length > 0) {
      query = query.or(`empresa_id.eq.${empresaId},rut.in.(${rutsEmpresa.join(',')})`)
    } else {
      query = query.eq('empresa_id', empresaId)
    }

    if (idsVinculados.length > 0) {
      query = query.not('id', 'in', `(${idsVinculados.join(',')})`)
    }

    const { data, error } = await query
    if (error) throw error
    return (data || []).map(r => ({
      id:        r.id,
      nombre:    r.nombre    ?? '',
      nombres:   r.nombres   ?? '',
      apellidos: r.apellidos ?? '',
      email:     r.email     ?? '',
      rol:       r.rol       ?? '',
      cargo:     r.cargo     ?? '',
      rut:       r.rut       ?? '',
      telefono:  r.telefono  ?? '',
    }))
  },

  /* Cuentas empresa */
  getCuentasEmpresa: async (eId) => {
    const { data, error } = await q('cuentas_empresa').select('*').eq('empresa_id', eId).order('created_at')
    if (error) throw error
    return data.map(fromCuenta)
  },
  insertCuenta: (c, eId)  => q('cuentas_empresa').insert(toCuenta(c, eId)),
  updateCuenta: (c, eId)  => q('cuentas_empresa').update(toCuenta(c, eId)).eq('id', c.id),
  deleteCuenta: (id)      => q('cuentas_empresa').delete().eq('id', id),

  /* Pagos cuentas empresa */
  getPagosCuentas: async (empresaId) => {
    const { data } = await q('pagos_cuentas_empresa')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('fecha_vencimiento', { ascending: false })
    return (data || []).map(fromPagoCuenta)
  },

  insertPagoCuenta: async (pago) => {
    const { data } = await q('pagos_cuentas_empresa')
      .insert({
        cuenta_id:         pago.cuentaId,
        empresa_id:        pago.empresaId,
        fecha_vencimiento: pago.fechaVencimiento,
        estado:            pago.estado || 'pendiente',
        monto:             pago.monto,
      })
      .select('*')
      .single()
    return fromPagoCuenta(data)
  },

  updatePagoCuenta: async (id, updates) => {
    const payload = {}
    if (updates.estado !== undefined)            payload.estado = updates.estado
    if (updates.comprobanteUrl !== undefined)    payload.comprobante_url = updates.comprobanteUrl
    if (updates.comprobanteNombre !== undefined) payload.comprobante_nombre = updates.comprobanteNombre
    const { data } = await q('pagos_cuentas_empresa')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()
    return fromPagoCuenta(data)
  },

  /* Gastos */
  updateGastoEstado: (id, estado) => q('gastos').update({ estado }).eq('id', id),

  getGastos: async (empresaId) => {
    const { data, error } = await q('gastos')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('fecha_gasto', { ascending: false })
    if (error) throw error
    return data.map(fromGasto)
  },
}
