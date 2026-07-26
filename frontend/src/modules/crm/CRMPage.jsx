import { useState, useEffect, useMemo } from 'react'
import { apiClient } from '../../services/apiClient'
import Toast from '../../components/Toast'
import {
  Users2, Filter, X, Mail, Phone, RefreshCw, Pencil,
} from 'lucide-react'

/* ── Metadatos de estado ────────────────────────────────────── */

const ESTADOS = [
  { key: 'nuevo',      label: 'Nuevo',      color: 'bg-blue-100 text-blue-700' },
  { key: 'contactado', label: 'Contactado', color: 'bg-amber-100 text-amber-700' },
  { key: 'en_proceso', label: 'En proceso', color: 'bg-violet-100 text-violet-700' },
  { key: 'cerrado',    label: 'Cerrado',    color: 'bg-emerald-100 text-emerald-700' },
  { key: 'perdido',    label: 'Perdido',    color: 'bg-red-100 text-red-700' },
]

const ESTADO_META = Object.fromEntries(ESTADOS.map((e) => [e.key, e]))

const fuenteMeta = (fuente) =>
  fuente === 'meta_leads'
    ? { icon: '🎯', label: 'Meta Leads' }
    : { icon: '✏️', label: 'Manual' }

/* "mi_campo_custom" → "Mi Campo Custom" */
const formatCampo = (k) =>
  String(k)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

/* Fecha legible en hora de Chile: "26 jul 2026, 11:39" */
const formatFecha = (fecha) => {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleString('es-CL', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Santiago'
  })
}

/* ── Página principal ───────────────────────────────────────── */

const ITEMS_POR_PAGINA = 10

