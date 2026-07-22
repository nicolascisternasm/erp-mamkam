import { useState, useMemo, useCallback, useRef } from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import {
  format, parse, startOfWeek, getDay,
  addDays, addMonths, differenceInDays,
} from 'date-fns'
import { es } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { CalendarDays, BarChart2, AlertTriangle, X, Save } from 'lucide-react'
import { apiClient } from '../../services/apiClient'

/* ── Colores por estado ──────────────────────────────────────────── */
const ESTADO_COL = {
  pendiente:   { dot: 'bg-slate-400',   hex: '#94a3b8' },
  en_progreso: { dot: 'bg-indigo-500',  hex: '#6366f1' },
  completada:  { dot: 'bg-emerald-500', hex: '#10b981' },
  bloqueada:   { dot: 'bg-red-500',     hex: '#ef4444' },
}
const getCol = (estado) => ESTADO_COL[estado] ?? ESTADO_COL.pendiente

/* ── react-big-calendar setup ────────────────────────────────────── */
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { locale: es }),
  getDay,
  locales: { es },
})

const CAL_MSG = {
  today: 'Hoy', previous: 'Anterior', next: 'Siguiente',
  month: 'Mes', week: 'Semana', day: 'Día',
  noEventsInRange: 'Sin eventos en este período',
  allDay: 'Todo el día', showMore: (n) => `+${n} más`,
}

