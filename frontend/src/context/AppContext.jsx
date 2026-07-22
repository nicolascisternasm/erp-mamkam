import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { generateId, generateNumero, addBusinessDays } from '../utils/formatters'
import { useAuth } from '../modules/auth/AuthContext'
import { SupabaseAPI, supabase, fromTrab } from '../services/supabase'
import { apiClient } from '../services/apiClient'

const fromGastoRow = (r) => ({
  id:              r.id,
  trabajadorId:    r.trabajador_id,
  trabajadorNombre: r.trabajador_nombre,
  fecha:           r.fecha_gasto,
  monto:           r.monto,
  moneda:          r.moneda,
  categoria:       r.categoria,
  comercio:        r.comercio,
  rutComercio:     r.rut_comercio,
  numeroDocumento: r.numero_documento,
  tipoDocumento:   r.tipo_documento,
  descripcion:     r.descripcion,
  fotoUrl:         r.foto_url,
  estado:          r.estado,
  latitud:         r.latitud,
  longitud:        r.longitud,
  creadoEn:        r.creado_en,
  tipo_movimiento:   r.tipo_movimiento  ?? 'egreso',
  subtipo:           r.subtipo          ?? null,
  cuenta_origen_id:  r.cuenta_origen_id ?? null,
  cuenta_destino_id: r.cuenta_destino_id ?? null,
})

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const { user, authReady } = useAuth()
  const empresaId = user?.empresa_id ?? null

  const [loading,   setLoading]   = useState(false)
  const [syncError, setSyncError] = useState(null)
  const [empresa,   setEmpresa]   = useState(null)

  const [cotizaciones, setCotizaciones] = useState([])
  const [proveedores,  setProveedores]  = useState([])
  const [compras,      setCompras]      = useState([])
  const [facturasSII,  setFacturasSII]  = useState([])
  const [trabajadores, setTrabajadores] = useState([])
  const [movimientos,  setMovimientos]  = useState([])
  const [cuentas,      setCuentas]      = useState([])
  const [documentos,             setDocumentos]             = useState([])
  const [gastos,                 setGastos]                 = useState([])
  const [solicitudesVacaciones,  setSolicitudesVacaciones]  = useState([])
  const [solicitudesColacion,    setSolicitudesColacion]    = useState([])
  const [marcaciones,            setMarcaciones]            = useState([])
  const [horarios,               setHorarios]               = useState({})
  const [solicitudesPassword,    setSolicitudesPassword]    = useState([])
  const [puntosTrabajo,          setPuntosTrabajo]          = useState([])
  const [proyectos,              setProyectos]              = useState([])
  const [pagosCuentas,           setPagosCuentas]           = useState([])

  /* Carga todos los datos al loguearse / cambiar de empresa */
  useEffect(() => {
    if (!authReady) return
    if (!empresaId) {
      setEmpresa(null)
      setCotizaciones([]); setProveedores([]); setCompras([])
      setFacturasSII([]); setTrabajadores([]); setMovimientos([]); setDocumentos([]); setGastos([])
      setCuentas([])
      setSolicitudesVacaciones([]); setSolicitudesColacion([])
      setMarcaciones([]); setHorarios({})
      setSolicitudesPassword([])
      setPuntosTrabajo([])
      setProyectos([])
      return
    }
    setLoading(true)
    setSyncError(null)
    Promise.all([
      SupabaseAPI.getCotizaciones(empresaId),
      SupabaseAPI.getProveedores(empresaId),
      SupabaseAPI.getCompras(empresaId),
      apiClient.get('/trabajadores').catch(() => []),
      SupabaseAPI.getMovimientos(empresaId),
      SupabaseAPI.getDocumentos(empresaId),
      apiClient.get('/gastos').catch(() => []),
      apiClient.get('/puntos-trabajo').catch(() => []),
      SupabaseAPI.getCuentasEmpresa(empresaId),
      SupabaseAPI.getPagosCuentas(empresaId).catch(() => []),
      // Carga empresa: intenta API primero, fallback directo a Supabase si falla
      (async () => {
        try {
          const e = await apiClient.get('/auth/empresa')
          if (e) return e
        } catch {}
        if (!empresaId) return null
        const { data } = await supabase.from('empresas').select('*').eq('id', String(empresaId)).maybeSingle()
        return data || null
      })(),
    ])
      .then(([cots, provs, comps, trabs, movs, docs, gasts, puntos, ctas, pcData, emp]) => {
        console.log('[AppContext] trabajadores recibidos:', trabs?.length, trabs)
        setCotizaciones(cots); setProveedores(provs); setCompras(comps)
        setTrabajadores(trabs); setMovimientos(movs)
        setDocumentos(docs); setGastos(gasts)
        setPuntosTrabajo(puntos || [])
        setCuentas(ctas || [])
        setPagosCuentas(pcData || [])
        setEmpresa(emp || null)
        const ids = trabs.map((t) => t.id)
        console.log('[AppContext] ids para solicitudes:', ids)
        const trabMap = Object.fromEntries(trabs.map((t) => [t.id, t.nombre]))
        if (!ids.length) return [[], [], [], [], []]
        console.log('[AppContext] cargando solicitudes con ids:', ids)
        return Promise.all([
          apiClient.get('/solicitudes/vacaciones').then(r => { console.log('[AppContext] vacaciones:', r); return r }).catch(e => { console.log('[AppContext] vacaciones error:', e); return [] }),
          apiClient.get('/solicitudes/colacion').then(r => { console.log('[AppContext] colacion:', r); return r }).catch(e => { console.log('[AppContext] colacion error:', e); return [] }),
          SupabaseAPI.getMarcaciones(ids),
          SupabaseAPI.getHorarios(ids),
          apiClient.get('/solicitudes/password').then(r => { console.log('[AppContext] password:', r); return r }).catch(e => { console.log('[AppContext] password error:', e); return [] }),
        ]).then((results) => [...results, trabMap])
      })
      .then(([vacs, cols, marcs, hors, pwds, trabMap]) => {
        setSolicitudesVacaciones(vacs || [])
        setSolicitudesColacion(cols || [])
        setMarcaciones(marcs || [])
        const map = {}
        ;(hors || []).forEach((h) => { map[h.trabajadorId] = h })
        setHorarios(map)
        setSolicitudesPassword((pwds || []).map((p) => ({
          ...p,
          trabajadorNombre: p.trabajadorNombre ?? trabMap?.[p.trabajadorId] ?? null,
        })))
      })
      .catch((err) => setSyncError('Error al cargar datos: ' + err.message))
      .finally(() => setLoading(false))
  }, [empresaId, authReady])

  /* Suscripción Realtime: INSERT en gastos filtrado por empresa_id */
  useEffect(() => {
    if (!authReady || !empresaId) return
    const channel = supabase
      .channel(`gastos-empresa-${empresaId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'gastos',
          filter: `empresa_id=eq.${empresaId}`,
        },
        (payload) => {
          const nuevo = fromGastoRow(payload.new)
          setGastos((prev) => {
            if (prev.some((g) => g.id === nuevo.id)) return prev
            return [nuevo, ...prev]
          })
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [empresaId, authReady])

  /* Carga lazy de proyectos: no bloquea el arranque del ERP */
  useEffect(() => {
    if (!empresaId) return
    apiClient.get('/proyectos')
      .then(data => setProyectos(data || []))
      .catch(() => setProyectos([]))
  }, [empresaId])

  /* Sync en background: actualiza estado local y luego persiste en Supabase */
  const sync = useCallback((fn) => {
    if (!empresaId) return
    fn().then(({ error }) => {
      if (error) setSyncError('Error al guardar: ' + error.message)
    })
  }, [empresaId])

  /* ── Cotizaciones ────────────────────────────────────────────── */
  const addCotizacion = (data) => {
    const nueva = {
      ...data, id: generateId('cot'), numero: generateNumero('COT', cotizaciones),
      fecha: new Date().toISOString().split('T')[0],
      estado: 'borrador', enviadoWhatsapp: false, enviadoEmail: false,
      usuarioId: data.usuarioId || user?.id || null,
      creadoPor: data.creadoPor || user?.nombre || null,
    }
    setCotizaciones((p) => [nueva, ...p])
    sync(() => SupabaseAPI.insertCotizacion(nueva, empresaId))
    return nueva
  }

  const duplicateCotizacion = (id) => {
    const original = cotizaciones.find((c) => c.id === id)
    if (!original) return null
    const today = new Date().toISOString().split('T')[0]
    const nueva = {
      ...original,
      id: generateId('cot'),
      numero: generateNumero('COT', cotizaciones),
      fecha: today,
      fechaExpiracion: addBusinessDays(new Date(), 10).toISOString().split('T')[0],
      estado: 'borrador',
      enviadoWhatsapp: false,
      enviadoEmail: false,
      usuarioId: user?.id || null,
      creadoPor: user?.nombre || null,
      vendedor: user?.nombre || null,
    }
    setCotizaciones((p) => [nueva, ...p])
    sync(() => SupabaseAPI.insertCotizacion(nueva, empresaId))
    return nueva
  }

  const updateCotizacion = (id, updates) => {
    setCotizaciones((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      const updated = next.find((c) => c.id === id)
      if (updated) sync(() => SupabaseAPI.updateCotizacion(updated, empresaId))
      return next
    })
  }

  // Actualiza el estado local sin disparar sync — usar cuando el backend ya fue actualizado directamente
  const updateCotizacionLocal = (id, updates) => {
    setCotizaciones((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)))
  }

  const deleteCotizacion = (id) => {
    const cot = cotizaciones.find((c) => c.id === id)
    setCotizaciones((p) => p.filter((c) => c.id !== id))
    sync(() => SupabaseAPI.deleteCotizacion(id))
    if (cot?.estado === 'aprobada' && cot.numero) {
      const prefix = `Venta ${cot.numero} —`
      const relacionados = movimientos.filter((m) => m.descripcion?.startsWith(prefix))
      if (relacionados.length > 0) {
        setMovimientos((p) => p.filter((m) => !m.descripcion?.startsWith(prefix)))
        relacionados.forEach((m) => sync(() => SupabaseAPI.deleteMovimiento(m.id)))
      }
    }
  }

  const changeCotizacionStatus = (id, estado) => {
    updateCotizacion(id, { estado })
  }

  const setCuotaEstado = (cotId, cuotaIdx, nuevoEstado) => {
    const cot = cotizaciones.find((c) => c.id === cotId)
    if (!cot) return
    const today = new Date().toISOString().split('T')[0]

    const aplicarCambio = (estadoAnterior, descripcion, monto) => {
      if (estadoAnterior === nuevoEstado) return
      const mov = movimientos.find((m) => m.descripcion === descripcion)

      if (nuevoEstado === 'facturado') {
        // pendiente→facturado: crear movimiento "Por cobrar" (no conciliado)
        // pagado→facturado: revertir conciliación (vuelve a "Por cobrar")
        if (!mov) {
          addMovimiento({ fecha: today, descripcion, tipo: 'ingreso', monto, conciliado: false })
        } else {
          conciliarMovimiento(mov.id, false)
        }
      } else if (nuevoEstado === 'pagado') {
        // facturado→pagado: marcar movimiento como cobrado (conciliado)
        // pendiente→pagado (salto): crear directamente como cobrado
        if (mov) {
          conciliarMovimiento(mov.id, true)
        } else {
          addMovimiento({ fecha: today, descripcion, tipo: 'ingreso', monto, conciliado: true })
        }
      } else {
        // →pendiente: eliminar movimiento si existe
        if (mov) {
          setMovimientos((p) => p.filter((m) => m.id !== mov.id))
          sync(() => SupabaseAPI.deleteMovimiento(mov.id))
        }
      }
    }

    if (cot.condicionesPago?.length > 0) {
      const cp = cot.condicionesPago[cuotaIdx]
      const estadoAnterior = cp.estado ?? 'pendiente'
      const nuevasCuotas = cot.condicionesPago.map((c, i) =>
        i === cuotaIdx ? { ...c, estado: nuevoEstado } : c
      )
      updateCotizacion(cotId, { condicionesPago: nuevasCuotas })
      const descripcion = `Venta ${cot.numero} — ${cot.cliente} · ${cp.descripcion}`
      const monto = cp.monto || Math.round(cot.total * cp.porcentaje / 100)
      aplicarCambio(estadoAnterior, descripcion, monto)
    } else {
      const estadoAnterior = cot.estadoTotal ?? 'pendiente'
      updateCotizacion(cotId, { estadoTotal: nuevoEstado })
      aplicarCambio(estadoAnterior, `Venta ${cot.numero} — ${cot.cliente}`, cot.total)
    }
  }

  /* ── Proveedores ─────────────────────────────────────────────── */
  const addProveedor = (data) => {
    const nuevo = { ...data, id: generateId('prov') }
    setProveedores((p) => [nuevo, ...p])
    sync(() => SupabaseAPI.insertProveedor(nuevo, empresaId))
    return nuevo
  }

  const updateProveedor = (id, updates) => {
    setProveedores((p) => {
      const next = p.map((v) => (v.id === id ? { ...v, ...updates } : v))
      const updated = next.find((v) => v.id === id)
      if (updated) sync(() => SupabaseAPI.updateProveedor(updated, empresaId))
      return next
    })
  }

  const deleteProveedor = (id) => {
    setProveedores((p) => p.filter((v) => v.id !== id))
    sync(() => SupabaseAPI.deleteProveedor(id))
  }

  /* ── Compras ─────────────────────────────────────────────────── */
  const addCompra = (data) => {
    const nueva = {
      ...data, id: generateId('oc'), numero: generateNumero('OC', compras),
      fecha: new Date().toISOString().split('T')[0],
      estado: 'creada', voucher: null, facturaVerificada: null,
    }
    setCompras((p) => [nueva, ...p])
    sync(() => SupabaseAPI.insertCompra(nueva, empresaId))
    return nueva
  }

  const updateCompra = (id, updates) => {
    setCompras((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      const updated = next.find((c) => c.id === id)
      if (updated) sync(() => SupabaseAPI.updateCompra(updated, empresaId))
      return next
    })
  }

  const deleteCompra = (id) => {
    const oc = compras.find((c) => c.id === id)
    setCompras((p) => p.filter((c) => c.id !== id))
    sync(() => SupabaseAPI.deleteCompra(id))
    if (oc?.estado !== 'creada' && oc?.numero) {
      const prefix = `Pago OC ${oc.numero} —`
      const relacionados = movimientos.filter((m) => m.descripcion?.startsWith(prefix))
      if (relacionados.length > 0) {
        setMovimientos((p) => p.filter((m) => !m.descripcion?.startsWith(prefix)))
        relacionados.forEach((m) => sync(() => SupabaseAPI.deleteMovimiento(m.id)))
      }
    }
  }

  /* ── Facturas SII ────────────────────────────────────────────── */
  const addFacturaSII = (data) => {
    const nueva = { ...data, id: data.id || generateId('fac') }
    setFacturasSII((p) => [nueva, ...p])
    sync(() => SupabaseAPI.insertFacturaSII(nueva, empresaId))
    return nueva
  }

  const updateFacturaSII = (id, updates) => {
    setFacturasSII((prev) => {
      const next = prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
      const updated = next.find((f) => f.id === id)
      if (updated) sync(() => SupabaseAPI.updateFacturaSII(updated, empresaId))
      return next
    })
  }

  const deleteFacturaSII = (id) => {
    setFacturasSII((p) => p.filter((f) => f.id !== id))
    sync(() => SupabaseAPI.deleteFacturaSII(id))
  }

  const bulkAddFacturasSII = async (rows) => {
    const withIds = rows.map((r) => ({ ...r, id: r.id || crypto.randomUUID() }))
    setFacturasSII((prev) => {
      const existingIds = new Set(prev.map((f) => f.id))
      const nuevas = withIds.filter((f) => !existingIds.has(f.id))
      return [...nuevas, ...prev]
    })
    await SupabaseAPI.bulkInsertFacturasSII(withIds, empresaId)
  }

  const buscarFacturaSII = (proveedorRut, monto) =>
    facturasSII.find(
      (f) => f.rutEmisor === proveedorRut && Math.abs(f.total - monto) / monto <= 0.10
    ) || null

  /* ── Trabajadores ────────────────────────────────────────────── */
  const addTrabajador = (data) => {
    const nuevo = { ...data, id: crypto.randomUUID(), estado: 'activo' }
    setTrabajadores((p) => [nuevo, ...p])
    sync(() => SupabaseAPI.insertTrabajador(nuevo, empresaId))
    return nuevo
  }

  const updateTrabajador = async (id, updates) => {
    const current = trabajadores.find((t) => t.id === id)
    const merged  = { ...current, ...updates }
    const { data: responseData, error } = await SupabaseAPI.updateTrabajador(merged, empresaId)
    if (error) throw new Error(error.message)
    const trabajadorActualizado = responseData ? fromTrab(responseData) : merged
    setTrabajadores((prev) => prev.map((t) => (t.id === id ? trabajadorActualizado : t)))
  }

  const deleteTrabajador = async (id) => {
    const { error } = await SupabaseAPI.deleteTrabajador(id)
    if (!error) {
      setTrabajadores((p) => p.filter((t) => t.id !== id))
      return
    }
    // FK constraint: el trabajador tiene liquidaciones u otros registros asociados
    // → marcar como inactivo en lugar de eliminar
    if (error.code === '23503') {
      const { error: e2 } = await supabase
        .from('trabajadores').update({ estado: 'inactivo' }).eq('id', id)
      if (!e2) {
        setTrabajadores((p) => p.map((t) => t.id === id ? { ...t, estado: 'inactivo' } : t))
        setSyncError('El trabajador tiene liquidaciones u otros registros asociados y no puede eliminarse. Fue marcado como inactivo.')
        return
      }
    }
    setSyncError('Error al eliminar trabajador: ' + error.message)
  }

  /* ── Movimientos ─────────────────────────────────────────────── */
  const addMovimiento = (data) => {
    const nuevo = { ...data, id: generateId('mov'), conciliado: data.conciliado ?? false }
    setMovimientos((p) => [nuevo, ...p])
    sync(() => SupabaseAPI.insertMovimiento(nuevo, empresaId))
  }

  const toggleConciliado = (id) => {
    setMovimientos((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, conciliado: !m.conciliado } : m))
      const updated = next.find((m) => m.id === id)
      if (updated) sync(() => SupabaseAPI.updateMovimiento(updated, empresaId))
      return next
    })
  }

  const conciliarMovimiento = (id, valor) => {
    setMovimientos((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, conciliado: valor } : m))
      const updated = next.find((m) => m.id === id)
      if (updated) sync(() => SupabaseAPI.updateMovimiento(updated, empresaId))
      return next
    })
  }

  /* ── Cuentas empresa ────────────────────────────────────────── */
  const addCuenta = (data) => {
    const nueva = { ...data, id: crypto.randomUUID(), activa: true, pagada: false }
    setCuentas((p) => [...p, nueva])
    sync(() => SupabaseAPI.insertCuenta(nueva, empresaId))
    return nueva
  }

  const updateCuenta = (id, updates) => {
    setCuentas((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      const updated = next.find((c) => c.id === id)
      if (updated) sync(() => SupabaseAPI.updateCuenta(updated, empresaId))
      return next
    })
  }

  const deleteCuenta = (id) => {
    setCuentas((p) => p.filter((c) => c.id !== id))
    sync(() => SupabaseAPI.deleteCuenta(id))
  }

  const addPagoCuenta = async (pago) => {
    const nuevo = await SupabaseAPI.insertPagoCuenta(pago)
    setPagosCuentas((prev) => [...prev, nuevo])
    return nuevo
  }

  const updatePagoCuenta = async (id, updates) => {
    const updated = await SupabaseAPI.updatePagoCuenta(id, updates)
    setPagosCuentas((prev) => prev.map((p) => (p.id === id ? updated : p)))
    return updated
  }

  const pagarCuenta = (id) => {
    const cuenta = cuentas.find((c) => c.id === id)
    if (!cuenta) return
    const today = new Date().toISOString().split('T')[0]
    const mesLabel = new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
    if (cuenta.periodicidad === 'unica') {
      updateCuenta(id, { pagada: true })
      addMovimiento({ fecha: today, descripcion: `Cuenta ${cuenta.nombre}`, tipo: 'egreso', monto: cuenta.monto, conciliado: true })
    } else {
      addMovimiento({ fecha: today, descripcion: `Cuenta ${cuenta.nombre} — ${mesLabel}`, tipo: 'egreso', monto: cuenta.monto, conciliado: true })
    }
  }

  /* ── Documentos ──────────────────────────────────────────────── */
  const addDocumento = (data) => {
    const n = { ...data, id: generateId('doc') }
    setDocumentos((p) => [n, ...p])
    sync(() => SupabaseAPI.insertDocumento(n, empresaId))
  }

  const deleteDocumento = (id) => {
    const doc = documentos.find(d => d.id === id)
    setDocumentos((p) => p.filter((d) => d.id !== id))
    sync(() => SupabaseAPI.deleteDocumento(id))
    if (doc?.url) {
      const path = doc.url.split('/storage/v1/object/public/documentos/')[1]
      if (path) supabase.storage.from('documentos').remove([decodeURIComponent(path)]).catch(() => {})
    }
  }

  /* ── Solicitudes ────────────────────────────────────────────── */
  const resolverSolicitudVacacion = (id, estado, comentario, resueltoPor) => {
    const ahora = new Date().toISOString()
    setSolicitudesVacaciones((prev) =>
      prev.map((s) => s.id === id ? { ...s, estado, comentarioAdmin: comentario || null, resueltaEn: ahora } : s)
    )
    apiClient.patch(`/solicitudes/vacaciones/${id}`, {
      estado,
      comentario_admin: comentario || null,
      resuelto_por: resueltoPor || null,
    }).catch((err) => setSyncError('Error al guardar: ' + err.message))
  }

  const resolverSolicitudColacion = (id, estado, resueltoPor) => {
    const ahora = new Date().toISOString()
    setSolicitudesColacion((prev) =>
      prev.map((s) => s.id === id ? { ...s, estado, resueltaEn: ahora } : s)
    )
    apiClient.patch(`/solicitudes/colacion/${id}`, {
      estado,
      resuelto_por: resueltoPor || null,
    }).catch((err) => setSyncError('Error al guardar: ' + err.message))
  }

  /* ── Gastos ─────────────────────────────────────────────────── */
  const recargarGastos = useCallback(async () => {
    if (!empresaId) return
    const gasts = await apiClient.get('/gastos').catch(() => [])
    setGastos(Array.isArray(gasts) ? gasts : [])
  }, [empresaId])

  const updateGastoEstado = (id, estado, proyectoId = null) => {
    setGastos((prev) => prev.map((g) => (g.id === id ? { ...g, estado } : g)))
    apiClient.patch(`/gastos/${id}/estado`, { estado, proyecto_id: proyectoId })
      .catch((err) => setSyncError('Error al guardar: ' + err.message))
  }

  /* ── Puntos de trabajo ─────────────────────────────────────── */
  const createPuntoTrabajo = async (data) => {
    const nuevo = await apiClient.post('/puntos-trabajo', data)
    setPuntosTrabajo((prev) => [nuevo, ...prev])
    return nuevo
  }

  const updatePuntoTrabajo = async (id, updates) => {
    const updated = await apiClient.patch(`/puntos-trabajo/${id}`, updates)
    setPuntosTrabajo((prev) => prev.map((p) => (p.id === id ? updated : p)))
    return updated
  }

  const togglePuntoTrabajo = async (id, activo) => {
    setPuntosTrabajo((prev) => prev.map((p) => (p.id === id ? { ...p, activo } : p)))
    try { await apiClient.patch(`/puntos-trabajo/${id}/toggle`, { activo }) } catch (err) { setSyncError('Error al guardar: ' + err.message) }
  }

  /* ── Solicitudes de contraseña ─────────────────────────────── */
  const resolverSolicitudPassword = (id, estado, resueltoPor) => {
    const ahora = new Date().toISOString()
    setSolicitudesPassword((prev) =>
      prev.map((s) => (s.id === id ? { ...s, estado, fechaResolucion: ahora, resueltoPor: resueltoPor || null } : s))
    )
    apiClient.patch(`/solicitudes/password/${id}`, {
      estado,
      resuelto_por: resueltoPor || null,
    }).catch((err) => setSyncError('Error al guardar: ' + err.message))
  }

  return (
    <AppContext.Provider value={{
      loading, syncError, clearSyncError: () => setSyncError(null),
      empresa,
      cotizaciones, addCotizacion, updateCotizacion, updateCotizacionLocal, deleteCotizacion, changeCotizacionStatus, duplicateCotizacion, setCuotaEstado,
      proveedores, addProveedor, updateProveedor, deleteProveedor,
      compras, addCompra, updateCompra, deleteCompra,
      facturasSII, addFacturaSII, updateFacturaSII, deleteFacturaSII, bulkAddFacturasSII, buscarFacturaSII,
      trabajadores, addTrabajador, updateTrabajador, deleteTrabajador,
      movimientos, addMovimiento, toggleConciliado,
      cuentas, addCuenta, updateCuenta, deleteCuenta, pagarCuenta,
      pagosCuentas, addPagoCuenta, updatePagoCuenta,
      documentos, addDocumento, deleteDocumento,
      gastos, updateGastoEstado, recargarGastos,
      solicitudesVacaciones, solicitudesColacion,
      resolverSolicitudVacacion, resolverSolicitudColacion,
      solicitudesPassword, resolverSolicitudPassword,
      puntosTrabajo, createPuntoTrabajo, updatePuntoTrabajo, togglePuntoTrabajo,
      marcaciones, horarios,
      proyectos, setProyectos,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
