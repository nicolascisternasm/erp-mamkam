import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../services/supabase'
import Toast from '../../components/Toast'
import {
  ClipboardList, RefreshCw, X,
  Image as ImageIcon, FileText, Bot, MapPin,
  Phone, Mail, User, Building2, Mic,
  ChevronDown, ChevronUp, Copy, Check, Play,
  Eye, Pencil, Trash2,
} from 'lucide-react'

// ── Constantes ────────────────────────────────────────────────────────────────

const ESTADOS = [
  { value: 'todas',      label: 'Todas' },
  { value: 'agendada',   label: 'Agendada' },
  { value: 'en_curso',   label: 'En curso' },
  { value: 'realizada',  label: 'Realizada' },
  { value: 'completada', label: 'Completada' },
  { value: 'programada', label: 'Programada' },
]

const ESTADO_LABEL = {
  agendada:   'Agendada',
  en_curso:   'En curso',
  realizada:  'Realizada',
  completada: 'Completada',
  programada: 'Programada',
}

const ESTADO_COLORS = {
  agendada:   'bg-blue-100 text-blue-700',
  en_curso:   'bg-amber-100 text-amber-700',
  realizada:  'bg-violet-100 text-violet-700',
  completada: 'bg-emerald-100 text-emerald-700',
  programada: 'bg-slate-100 text-slate-600',
}

const PRODUCT_LABELS = {
  toldo_vela:      'Toldo vela',
  pasto_sintetico: 'Pasto sintético',
  caucho_continuo: 'Caucho continuo',
  multiple:        'Múltiple',
}

const PRODUCT_COLORS = {
  toldo_vela:      'bg-sky-100 text-sky-700 border-sky-200',
  pasto_sintetico: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  caucho_continuo: 'bg-orange-100 text-orange-700 border-orange-200',
  multiple:        'bg-purple-100 text-purple-700 border-purple-200',
}

const TIPO_CLIENTE_LABEL = {
  particular:   'Particular',
  constructora: 'Constructora',
  colegio:      'Colegio',
  jardin:       'Jardín infantil',
  empresa:      'Empresa',
  conjunto:     'Conjunto residencial',
  otro:         'Otro',
}

const TIPO_ESPACIO_LABEL = {
  terraza:         'Terraza',
  patio:           'Patio',
  jardin:          'Jardín',
  parque_infantil: 'Parque infantil',
  cancha:          'Cancha deportiva',
  piscina:         'Zona piscina',
  comercial:       'Local comercial',
  otro:            'Otro',
}

const MODAL_TABS = ['Datos', 'Checklist', 'Multimedia', 'Resumen IA']

const ESTADOS_EDITAR = [
  { value: 'agendada',   label: 'Agendada' },
  { value: 'en_curso',   label: 'En curso' },
  { value: 'realizada',  label: 'Realizada' },
  { value: 'completada', label: 'Completada' },
  { value: 'programada', label: 'Programada' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateInputValue(d) {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function EstadoBadge({ estado }) {
  const cls = ESTADO_COLORS[estado] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {ESTADO_LABEL[estado] ?? estado}
    </span>
  )
}

function ProductChip({ product }) {
  const cls = PRODUCT_COLORS[product] ?? 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {PRODUCT_LABELS[product] ?? product}
    </span>
  )
}

function formatFechaCorta(d) {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function InfoRow({ label, value, children }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-slate-400 text-xs font-medium min-w-[150px] shrink-0 mt-0.5">{label}</span>
      <span className="text-slate-800 text-sm font-medium flex-1">{children ?? value ?? '—'}</span>
    </div>
  )
}

function SectionHeader({ icon: Icon, title, badge }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon className="w-4 h-4 text-indigo-500 shrink-0" />}
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</h3>
      {badge !== undefined && (
        <span className="ml-auto text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">{badge}</span>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-12 bg-slate-100 rounded-lg" />
      ))}
    </div>
  )
}

