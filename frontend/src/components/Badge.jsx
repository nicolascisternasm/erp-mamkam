import { STATUS_LABELS, STATUS_COLORS } from '../utils/formatters'

export default function Badge({ status, className = '' }) {
  const label = STATUS_LABELS[status] || status
  const color = STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color} ${className}`}
    >
      {label}
    </span>
  )
}

export function Dot({ status }) {
  const colors = {
    aprobada: 'bg-emerald-500',
    activo: 'bg-emerald-500',
    pagada: 'bg-emerald-500',
    retirada: 'bg-violet-500',
    enviada: 'bg-blue-500',
    creada: 'bg-amber-500',
    borrador: 'bg-slate-400',
    rechazada: 'bg-red-500',
    inactivo: 'bg-slate-300',
  }
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[status] || 'bg-slate-400'}`}
    />
  )
}