export default function CRMPage() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading]   = useState(true)
  const [sel, setSel]           = useState(null)   // cliente seleccionado (panel lateral)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState(null)

  // Filtros y paginación
  const [filtroProducto, setFiltroProducto] = useState('todos')
  const [filtroEstado, setFiltroEstado]     = useState('todos')
  const [fechaDesde, setFechaDesde]         = useState('')
  const [fechaHasta, setFechaHasta]         = useState('')
  const [pagina, setPagina]                 = useState(1)

  // Comentarios del cliente seleccionado
  const [comentarios, setComentarios]             = useState([])
  const [nuevoComentario, setNuevoComentario]     = useState('')
  const [loadingComentario, setLoadingComentario] = useState(false)

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const cargar = async () => {
    setLoading(true)
    try {
      const data = await apiClient.get('/crm/clientes')
      setClientes(data || [])
    } catch (err) {
      showToast('error', `No se pudieron cargar los clientes: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const productosUnicos = useMemo(
    () => [...new Set(clientes.map((c) => c.producto).filter(Boolean))],
    [clientes],
  )

  const filtrados = useMemo(() => {
    return clientes.filter((c) => {
      if (filtroProducto !== 'todos' && c.producto !== filtroProducto) return false
      if (filtroEstado !== 'todos' && c.estado !== filtroEstado) return false
      if (fechaDesde && c.createdAt && new Date(c.createdAt) < new Date(fechaDesde)) return false
      if (fechaHasta && c.createdAt) {
        const hasta = new Date(fechaHasta)
        hasta.setHours(23, 59, 59, 999)   // incluye todo el día "hasta"
        if (new Date(c.createdAt) > hasta) return false
      }
      return true
    })
  }, [clientes, filtroProducto, filtroEstado, fechaDesde, fechaHasta])

  // Al cambiar cualquier filtro, volver a la página 1
  useEffect(() => { setPagina(1) }, [filtroProducto, filtroEstado, fechaDesde, fechaHasta])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / ITEMS_POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const paginados = filtrados.slice((paginaActual - 1) * ITEMS_POR_PAGINA, paginaActual * ITEMS_POR_PAGINA)

  const hayFiltros = filtroProducto !== 'todos' || filtroEstado !== 'todos' || !!fechaDesde || !!fechaHasta

  const limpiarFiltros = () => {
    setFiltroProducto('todos')
    setFiltroEstado('todos')
    setFechaDesde('')
    setFechaHasta('')
    setPagina(1)
  }

  const cambiarEstado = async (cliente, estado) => {
    if (estado === cliente.estado) return
    setSaving(true)
    try {
      const actualizado = await apiClient.patch(`/crm/clientes/${cliente.id}`, { estado })
      setClientes((prev) => prev.map((c) => (c.id === cliente.id ? actualizado : c)))
      setSel((prev) => (prev && prev.id === cliente.id ? actualizado : prev))
      showToast('success', 'Estado actualizado')
    } catch (err) {
      showToast('error', `No se pudo actualizar: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Carga los comentarios del cliente seleccionado
  useEffect(() => {
    if (!sel) { setComentarios([]); setNuevoComentario(''); return }
    let cancel = false
    apiClient.get(`/crm/clientes/${sel.id}/comentarios`)
      .then((data) => { if (!cancel) setComentarios(data || []) })
      .catch(() => { if (!cancel) setComentarios([]) })
    return () => { cancel = true }
  }, [sel?.id])

  const agregarComentario = async () => {
    if (!nuevoComentario.trim() || !sel) return
    setLoadingComentario(true)
    try {
      await apiClient.post(`/crm/clientes/${sel.id}/comentarios`, { comentario: nuevoComentario.trim() })
      setNuevoComentario('')
      const data = await apiClient.get(`/crm/clientes/${sel.id}/comentarios`)
      setComentarios(data || [])
    } catch (err) {
      showToast('error', `No se pudo agregar el comentario: ${err.message}`)
    } finally {
      setLoadingComentario(false)
    }
  }

  return (
    <div className="space-y-5 w-full">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users2 className="w-5 h-5 text-indigo-500" /> CRM
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">{clientes.length} clientes en total</p>
        </div>
        <button onClick={cargar} className="btn-secondary text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <Filter className="w-4 h-4 text-slate-400 mb-2.5" />
        <div>
          <label className="label-base">Producto</label>
          <select
            value={filtroProducto}
            onChange={(e) => setFiltroProducto(e.target.value)}
            className="input-base text-sm"
          >
            <option value="todos">Todos</option>
            {productosUnicos.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label-base">Estado</label>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="input-base text-sm"
          >
            <option value="todos">Todos</option>
            {ESTADOS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label-base">Desde</label>
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="input-base text-sm" />
        </div>
        <div>
          <label className="label-base">Hasta</label>
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="input-base text-sm" />
        </div>
        {hayFiltros && (
          <button onClick={limpiarFiltros} className="btn-secondary text-sm mb-0.5">
            <X className="w-4 h-4" /> Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users2 className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">Sin clientes</p>
            <p className="text-xs text-slate-400 mt-1">
              {hayFiltros
                ? 'No hay clientes con los filtros seleccionados.'
                : 'Los leads de Meta y los clientes manuales aparecerán aquí.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="table-th">Nombre</th>
                    <th className="table-th">Email</th>
                    <th className="table-th">Teléfono</th>
                    <th className="table-th">Producto</th>
                    <th className="table-th">Estado</th>
                    <th className="table-th">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginados.map((c) => {
                    const est = ESTADO_META[c.estado] || { label: c.estado, color: 'bg-slate-100 text-slate-600' }
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSel(c)}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${sel?.id === c.id ? 'bg-indigo-50/50' : ''}`}
                      >
                        <td className="table-td text-sm font-medium text-slate-800">{c.nombre}</td>
                        <td className="table-td text-xs text-slate-500">{c.email || '—'}</td>
                        <td className="table-td text-xs text-slate-500">{c.telefono || '—'}</td>
                        <td className="table-td text-xs text-slate-600">{c.producto || '—'}</td>
                        <td className="table-td">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${est.color}`}>
                            {est.label}
                          </span>
                        </td>
                        <td className="table-td text-xs text-slate-400">{formatFecha(c.createdAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={paginaActual <= 1}
                className="btn-secondary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <span className="text-xs text-slate-500">
                Página {paginaActual} de {totalPaginas} · {filtrados.length} cliente{filtrados.length === 1 ? '' : 's'}
              </span>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaActual >= totalPaginas}
                className="btn-secondary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente →
              </button>
            </div>
          </>
        )}
      </div>

      {/* Panel lateral de detalle */}
      {sel && (
        <>
          <div className="fixed inset-0 bg-slate-900/30 z-40" onClick={() => setSel(null)} />
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Detalle del cliente</h3>
              <button onClick={() => setSel(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              <div>
                <p className="text-lg font-bold text-slate-900">{sel.nombre}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {fuenteMeta(sel.fuente).icon} {fuenteMeta(sel.fuente).label}
                  {sel.fuenteDetalle ? ` · ${sel.fuenteDetalle}` : ''}
                </p>
              </div>

              <div className="space-y-2">
                {sel.email && (
                  <a href={`mailto:${sel.email}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-indigo-600">
                    <Mail className="w-4 h-4 text-slate-400" /> {sel.email}
                  </a>
                )}
                {sel.telefono && (
                  <a href={`tel:${sel.telefono}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-indigo-600">
                    <Phone className="w-4 h-4 text-slate-400" /> {sel.telefono}
                  </a>
                )}
              </div>

              {sel.mensaje && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Mensaje</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line bg-slate-50 rounded-lg p-3">{sel.mensaje}</p>
                </div>
              )}

              {sel.datosAdicionales && Object.keys(sel.datosAdicionales).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Datos adicionales</p>
                  <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                    {Object.entries(sel.datosAdicionales).map(([campo, valor]) => (
                      <div key={campo} className="text-sm">
                        <span className="font-medium text-slate-600">{formatCampo(campo)}:</span>{' '}
                        <span className="text-slate-700">{String(valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comentarios */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Comentarios</p>
                <div className="space-y-2 mb-3">
                  {comentarios.length === 0 ? (
                    <p className="text-sm text-slate-400">Sin comentarios aún</p>
                  ) : (
                    comentarios.map((cm) => (
                      <div key={cm.id} className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-medium text-slate-700">{cm.usuario_nombre}</span>
                          <span className="text-xs text-slate-400 flex-shrink-0">{formatFecha(cm.created_at)}</span>
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-line">{cm.comentario}</p>
                      </div>
                    ))
                  )}
                </div>
                <textarea
                  value={nuevoComentario}
                  onChange={(e) => setNuevoComentario(e.target.value)}
                  rows={2}
                  placeholder="Escribe un comentario..."
                  className="input-base text-sm resize-y"
                />
                <button
                  onClick={agregarComentario}
                  disabled={!nuevoComentario.trim() || loadingComentario}
                  className="btn-primary text-sm mt-2 disabled:opacity-50"
                >
                  {loadingComentario && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Agregar
                </button>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Pencil className="w-3 h-3" /> Estado
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ESTADOS.map((e) => {
                    const active = sel.estado === e.key
                    return (
                      <button
                        key={e.key}
                        onClick={() => cambiarEstado(sel, e.key)}
                        disabled={saving}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                          active ? `${e.color} ring-2 ring-offset-1 ring-slate-300` : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {e.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="text-xs text-slate-400 pt-2 border-t border-slate-100 space-y-1">
                <p>Creado: {formatFecha(sel.createdAt)}</p>
                {sel.updatedAt && <p>Actualizado: {formatFecha(sel.updatedAt)}</p>}
              </div>
            </div>
          </aside>
        </>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
