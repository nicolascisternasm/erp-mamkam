import { useState, useMemo, useRef } from 'react'
import { format, addDays, addMonths, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'

const PX_PER  = { dias: 28, semanas: 80 / 7, meses: 110 / 30 }
const COL_W   = { dias: 28, semanas: 80, meses: 110 }
const PROY_RH = 48
const TASK_RH = 38
const HEAD_H  = 52
const LEFT_W  = 300

const ESTADO_HEX = { pendiente: '#94a3b8', en_progreso: '#6366f1', completada: '#10b981', bloqueada: '#ef4444' }
const estadoHex  = (e) => ESTADO_HEX[e] ?? '#94a3b8'
const ESTADO_DOT = { pendiente: 'bg-slate-400', en_progreso: 'bg-indigo-500', completada: 'bg-emerald-500', bloqueada: 'bg-red-500' }

export default function GanttView({ proyectos, tareas, colorMap }) {
  const [zoom,     setZoom]     = useState('dias')
  const [expanded, setExpanded] = useState(() => new Set())
  const scrollRef               = useRef(null)
  const today                   = useMemo(() => new Date(), [])
  const todayStr                = today.toISOString().slice(0, 10)

  const tareasByProy = useMemo(() => {
    const m = {}
    tareas.forEach((t) => { if (!m[t.proyectoId]) m[t.proyectoId] = []; m[t.proyectoId].push(t) })
    return m
  }, [tareas])

  const { rangeStart, rangeEnd } = useMemo(() => {
    const dates = [today]
    proyectos.forEach((p) => {
      ['fechaInicioEst', 'fechaFinEst', 'fechaInicioReal', 'fechaFinReal'].forEach((f) => {
        if (p[f]) dates.push(new Date(p[f]))
      })
    })
    tareas.forEach((t) => {
      if (t.fechaInicio) dates.push(new Date(t.fechaInicio))
      if (t.fechaFin)    dates.push(new Date(t.fechaFin))
    })
    const min = new Date(Math.min(...dates.map((d) => d.getTime())))
    const max = new Date(Math.max(...dates.map((d) => d.getTime())))
    return { rangeStart: addDays(min, -14), rangeEnd: addDays(max, 21) }
  }, [proyectos, tareas, today])

  const totalDays = differenceInDays(rangeEnd, rangeStart) + 1
  const pxPerDay  = PX_PER[zoom]
  const colW      = COL_W[zoom]
  const timeW     = Math.max(600, Math.round(totalDays * pxPerDay))

  const getX    = (d) => Math.round(differenceInDays(new Date(d), rangeStart) * pxPerDay)
  const getBarW = (s, e) => Math.max(6, Math.round((differenceInDays(new Date(e), new Date(s)) + 1) * pxPerDay))
  const todayX  = getX(todayStr)

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

  const rows = useMemo(() => {
    const r = []
    proyectos.forEach((p) => {
      const pTareas = tareasByProy[p.id] || []
      const isExp   = expanded.has(p.id)
      r.push({ type: 'proy', proy: p, tareaCount: pTareas.length, isExp })
      if (isExp) pTareas.forEach((t) => r.push({ type: 'tarea', tarea: t, proyId: p.id }))
    })
    return r
  }, [proyectos, tareasByProy, expanded])

  const getProyRange = (p) => {
    const pts = tareasByProy[p.id] || []
    const all = [
      p.fechaInicioReal || p.fechaInicioEst,
      p.fechaFinReal    || p.fechaFinEst,
      ...pts.flatMap((t) => [t.fechaInicio, t.fechaFin]),
    ].filter(Boolean)
    if (!all.length) return null
    return { s: all.reduce((a, b) => a < b ? a : b), e: all.reduce((a, b) => a > b ? a : b) }
  }

  const scrollToToday = () => {
    if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, todayX - scrollRef.current.clientWidth / 2)
  }

  const toggle = (pid) => setExpanded((prev) => {
    const n = new Set(prev); n.has(pid) ? n.delete(pid) : n.add(pid); return n
  })

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 flex-wrap">
        <span className="text-xs font-medium text-slate-500">Zoom:</span>
        {[['dias', 'Días'], ['semanas', 'Semanas'], ['meses', 'Meses']].map(([z, l]) => (
          <button key={z} onClick={() => setZoom(z)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              zoom === z ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >{l}</button>
        ))}
        <button onClick={() => setExpanded(new Set(proyectos.map((p) => p.id)))}
          className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200">
          Expandir todo
        </button>
        <button onClick={() => setExpanded(new Set())}
          className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200">
          Colapsar todo
        </button>
        <button onClick={scrollToToday}
          className="ml-auto px-3 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200">
          Hoy
        </button>
      </div>

      {/* Cuerpo */}
      <div className="flex" style={{ maxHeight: 560, overflow: 'hidden' }}>
        {/* Panel izquierdo */}
        <div className="flex-shrink-0 border-r border-slate-200 flex flex-col" style={{ width: LEFT_W }}>
          <div className="bg-slate-50 border-b border-slate-200 flex items-end px-4 pb-2 flex-shrink-0" style={{ height: HEAD_H }}>
            <span className="text-xs font-semibold text-slate-500">Proyecto / Tarea</span>
          </div>
          <div className="overflow-y-auto flex-1">
            {rows.map((row) => {
              if (row.type === 'proy') {
                const p     = row.proy
                const color = colorMap[p.id] ?? '#6366f1'
                return (
                  <div
                    key={`proy-${p.id}`}
                    style={{ height: PROY_RH }}
                    className="flex items-center gap-2 px-3 border-b border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => toggle(p.id)}
                  >
                    {row.isExp
                      ? <ChevronDown  className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{p.nombre}</p>
                      {p.cliente && <p className="text-[10px] text-slate-500 truncate">{p.cliente}</p>}
                    </div>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{row.tareaCount}t</span>
                  </div>
                )
              }
              const t = row.tarea
              return (
                <div
                  key={`tarea-${t.id}`}
                  style={{ height: TASK_RH }}
                  className="flex items-center gap-2 pl-8 pr-3 border-b border-slate-50 hover:bg-indigo-50/30 transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ESTADO_DOT[t.estado] ?? 'bg-slate-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-700 truncate">{t.nombre}</p>
                    {t.responsableNombre && <p className="text-[10px] text-slate-400 truncate">{t.responsableNombre}</p>}
                  </div>
                  {!t.fechaFin && <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" title="Sin fechas" />}
                </div>
              )
            })}
          </div>
        </div>

        {/* Panel timeline */}
        <div className="flex-1 overflow-auto" ref={scrollRef}>
          <div style={{ width: timeW, position: 'relative', minWidth: '100%' }}>
            {/* Encabezados */}
            <div className="flex bg-slate-50 border-b border-slate-200 sticky top-0 z-10" style={{ height: HEAD_H }}>
              {columns.map((col, i) => (
                <div key={i} className="border-r border-slate-100 flex flex-col items-center justify-end pb-1.5 flex-shrink-0"
                  style={{ width: colW, minWidth: colW }}>
                  <span className="text-[10px] font-medium text-slate-500 capitalize">{col.label}</span>
                  {col.sub && <span className="text-[9px] text-slate-400 capitalize">{col.sub}</span>}
                </div>
              ))}
            </div>

            {/* Filas */}
            <div className="relative">
              {/* Línea hoy */}
              {todayX >= 0 && todayX <= timeW && (
                <div className="absolute top-0 bottom-0 z-20 pointer-events-none"
                  style={{ left: todayX, width: 2, backgroundColor: '#f87171' }} />
              )}

              {rows.map((row) => {
                const isProy = row.type === 'proy'
                const rh     = isProy ? PROY_RH : TASK_RH
                const color  = colorMap[isProy ? row.proy?.id : row.proyId] ?? '#6366f1'
                let barEl    = null

                if (isProy) {
                  const range = getProyRange(row.proy)
                  if (range) {
                    const x = getX(range.s); const w = getBarW(range.s, range.e)
                    const av = row.proy.porcentajeAvance ?? 0
                    barEl = (
                      <div className="absolute rounded"
                        style={{ left: x, width: w, height: 28, top: '50%', transform: 'translateY(-50%)',
                          backgroundColor: color + '22', border: `2px solid ${color}`, overflow: 'hidden' }}>
                        <div style={{ width: `${av}%`, height: '100%', backgroundColor: color, opacity: 0.35 }} />
                        {w > 60 && (
                          <span className="absolute inset-0 flex items-center px-2 text-[10px] font-bold truncate"
                            style={{ color }}>{av}%</span>
                        )}
                      </div>
                    )
                  }
                } else {
                  const t = row.tarea
                  if (t.fechaFin) {
                    const ss   = t.fechaInicio || t.fechaFin
                    const x    = getX(ss); const w = getBarW(ss, t.fechaFin)
                    const late = t.fechaFin < todayStr && t.estado !== 'completada'
                    const bc   = late ? '#ef4444' : estadoHex(t.estado)
                    const av   = t.porcentajeAvance ?? (t.estado === 'completada' ? 100 : 0)
                    barEl = (
                      <div className="absolute rounded hover:opacity-80 transition-opacity cursor-default"
                        style={{ left: x, width: w, height: 22, top: '50%', transform: 'translateY(-50%)',
                          backgroundColor: bc + '28', border: `1.5px solid ${bc}`, overflow: 'hidden' }}
                        title={`${t.nombre}${late ? ' ⚠️ Atrasada' : ''}\nAvance: ${av}%`}>
                        <div style={{ width: `${av}%`, height: '100%', backgroundColor: bc, opacity: 0.4 }} />
                        {w > 50 && (
                          <span className="absolute inset-0 flex items-center px-1.5 text-[10px] font-medium truncate pointer-events-none"
                            style={{ color: bc }}>{t.nombre}</span>
                        )}
                      </div>
                    )
                  }
                }

                return (
                  <div key={`${row.type}-${isProy ? row.proy.id : row.tarea.id}`}
                    className={`relative border-b ${isProy ? 'bg-slate-50/60 border-slate-200' : 'border-slate-50'}`}
                    style={{ height: rh }}>
                    {columns.map((_, ci) => (
                      <div key={ci} className="absolute top-0 bottom-0 border-r border-slate-100/50"
                        style={{ left: ci * colW, width: colW }} />
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
