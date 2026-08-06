import { useState, useEffect, useMemo, useRef } from 'react'
import { DndContext, useDraggable, useDroppable, MouseSensor, useSensor, useSensors } from '@dnd-kit/core'
import { apiClient } from '../../services/apiClient'
import { useAuth } from '../auth/AuthContext'
import Toast from '../../components/Toast'
import {
  Users2, Filter, X, Mail, Phone, RefreshCw, Pencil, Trash2,
  Tag, Calendar, LayoutGrid, List, Plus, Check,
} from 'lucide-react'

/* ── Metadatos de estado ────────────────────────────────────── */

const ESTADOS = [
  { key: 'nuevo',      label: 'Nuevo',      color: 'bg-blue-100 text-blue-700'     },
  { key: 'contactado', label: 'Contactado', color: 'bg-amber-100 text-amber-700'   },
  { key: 'en_proceso', label: 'En proceso', color: 'bg-violet-100 text-violet-700' },
  { key: 'cerrado',    label: 'Cerrado',    color: 'bg-emerald-100 text-emerald-700' },
  { key: 'perdido',    label: 'Perdido',    color: 'bg-red-100 text-red-700'       },
]

const ESTADO_META = Object.fromEntries(ESTADOS.map((e) => [e.key, e]))

const COLORES_ETIQUETA = {
  red:    { bg: 'bg-red-100',    text: 'text-red-700'    },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700' },
  amber:  { bg: 'bg-amber-100',  text: 'text-amber-700'  },
  green:  { bg: 'bg-green-100',  text: 'text-green-700'  },
  sky:    { bg: 'bg-sky-100',    text: 'text-sky-700'    },
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-700'   },
  violet: { bg: 'bg-violet-100', text: 'text-violet-700' },
  pink:   { bg: 'bg-pink-100',   text: 'text-pink-700'   },
}

const badgeRecordatorio = (fechaStr) => {
  if (!fechaStr) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const fecha = new Date(fechaStr + 'T00:00:00')
  const diff = Math.round((fecha - hoy) / 86400000)
  if (diff < 0)  return { label: 'Vencido',   cls: 'bg-red-100 text-red-700'       }
  if (diff === 0) return { label: 'Hoy',       cls: 'bg-amber-100 text-amber-700'   }
  if (diff <= 7)  return { label: `En ${diff}d`, cls: 'bg-yellow-100 text-yellow-700' }
  return { label: fechaStr, cls: 'bg-slate-100 text-slate-500' }
}

const fuenteMeta = (fuente) =>
  fuente === 'meta_leads' ? { icon: '🎯', label: 'Meta Leads' } : { icon: '✏️', label: 'Manual' }

const formatCampo = (k) =>
  String(k).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const formatFecha = (fecha) => {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleString('es-CL', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Santiago',
  })
}

const ITEMS_POR_PAGINA = 10

/* ── Componentes Kanban ─────────────────────────────────────── */

function EtiquetaChip({ etiqueta }) {
  const col = COLORES_ETIQUETA[etiqueta.color] || { bg: 'bg-slate-100', text: 'text-slate-600' }
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${col.bg} ${col.text}`}>
      {etiqueta.nombre}
    </span>
  )
}

function KanbanCard({ cliente, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: cliente.id })
  const style = transform ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` } : undefined
  const rec = badgeRecordatorio(cliente.fechaRecordatorio)
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`bg-white rounded-lg border border-slate-200 p-3 cursor-pointer select-none shadow-sm hover:shadow-md transition-shadow ${isDragging ? 'opacity-50 ring-2 ring-indigo-400' : ''}`}
    >
      <p className="text-sm font-medium text-slate-800 truncate">{cliente.nombre}</p>
      {cliente.producto && <p className="text-xs text-slate-400 mt-0.5 truncate">{cliente.producto}</p>}
      {(cliente.etiquetas || []).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {cliente.etiquetas.map((et) => <EtiquetaChip key={et.id} etiqueta={et} />)}
        </div>
      )}
      {rec && (
        <div className="mt-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium ${rec.cls}`}>
            <Calendar className="w-3 h-3" /> {rec.label}
          </span>
        </div>
      )}
    </div>
  )
}

