import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { apiClient } from '../../services/apiClient'
import { CalendarDays, BarChart2, RefreshCw, AlertTriangle, Bot, Loader2 } from 'lucide-react'
import CalendarView from '../../components/planificacion/CalendarView'
import GanttView    from '../../components/planificacion/GanttView'

const COLORES_PROYECTO = [
  '#E63946',
  '#2196F3',
  '#4CAF50',
  '#FF9800',
  '#9C27B0',
  '#00BCD4',
  '#FF5722',
  '#8BC34A',
]

const ESTADO_COLORES = {
  'En tiempo': '#22c55e',
  'Atención':  '#eab308',
  'Retrasado': '#ef4444',
}

function parseFecha(str) {
  if (!str) return null
  const d = new Date(str)
  d.setHours(0, 0, 0, 0)
  return d
}

function estadoProyecto(proyecto, avance, completadas) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const fechaInicio = parseFecha(proyecto.fechaInicioReal || proyecto.fechaInicioEst)
  const fechaFin    = parseFecha(proyecto.fechaFinReal    || proyecto.fechaFinEst)

  // ROJO: fecha_fin ya pasó y avance < 100%
  if (fechaFin && fechaFin < hoy && avance < 100) return 'Retrasado'

  // ROJO: fecha_inicio ya pasó y no hay tareas completadas
  if (fechaInicio && fechaInicio < hoy && completadas === 0 && avance < 100) return 'Retrasado'

  // Proyecto no ha comenzado aún
  if (fechaInicio && fechaInicio >= hoy) {
    const dias = Math.ceil((fechaInicio - hoy) / 86400000)
    return dias <= 5 ? 'Atención' : 'En tiempo'
  }

  // En curso: comparar avance real vs esperado por tiempo transcurrido
  if (fechaInicio && fechaFin && fechaFin >= hoy) {
    const duracion      = Math.max(1, (fechaFin - fechaInicio) / 86400000)
    const transcurridos = (hoy - fechaInicio) / 86400000
    const esperado      = Math.min(100, Math.round((transcurridos / duracion) * 100))
    if (avance < esperado) return 'Atención'
  }

  return 'En tiempo'
}

function calcDiasRetraso(fechaFinStr) {
  if (!fechaFinStr) return 0
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const fin = parseFecha(fechaFinStr)
  return fin ? Math.max(0, Math.ceil((hoy - fin) / 86400000)) : 0
}

function resumenBanner(p) {
  if (p.estado === 'Retrasado') {
    const dias = calcDiasRetraso(p.fechaFin)
    if (dias > 0) return `${dias} día${dias !== 1 ? 's' : ''} de retraso`
    if (p.completadas === 0) return 'Sin inicio efectivo'
    return 'Fuera de plazo'
  }
  if (p.estado === 'Atención') {
    const fi  = parseFecha(p.fechaInicio)
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    if (fi && fi >= hoy) {
      const dias = Math.ceil((fi - hoy) / 86400000)
      return `Comienza en ${dias} día${dias !== 1 ? 's' : ''}`
    }
    if (p.avanceEsperado !== null)
      return `Avance ${p.pct}% — se esperaba ${p.avanceEsperado}%`
    return 'Avance por debajo de lo planificado'
  }
  return ''
}

function formatFecha(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function llamarIA(p) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY no configurada')

  const hoy      = new Date(); hoy.setHours(0, 0, 0, 0)
  const fechaFin = parseFecha(p.fechaFin)
  const diasRestantes = fechaFin ? Math.ceil((fechaFin - hoy) / 86400000) : null

  const pendientesStr = p.tareasPendientes?.length
    ? p.tareasPendientes.map((t) => t.nombre).join(', ')
    : 'ninguna'

  const content = `Analiza este proyecto y genera un resumen ejecutivo breve (máximo 3 oraciones) indicando su estado actual, riesgos y recomendación.

Proyecto: ${p.nombre}
Fecha inicio: ${p.fechaInicio ?? '—'}
Fecha fin: ${p.fechaFin ?? '—'}
Avance: ${p.pct}% (${p.completadas}/${p.totalTareas} tareas)
Estado: ${p.estado}
Tareas pendientes: ${pendientesStr}
Días para inicio/fin: ${diasRestantes !== null ? diasRestantes : 'sin fecha definida'}

Responde en español, de forma concisa y directa.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':                          'application/json',
      'x-api-key':                             apiKey,
      'anthropic-version':                     '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 300,
      messages:   [{ role: 'user', content }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Error ${res.status}`)
  }

  const data = await res.json()
  return data.content?.[0]?.text ?? '—'
}

