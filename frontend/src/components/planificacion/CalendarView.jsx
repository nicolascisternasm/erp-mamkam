import { useMemo, useCallback, useState } from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const localizer = dateFnsLocalizer({
  format, parse,
  startOfWeek: (date) => startOfWeek(date, { locale: es }),
  getDay, locales: { es },
})

const CAL_MSG = {
  today: 'Hoy', previous: 'Anterior', next: 'Siguiente',
  month: 'Mes', week: 'Semana', day: 'Día',
  noEventsInRange: 'Sin eventos en este período',
  allDay: 'Todo el día', showMore: (n) => `+${n} más`,
}

const ESTADO_HEX = { pendiente: '#94a3b8', en_progreso: '#6366f1', completada: '#10b981', bloqueada: '#ef4444' }
const estadoHex = (e) => ESTADO_HEX[e] ?? '#94a3b8'

export default function CalendarView({ proyectos, tareas, colorMap }) {
  const [vistaActual, setVistaActual] = useState('month')

  const events = useMemo(() => {
    const evs = []

    // Siempre mostrar proyectos (con su duración completa)
    proyectos.forEach((p) => {
      const s = p.fechaInicioReal || p.fechaInicioEst
      const e = p.fechaFinReal    || p.fechaFinEst
      if (!s || !e) return
      evs.push({
        id: `p-${p.id}`,
        title: p.nombre,
        start: new Date(s),
        end: new Date(e),
        allDay: true,
        isProyecto: true,
        proyectoId: p.id,
      })
    })

    // Tareas solo en vistas Semana y Día
    if (vistaActual !== 'month') {
      tareas.forEach((t) => {
        if (!t.fechaFin) return
        const start = t.fechaInicio ? new Date(t.fechaInicio) : new Date(t.fechaFin)
        evs.push({
          id: t.id,
          title: `${t.proyectoNombre ?? ''}: ${t.nombre}`,
          start,
          end: new Date(t.fechaFin),
          allDay: true,
          isTarea: true,
          tarea: t,
          proyectoId: t.proyectoId,
        })
      })
    }

    return evs
  }, [proyectos, tareas, vistaActual])

  const eventPropGetter = useCallback((ev) => {
    const color = colorMap[ev.proyectoId] ?? '#94a3b8'
    if (ev.isProyecto) {
      return { style: { backgroundColor: color, color: '#fff', border: 'none', fontWeight: 600, fontSize: 11 } }
    }
    const hex = estadoHex(ev.tarea?.estado)
    return { style: { backgroundColor: hex, color: '#fff', border: 'none', borderRadius: 4, fontSize: 11 } }
  }, [colorMap])

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={{ height: 580 }}>
      <div style={{ height: '100%', padding: 8 }}>
        <Calendar
          localizer={localizer}
          events={events}
          defaultView="month"
          view={vistaActual}
          onView={setVistaActual}
          views={['month', 'week', 'day']}
          messages={CAL_MSG}
          culture="es"
          eventPropGetter={eventPropGetter}
          tooltipAccessor={(ev) => {
            if (ev.isProyecto) return ev.title
            const t = ev.tarea
            return [
              `${t.proyectoNombre ?? ''}: ${t.nombre}`,
              `Estado: ${t.estado || '—'}`,
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