function KanbanColumna({ estado, clientes, onCardClick }) {
  const { isOver, setNodeRef } = useDroppable({ id: estado.key })
  return (
    <div className="flex-1 min-w-[200px] max-w-[240px]">
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${estado.color}`}>
          {estado.label}
        </span>
        <span className="text-xs text-slate-400">{clientes.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-[200px] space-y-2 rounded-lg p-2 transition-colors ${isOver ? 'bg-indigo-50/60' : 'bg-slate-50/50'}`}
      >
        {clientes.map((c) => (
          <KanbanCard key={c.id} cliente={c} onClick={() => onCardClick(c)} />
        ))}
      </div>
    </div>
  )
}

/* ── Página principal ───────────────────────────────────────── */

export default function CRMPage() {
  const { user } = useAuth()
  const [clientes, setClientes]   = useState([])
  const [etiquetas, setEtiquetas] = useState([])
  const [loading, setLoading]     = useState(true)
  const [sel, setSel]             = useState(null)
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState(null)
  const [vista, setVista]         = useState('lista')

  // Filtros y paginación
  const [filtroProducto, setFiltroProducto] = useState('todos')
  const [filtroEstado, setFiltroEstado]     = useState('todos')
  const [fechaDesde, setFechaDesde]         = useState('')
  const [fechaHasta, setFechaHasta]         = useState('')
  const [pagina, setPagina]                 = useState(1)

  // Comentarios
  const [comentarios, setComentarios]             = useState([])
  const [nuevoComentario, setNuevoComentario]     = useState('')
  const [loadingComentario, setLoadingComentario] = useState(false)
  const [editandoId, setEditandoId]               = useState(null)
  const [editTexto, setEditTexto]                 = useState('')

  // Panel de etiquetas
  const [etiquetaDropdown, setEtiquetaDropdown] = useState(false)
  const [mostrarFormNueva, setMostrarFormNueva] = useState(false)
  const [nuevaEtiqueta, setNuevaEtiqueta]       = useState({ nombre: '', color: 'blue' })
  const [editandoEtiqueta, setEditandoEtiqueta] = useState(null)
  const dropdownRef = useRef(null)

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const cargar = async () => {
    setLoading(true)
    try {
      const [dataClientes, dataEtiquetas] = await Promise.all([
        apiClient.get('/crm/clientes'),
        apiClient.get('/crm/etiquetas'),
      ])
      setClientes(dataClientes || [])
      setEtiquetas(dataEtiquetas || [])
    } catch (err) {
      showToast('error', `No se pudieron cargar los datos: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  // Cierra dropdown al hacer click fuera
  useEffect(() => {
    if (!etiquetaDropdown) return
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setEtiquetaDropdown(false)
        setMostrarFormNueva(false)
        setEditandoEtiqueta(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [etiquetaDropdown])

  const productosUnicos = useMemo(
    () => [...new Set(clientes.map((c) => c.producto).filter(Boolean))],
    [clientes],
  )

  const filtrados = useMemo(() => clientes.filter((c) => {
    if (filtroProducto !== 'todos' && c.producto !== filtroProducto) return false
    if (filtroEstado !== 'todos' && c.estado !== filtroEstado) return false
    if (fechaDesde && c.createdAt && new Date(c.createdAt) < new Date(fechaDesde)) return false
    if (fechaHasta && c.createdAt) {
      const hasta = new Date(fechaHasta); hasta.setHours(23, 59, 59, 999)
      if (new Date(c.createdAt) > hasta) return false
    }
    return true
  }), [clientes, filtroProducto, filtroEstado, fechaDesde, fechaHasta])

  useEffect(() => { setPagina(1) }, [filtroProducto, filtroEstado, fechaDesde, fechaHasta])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / ITEMS_POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const paginados   = filtrados.slice((paginaActual - 1) * ITEMS_POR_PAGINA, paginaActual * ITEMS_POR_PAGINA)
  const hayFiltros  = filtroProducto !== 'todos' || filtroEstado !== 'todos' || !!fechaDesde || !!fechaHasta

  const limpiarFiltros = () => {
    setFiltroProducto('todos'); setFiltroEstado('todos')
    setFechaDesde(''); setFechaHasta(''); setPagina(1)
  }

  // Helper: actualiza un cliente en lista y panel
  const updateClienteLocal = (id, updates) => {
    setClientes((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)))
    setSel((prev) => (prev?.id === id ? { ...prev, ...updates } : prev))
  }

  /* ── Acciones de estado y recordatorio ─────────────────── */

  const cambiarEstado = async (cliente, estado) => {
    if (estado === cliente.estado) return
    setSaving(true)
    try {
      const actualizado = await apiClient.patch(`/crm/clientes/${cliente.id}`, { estado })
      setClientes((prev) => prev.map((c) => (c.id === cliente.id ? actualizado : c)))
      setSel((prev) => (prev?.id === cliente.id ? actualizado : prev))
      showToast('success', 'Estado actualizado')
    } catch (err) {
      showToast('error', `No se pudo actualizar: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const cambiarRecordatorio = async (cliente, fecha) => {
    try {
      const actualizado = await apiClient.patch(`/crm/clientes/${cliente.id}`, { fecha_recordatorio: fecha || null })
      setClientes((prev) => prev.map((c) => (c.id === cliente.id ? actualizado : c)))
      setSel((prev) => (prev?.id === cliente.id ? actualizado : prev))
    } catch (err) {
      showToast('error', `No se pudo guardar el recordatorio: ${err.message}`)
    }
  }

  /* ── Acciones de etiquetas ──────────────────────────────── */

  const asignarEtiqueta = async (etiquetaId) => {
    if (!sel || (sel.etiquetas || []).some((e) => e.id === etiquetaId)) return
    try {
      await apiClient.post(`/crm/clientes/${sel.id}/etiquetas`, { etiqueta_id: etiquetaId })
      const et = etiquetas.find((e) => e.id === etiquetaId)
      if (et) updateClienteLocal(sel.id, { etiquetas: [...(sel.etiquetas || []), et] })
    } catch (err) {
      showToast('error', `No se pudo asignar la etiqueta: ${err.message}`)
    }
  }

  const quitarEtiqueta = async (etiquetaId) => {
    if (!sel) return
    try {
      await apiClient.delete(`/crm/clientes/${sel.id}/etiquetas/${etiquetaId}`)
      updateClienteLocal(sel.id, { etiquetas: (sel.etiquetas || []).filter((e) => e.id !== etiquetaId) })
    } catch (err) {
      showToast('error', `No se pudo quitar la etiqueta: ${err.message}`)
    }
  }

  const crearYAsignarEtiqueta = async () => {
    if (!nuevaEtiqueta.nombre.trim()) return
    try {
      const creada = await apiClient.post('/crm/etiquetas', {
        nombre: nuevaEtiqueta.nombre.trim(),
        color: nuevaEtiqueta.color,
      })
      setEtiquetas((prev) => [...prev, creada])
      setNuevaEtiqueta({ nombre: '', color: 'blue' })
      setMostrarFormNueva(false)
      if (sel) {
        await apiClient.post(`/crm/clientes/${sel.id}/etiquetas`, { etiqueta_id: creada.id })
        updateClienteLocal(sel.id, { etiquetas: [...(sel.etiquetas || []), creada] })
      }
    } catch (err) {
      showToast('error', `No se pudo crear la etiqueta: ${err.message}`)
    }
  }

  const guardarEdicionEtiqueta = async () => {
    if (!editandoEtiqueta) return
    try {
      const actualizada = await apiClient.patch(`/crm/etiquetas/${editandoEtiqueta.id}`, {
        nombre: editandoEtiqueta.nombre.trim(),
        color: editandoEtiqueta.color,
      })
      setEtiquetas((prev) => prev.map((e) => (e.id === actualizada.id ? actualizada : e)))
      setClientes((prev) => prev.map((c) => ({
        ...c,
        etiquetas: (c.etiquetas || []).map((e) => (e.id === actualizada.id ? actualizada : e)),
      })))
      setSel((prev) => prev ? {
        ...prev,
        etiquetas: (prev.etiquetas || []).map((e) => (e.id === actualizada.id ? actualizada : e)),
      } : prev)
      setEditandoEtiqueta(null)
    } catch (err) {
      showToast('error', `No se pudo editar: ${err.message}`)
    }
  }

  const eliminarEtiqueta = async (etiquetaId) => {
    if (!window.confirm('¿Eliminar esta etiqueta? Se quitará de todos los clientes.')) return
    try {
      await apiClient.delete(`/crm/etiquetas/${etiquetaId}`)
      setEtiquetas((prev) => prev.filter((e) => e.id !== etiquetaId))
      setClientes((prev) => prev.map((c) => ({
        ...c,
        etiquetas: (c.etiquetas || []).filter((e) => e.id !== etiquetaId),
      })))
      setSel((prev) => prev ? {
        ...prev,
        etiquetas: (prev.etiquetas || []).filter((e) => e.id !== etiquetaId),
      } : prev)
      if (editandoEtiqueta?.id === etiquetaId) setEditandoEtiqueta(null)
    } catch (err) {
      showToast('error', `No se pudo eliminar: ${err.message}`)
    }
  }

  /* ── Comentarios ────────────────────────────────────────── */

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

  const editarComentario = async (comentarioId, texto) => {
    try {
      const updated = await apiClient.patch(`/crm/clientes/${sel.id}/comentarios/${comentarioId}`, { comentario: texto })
      setComentarios((prev) => prev.map((c) => (c.id === comentarioId ? updated : c)))
      setEditandoId(null); setEditTexto('')
    } catch (err) {
      showToast('error', `No se pudo editar: ${err.message}`)
    }
  }

  const eliminarComentario = async (comentarioId) => {
    if (!window.confirm('¿Eliminar este comentario?')) return
    try {
      await apiClient.delete(`/crm/clientes/${sel.id}/comentarios/${comentarioId}`)
      setComentarios((prev) => prev.filter((c) => c.id !== comentarioId))
    } catch (err) {
      showToast('error', `No se pudo eliminar: ${err.message}`)
    }
  }

  /* ── DnD ────────────────────────────────────────────────── */

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
  )

  const handleDragEnd = ({ active, over }) => {
    if (!over) return
    const cliente = clientes.find((c) => c.id === active.id)
    if (cliente && over.id !== cliente.estado) cambiarEstado(cliente, over.id)
  }

  const porEstado = useMemo(() => {
    const map = Object.fromEntries(ESTADOS.map((e) => [e.key, []]))
    filtrados.forEach((c) => { if (map[c.estado]) map[c.estado].push(c) })
    return map
  }, [filtrados])

  /* ── Render ─────────────────────────────────────────────── */

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
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setVista('lista')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${vista === 'lista' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <List className="w-4 h-4" /> Lista
            </button>
            <button
              onClick={() => setVista('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${vista === 'kanban' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <LayoutGrid className="w-4 h-4" /> Kanban
            </button>
          </div>
          <button onClick={cargar} className="btn-secondary text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <Filter className="w-4 h-4 text-slate-400 mb-2.5" />
        <div>
          <label className="label-base">Producto</label>
          <select value={filtroProducto} onChange={(e) => setFiltroProducto(e.target.value)} className="input-base text-sm">
            <option value="todos">Todos</option>
            {productosUnicos.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label-base">Estado</label>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="input-base text-sm">
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

      {/* Vista Lista */}
      {vista === 'lista' && (
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
                {hayFiltros ? 'No hay clientes con los filtros seleccionados.' : 'Los leads de Meta y los clientes manuales aparecerán aquí.'}
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
                      <th className="table-th">Etiquetas</th>
                      <th className="table-th">Recordatorio</th>
                      <th className="table-th">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginados.map((c) => {
                      const est = ESTADO_META[c.estado] || { label: c.estado, color: 'bg-slate-100 text-slate-600' }
                      const rec = badgeRecordatorio(c.fechaRecordatorio)
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
                          <td className="table-td">
                            <div className="flex flex-wrap gap-1">
                              {(c.etiquetas || []).map((et) => <EtiquetaChip key={et.id} etiqueta={et} />)}
                            </div>
                          </td>
                          <td className="table-td">
                            {rec && (
                              <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium ${rec.cls}`}>
                                <Calendar className="w-3 h-3" /> {rec.label}
                              </span>
                            )}
                          </td>
                          <td className="table-td text-xs text-slate-400">{formatFecha(c.createdAt)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
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
      )}

      {/* Vista Kanban */}
      {vista === 'kanban' && (
        loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {ESTADOS.map((estado) => (
                <KanbanColumna
                  key={estado.key}
                  estado={estado}
                  clientes={porEstado[estado.key] || []}
                  onCardClick={setSel}
                />
              ))}
            </div>
          </DndContext>
        )
      )}

      {/* Panel lateral */}
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

              {/* Nombre y fuente */}
              <div>
                <p className="text-lg font-bold text-slate-900">{sel.nombre}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {fuenteMeta(sel.fuente).icon} {fuenteMeta(sel.fuente).label}
                  {sel.fuenteDetalle ? ` · ${sel.fuenteDetalle}` : ''}
                </p>
              </div>

              {/* Contacto */}
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

              {/* Mensaje */}
              {sel.mensaje && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Mensaje</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line bg-slate-50 rounded-lg p-3">{sel.mensaje}</p>
                </div>
              )}

              {/* Datos adicionales */}
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

              {/* Etiquetas */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Tag className="w-3 h-3" /> Etiquetas
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(sel.etiquetas || []).length === 0 ? (
                    <span className="text-xs text-slate-400">Sin etiquetas</span>
                  ) : (
                    (sel.etiquetas || []).map((et) => {
                      const col = COLORES_ETIQUETA[et.color] || { bg: 'bg-slate-100', text: 'text-slate-600' }
                      return (
                        <span key={et.id} className={`inline-flex items-center gap-1 rounded-full pl-2 pr-1 py-0.5 text-xs font-medium ${col.bg} ${col.text}`}>
                          {et.nombre}
                          <button onClick={() => quitarEtiqueta(et.id)} className="rounded-full hover:bg-black/10 p-0.5">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      )
                    })
                  )}
                </div>

                {/* Dropdown para agregar/gestionar etiquetas */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => { setEtiquetaDropdown((v) => !v); setMostrarFormNueva(false); setEditandoEtiqueta(null) }}
                    className="btn-secondary text-xs flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar etiqueta
                  </button>

                  {etiquetaDropdown && (
                    <div className="absolute left-0 top-full mt-1 z-10 w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5">
                      {etiquetas.length === 0 && !mostrarFormNueva && (
                        <p className="px-3 py-2 text-xs text-slate-400">No hay etiquetas aún</p>
                      )}
                      {etiquetas.map((et) => {
                        const isAssigned = (sel.etiquetas || []).some((se) => se.id === et.id)
                        const col = COLORES_ETIQUETA[et.color] || { bg: 'bg-slate-100', text: 'text-slate-600' }

                        if (editandoEtiqueta?.id === et.id) {
                          return (
                            <div key={et.id} className="px-3 py-2 space-y-2 border-b border-slate-100">
                              <input
                                value={editandoEtiqueta.nombre}
                                onChange={(e) => setEditandoEtiqueta((prev) => ({ ...prev, nombre: e.target.value }))}
                                className="input-base text-xs w-full"
                                autoFocus
                              />
                              <div className="flex gap-1 flex-wrap">
                                {Object.keys(COLORES_ETIQUETA).map((c) => (
                                  <button
                                    key={c}
                                    onClick={() => setEditandoEtiqueta((prev) => ({ ...prev, color: c }))}
                                    className={`w-5 h-5 rounded-full ${COLORES_ETIQUETA[c].bg} border-2 transition-all ${editandoEtiqueta.color === c ? 'border-slate-600 scale-110' : 'border-transparent'}`}
                                  />
                                ))}
                              </div>
                              <div className="flex gap-1">
                                <button onClick={guardarEdicionEtiqueta} className="btn-primary text-xs py-0.5 px-2">Guardar</button>
                                <button onClick={() => setEditandoEtiqueta(null)} className="btn-secondary text-xs py-0.5 px-2">Cancelar</button>
                              </div>
                            </div>
                          )
                        }

                        return (
                          <div
                            key={et.id}
                            className={`flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 group ${isAssigned ? 'opacity-60' : ''}`}
                          >
                            <button
                              className="flex-1 flex items-center gap-2 text-left disabled:cursor-default"
                              onClick={() => { if (!isAssigned) { asignarEtiqueta(et.id); setEtiquetaDropdown(false) } }}
                              disabled={isAssigned}
                            >
                              {isAssigned && <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${col.bg} ${col.text}`}>
                                {et.nombre}
                              </span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditandoEtiqueta({ ...et }) }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-indigo-600 rounded transition-opacity"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); eliminarEtiqueta(et.id) }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-600 rounded transition-opacity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )
                      })}

                      <div className="border-t border-slate-100 mt-1 pt-1">
                        {mostrarFormNueva ? (
                          <div className="px-3 py-2 space-y-2">
                            <input
                              value={nuevaEtiqueta.nombre}
                              onChange={(e) => setNuevaEtiqueta((prev) => ({ ...prev, nombre: e.target.value }))}
                              placeholder="Nombre de etiqueta"
                              className="input-base text-xs w-full"
                              autoFocus
                            />
                            <div className="flex gap-1 flex-wrap">
                              {Object.keys(COLORES_ETIQUETA).map((c) => (
                                <button
                                  key={c}
                                  onClick={() => setNuevaEtiqueta((prev) => ({ ...prev, color: c }))}
                                  className={`w-5 h-5 rounded-full ${COLORES_ETIQUETA[c].bg} border-2 transition-all ${nuevaEtiqueta.color === c ? 'border-slate-600 scale-110' : 'border-transparent'}`}
                                />
                              ))}
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={crearYAsignarEtiqueta}
                                disabled={!nuevaEtiqueta.nombre.trim()}
                                className="btn-primary text-xs py-0.5 px-2 disabled:opacity-50"
                              >
                                Crear y asignar
                              </button>
                              <button
                                onClick={() => { setMostrarFormNueva(false); setNuevaEtiqueta({ nombre: '', color: 'blue' }) }}
                                className="btn-secondary text-xs py-0.5 px-2"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setMostrarFormNueva(true)}
                            className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded-b-xl"
                          >
                            <Plus className="w-3.5 h-3.5" /> Nueva etiqueta
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Recordatorio */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Próximo contacto
                </p>
                <input
                  type="date"
                  value={sel.fechaRecordatorio || ''}
                  onChange={(e) => cambiarRecordatorio(sel, e.target.value)}
                  className="input-base text-sm"
                />
                {sel.fechaRecordatorio && (() => {
                  const rec = badgeRecordatorio(sel.fechaRecordatorio)
                  return rec ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${rec.cls}`}>
                        <Calendar className="w-3 h-3" /> {rec.label}
                      </span>
                      <button onClick={() => cambiarRecordatorio(sel, '')} className="text-xs text-slate-400 hover:text-red-500">
                        Quitar
                      </button>
                    </div>
                  ) : null
                })()}
              </div>

              {/* Comentarios */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Comentarios</p>
                <div className="space-y-2 mb-3">
                  {comentarios.length === 0 ? (
                    <p className="text-sm text-slate-400">Sin comentarios aún</p>
                  ) : (
                    comentarios.map((cm) => {
                      const esAutor  = cm.usuario_id === user?.id
                      const editando = editandoId === cm.id
                      return (
                        <div key={cm.id} className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-700">{cm.usuario_nombre}</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-xs text-slate-400">{formatFecha(cm.created_at)}</span>
                              {cm.editado_at && <span className="text-xs text-slate-400">(editado)</span>}
                              {esAutor && !editando && (
                                <>
                                  <button onClick={() => { setEditandoId(cm.id); setEditTexto(cm.comentario) }} className="rounded p-0.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-200" title="Editar">
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => eliminarComentario(cm.id)} className="rounded p-0.5 text-slate-400 hover:text-red-600 hover:bg-slate-200" title="Eliminar">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {editando ? (
                            <div className="space-y-2 mt-1">
                              <textarea
                                value={editTexto}
                                onChange={(e) => setEditTexto(e.target.value)}
                                rows={2}
                                className="input-base text-sm resize-y w-full"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button onClick={() => editarComentario(cm.id, editTexto)} disabled={!editTexto.trim()} className="btn-primary text-xs py-1 px-2 disabled:opacity-50">Guardar</button>
                                <button onClick={() => { setEditandoId(null); setEditTexto('') }} className="btn-secondary text-xs py-1 px-2">Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-600 whitespace-pre-line">{cm.comentario}</p>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
                <textarea
                  value={nuevoComentario}
                  onChange={(e) => setNuevoComentario(e.target.value)}
                  rows={2}
                  placeholder="Escribe un comentario..."
                  className="input-base text-sm resize-y"
                />
                <button onClick={agregarComentario} disabled={!nuevoComentario.trim() || loadingComentario} className="btn-primary text-sm mt-2 disabled:opacity-50">
                  {loadingComentario && <RefreshCw className="w-4 h-4 animate-spin" />} Agregar
                </button>
              </div>

              {/* Estado */}
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
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${active ? `${e.color} ring-2 ring-offset-1 ring-slate-300` : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
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