export default function PlanificacionPage() {
  const { trabajadores } = useApp()
  const [searchParams]   = useSearchParams()

  const [proyectos,      setProyectos]      = useState([])
  const [tareas,         setTareas]         = useState([])
  const [loading,        setLoading]        = useState(true)
  const [vista,          setVista]          = useState('gantt')
  const [filtroProyecto, setFiltroProyecto] = useState('todos')
  const [analisisIA,     setAnalisisIA]     = useState({})
  const [mostrarCerrados, setMostrarCerrados] = useState(false)

  const trabMap = useMemo(() =>
    Object.fromEntries(trabajadores.map((t) => [String(t.id), t.nombre])),
    [trabajadores],
  )

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const { proyectos: ps, tareas: ts } = await apiClient.get('/proyectos/planificacion')
      setProyectos(ps || [])
      setTareas((ts || []).map((t) => ({
        ...t,
        responsableNombre: t.responsableNombre
          ?? (t.responsableId ? trabMap[String(t.responsableId)] : null),
      })))
    } catch (err) {
      console.error('[planificacion]', err)
    } finally {
      setLoading(false)
    }
  }, [trabMap])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    const pid = searchParams.get('proyecto')
    if (pid) setFiltroProyecto(pid)
  }, [searchParams])

  const colorMap = useMemo(() => {
    const m = {}
    proyectos.forEach((p, i) => { m[p.id] = COLORES_PROYECTO[i % COLORES_PROYECTO.length] })
    return m
  }, [proyectos])

  const filteredProys  = (filtroProyecto === 'todos' ? proyectos : proyectos.filter((p) => p.id === filtroProyecto))
    .filter((p) => (mostrarCerrados || p.estado !== 'cerrado') && p.estado !== 'cancelado')
  const filteredTareas = filtroProyecto === 'todos' ? tareas    : tareas.filter((t) => t.proyectoId === filtroProyecto)

  const avancePorProyecto = useMemo(() => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    return filteredProys.map((p) => {
      const tareasProy      = filteredTareas.filter((t) => t.proyectoId === p.id)
      const totalTareas     = tareasProy.length
      const completadas     = tareasProy.filter((t) => t.estado === 'completada').length
      const tareasPendientes = tareasProy.filter((t) => t.estado !== 'completada')
      const pct             = totalTareas > 0
        ? Math.round((completadas / totalTareas) * 100)
        : (p.porcentajeAvance ?? 0)
      const fechaInicio = p.fechaInicioReal || p.fechaInicioEst
      const fechaFin    = p.fechaFinReal    || p.fechaFinEst

      const fi = parseFecha(fechaInicio)
      const ff = parseFecha(fechaFin)
      let avanceEsperado = null
      if (fi && ff && fi < hoy && ff >= hoy) {
        const duracion      = Math.max(1, (ff - fi) / 86400000)
        const transcurridos = (hoy - fi) / 86400000
        avanceEsperado      = Math.min(100, Math.round((transcurridos / duracion) * 100))
      }

      const estado = estadoProyecto(p, pct, completadas)
      return { ...p, totalTareas, completadas, tareasPendientes, pct, estado, fechaInicio, fechaFin, avanceEsperado }
    })
  }, [filteredProys, filteredTareas])

  const conProblemas = avancePorProyecto.filter(
    (p) => p.estado === 'Retrasado' || p.estado === 'Atención',
  )

  const handleAnalizarIA = useCallback(async (p, forzar = false) => {
    if (!forzar && analisisIA[p.id]?.texto) return
    setAnalisisIA((prev) => ({ ...prev, [p.id]: { loading: true, texto: null, error: null } }))
    try {
      const texto = await llamarIA(p)
      setAnalisisIA((prev) => ({ ...prev, [p.id]: { loading: false, texto, error: null } }))
    } catch (err) {
      setAnalisisIA((prev) => ({ ...prev, [p.id]: { loading: false, texto: null, error: err.message } }))
    }
  }, [analisisIA])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin mr-2" />
        <span className="text-sm text-slate-500">Cargando planificación…</span>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Planificación</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {proyectos.length} proyecto{proyectos.length !== 1 ? 's' : ''} · {tareas.length} tarea{tareas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filtroProyecto}
            onChange={(e) => setFiltroProyecto(e.target.value)}
            className="input-base py-1.5 text-sm"
          >
            <option value="todos">Todos los proyectos</option>
            {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setMostrarCerrados(!mostrarCerrados)}
              className={`relative w-8 h-4 rounded-full transition-colors ${mostrarCerrados ? 'bg-indigo-500' : 'bg-slate-300'}`}
            >
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${mostrarCerrados ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-xs text-slate-500">Mostrar cerrados</span>
          </label>
          <button onClick={cargar} title="Recargar"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setVista('calendario')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                vista === 'calendario' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />Calendario
            </button>
            <button onClick={() => setVista('gantt')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                vista === 'gantt' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />Gantt
            </button>
          </div>
        </div>
      </div>

      {/* Banner global de advertencias */}
      {conProblemas.length > 0 && (
        <div className={`rounded-xl border px-4 py-3 flex flex-col gap-2 ${
          conProblemas.some((p) => p.estado === 'Retrasado')
            ? 'bg-red-50 border-red-200'
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${
              conProblemas.some((p) => p.estado === 'Retrasado') ? 'text-red-500' : 'text-yellow-500'
            }`} />
            <span className={`text-sm font-semibold ${
              conProblemas.some((p) => p.estado === 'Retrasado') ? 'text-red-700' : 'text-yellow-700'
            }`}>
              {conProblemas.some((p) => p.estado === 'Retrasado') ? '🚨' : '⚠'} {conProblemas.length} proyecto{conProblemas.length !== 1 ? 's' : ''} requiere{conProblemas.length === 1 ? '' : 'n'} atención
            </span>
          </div>
          <ul className="ml-6 space-y-1">
            {conProblemas.map((p) => (
              <li key={p.id} className="text-xs flex items-center gap-1.5">
                <span className="font-semibold" style={{
                  color: p.estado === 'Retrasado' ? '#b91c1c' : '#92400e',
                }}>
                  {p.estado === 'Retrasado' ? '🚨' : '⚠'} {p.nombre}:
                </span>
                <span className={p.estado === 'Retrasado' ? 'text-red-600' : 'text-yellow-700'}>
                  {resumenBanner(p)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Leyenda de colores */}
      {filteredProys.length > 0 && (
        <div className="card p-3 flex flex-wrap gap-x-5 gap-y-2">
          {filteredProys.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: colorMap[p.id] }} />
              <span className="text-xs text-slate-600 truncate max-w-[200px]">{p.nombre}</span>
            </div>
          ))}
        </div>
      )}

      {proyectos.length === 0 ? (
        <div className="card py-16 text-center">
          <BarChart2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-400">Sin proyectos para planificar</p>
        </div>
      ) : vista === 'calendario' ? (
        <CalendarView proyectos={filteredProys} tareas={filteredTareas} colorMap={colorMap} />
      ) : (
        <GanttView proyectos={filteredProys} tareas={filteredTareas} colorMap={colorMap} />
      )}

      {/* Panel de avance por proyecto */}
      {avancePorProyecto.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Avance por proyecto</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {avancePorProyecto.map((p) => {
              const estadoColor  = ESTADO_COLORES[p.estado] ?? '#22c55e'
              const diasRetraso  = p.estado === 'Retrasado' ? calcDiasRetraso(p.fechaFin) : 0
              const ia           = analisisIA[p.id]

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3"
                  style={{ borderLeftWidth: 4, borderLeftColor: estadoColor }}
                >
                  {/* Nombre */}
                  <span className="text-sm font-semibold text-slate-800 leading-snug">{p.nombre}</span>

                  {/* Badge de estado + botón IA */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                      p.estado === 'Retrasado' ? 'bg-red-100 text-red-700' :
                      p.estado === 'Atención'  ? 'bg-yellow-100 text-yellow-700' :
                                                 'bg-green-100 text-green-700'
                    }`}>
                      {p.estado === 'Retrasado' ? '🚨 Retrasado' :
                       p.estado === 'Atención'  ? '⚠ Atención' :
                                                  '✓ En tiempo'}
                    </span>

                    {/* Días de retraso */}
                    {p.estado === 'Retrasado' && diasRetraso > 0 && (
                      <span className="text-[11px] text-red-500 font-medium">
                        {diasRetraso} día{diasRetraso !== 1 ? 's' : ''} de retraso
                      </span>
                    )}

                    {/* Botón IA */}
                    <button
                      onClick={() => handleAnalizarIA(p, !!ia?.texto)}
                      disabled={ia?.loading}
                      className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors disabled:opacity-60"
                      title={ia?.texto ? 'Volver a analizar con IA' : 'Analizar con IA'}
                    >
                      {ia?.loading
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Bot className="w-3 h-3" />}
                      {ia?.loading ? 'Analizando…' : ia?.texto ? 'Reanalizar' : 'Analizar 🤖'}
                    </button>
                  </div>

                  {/* Resultado IA */}
                  {ia?.texto && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-xs text-indigo-800 leading-relaxed">
                      {ia.texto}
                    </div>
                  )}
                  {ia?.error && (
                    <p className="text-[11px] text-red-500">Error: {ia.error}</p>
                  )}

                  {/* Barra de progreso */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>{p.completadas} / {p.totalTareas} tarea{p.totalTareas !== 1 ? 's' : ''} completada{p.totalTareas !== 1 ? 's' : ''}</span>
                      <span className="font-semibold" style={{ color: colorMap[p.id] }}>{p.pct}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${p.pct}%`, backgroundColor: colorMap[p.id] }}
                      />
                    </div>
                    {/* Avance esperado (solo en Atención con proyecto en curso) */}
                    {p.estado === 'Atención' && p.avanceEsperado !== null && (
                      <p className="text-[11px] text-yellow-600 mt-1">
                        Avance esperado a esta fecha: {p.avanceEsperado}%
                      </p>
                    )}
                  </div>

                  {/* Fechas */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span>{formatFecha(p.fechaInicio)}</span>
                    <span className="text-slate-300">→</span>
                    <span>{formatFecha(p.fechaFin)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
