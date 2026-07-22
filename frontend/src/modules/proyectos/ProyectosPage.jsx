import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, AlertTriangle, FolderOpen, Eye,
} from 'lucide-react'
import { apiClient } from '../../services/apiClient'
import { formatCLP, formatDate } from '../../utils/formatters'
import GanttView from '../../components/planificacion/GanttView'

const COLORES_PROYECTO = [
  '#E63946', '#2196F3', '#4CAF50', '#FF9800',
  '#9C27B0', '#00BCD4', '#FF5722', '#8BC34A',
]

const ESTADO_CONFIG = {
  planificacion: { label: 'Planificación', cls: 'bg-slate-100 text-slate-600'     },
  ejecucion:     { label: 'Ejecución',     cls: 'bg-emerald-100 text-emerald-700' },
  cierre:        { label: 'Cierre',        cls: 'bg-blue-100 text-blue-700'       },
  pausado:       { label: 'Pausado',       cls: 'bg-yellow-100 text-yellow-700'   },
  cancelado:     { label: 'Cancelado',     cls: 'bg-red-100 text-red-700'         },
}

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, cls: 'bg-slate-100 text-slate-600' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function ProgressBar({ value }) {
  const pct = Math.min(100, Math.max(0, value ?? 0))
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-indigo-500' : 'bg-amber-500'
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function ProyectosPage() {
  const navigate = useNavigate()
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroResponsable, setFiltroResponsable] = useState('todos')
  const [ganttExpandido, setGanttExpandido] = useState(true)
  const [datosPlanificacion, setDatosPlanificacion] = useState({ proyectos: [], tareas: [] })
  const [mostrarCerrados, setMostrarCerrados] = useState(false)

  useEffect(() => {
    apiClient.get('/proyectos')
      .then((data) => setProyectos(data || []))
      .catch(() => setProyectos([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    apiClient.get('/proyectos/planificacion')
      .then(({ proyectos: ps, tareas: ts }) =>
        setDatosPlanificacion({ proyectos: ps || [], tareas: ts || [] })
      )
      .catch(() => {})
  }, [])

  const responsables = useMemo(() => {
    const map = {}
    proyectos.forEach((p) => {
      if (p.responsableId && p.responsableNombre) map[p.responsableId] = p.responsableNombre
    })
    return Object.entries(map).map(([id, nombre]) => ({ id, nombre }))
  }, [proyectos])

  const filtrados = useMemo(() => {
    const q = search.toLowerCase()
    return proyectos.filter((p) => {
      if (q && !p.nombre?.toLowerCase().includes(q) && !p.cliente?.toLowerCase().includes(q)) return false
      if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false
      if (filtroEstado !== 'cancelado' && p.estado === 'cancelado') return false
      if (!mostrarCerrados && p.estado === 'cerrado') return false
      if (filtroResponsable !== 'todos' && p.responsableId !== filtroResponsable) return false
      return true
    })
  }, [proyectos, search, filtroEstado, filtroResponsable, mostrarCerrados])

  const stats = useMemo(() => {
    const total         = proyectos.length
    const activos       = proyectos.filter((p) => p.estado === 'ejecucion').length
    const avanceProm    = total > 0
      ? Math.round(proyectos.reduce((s, p) => s + (p.porcentajeAvance ?? 0), 0) / total)
      : 0
    const totalPorCobrar = proyectos.reduce((s, p) => s + (p.financiero?.porCobrar ?? 0), 0)
    const totalPorPagar  = proyectos.reduce((s, p) => s + (p.financiero?.porPagar  ?? 0), 0)
    return { total, activos, avanceProm, totalPorCobrar, totalPorPagar }
  }, [proyectos])

  const totalesFiltrados = useMemo(() => ({
    cobrado:   filtrados.reduce((s, p) => s + (p.financiero?.cobrado   ?? 0), 0),
    porCobrar: filtrados.reduce((s, p) => s + (p.financiero?.porCobrar ?? 0), 0),
    iva:       filtrados.reduce((s, p) => s + (p.financiero?.iva       ?? 0), 0),
    pagado:    filtrados.reduce((s, p) => s + (p.financiero?.pagado    ?? 0), 0),
    porPagar:  filtrados.reduce((s, p) => s + (p.financiero?.porPagar  ?? 0), 0),
    gastos:    filtrados.reduce((s, p) => s + (p.financiero?.gastos    ?? 0), 0),
  }), [filtrados])

  const colorMapGantt = useMemo(() => {
    const m = {}
    datosPlanificacion.proyectos.forEach((p, i) => {
      m[p.id] = COLORES_PROYECTO[i % COLORES_PROYECTO.length]
    })
    return m
  }, [datosPlanificacion.proyectos])

  const FILTROS_ESTADO = [
    { key: 'todos',         label: 'Todos'         },
    { key: 'planificacion', label: 'Planificación' },
    { key: 'ejecucion',     label: 'Ejecución'     },
    { key: 'cierre',        label: 'Cierre'        },
    { key: 'pausado',       label: 'Pausados'      },
    { key: 'cancelado',     label: 'Cancelados'    },
  ]

  return (
    <div className="space-y-5 w-full">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Proyectos</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {stats.total} proyectos · {stats.activos} activos · {stats.avanceProm}% avance promedio
            {stats.totalPorCobrar > 0 && <> · <span className="text-amber-600 font-medium">Por cobrar {formatCLP(stats.totalPorCobrar)}</span></>}
            {stats.totalPorPagar  > 0 && <> · <span className="text-red-500 font-medium">Por pagar {formatCLP(stats.totalPorPagar)}</span></>}
          </p>
        </div>
        <button onClick={() => navigate('/proyectos/nuevo')} className="btn-primary">
          <Plus className="w-4 h-4" />
          Nuevo proyecto
        </button>
      </div>

      {/* Gantt global */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Planificación global</h2>
          <button
            onClick={() => setGanttExpandido(!ganttExpandido)}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            {ganttExpandido ? 'Colapsar' : 'Expandir'}
          </button>
        </div>
        {ganttExpandido && (
          <div className="card overflow-hidden">
            <GanttView
              proyectos={datosPlanificacion.proyectos.filter((p) => (mostrarCerrados || p.estado !== 'cerrado') && p.estado !== 'cancelado')}
              tareas={datosPlanificacion.tareas}
              colorMap={colorMapGantt}
            />
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o cliente..."
              className="input-base pl-9"
            />
          </div>
          {responsables.length > 0 && (
            <select
              value={filtroResponsable}
              onChange={(e) => setFiltroResponsable(e.target.value)}
              className="input-base w-full sm:w-52"
            >
              <option value="todos">Todos los responsables</option>
              {responsables.map((r) => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {FILTROS_ESTADO.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFiltroEstado(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filtroEstado === key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setMostrarCerrados(!mostrarCerrados)}
              className={`relative w-8 h-4 rounded-full transition-colors ${mostrarCerrados ? 'bg-indigo-500' : 'bg-slate-300'}`}
            >
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${mostrarCerrados ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-xs text-slate-500">Mostrar cerrados</span>
          </label>
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderOpen className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">Sin proyectos</p>
            <p className="text-xs text-slate-400 mt-1">
              {search || filtroEstado !== 'todos'
                ? 'No hay proyectos que coincidan con los filtros.'
                : 'Crea el primer proyecto con el botón de arriba.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th colSpan={5} />
                  <th colSpan={2} className="text-center text-[10px] text-green-600 uppercase tracking-wide border-b border-slate-200 pb-1 bg-green-50 hidden md:table-cell">
                    Venta
                  </th>
                  <th colSpan={3} className="text-center text-[10px] text-red-600 uppercase tracking-wide border-b border-slate-200 pb-1 bg-red-50 hidden lg:table-cell">
                    Costos
                  </th>
                  <th colSpan={1} className="text-center text-[10px] text-sky-600 uppercase tracking-wide border-b border-slate-200 pb-1 bg-sky-50 hidden md:table-cell">
                    IVA
                  </th>
                  <th />
                </tr>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="table-th">Código</th>
                  <th className="table-th">Proyecto / Cliente</th>
                  <th className="table-th">Estado</th>
                  <th className="table-th w-40">Avance</th>
                  <th className="table-th hidden md:table-cell">Cotización</th>
                  <th className="table-th text-right hidden md:table-cell bg-green-50">Cobrado</th>
                  <th className="table-th text-right hidden md:table-cell bg-green-50">Por cobrar</th>
                  <th className="table-th text-right hidden lg:table-cell bg-red-50">Pagado OCs</th>
                  <th className="table-th text-right hidden lg:table-cell bg-red-50">Por pagar OCs</th>
                  <th className="table-th text-right hidden lg:table-cell bg-red-50">Gastos</th>
                  <th className="table-th text-right hidden md:table-cell bg-sky-50">IVA</th>
                  <th className="table-th text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtrados.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => navigate(`/proyectos/${p.id}`)}
                  >
                    <td className="table-td font-mono text-xs text-slate-500">{p.codigo || '—'}</td>
                    <td className="table-td">
                      <div className="font-medium text-slate-800">{p.nombre}</div>
                      {p.cliente && <div className="text-xs text-slate-400">{p.cliente}</div>}
                      {p.tieneTareasVencidas && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600">
                          <AlertTriangle className="w-3 h-3" />Tareas vencidas
                        </span>
                      )}
                    </td>
                    <td className="table-td">
                      <EstadoBadge estado={p.estado} />
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-[60px]">
                          <ProgressBar value={p.porcentajeAvance} />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 w-8 text-right flex-shrink-0">
                          {p.porcentajeAvance ?? 0}%
                        </span>
                      </div>
                    </td>
                    <td className="table-td hidden md:table-cell">
                      {p.financiero?.cotizaciones?.length > 0
                        ? p.financiero.cotizaciones.map((cot, i) => (
                            <span key={cot.id}>
                              {i > 0 && <span className="text-slate-300">, </span>}
                              <span
                                className="font-mono text-xs text-indigo-600"
                                title={`Cliente: ${cot.nombre || '—'}`}
                              >{cot.numero}</span>
                            </span>
                          ))
                        : <span className="text-slate-400">—</span>
                      }
                    </td>
                    <td className="table-td text-right hidden md:table-cell bg-green-50">
                      <span className="text-xs font-semibold text-green-600">
                        {formatCLP(p.financiero?.cobrado ?? 0)}
                      </span>
                    </td>
                    <td className="table-td text-right hidden md:table-cell bg-green-50">
                      <span className="text-xs font-semibold text-amber-600">
                        {formatCLP(p.financiero?.porCobrar ?? 0)}
                      </span>
                    </td>
                    <td className="table-td text-right hidden lg:table-cell bg-red-50">
                      <span className="text-xs font-semibold text-slate-700">
                        {formatCLP(p.financiero?.pagado ?? 0)}
                      </span>
                    </td>
                    <td className="table-td text-right hidden lg:table-cell bg-red-50">
                      <span className="text-xs font-semibold text-red-500">
                        {formatCLP(p.financiero?.porPagar ?? 0)}
                      </span>
                    </td>
                    <td className="table-td text-right hidden lg:table-cell bg-red-50">
                      <span className="text-xs font-semibold text-orange-600">
                        {formatCLP(p.financiero?.gastos ?? 0)}
                      </span>
                    </td>
                    <td className="table-td text-right hidden md:table-cell bg-sky-50">
                      <span className="text-xs font-semibold text-indigo-600">
                        {formatCLP(p.financiero?.iva ?? 0)}
                      </span>
                    </td>
                    <td className="table-td text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/proyectos/${p.id}`)}
                        className="btn-ghost p-1.5"
                        title="Ver proyecto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan="4" className="table-td font-semibold text-slate-600 text-xs">
                    Totales ({filtrados.length} proyectos)
                  </td>
                  <td className="table-td text-right hidden md:table-cell bg-green-50">
                    <span className="text-xs font-bold text-green-600">{formatCLP(totalesFiltrados.cobrado)}</span>
                  </td>
                  <td className="table-td text-right hidden md:table-cell bg-green-50">
                    <span className="text-xs font-bold text-amber-600">{formatCLP(totalesFiltrados.porCobrar)}</span>
                  </td>
                  <td className="table-td text-right hidden lg:table-cell bg-red-50">
                    <span className="text-xs font-bold text-slate-700">{formatCLP(totalesFiltrados.pagado)}</span>
                  </td>
                  <td className="table-td text-right hidden lg:table-cell bg-red-50">
                    <span className="text-xs font-bold text-red-500">{formatCLP(totalesFiltrados.porPagar)}</span>
                  </td>
                  <td className="table-td text-right hidden lg:table-cell bg-red-50">
                    <span className="text-xs font-bold text-orange-600">{formatCLP(totalesFiltrados.gastos)}</span>
                  </td>
                  <td className="table-td text-right hidden md:table-cell bg-sky-50">
                    <span className="text-xs font-bold text-indigo-600">{formatCLP(totalesFiltrados.iva)}</span>
                  </td>
                  <td className="table-td" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