function MarkdownText({ text }) {
  if (!text) return null
  return (
    <div className="space-y-0.5 text-sm leading-relaxed">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('## '))
          return <p key={i} className="font-bold text-slate-800 text-sm mt-3 first:mt-0">{line.slice(3)}</p>
        if (line.startsWith('# '))
          return <p key={i} className="font-bold text-slate-900 text-base mt-3 first:mt-0">{line.slice(2)}</p>
        if (line.startsWith('* ') || line.startsWith('- '))
          return (
            <div key={i} className="flex items-start gap-2 pl-1">
              <span className="text-indigo-400 shrink-0 mt-0.5">•</span>
              <span className="text-slate-700">{line.slice(2)}</span>
            </div>
          )
        if (!line.trim())
          return <div key={i} className="h-1.5" />
        return <p key={i} className="text-slate-700">{line}</p>
      })}
    </div>
  )
}

// ── Modal de detalle ──────────────────────────────────────────────────────────

function DetalleModal({ visita, onClose }) {
  const [tab,       setTab]       = useState('Datos')
  const [checklist, setChecklist] = useState([])
  const [fotos,     setFotos]     = useState([])
  const [audios,    setAudios]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [copied,    setCopied]    = useState(false)
  const [expanded,  setExpanded]  = useState({})

  const fetchDetalle = useCallback(async () => {
    if (!visita) return
    setLoading(true)
    const [clRes, fRes, aRes] = await Promise.all([
      supabase.from('visita_checklist').select('*').eq('visita_id', visita.id).order('created_at', { ascending: true }),
      supabase.from('visita_fotos').select('*').eq('visita_id', visita.id).order('created_at', { ascending: false }),
      supabase.from('visita_audios').select('*').eq('visita_id', visita.id).order('grabado_en', { ascending: true }),
    ])
    setChecklist(clRes.data ?? [])
    setFotos(fRes.data ?? [])
    setAudios(aRes.data ?? [])
    setLoading(false)
  }, [visita])

  useEffect(() => { void fetchDetalle() }, [fetchDetalle])

  if (!visita) return null

  // Agrupar checklist por sección
  const checklistBySec = checklist.reduce((acc, item) => {
    const sec = item.seccion || 'General'
    if (!acc[sec]) acc[sec] = []
    acc[sec].push(item)
    return acc
  }, {})
  const respondidas = checklist.filter(c => c.respuesta?.trim()).length

  const handleCopy = () => {
    if (!visita.resumen_ia) return
    navigator.clipboard.writeText(visita.resumen_ia)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="font-bold text-slate-900 text-lg leading-tight">{visita.cliente}</h2>
            <div className="flex items-center flex-wrap gap-2 mt-1">
              {visita.direccion && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {visita.direccion}{visita.comuna ? `, ${visita.comuna}` : ''}
                </span>
              )}
              <EstadoBadge estado={visita.estado} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-lg hover:bg-slate-100 shrink-0 ml-4"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 px-6 pt-3 border-b border-slate-100 shrink-0 overflow-x-auto">
          {MODAL_TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors whitespace-nowrap border-b-2 -mb-px ${
                tab === t
                  ? 'text-indigo-600 border-indigo-500 bg-indigo-50/60'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">

          {/* ── TAB: DATOS ────────────────────────────────────────────── */}
          {tab === 'Datos' && (
            <div className="space-y-5">
              {/* Sección 1 — Datos generales */}
              <section>
                <SectionHeader icon={ClipboardList} title="Datos generales" />
                <div className="card p-4">
                  <InfoRow label="Estado"><EstadoBadge estado={visita.estado} /></InfoRow>
                  <InfoRow label="Fecha agendada" value={formatFechaCorta(visita.fecha_agendada)} />
                  <InfoRow label="Fecha realizada" value={formatFechaCorta(visita.fecha_realizada)} />
                  <InfoRow label="Vendedor responsable" value={visita.vendedor_nombre ?? '—'} />
                  <InfoRow label="Instalador asignado" value={visita.instalador_nombre ?? '—'} />
                  {visita.productos?.length > 0 && (
                    <InfoRow label="Productos">
                      <div className="flex flex-wrap gap-1.5">
                        {visita.productos.map(p => <ProductChip key={p} product={p} />)}
                      </div>
                    </InfoRow>
                  )}
                </div>
              </section>

              {/* Sección 2 — Cliente */}
              <section>
                <SectionHeader icon={User} title="Información del cliente" />
                <div className="card p-4">
                  <InfoRow label="Nombre" value={visita.cliente} />
                  <InfoRow label="Tipo de cliente" value={TIPO_CLIENTE_LABEL[visita.tipo_cliente] ?? visita.tipo_cliente ?? '—'} />
                  <InfoRow label="Teléfono">
                    {visita.telefono_cliente
                      ? <a href={`tel:${visita.telefono_cliente}`} className="text-indigo-600 hover:underline flex items-center gap-1"><Phone className="w-3 h-3" />{visita.telefono_cliente}</a>
                      : '—'}
                  </InfoRow>
                  <InfoRow label="Email">
                    {visita.email_cliente
                      ? <a href={`mailto:${visita.email_cliente}`} className="text-indigo-600 hover:underline flex items-center gap-1"><Mail className="w-3 h-3" />{visita.email_cliente}</a>
                      : '—'}
                  </InfoRow>
                  <InfoRow label="Dirección" value={visita.direccion ?? '—'} />
                  <InfoRow label="Comuna" value={visita.comuna ?? '—'} />
                </div>
              </section>

              {/* Sección 3 — Proyecto */}
              <section>
                <SectionHeader icon={Building2} title="Información del proyecto" />
                <div className="card p-4">
                  <InfoRow label="Nombre del proyecto" value={visita.nombre_proyecto ?? '—'} />
                  <InfoRow label="Tipo de espacio" value={TIPO_ESPACIO_LABEL[visita.tipo_espacio] ?? visita.tipo_espacio ?? '—'} />
                  <InfoRow label="Inicio estimado" value={formatFechaCorta(visita.fecha_inicio_estimada)} />
                  <InfoRow label="Entrega estimada" value={formatFechaCorta(visita.fecha_entrega_estimada)} />
                  <InfoRow label="Responsable de visita" value={visita.responsable_visita ?? '—'} />
                  {visita.notas_previas && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Notas previas</p>
                      <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {visita.notas_previas}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* ── TAB: CHECKLIST ────────────────────────────────────────── */}
          {tab === 'Checklist' && (
            <section>
              <SectionHeader
                icon={FileText}
                title="Checklist respondido"
                badge={loading ? null : `${respondidas}/${checklist.length} respondidas`}
              />
              {loading ? (
                <Skeleton />
              ) : checklist.length === 0 ? (
                <div className="card p-10 text-center">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin respuestas registradas.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {Object.entries(checklistBySec).map(([seccion, items]) => (
                    <div key={seccion}>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">{seccion}</p>
                      <div className="space-y-2">
                        {items.map(item => (
                          <div key={item.id} className="card p-3.5">
                            <p className="text-xs text-slate-400 mb-1 font-medium">{item.pregunta}</p>
                            <p className={`text-sm font-medium ${item.respuesta?.trim() ? 'text-slate-800' : 'text-slate-400 italic'}`}>
                              {item.respuesta?.trim() || 'Sin respuesta'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── TAB: MULTIMEDIA ───────────────────────────────────────── */}
          {tab === 'Multimedia' && (
            <div className="space-y-6">
              {/* Sección 5 — Audios */}
              <section>
                <SectionHeader
                  icon={Mic}
                  title="Audios y transcripciones"
                  badge={loading ? null : audios.length}
                />
                {loading ? (
                  <Skeleton />
                ) : audios.length === 0 ? (
                  <div className="card p-8 text-center">
                    <Mic className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Sin audios registrados.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {audios.map(a => (
                      <div key={a.id} className="card p-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                          >
                            <Play className="w-3.5 h-3.5" /> Reproducir
                          </a>
                          {a.duracion_segundos != null && (
                            <span className="text-xs text-slate-400 font-medium">{a.duracion_segundos}s</span>
                          )}
                          {a.descripcion && (
                            <span className="text-xs text-slate-600 flex-1 min-w-0 truncate">{a.descripcion}</span>
                          )}
                          {(a.grabado_en || a.subido_en) && (
                            <span className="text-xs text-slate-400 ml-auto shrink-0">
                              {formatFechaCorta(a.grabado_en ?? a.subido_en)}
                            </span>
                          )}
                        </div>
                        {a.transcripcion && (
                          <div className="mt-3">
                            <button
                              onClick={() => setExpanded(p => ({ ...p, [a.id]: !p[a.id] }))}
                              className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                            >
                              {expanded[a.id]
                                ? <ChevronUp className="w-3.5 h-3.5" />
                                : <ChevronDown className="w-3.5 h-3.5" />}
                              {expanded[a.id] ? 'Ocultar transcripción' : 'Ver transcripción'}
                            </button>
                            {expanded[a.id] && (
                              <div className="mt-2 bg-slate-50 rounded-lg p-3 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap border border-slate-100">
                                {a.transcripcion}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Sección 6 — Fotos */}
              <section>
                <SectionHeader
                  icon={ImageIcon}
                  title="Fotos"
                  badge={loading ? null : fotos.length}
                />
                {loading ? (
                  <Skeleton />
                ) : fotos.length === 0 ? (
                  <div className="card p-8 text-center">
                    <ImageIcon className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Sin fotos registradas.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {fotos.map(f => (
                      <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="group">
                        <div className="aspect-square rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                          <img
                            src={f.url}
                            alt={f.descripcion || 'foto visita'}
                            className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                          />
                        </div>
                        {f.descripcion && (
                          <p className="text-xs text-slate-500 mt-1 truncate px-0.5">{f.descripcion}</p>
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ── TAB: RESUMEN IA ───────────────────────────────────────── */}
          {tab === 'Resumen IA' && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Bot className="w-4 h-4 text-indigo-500 shrink-0" />
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Resumen IA</h3>
                {visita.resumen_ia && (
                  <button
                    onClick={handleCopy}
                    className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {copied
                      ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copiado</>
                      : <><Copy className="w-3.5 h-3.5" /> Copiar resumen</>}
                  </button>
                )}
              </div>
              {visita.resumen_ia ? (
                <div className="card p-5 bg-indigo-50 border border-indigo-100">
                  <MarkdownText text={visita.resumen_ia} />
                </div>
              ) : (
                <div className="card p-10 text-center">
                  <Bot className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin resumen generado para esta visita.</p>
                </div>
              )}
            </section>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Modal de edición ─────────────────────────────────────────────────────────

function EditarModal({ visita, onClose, onSaved }) {
  const [form, setForm] = useState({
    estado:                visita.estado                ?? '',
    cliente:               visita.cliente               ?? '',
    telefono_cliente:      visita.telefono_cliente      ?? '',
    email_cliente:         visita.email_cliente         ?? '',
    direccion:             visita.direccion             ?? '',
    comuna:                visita.comuna                ?? '',
    nombre_proyecto:       visita.nombre_proyecto       ?? '',
    tipo_espacio:          visita.tipo_espacio          ?? '',
    fecha_agendada:        toDateInputValue(visita.fecha_agendada),
    fecha_inicio_estimada: toDateInputValue(visita.fecha_inicio_estimada),
    fecha_entrega_estimada:toDateInputValue(visita.fecha_entrega_estimada),
    responsable_visita:    visita.responsable_visita    ?? '',
    instalador_nombre:     visita.instalador_nombre     ?? '',
    notas_previas:         visita.notas_previas         ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      ...form,
      fecha_agendada:         form.fecha_agendada         || null,
      fecha_inicio_estimada:  form.fecha_inicio_estimada  || null,
      fecha_entrega_estimada: form.fecha_entrega_estimada || null,
    }
    const { data, error: err } = await supabase
      .from('visitas')
      .update(payload)
      .eq('id', visita.id)
      .select()
      .single()
    if (err) { setError(err.message); setSaving(false); return }
    onSaved(data)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <form
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-bold text-slate-900 text-lg">Editar visita</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Campos */}
        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0 space-y-5">
          {error && (
            <div className="text-red-600 text-sm bg-red-50 rounded-lg px-4 py-2">{error}</div>
          )}

          {/* Estado */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Estado</label>
            <select value={form.estado} onChange={set('estado')} className="input-base w-full">
              {ESTADOS_EDITAR.map(e => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Cliente</label>
            <div className="space-y-2">
              <input className="input-base w-full" placeholder="Nombre del cliente" value={form.cliente} onChange={set('cliente')} />
              <input className="input-base w-full" placeholder="Teléfono" value={form.telefono_cliente} onChange={set('telefono_cliente')} />
              <input className="input-base w-full" placeholder="Email" type="email" value={form.email_cliente} onChange={set('email_cliente')} />
            </div>
          </div>

          {/* Ubicación */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Ubicación</label>
            <div className="space-y-2">
              <input className="input-base w-full" placeholder="Dirección" value={form.direccion} onChange={set('direccion')} />
              <input className="input-base w-full" placeholder="Comuna" value={form.comuna} onChange={set('comuna')} />
            </div>
          </div>

          {/* Proyecto */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Proyecto</label>
            <div className="space-y-2">
              <input className="input-base w-full" placeholder="Nombre del proyecto" value={form.nombre_proyecto} onChange={set('nombre_proyecto')} />
              <select value={form.tipo_espacio} onChange={set('tipo_espacio')} className="input-base w-full">
                <option value="">Tipo de espacio</option>
                {Object.entries(TIPO_ESPACIO_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fechas */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Fechas</label>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 min-w-[130px]">Fecha agendada</span>
                <input type="date" className="input-base flex-1" value={form.fecha_agendada} onChange={set('fecha_agendada')} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 min-w-[130px]">Inicio estimado</span>
                <input type="date" className="input-base flex-1" value={form.fecha_inicio_estimada} onChange={set('fecha_inicio_estimada')} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 min-w-[130px]">Entrega estimada</span>
                <input type="date" className="input-base flex-1" value={form.fecha_entrega_estimada} onChange={set('fecha_entrega_estimada')} />
              </div>
            </div>
          </div>

          {/* Equipo */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Equipo</label>
            <div className="space-y-2">
              <input className="input-base w-full" placeholder="Responsable de visita" value={form.responsable_visita} onChange={set('responsable_visita')} />
              <input className="input-base w-full" placeholder="Instalador asignado" value={form.instalador_nombre} onChange={set('instalador_nombre')} />
            </div>
          </div>

          {/* Notas previas */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Notas previas</label>
            <textarea
              className="input-base w-full resize-none"
              rows={4}
              placeholder="Notas o contexto previo…"
              value={form.notas_previas}
              onChange={set('notas_previas')}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancelar</button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60"
          >
            {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Modal de confirmación eliminar ────────────────────────────────────────────

function ConfirmarEliminarModal({ visita, onClose, onDeleted, showToast }) {
  const [deleting, setDeleting] = useState(false)
  const [error,    setError]    = useState(null)

  const handleEliminar = async () => {
    setDeleting(true)
    setError(null)

    // Eliminar tablas relacionadas primero para evitar violación de FK
    const [clRes, fRes, aRes] = await Promise.all([
      supabase.from('visita_checklist').delete().eq('visita_id', visita.id),
      supabase.from('visita_fotos').delete().eq('visita_id', visita.id),
      supabase.from('visita_audios').delete().eq('visita_id', visita.id),
    ])
    const childErrors = [clRes.error, fRes.error, aRes.error].filter(Boolean)
    if (childErrors.length) {
      console.warn('[eliminar visita] errores en tablas relacionadas:', childErrors.map(e => e.message))
    }

    // Eliminar la visita principal
    const { error: errVisita } = await supabase.from('visitas').delete().eq('id', visita.id)
    console.log('[DELETE visita] id:', visita.id)
    console.log('[DELETE visita] error:', errVisita)
    console.log('[DELETE visita] supabase client:', supabase)
    const err = errVisita
    if (err) {
      setError(err.message)
      showToast('error', `No se pudo eliminar: ${err.message}`)
      setDeleting(false)
      return
    }
    showToast('success', `Visita de ${visita.cliente} eliminada correctamente`)
    onDeleted(visita.id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Eliminar visita</h3>
            <p className="text-sm text-slate-600 mt-1">
              ¿Eliminar visita de <span className="font-semibold">{visita.cliente}</span>?{' '}
              Esta acción no se puede deshacer.
            </p>
          </div>
        </div>
        {error && (
          <div className="text-red-600 text-sm bg-red-50 rounded-lg px-4 py-2 mb-4">{error}</div>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={deleting}
            className="btn-secondary text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleEliminar}
            disabled={deleting}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {deleting && <RefreshCw className="w-4 h-4 animate-spin" />}
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function VisitasPage() {
  const { user } = useAuth()
  const { trabajadores } = useApp()
  const empresaId = user?.empresa_id ?? null

  const [visitas,        setVisitas]        = useState([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const [filtroEstado,   setFiltroEstado]   = useState('todas')
  const [filtroVendedor, setFiltroVendedor] = useState('todos')
  const [selected,       setSelected]       = useState(null)
  const [editando,       setEditando]       = useState(null)
  const [eliminando,     setEliminando]     = useState(null)
  const [toast,          setToast]          = useState(null)
  const isMutating = useRef(false)

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4500) }

  const fetchVisitas = useCallback(async () => {
    // Si hay una mutación local en curso, ignorar el re-fetch automático
    if (isMutating.current) {
      console.log('[visitas] re-fetch bloqueado (mutación local activa)')
      isMutating.current = false
      return
    }
    if (!empresaId) {
      console.warn('[visitas] empresaId es null — usuario sin empresa asignada:', user)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('visitas')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
    console.log('[visitas] SELECT → empresaId:', empresaId, '| registros:', data?.length ?? 0, '| error:', err)
    if (err) { setError(err.message); setLoading(false); return }
    setVisitas(data ?? [])
    setLoading(false)
  }, [empresaId])

  useEffect(() => { void fetchVisitas() }, [fetchVisitas])

  // vendedor_id en visitas = usuario_id del trabajador (ERP user ID del JWT)
  // Se indexa por ambas claves para cubrir cualquier variación
  const vendedoresMap = {}
  for (const t of trabajadores) {
    vendedoresMap[t.id] = t.nombre
    if (t.usuarioId) vendedoresMap[t.usuarioId] = t.nombre
  }

  const visitasEnriquecidas = visitas.map(v => ({
    ...v,
    vendedor_nombre: vendedoresMap[v.vendedor_id] ?? v.vendedor_id ?? '—',
  }))

  // Filtros
  const filtered = visitasEnriquecidas.filter(v => {
    const pasaEstado    = filtroEstado    === 'todas' || v.estado      === filtroEstado
    const pasaVendedor  = filtroVendedor  === 'todos' || v.vendedor_id === filtroVendedor
    return pasaEstado && pasaVendedor
  })
  console.log('[visitas filtradas]', filtered.length, 'de', visitas.length,
    '| filtroEstado:', filtroEstado, '| filtroVendedor:', filtroVendedor)

  const handleGuardarEdicion = updated => {
    isMutating.current = true
    setVisitas(vs => vs.map(v => v.id === updated.id ? updated : v))
  }
  const handleEliminar = id => {
    isMutating.current = true
    setVisitas(vs => vs.filter(v => v.id !== id))
  }

  // Vendedores únicos para el filtro
  const vendedores = [
    ...new Map(
      visitas.map(v => [v.vendedor_id, vendedoresMap[v.vendedor_id] ?? v.vendedor_id])
    ).entries()
  ]

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Visitas comerciales</h2>
          <p className="text-sm text-slate-500 mt-0.5">{visitas.length} visitas registradas</p>
        </div>
        <button
          onClick={() => void fetchVisitas()}
          className="btn-secondary flex items-center gap-2 text-sm"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 flex-wrap">
          {ESTADOS.map(e => (
            <button
              key={e.value}
              onClick={() => setFiltroEstado(e.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filtroEstado === e.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
        {vendedores.length > 0 && (
          <select
            value={filtroVendedor}
            onChange={e => setFiltroVendedor(e.target.value)}
            className="input-base text-sm max-w-[200px]"
          >
            <option value="todos">Todos los vendedores</option>
            {vendedores.map(([id, nombre]) => (
              <option key={id} value={id}>{nombre}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="card p-10 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : error ? (
        <div className="card p-6 text-center text-red-600 text-sm">Error: {error}</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-slate-400 text-sm">
          No hay visitas que coincidan con los filtros seleccionados.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="table-th">Cliente</th>
                <th className="table-th hidden sm:table-cell">Vendedor</th>
                <th className="table-th hidden lg:table-cell">Dirección / Comuna</th>
                <th className="table-th hidden xl:table-cell">Responsable</th>
                <th className="table-th hidden xl:table-cell">Instalador</th>
                <th className="table-th">Estado</th>
                <th className="table-th hidden md:table-cell">Fecha agendada</th>
                <th className="table-th hidden lg:table-cell">Productos</th>
                <th className="table-th">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(v => (
                <tr
                  key={v.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <td className="table-td">
                    <div className="font-medium text-slate-900">{v.cliente}</div>
                    {v.nombre_proyecto && (
                      <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[180px]">{v.nombre_proyecto}</div>
                    )}
                  </td>
                  <td className="table-td text-slate-600 hidden sm:table-cell">{v.vendedor_nombre}</td>
                  <td className="table-td hidden lg:table-cell">
                    <div className="text-slate-700 text-xs leading-snug">{v.direccion || '—'}</div>
                    {v.comuna && <div className="text-slate-400 text-xs">{v.comuna}</div>}
                  </td>
                  <td className="table-td text-slate-600 text-xs hidden xl:table-cell">{v.responsable_visita || '—'}</td>
                  <td className="table-td text-slate-600 text-xs hidden xl:table-cell">{v.instalador_nombre || '—'}</td>
                  <td className="table-td"><EstadoBadge estado={v.estado} /></td>
                  <td className="table-td text-slate-500 text-xs hidden md:table-cell">{formatFechaCorta(v.fecha_agendada)}</td>
                  <td className="table-td hidden lg:table-cell">
                    {v.productos?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {v.productos.map(p => <ProductChip key={p} product={p} />)}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="table-td">
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => setSelected(v)}
                        title="Ver detalle"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditando(v)}
                        title="Editar visita"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEliminando(v)}
                        title="Eliminar visita"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <DetalleModal visita={selected} onClose={() => setSelected(null)} />
      )}
      {editando && (
        <EditarModal
          visita={editando}
          onClose={() => setEditando(null)}
          onSaved={updated => { handleGuardarEdicion(updated); setEditando(null) }}
        />
      )}
      {eliminando && (
        <ConfirmarEliminarModal
          visita={eliminando}
          onClose={() => setEliminando(null)}
          onDeleted={id => { handleEliminar(id); setEliminando(null) }}
          showToast={showToast}
        />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
