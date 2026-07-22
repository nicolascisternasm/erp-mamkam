export const formatCLP = (amount) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount || 0)

export const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export const formatRUT = (rut) => {
  if (!rut) return '—'
  return rut
}

export const generateId = (prefix = 'id') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export const generateNumero = (prefix, list) => {
  const year = new Date().getFullYear()
  const prefixYear = `${prefix}-${year}-`
  const maxNum = list
    .map((item) => item.numero || '')
    .filter((n) => n.startsWith(prefixYear))
    .map((n) => parseInt(n.replace(prefixYear, ''), 10))
    .filter((n) => !isNaN(n))
    .reduce((max, n) => Math.max(max, n), 0)
  const next = String(maxNum + 1).padStart(4, '0')
  return `${prefixYear}${next}`
}

export function addBusinessDays(date, days) {
  const result = new Date(date)
  let added = 0
  while (added < days) {
    result.setDate(result.getDate() + 1)
    const dow = result.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return result
}

export const STATUS_LABELS = {
  borrador:     'Borrador',
  enviada:      'Enviada',
  visita:       'Visita',
  aprobada:     'Aprobada',
  en_ejecucion: 'En ejecución',
  cerrada:      'Cerrada',
  rechazada:    'Rechazada',
  perdida:      'Perdida',
  creada:       'Creada',
  pagada:       'Pagada',
  entregada:    'Entregada',
  retirada:     'Retirada',
  activo:       'Activo',
  inactivo:     'Inactivo',
  conciliado:   'Conciliado',
  pendiente:    'Pendiente',
}

export const STATUS_COLORS = {
  borrador:     'bg-slate-100 text-slate-600',
  enviada:      'bg-blue-100 text-blue-700',
  visita:       'bg-purple-100 text-purple-700',
  aprobada:     'bg-emerald-100 text-emerald-700',
  en_ejecucion: 'bg-amber-100 text-amber-700',
  cerrada:      'bg-emerald-100 text-emerald-900',
  rechazada:    'bg-red-100 text-red-700',
  perdida:      'bg-red-200 text-red-900',
  creada:       'bg-amber-100 text-amber-700',
  pagada:       'bg-blue-100 text-blue-700',
  entregada:    'bg-violet-100 text-violet-700',
  retirada:     'bg-violet-100 text-violet-700',
  activo:       'bg-emerald-100 text-emerald-700',
  inactivo:     'bg-slate-100 text-slate-500',
  conciliado:   'bg-emerald-100 text-emerald-700',
  pendiente:    'bg-amber-100 text-amber-700',
}
