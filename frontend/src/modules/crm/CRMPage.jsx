import { useState, useEffect, useMemo } from 'react'
import { apiClient } from '../../services/apiClient'
import { formatDate } from '../../utils/formatters'
import Toast from '../../components/Toast'
import {
  Users2, Filter, X, Mail, Phone, RefreshCw, Target, Pencil,
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

/* ── Página principal ───────────────────────────────────────── */

export default function CRMPage() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filtro, setFiltro]     = useState('todos')
  const [sel, setSel]           = useState(null)   // cliente seleccionado (panel lateral)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState(null)

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

  const filtrados = useMemo(
    () => (filtro === 'todos' ? clientes : clientes.filter((c) => c.estado === filtro)),
    [clientes, filtro],
  )

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

  const conteo = (key) =>
    key === 'todos' ? clientes.length : clientes.filter((c) => c.estado === key).length

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

      {/* Filtros por estado */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-slate-400" />
        {[{ key: 'todos', label: 'Todos' }, ...ESTADOS].map((e) => {
          const active = filtro === e.key
          return (
            <button
              key={e.key}
              onClick={() => setFiltro(e.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {e.label}
              <span className={`text-xs px-1.5 rounded-full ${active ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-200 text-slate-500'}`}>
                {conteo(e.key)}
              </span>
            </button>
          )
        })}
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
              {filtro === 'todos'
                ? 'Los leads de Meta y los clientes manuales aparecerán aquí.'
                : `No hay clientes en estado "${ESTADO_META[filtro]?.label ?? filtro}".`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="table-th">Nombre</th>
                  <th className="table-th">Email</th>
                  <th className="table-th">Teléfono</th>
                  <th className="table-th">Fuente</th>
                  <th className="table-th">Estado</th>
                  <th className="table-th">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtrados.map((c) => {
                  const est = ESTADO_META[c.estado] || { label: c.estado, color: 'bg-slate-100 text-slate-600' }
                  const fte = fuenteMeta(c.fuente)
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSel(c)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${sel?.id === c.id ? 'bg-indigo-50/50' : ''}`}
                    >
                      <td className="table-td text-sm font-medium text-slate-800">{c.nombre}</td>
                      <td className="table-td text-xs text-slate-500">{c.email || '—'}</td>
                      <td className="table-td text-xs text-slate-500">{c.telefono || '—'}</td>
                      <td className="table-td text-xs text-slate-600">
                        <span title={fte.label}>{fte.icon} {fte.label}</span>
                      </td>
                      <td className="table-td">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${est.color}`}>
                          {est.label}
                        </span>
                      </td>
                      <td className="table-td text-xs text-slate-400">{formatDate(c.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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
                <p>Creado: {formatDate(sel.createdAt)}</p>
                {sel.updatedAt && <p>Actualizado: {formatDate(sel.updatedAt)}</p>}
              </div>
            </div>
          </aside>
        </>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
