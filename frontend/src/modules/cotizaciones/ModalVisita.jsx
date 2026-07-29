import { useState, useEffect } from 'react'
import { X, CalendarDays, ClipboardList, Image as ImageIcon, Bot, Loader2 } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../auth/AuthContext'
import { useApp } from '../../context/AppContext'

const TABS = ['Datos', 'Checklist', 'Fotos', 'Resumen IA']
const TAB_ICONS = { Datos: CalendarDays, Checklist: ClipboardList, Fotos: ImageIcon, 'Resumen IA': Bot }
const PRODUCTOS_OPCIONES = ['Toldo Vela', 'Pasto Sintético', 'Caucho Continuo']

const ESTADO_STYLES = {
  completada: 'bg-emerald-100 text-emerald-700',
  en_curso:   'bg-amber-100 text-amber-700',
  realizada:  'bg-violet-100 text-violet-700',
}

export default function ModalVisita({ cot, onClose }) {
  const { user }         = useAuth()
  const { trabajadores } = useApp()

  const [tab,     setTab]     = useState('Datos')
  const [visita,  setVisita]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  /* form state */
  const [fechaAgendada,      setFechaAgendada]      = useState('')
  const [responsable,        setResponsable]        = useState(user?.nombre || '')
  const [instalador,         setInstalador]         = useState('')
  const [notasPrevias,       setNotasPrevias]       = useState('')
  const [productosChecked,   setProductosChecked]   = useState([])

  const trabajadoresActivos = (trabajadores || []).filter(t => t.estado === 'activo')

  useEffect(() => {
    async function fetchVisita() {
      setLoading(true)
      const { data } = await supabase
        .from('visitas')
        .select('*')
        .eq('cotizacion_id', cot.id)
        .maybeSingle()
      setVisita(data ?? null)
      setLoading(false)
    }
    void fetchVisita()
  }, [cot.id])

  function toggleProducto(p) {
    setProductosChecked(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  async function handleCrear() {
    setGuardando(true)
    const { data, error } = await supabase
      .from('visitas')
      .insert({
        cotizacion_id:     cot.id,
        empresa_id:        user?.empresa_id,
        cliente:           cot.cliente,
        telefono_cliente:  cot.telefono  || null,
        email_cliente:     cot.email     || null,
        direccion:         cot.direccion || null,
        comuna:            cot.comuna    || null,
        nombre_proyecto:   cot.glosa     || null,
        productos:         productosChecked,
        fecha_agendada:    fechaAgendada || null,
        responsable_visita: responsable  || null,
        instalador_nombre: instalador    || null,
        notas_previas:     notasPrevias  || null,
        vendedor_id:       user?.id,
        vendedor_nombre:   user?.nombre  || null,
        estado:            'agendada',
      })
      .select()
      .single()
    if (!error && data) setVisita(data)
    setGuardando(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="font-bold text-slate-900 text-lg leading-tight">
              Visita — {cot.numero}
            </h2>
            {loading ? (
              <p className="text-xs text-slate-400 mt-0.5">Cargando...</p>
            ) : visita ? (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500">{visita.cliente}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_STYLES[visita.estado] || 'bg-blue-100 text-blue-700'}`}>
                  {visita.estado}
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-0.5">Sin visita asociada</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-0.5 px-6 pt-3 border-b border-slate-100 shrink-0 overflow-x-auto">
          {TABS.map(t => {
            const Icon = TAB_ICONS[t]
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors whitespace-nowrap border-b-2 -mb-px
                  ${tab === t
                    ? 'text-indigo-600 border-indigo-500 bg-indigo-50/60'
                    : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t}
              </button>
            )
          })}
        </div>

        {/* ── Contenido ── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : (
            <>
              {/* TAB DATOS */}
              {tab === 'Datos' && (
                visita ? <TabDatosLectura visita={visita} /> : <TabDatosCrear
                  fechaAgendada={fechaAgendada}       setFechaAgendada={setFechaAgendada}
                  responsable={responsable}           setResponsable={setResponsable}
                  instalador={instalador}             setInstalador={setInstalador}
                  notasPrevias={notasPrevias}         setNotasPrevias={setNotasPrevias}
                  productosChecked={productosChecked} toggleProducto={toggleProducto}
                  trabajadores={trabajadoresActivos}
                  onCancelar={onClose}
                  onCrear={handleCrear}
                  guardando={guardando}
                />
              )}

              {/* OTRAS TABS */}
              {tab !== 'Datos' && (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400 py-12">
                  {(() => { const Icon = TAB_ICONS[tab]; return <Icon className="w-8 h-8 mb-3 text-slate-300" /> })()}
                  <p className="text-sm">Próximamente...</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Sub-componente: datos en modo lectura ── */
function TabDatosLectura({ visita }) {
  return (
    <div className="px-6 py-5 space-y-1 max-w-2xl">
      <Row label="Estado"            value={visita.estado} />
      <Row label="Cliente"           value={visita.cliente} />
      <Row label="Dirección"         value={visita.direccion ?? '—'} />
      <Row label="Comuna"            value={visita.comuna ?? '—'} />
      <Row label="Teléfono"          value={visita.telefono_cliente ?? '—'} />
      <Row label="Proyecto"          value={visita.nombre_proyecto ?? '—'} />
      <Row label="Fecha agendada"    value={visita.fecha_agendada ?? '—'} />
      <Row label="Responsable"       value={visita.responsable_visita ?? '—'} />
      <Row label="Instalador"        value={visita.instalador_nombre ?? '—'} />
      <Row label="Productos"         value={Array.isArray(visita.productos) && visita.productos.length ? visita.productos.join(', ') : '—'} />
      {visita.notas_previas && (
        <div className="pt-3">
          <p className="text-xs font-medium text-slate-400 mb-1">Notas previas</p>
          <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 leading-relaxed">{visita.notas_previas}</p>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
      <span className="text-slate-400 text-xs font-medium min-w-[150px] shrink-0 mt-0.5">{label}</span>
      <span className="text-slate-800 text-sm">{value}</span>
    </div>
  )
}

/* ── Sub-componente: formulario de creación ── */
function TabDatosCrear({
  fechaAgendada, setFechaAgendada,
  responsable, setResponsable,
  instalador, setInstalador,
  notasPrevias, setNotasPrevias,
  productosChecked, toggleProducto,
  trabajadores,
  onCancelar, onCrear, guardando,
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Fecha agendada */}
        <Field label="Fecha agendada">
          <input
            type="date"
            value={fechaAgendada}
            onChange={e => setFechaAgendada(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </Field>

        {/* Responsable */}
        <Field label="Responsable de visita">
          <input
            type="text"
            value={responsable}
            onChange={e => setResponsable(e.target.value)}
            placeholder="Nombre del responsable"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </Field>

        {/* Instalador */}
        <Field label="Instalador">
          <select
            value={instalador}
            onChange={e => setInstalador(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          >
            <option value="">— Sin asignar —</option>
            {trabajadores.map(t => (
              <option key={t.id} value={t.nombre}>{t.nombre}</option>
            ))}
          </select>
        </Field>

        {/* Productos */}
        <Field label="Productos">
          <div className="flex flex-col gap-2">
            {PRODUCTOS_OPCIONES.map(p => (
              <label key={p} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={productosChecked.includes(p)}
                  onChange={() => toggleProducto(p)}
                  className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                />
                <span className="text-sm text-slate-700">{p}</span>
              </label>
            ))}
          </div>
        </Field>

        {/* Notas previas */}
        <Field label="Notas previas">
          <textarea
            value={notasPrevias}
            onChange={e => setNotasPrevias(e.target.value)}
            rows={3}
            placeholder="Instrucciones, observaciones, etc."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
        </Field>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0 bg-slate-50/70">
        <button
          onClick={onCancelar}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={onCrear}
          disabled={guardando}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60"
        >
          {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
          Crear visita
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 items-start">
      <label className="text-xs font-medium text-slate-500 pt-2.5">{label}</label>
      <div>{children}</div>
    </div>
  )
}
