import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../../services/supabase'
import { formatCLP, formatDate, STATUS_LABELS } from '../../utils/formatters'
import { apiClient } from '../../services/apiClient'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Toast from '../../components/Toast'
import Modal, { ConfirmModal } from '../../components/Modal'
import {
  Plus, Search, Eye, Pencil, Trash2, FileText,
  Download, Copy, User, Calendar,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Package, X,
} from 'lucide-react'

const FECHA_FILTROS = [
  { id: 'todos', label: 'Todas' },
  { id: 'hoy',   label: 'Hoy' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes',   label: 'Este mes' },
]

function buildPublicUrl(c) {
  const lean = {
    n: c.numero, c: c.cliente, m: c.comuna || '', r: c.direccion || '',
    e: c.email || '', t: c.telefono || '', f: c.fecha, s: c.estado,
    o: c.observaciones || '',
    i: (c.items || []).map((it) => ({
      p: it.producto,
      b: it.incluirDescripcion ? (it.descripcion || '') : '',
      q: it.cantidad, u: it.medicion || 'Unidad', v: it.valorUnitario,
    })),
    nt: c.neto || 0, iv: c.iva || 0, tt: c.total || 0,
  }
  const base = import.meta.env.VITE_PUBLIC_URL || window.location.origin
  return `${base}/ver?d=${btoa(unescape(encodeURIComponent(JSON.stringify(lean))))}`
}

const ESTADOS = ['todos', 'borrador', 'enviada', 'visita', 'aprobada', 'en_ejecucion', 'ejecutada', 'cerrada', 'rechazada', 'perdida']

const PRODUCTO_CHIP = {
  'CAUCHO CONTINUO':  { cls: 'bg-blue-100 text-blue-700',     label: 'Caucho' },
  'TOLDOS VELA':      { cls: 'bg-emerald-100 text-emerald-700', label: 'Toldos' },
  'PASTO SINTETICO':  { cls: 'bg-orange-100 text-orange-700',  label: 'Pasto'  },
}

function abreviarProducto(nombre) {
  return PRODUCTO_CHIP[nombre]?.label ?? nombre.split(' ')[0]
}

function ProductosChips({ productos }) {
  if (!productos?.length) return <span className="text-slate-300 text-xs">—</span>
  const visible = productos.slice(0, 2)
  const extra   = productos.length - 2
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((p) => (
        <span
          key={p}
          className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium leading-tight ${
            PRODUCTO_CHIP[p]?.cls ?? 'bg-slate-100 text-slate-600'
          }`}
        >
          {abreviarProducto(p)}
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium leading-tight bg-slate-100 text-slate-500">
          +{extra}
        </span>
      )}
    </div>
  )
}

export default function CotizacionesPage() {
  const { cotizaciones, deleteCotizacion, updateCotizacion, duplicateCotizacion } = useApp()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroVendedor, setFiltroVendedor] = useState('todos')
  const [filtroFecha, setFiltroFecha] = useState('todos')
  const [filtroProductos, setFiltroProductos] = useState([])
  const [productosDisponibles, setProductosDisponibles] = useState([])
  const [itemsPorPagina, setItemsPorPagina] = useState(25)
  const [paginaActual,   setPaginaActual]   = useState(1)
  const [deleteId, setDeleteId] = useState(null)
  const [duplicateId, setDuplicateId] = useState(null)
  const [toast, setToast] = useState(null)
  const [movimientosCot, setMovimientosCot] = useState([])
  const [condicionesPorCot, setCondicionesPorCot] = useState({})

  const cargarProductos = useCallback(async () => {
    if (!supabase || !user?.empresa_id) return
    const { data } = await supabase
      .from('productos').select('nombre').eq('empresa_id', user.empresa_id).eq('activo', true).order('nombre')
    if (data) setProductosDisponibles(data.map((p) => p.nombre))
  }, [user?.empresa_id])

  useEffect(() => { cargarProductos() }, [cargarProductos])

  useEffect(() => {
    if (!user?.empresa_id || !supabase) return
    supabase
      .from('movimientos')
      .select('id, gasto_id, monto, fecha, glosa, tipo')
      .eq('empresa_id', user.empresa_id)
      .then(({ data }) => { if (data) setMovimientosCot(data) })
  }, [user?.empresa_id])

  useEffect(() => {
    const activas = cotizaciones.filter(c =>
      c.estado === 'aprobada' || c.estado === 'en_ejecucion'
    )
    if (activas.length === 0) return
    supabase
      .from('cotizaciones')
      .select('id, condiciones_pago, pagos_comprobantes')
      .in('id', activas.map(c => c.id))
      .then(({ data, error }) => {
        console.log('[condicionesPorCot] error:', error)
        console.log('[condicionesPorCot] data:', JSON.stringify(data?.slice(0, 2)))
        if (!data) return
        const map = {}
        data.forEach(row => { map[row.id] = row })
        console.log('[condicionesPorCot] map keys:', Object.keys(map).length)
        const primera = data[0]
        if (primera) {
          console.log('[condicionesPorCot] condiciones_pago[0]:', JSON.stringify(primera.condiciones_pago))
          console.log('[condicionesPorCot] pagos_comprobantes[0]:', JSON.stringify(primera.pagos_comprobantes))
        }
        setCondicionesPorCot(map)
      })
  }, [cotizaciones])

  // Resetear a página 1 cuando cambia cualquier filtro o el tamaño de página
  useEffect(() => { setPaginaActual(1) }, [search, filtroEstado, filtroVendedor, filtroFecha, filtroProductos, itemsPorPagina])

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4500)
  }

  const vendedores = useMemo(() => {
    const map = new Map()
    cotizaciones.forEach((c) => {
      if (c.usuarioId && !map.has(c.usuarioId)) {
        map.set(c.usuarioId, c.creadoPor || c.usuarioId)
      }
    })
    return [...map.entries()]
      .map(([uid, label]) => ({ uid, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [cotizaciones])

  const filtered = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10)
    const now = new Date()

    return cotizaciones.filter((c) => {
      const matchSearch =
        c.cliente.toLowerCase().includes(search.toLowerCase()) ||
        c.numero.toLowerCase().includes(search.toLowerCase())

      const matchEstado = filtroEstado === 'todos' || c.estado === filtroEstado

      const matchVendedor = filtroVendedor === 'todos' || c.usuarioId === filtroVendedor

      let matchFecha = true
      if (filtroFecha === 'hoy') {
        matchFecha = c.fecha === hoy
      } else if (filtroFecha === 'semana') {
        const dow = now.getDay()
        const diff = dow === 0 ? -6 : 1 - dow
        const lunes = new Date(now)
        lunes.setDate(now.getDate() + diff)
        const lunesStr = lunes.toISOString().slice(0, 10)
        matchFecha = c.fecha >= lunesStr && c.fecha <= hoy
      } else if (filtroFecha === 'mes') {
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        matchFecha = c.fecha?.startsWith(ym)
      }

      const matchProductos = filtroProductos.length === 0 ||
        filtroProductos.some((p) => (c.productos_asociados || []).includes(p))

      return matchSearch && matchEstado && matchVendedor && matchFecha && matchProductos
    })
  }, [cotizaciones, search, filtroEstado, filtroVendedor, filtroFecha, filtroProductos])

  const esActiva = (c) => c.estado === 'aprobada' || c.estado === 'en_ejecucion' || c.estado === 'ejecutada' || c.estado === 'visita'

  const totalAprobadas = useMemo(() => filtered.filter(esActiva).length, [filtered])
  const totalOtras     = useMemo(() => filtered.filter(c => !esActiva(c)).length, [filtered])

  const sortedFiltered = useMemo(() => {
    const aprobadas = filtered
      .filter(esActiva)
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
    const otras = filtered
      .filter(c => !esActiva(c))
      .sort((a, b) => (b.fechaCreacion || b.fecha || '').localeCompare(a.fechaCreacion || a.fecha || ''))
    return [...aprobadas, ...otras]
  }, [filtered])

  const totalPaginas = Math.ceil(sortedFiltered.length / itemsPorPagina)
  const cotizacionesPaginadas = sortedFiltered.slice(
    (paginaActual - 1) * itemsPorPagina,
    paginaActual * itemsPorPagina,
  )
  const pageAprobadas = cotizacionesPaginadas.filter(esActiva)
  const pageOtras     = cotizacionesPaginadas.filter(c => !esActiva(c))
  const inicioPag = filtered.length === 0 ? 0 : (paginaActual - 1) * itemsPorPagina + 1
  const finPag    = Math.min(paginaActual * itemsPorPagina, filtered.length)

  const paginasVisibles = (() => {
    if (totalPaginas <= 5) return Array.from({ length: totalPaginas }, (_, i) => i + 1)
    let start = Math.max(1, paginaActual - 2)
    let end   = Math.min(totalPaginas, start + 4)
    if (end - start < 4) start = Math.max(1, end - 4)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  })()

  const PgBtn = ({ onClick, disabled, active, children }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-8 min-w-[2rem] px-2 rounded-lg text-xs font-medium transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed
        ${active
          ? 'bg-indigo-600 text-white'
          : 'text-slate-600 hover:bg-slate-100 disabled:hover:bg-transparent'
        }`}
    >
      {children}
    </button>
  )

  const handlePDF = (c) => navigate(`/cotizaciones/${c.id}`)

  const handleDuplicate = () => {
    if (!duplicateId) return
    const nueva = duplicateCotizacion(duplicateId)
    setDuplicateId(null)
    if (nueva) navigate(`/cotizaciones/${nueva.id}/editar`)
  }

  const toDeleteItem = cotizaciones.find((c) => c.id === deleteId)

  const renderFila = (c, trClass) => (
    <tr key={c.id} className={`transition-colors ${trClass} ${['cerrada', 'perdida'].includes(c.estado) ? 'opacity-60' : ''}`}>
      <td className="table-td font-mono text-xs text-slate-500">{c.numero}</td>
      <td className="table-td">
        <div className="font-medium text-slate-800">{c.cliente}</div>
        <div className="text-xs text-slate-400">
          {c.glosa
            ? (c.glosa.length > 60 ? c.glosa.substring(0, 60) + '...' : c.glosa)
            : c.email}
        </div>
      </td>
      <td className="table-td hidden lg:table-cell max-w-[180px]">
        <ProductosChips productos={c.productos_asociados} />
      </td>
      <td className="table-td hidden md:table-cell text-slate-500">{formatDate(c.fecha)}</td>
      <td className="table-td text-right font-semibold text-slate-900">
        {formatCLP(c.total)}
        {esActiva(c) && (() => {
          const totalPagado = (c.pagosComprobantes || []).reduce((s, p) => {
            const mov = movimientosCot.find((m) => m.id === p.movimiento_id)
            return s + (mov ? Number(mov.monto) : 0)
          }, 0)
          const pct = c.total > 0 ? Math.min(100, (totalPagado / c.total) * 100) : 0
          const pctR = Math.round(pct)
          const barColor = pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-slate-200'
          const txtColor = pct >= 100 ? 'text-emerald-600' : pct > 0 ? 'text-amber-500' : 'text-slate-400'
          return (
            <div className="mt-1">
              <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pctR}%` }} />
              </div>
              <p className={`text-[10px] font-semibold mt-0.5 ${txtColor}`}>
                {pct >= 100 ? '✓ 100%' : `${pctR}%`}
              </p>
            </div>
          )
        })()}
      </td>
      <td className="table-td">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge status={c.estado} />
          {(() => {
            if (esActiva(c)) console.log('[badge]', c.id, 'condicionesPorCot entry:', condicionesPorCot[c.id])
            const cotData = condicionesPorCot[c.id]
            const condiciones = cotData?.condiciones_pago || []
            const pagosComp = cotData?.pagos_comprobantes || []
            const necesitaAtencion = esActiva(c) && condiciones.some(cp => {
              const sinComprobante = !pagosComp.some(p => p.condicion_id === cp.id)
              const sinFactura = !cp.factura_sii_id
              return sinComprobante || sinFactura
            })
            return necesitaAtencion && (
            <span
              title="Tiene condiciones sin comprobante de pago o sin factura de venta"
              className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-white text-[9px] font-black cursor-help"
            >
              ?
            </span>
          )
          })()}
        </div>
      </td>
      <td className="table-td">
        <div className="flex items-center justify-end gap-1">
          <button title="Ver detalle" onClick={() => navigate(`/cotizaciones/${c.id}`)} className="btn-ghost p-1.5">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button title="Duplicar" onClick={() => setDuplicateId(c.id)} className="btn-ghost p-1.5 text-indigo-500 hidden sm:flex">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button title="Descargar PDF" onClick={() => handlePDF(c)} className="btn-ghost p-1.5 text-slate-500 hidden sm:flex">
            <Download className="w-3.5 h-3.5" />
          </button>
          {(user?.rol === 'admin' || c.usuarioId === user?.id) && (
            <button title="Eliminar" onClick={() => setDeleteId(c.id)} className="btn-ghost p-1.5 text-red-400 hover:text-red-600">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Cotizaciones</h2>
          <p className="text-sm text-slate-500 mt-0.5">{cotizaciones.length} cotizaciones en total</p>
        </div>
        <button onClick={() => navigate('/cotizaciones/nueva')} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nueva </span>Cotización
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        {/* Fila 1: búsqueda + vendedor */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente o número..."
              className="input-base pl-9"
            />
          </div>
          {vendedores.length > 0 && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={filtroVendedor}
                onChange={(e) => setFiltroVendedor(e.target.value)}
                className="input-base pl-9 pr-8 min-w-[180px]"
              >
                <option value="todos">Todos los vendedores</option>
                {vendedores.map((v) => (
                  <option key={v.uid} value={v.uid}>{v.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Fila 2: estado + fecha */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex gap-1.5 flex-wrap">
            {ESTADOS.map((e) => (
              <button
                key={e}
                onClick={() => setFiltroEstado(e)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filtroEstado === e
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {e === 'todos' ? 'Todos' : (STATUS_LABELS[e] ?? e)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 sm:ml-auto flex-wrap">
            <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            {FECHA_FILTROS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltroFecha(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filtroFecha === f.id
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fila 3: filtro por producto */}
        {productosDisponibles.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-500">Filtrar por producto:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {productosDisponibles.map((nombre) => {
                const activo = filtroProductos.includes(nombre)
                return (
                  <button
                    key={nombre}
                    onClick={() => setFiltroProductos((p) =>
                      activo ? p.filter((n) => n !== nombre) : [...p, nombre]
                    )}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      activo
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {nombre}
                    {activo && <X className="w-3 h-3" />}
                  </button>
                )
              })}
              {filtroProductos.length > 0 && (
                <button
                  onClick={() => setFiltroProductos([])}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors underline ml-1"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sin cotizaciones"
            description="No hay cotizaciones que coincidan con tu búsqueda."
            action={
              <button onClick={() => navigate('/cotizaciones/nueva')} className="btn-primary">
                <Plus className="w-4 h-4" /> Nueva Cotización
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="table-th">Número</th>
                  <th className="table-th">Cliente</th>
                  <th className="table-th hidden lg:table-cell">Productos</th>
                  <th className="table-th hidden md:table-cell">Fecha</th>
                  <th className="table-th text-right">Total</th>
                  <th className="table-th">Estado</th>
                  <th className="table-th text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* ── Sección APROBADAS ─────────────────────────────── */}
                {pageAprobadas.length > 0 && (
                  <>
                    <tr className="bg-green-50 border-b border-green-100">
                      <td colSpan={9} className="px-4 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-green-800 uppercase tracking-wide">Activas</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-200 text-green-800">
                            {totalAprobadas} activa{totalAprobadas !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {pageAprobadas.map(c => renderFila(c, 'bg-green-50/60 hover:bg-green-100/50 border-l-4 border-green-500'))}
                  </>
                )}

                {/* ── Sección OTRAS ─────────────────────────────────── */}
                {pageOtras.length > 0 && (
                  <>
                    {pageAprobadas.length > 0 && (
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <td colSpan={9} className="px-4 py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Otras cotizaciones</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-600">
                              {totalOtras} cotización{totalOtras !== 1 ? 'es' : ''}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {pageOtras.map(c => renderFila(c, 'hover:bg-slate-50/80'))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 flex-wrap gap-3">
            <p className="text-xs text-slate-500">
              Mostrando <span className="font-medium text-slate-700">{inicioPag}–{finPag}</span> de{' '}
              <span className="font-medium text-slate-700">{filtered.length}</span> cotizaciones
            </p>

            {totalPaginas > 1 && (
              <div className="flex items-center gap-0.5">
                <PgBtn onClick={() => setPaginaActual(1)} disabled={paginaActual === 1}>
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </PgBtn>
                <PgBtn onClick={() => setPaginaActual((p) => p - 1)} disabled={paginaActual === 1}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </PgBtn>
                {paginasVisibles.map((p) => (
                  <PgBtn key={p} onClick={() => setPaginaActual(p)} active={p === paginaActual}>
                    {p}
                  </PgBtn>
                ))}
                <PgBtn onClick={() => setPaginaActual((p) => p + 1)} disabled={paginaActual === totalPaginas}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </PgBtn>
                <PgBtn onClick={() => setPaginaActual(totalPaginas)} disabled={paginaActual === totalPaginas}>
                  <ChevronsRight className="w-3.5 h-3.5" />
                </PgBtn>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Filas:</span>
              <select
                value={itemsPorPagina}
                onChange={(e) => setItemsPorPagina(Number(e.target.value))}
                className="input-base py-1 text-xs w-16"
              >
                {[10, 25, 50, 100].map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteCotizacion(deleteId)}
        title={toDeleteItem?.estado === 'aprobada' ? 'Eliminar cotización aprobada' : 'Eliminar cotización'}
        message={`¿Estás seguro que deseas eliminar la cotización ${toDeleteItem?.numero}? Esta acción no se puede deshacer.`}
        warningNote={
          toDeleteItem?.estado === 'aprobada'
            ? 'Esta cotización está aprobada. Al eliminarla se borrarán también los movimientos de ingresos asociados en Finanzas, lo que afectará el flujo de caja de la empresa.'
            : undefined
        }
      />

      <ConfirmModal
        open={!!duplicateId}
        onClose={() => setDuplicateId(null)}
        onConfirm={handleDuplicate}
        title="Duplicar cotización"
        message={`¿Deseas duplicar la cotización ${cotizaciones.find(c => c.id === duplicateId)?.numero}? Se creará una copia en estado borrador con fecha de hoy.`}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