/* ── Vista Calendario ────────────────────────────────────────────── */
function CalendarView({ proyecto, tareas, onEditTask }) {
  const events = useMemo(() => {
    const evs = []
    const pStart = proyecto.fechaInicioReal || proyecto.fechaInicioEst
    const pEnd   = proyecto.fechaFinReal    || proyecto.fechaFinEst
    if (pStart && pEnd) {
      evs.push({
        id: '__proyecto__',
        title: `📋 ${proyecto.nombre}`,
        start: new Date(pStart),
        end:   new Date(pEnd),
        allDay: true,
        isProyecto: true,
      })
    }
    tareas.forEach((t) => {
      if (!t.fechaFin) return
      const start = t.fechaInicio ? new Date(t.fechaInicio) : new Date(t.fechaFin)
      evs.push({
        id: t.id, title: t.nombre,
        start, end: new Date(t.fechaFin),
        allDay: true, resource: t,
      })
    })
    return evs
  }, [proyecto, tareas])

  const eventPropGetter = useCallback((ev) => {
    if (ev.isProyecto) {
      return { style: { backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd', fontSize: 11 } }
    }
    const { hex } = getCol(ev.resource?.estado)
    return { style: { backgroundColor: hex, color: '#fff', border: 'none', borderRadius: 4, fontSize: 11 } }
  }, [])

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={{ height: 580 }}>
      <div style={{ height: '100%', padding: 8 }}>
        <Calendar
          localizer={localizer}
          events={events}
          defaultView="month"
          views={['month', 'week', 'day']}
          messages={CAL_MSG}
          culture="es"
          eventPropGetter={eventPropGetter}
          onSelectEvent={(ev) => { if (!ev.isProyecto && ev.resource) onEditTask(ev.resource) }}
          tooltipAccessor={(ev) => {
            if (ev.isProyecto) return ev.title
            const t = ev.resource
            return [
              t.nombre,
              `Fase: ${t.fase || '—'}`,
              `Responsable: ${t.responsableNombre || '—'}`,
              `Avance: ${t.porcentajeAvance ?? 0}%`,
            ].join('\n')
          }}
          style={{ height: '100%' }}
        />
      </div>
    </div>
  )
}

/* ── Vista Gantt (SVG / divs puros) ─────────────────────────────── */
const PX_PER = { dias: 28, semanas: 80 / 7, meses: 110 / 30 }
const COL_W  = { dias: 28, semanas: 80, meses: 110 }
const ROW_H  = 40
const HEAD_H = 52
const LEFT_W = 272

function GanttView({ proyecto, tareas, onEditTask }) {
  const [zoom, setZoom] = useState('semanas')
  const scrollRef       = useRef(null)
  const today           = useMemo(() => new Date(), [])
  const todayStr        = today.toISOString().slice(0, 10)

  /* ── Rango de fechas ── */
  const { rangeStart, rangeEnd } = useMemo(() => {
    const dates = tareas
      .flatMap((t) => [t.fechaInicio, t.fechaFin].filter(Boolean).map((d) => new Date(d)))
    const pS = proyecto.fechaInicioReal || proyecto.fechaInicioEst
    const pE = proyecto.fechaFinReal    || proyecto.fechaFinEst
    if (pS) dates.push(new Date(pS))
    if (pE) dates.push(new Date(pE))
    dates.push(today)
    const min = new Date(Math.min(...dates.map((d) => d.getTime())))
    const max = new Date(Math.max(...dates.map((d) => d.getTime())))
    return { rangeStart: addDays(min, -14), rangeEnd: addDays(max, 21) }
  }, [tareas, proyecto, today])

  const totalDays = differenceInDays(rangeEnd, rangeStart) + 1
  const pxPerDay  = PX_PER[zoom]
  const colW      = COL_W[zoom]

  const getX = (dateStr) => Math.round(differenceInDays(new Date(dateStr), rangeStart) * pxPerDay)
  const getBarW = (s, e) => Math.max(6, Math.round((differenceInDays(new Date(e), new Date(s)) + 1) * pxPerDay))

  const timeW = Math.max(600, Math.round(totalDays * pxPerDay))

  /* ── Columnas encabezado ── */
  const columns = useMemo(() => {
    const cols = []
    if (zoom === 'dias') {
      let d = new Date(rangeStart)
      while (d <= rangeEnd) {
        cols.push({ label: format(d, 'd', { locale: es }), sub: format(d, 'EEE', { locale: es }) })
        d = addDays(d, 1)
      }
    } else if (zoom === 'semanas') {
      let d = new Date(rangeStart)
      while (d <= rangeEnd) {
        cols.push({ label: format(d, 'd MMM', { locale: es }) })
        d = addDays(d, 7)
      }
    } else {
      let d = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
      while (d <= rangeEnd) {
        cols.push({ label: format(d, 'MMM yyyy', { locale: es }) })
        d = addMonths(d, 1)
      }
    }
    return cols
  }, [zoom, rangeStart, rangeEnd])

  /* ── Agrupar tareas por fase ── */
  const rows = useMemo(() => {
    const groups = {}
    tareas.forEach((t) => {
      const fase = t.fase || 'General'
      if (!groups[fase]) groups[fase] = []
      groups[fase].push(t)
    })
    return Object.entries(groups).flatMap(([fase, tasks]) => [
      { type: 'fase', label: fase, id: `fase-${fase}` },
      ...tasks.map((t) => ({ type: 'task', task: t, id: t.id })),
    ])
  }, [tareas])

  const todayX = getX(todayStr)

  const scrollToToday = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, todayX - scrollRef.current.clientWidth / 2)
    }
  }

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
        <span className="text-xs font-medium text-slate-500">Zoom:</span>
        {[['dias', 'Días'], ['semanas', 'Semanas'], ['meses', 'Meses']].map(([z, label]) => (
          <button
            key={z}
            onClick={() => setZoom(z)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              zoom === z ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={scrollToToday}
          className="ml-auto px-3 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200"
        >
          Hoy
        </button>
      </div>

      {/* Cuerpo */}
      <div className="flex" style={{ maxHeight: 520, overflow: 'hidden' }}>

        {/* Panel izquierdo */}
        <div className="flex-shrink-0 border-r border-slate-200 flex flex-col" style={{ width: LEFT_W }}>
          {/* Header */}
          <div className="bg-slate-50 border-b border-slate-200 flex items-end px-4 pb-2 flex-shrink-0" style={{ height: HEAD_H }}>
            <span className="text-xs font-semibold text-slate-500">Tarea / Fase</span>
          </div>
          {/* Rows (scrolls in sync via shared container) */}
          <div className="overflow-y-auto flex-1">
            {rows.map((row) => (
              <div
                key={row.id}
                style={{ height: ROW_H }}
                className={`flex items-center border-b border-slate-50 ${
                  row.type === 'fase'
                    ? 'bg-slate-50 px-3'
                    : 'px-4 cursor-pointer hover:bg-indigo-50/40 transition-colors'
                }`}
                onClick={() => row.type === 'task' && row.task.fechaFin && onEditTask(row.task)}
              >
                {row.type === 'fase' ? (
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">
                    {row.label}
                  </span>
                ) : (
                  <div className="flex items-center gap-2 w-full min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getCol(row.task.estado).dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-700 truncate">{row.task.nombre}</p>
                      {row.task.responsableNombre && (
                        <p className="text-[10px] text-slate-400 truncate">{row.task.responsableNombre}</p>
                      )}
                    </div>
                    {!row.task.fechaFin && (
                      <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" title="Sin fechas definidas" />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Panel derecho (timeline) */}
        <div className="flex-1 overflow-auto" ref={scrollRef}>
          <div style={{ width: timeW, position: 'relative', minWidth: '100%' }}>

            {/* Encabezado columnas */}
            <div
              className="flex bg-slate-50 border-b border-slate-200 sticky top-0 z-10"
              style={{ height: HEAD_H }}
            >
              {columns.map((col, i) => (
                <div
                  key={i}
                  className="border-r border-slate-100 flex flex-col items-center justify-end pb-1.5 flex-shrink-0"
                  style={{ width: colW, minWidth: colW }}
                >
                  <span className="text-[10px] font-medium text-slate-500 capitalize leading-tight">{col.label}</span>
                  {col.sub && <span className="text-[9px] text-slate-400 capitalize">{col.sub}</span>}
                </div>
              ))}
            </div>

            {/* Filas con barras */}
            <div className="relative">
              {/* Línea "Hoy" */}
              {todayX >= 0 && todayX <= timeW && (
                <div
                  className="absolute top-0 bottom-0 z-20 pointer-events-none"
                  style={{ left: todayX, width: 2, backgroundColor: '#f87171' }}
                />
              )}

              {rows.map((row) => {
                const isTask = row.type === 'task'
                const t = isTask ? row.task : null

                let barEl = null
                if (isTask && t.fechaFin) {
                  const startStr = t.fechaInicio || t.fechaFin
                  const x = getX(startStr)
                  const w = getBarW(startStr, t.fechaFin)
                  const isLate = t.fechaFin < todayStr && t.estado !== 'completada'
                  const barColor = isLate ? '#ef4444' : getCol(t.estado).hex
                  const avance = t.porcentajeAvance ?? (t.estado === 'completada' ? 100 : 0)

                  barEl = (
                    <div
                      className="absolute rounded cursor-pointer transition-opacity hover:opacity-80"
                      style={{
                        left: x, width: w, height: 22,
                        top: '50%', transform: 'translateY(-50%)',
                        backgroundColor: barColor + '28',
                        border: `1.5px solid ${barColor}`,
                        overflow: 'hidden',
                      }}
                      onClick={() => onEditTask(t)}
                      title={`${t.nombre}${isLate ? ' ⚠️ Atrasada' : ''}\nAvance: ${avance}%`}
                    >
                      <div style={{ width: `${avance}%`, height: '100%', backgroundColor: barColor, opacity: 0.45 }} />
                      {w > 50 && (
                        <span
                          className="absolute inset-0 flex items-center px-1.5 text-[10px] font-semibold truncate pointer-events-none"
                          style={{ color: barColor }}
                        >
                          {t.nombre}
                        </span>
                      )}
                    </div>
                  )
                }

                return (
                  <div
                    key={row.id}
                    className={`relative border-b border-slate-50 ${row.type === 'fase' ? 'bg-slate-50/60' : ''}`}
                    style={{ height: ROW_H }}
                  >
                    {/* Líneas de columna (grid visual) */}
                    {columns.map((_, ci) => (
                      <div
                        key={ci}
                        className="absolute top-0 bottom-0 border-r border-slate-100/60"
                        style={{ left: ci * colW, width: colW }}
                      />
                    ))}
                    {barEl}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Modal edición de tarea ─────────────────────────────────────── */
function EditTaskModal({ tarea, proyectoId, onClose, onSave }) {
  const [fechaInicio, setFechaInicio] = useState(tarea.fechaInicio || '')
  const [fechaFin,    setFechaFin]    = useState(tarea.fechaFin    || '')
  const [saving,      setSaving]      = useState(false)
  const [err,         setErr]         = useState('')

  const handleSave = async () => {
    setSaving(true)
    setErr('')
    try {
      const updated = await apiClient.patch(`/proyectos/${proyectoId}/tareas/${tarea.id}`, {
        fecha_inicio: fechaInicio || null,
        fecha_fin:    fechaFin    || null,
      })
      onSave(updated ?? { ...tarea, fechaInicio: fechaInicio || null, fechaFin: fechaFin || tarea.fechaFin })
    } catch (e) {
      setErr(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <p className="font-semibold text-slate-900 text-sm truncate pr-2">{tarea.nombre}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha inicio</label>
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha fin</label>
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="input-base" />
          </div>
          {err && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="btn-secondary">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
              {saving
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Save className="w-4 h-4" />}
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Componente principal ────────────────────────────────────────── */
export default function PlanificacionTab({ proyecto, tareas, setTareas, proyectoId }) {
  const [vista,       setVista]       = useState('calendario')
  const [editingTask, setEditingTask] = useState(null)

  const handleSave = useCallback((updated) => {
    setTareas((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
    setEditingTask(null)
  }, [setTareas])

  return (
    <div className="space-y-4">
      {/* Header + toggle de vista */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Planificación</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {tareas.length} tarea{tareas.length !== 1 ? 's' : ''} · click en una tarea para editar fechas
          </p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setVista('calendario')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              vista === 'calendario' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />Calendario
          </button>
          <button
            onClick={() => setVista('gantt')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              vista === 'gantt' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />Gantt
          </button>
        </div>
      </div>

      {tareas.length === 0 ? (
        <div className="card py-16 text-center">
          <BarChart2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-400">Sin tareas para planificar</p>
          <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto">
            Agrega tareas en la pestaña "Tareas" y asígnales fechas para verlas aquí.
          </p>
        </div>
      ) : vista === 'calendario' ? (
        <CalendarView proyecto={proyecto} tareas={tareas} onEditTask={setEditingTask} />
      ) : (
        <GanttView proyecto={proyecto} tareas={tareas} onEditTask={setEditingTask} />
      )}

      {editingTask && (
        <EditTaskModal
          tarea={editingTask}
          proyectoId={proyectoId}
          onClose={() => setEditingTask(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
