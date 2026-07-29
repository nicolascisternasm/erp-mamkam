import { useState, useEffect, useRef } from 'react'
import { X, CalendarDays, ClipboardList, Image as ImageIcon, Bot, Loader2, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../auth/AuthContext'
import { useApp } from '../../context/AppContext'

const TABS = ['Datos', 'Checklist', 'Fotos', 'Resumen IA']
const TAB_ICONS = { Datos: CalendarDays, Checklist: ClipboardList, Fotos: ImageIcon, 'Resumen IA': Bot }

const PRODUCTOS_OPCIONES = [
  { id: 'toldo_vela',       label: 'Toldo Vela' },
  { id: 'pasto_sintetico',  label: 'Pasto Sintético' },
  { id: 'caucho_continuo',  label: 'Caucho Continuo' },
]

const ESTADO_STYLES = {
  completada: 'bg-emerald-100 text-emerald-700',
  en_curso:   'bg-amber-100 text-amber-700',
  realizada:  'bg-violet-100 text-violet-700',
}

const LABEL_TO_SNAKE = {
  'Toldo Vela':      'toldo_vela',
  'Pasto Sintético': 'pasto_sintetico',
  'Caucho Continuo': 'caucho_continuo',
}

const SNAKE_TO_LABEL = {
  'toldo_vela':      'Toldo Vela',
  'pasto_sintetico': 'Pasto Sintético',
  'caucho_continuo': 'Caucho Continuo',
}

const GRUPO_STYLES = {
  General:           { header: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400' },
  'Toldo Vela':      { header: 'bg-amber-50 text-amber-800',     dot: 'bg-amber-400' },
  'Pasto Sintético': { header: 'bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500' },
  'Caucho Continuo': { header: 'bg-red-50 text-red-800',         dot: 'bg-red-500' },
}

/* ═══════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════ */
export default function ModalVisita({ cot, onClose }) {
  const { user }         = useAuth()
  const { trabajadores } = useApp()

  const [tab,      setTab]      = useState('Datos')
  const [visita,   setVisita]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [guardando, setGuardando] = useState(false)

  /* form state (tab Datos — creación) */
  const [fechaAgendada,    setFechaAgendada]    = useState('')
  const [responsable,      setResponsable]      = useState(user?.nombre || '')
  const [instalador,       setInstalador]       = useState('')
  const [notasPrevias,     setNotasPrevias]     = useState('')
  const [productosChecked, setProductosChecked] = useState([])

  const trabajadoresActivos = (trabajadores || []).filter(t => t.estado === 'activo')
  const tabIdx = TABS.indexOf(tab)

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

  function toggleProducto(label) {
    setProductosChecked(prev =>
      prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label]
    )
  }

  async function handleCrear() {
    setGuardando(true)
    const { data, error } = await supabase
      .from('visitas')
      .insert({
        cotizacion_id:      cot.id,
        empresa_id:         user?.empresa_id,
        cliente:            cot.cliente,
        telefono_cliente:   cot.telefono  || null,
        email_cliente:      cot.email     || null,
        direccion:          cot.direccion || null,
        comuna:             cot.comuna    || null,
        nombre_proyecto:    cot.glosa     || null,
        productos:          productosChecked,
        fecha_agendada:     fechaAgendada || null,
        responsable_visita: responsable   || null,
        instalador_nombre:  instalador    || null,
        notas_previas:      notasPrevias  || null,
        vendedor_id:        user?.id,
        vendedor_nombre:    user?.nombre  || null,
        estado:             'agendada',
      })
      .select()
      .single()
    if (!error && data) {
      setVisita(data)
      setTab('Checklist')
    }
    setGuardando(false)
  }

  function handleProductosGuardados(productos) {
    setVisita(prev => ({ ...prev, productos }))
  }

  /* ── Render footer de navegación ── */
  function renderFooter() {
    const btnBase = 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors'
    const btnGray = `${btnBase} text-slate-600 bg-slate-100 hover:bg-slate-200`
    const btnIndigo = `${btnBase} text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60`

    /* Tab Datos sin visita → Cancelar + Crear visita */
    if (tab === 'Datos' && !visita) {
      return (
        <>
          <button className={btnGray} onClick={onClose}>Cancelar</button>
          <button className={btnIndigo} onClick={handleCrear} disabled={guardando}>
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear visita
          </button>
        </>
      )
    }

    /* Tab Resumen IA → Anterior + Cerrar */
    if (tab === 'Resumen IA') {
      return (
        <>
          <button className={btnGray} onClick={() => setTab(TABS[tabIdx - 1])}>
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <button className={btnGray} onClick={onClose}>Cerrar</button>
        </>
      )
    }

    /* Tab Datos con visita → solo Siguiente */
    if (tab === 'Datos' && visita) {
      return (
        <>
          <div />
          <button className={btnIndigo} onClick={() => setTab(TABS[tabIdx + 1])}>
            Siguiente <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )
    }

    /* Tabs intermedios (Checklist, Fotos) → Anterior + Siguiente */
    return (
      <>
        <button className={btnGray} onClick={() => setTab(TABS[tabIdx - 1])}>
          <ChevronLeft className="w-4 h-4" /> Anterior
        </button>
        <button className={btnIndigo} onClick={() => setTab(TABS[tabIdx + 1])}>
          Siguiente <ChevronRight className="w-4 h-4" />
        </button>
      </>
    )
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
              {tab === 'Datos' && (
                visita
                  ? <TabDatosLectura visita={visita} />
                  : <TabDatosCrear
                      fechaAgendada={fechaAgendada}       setFechaAgendada={setFechaAgendada}
                      responsable={responsable}           setResponsable={setResponsable}
                      instalador={instalador}             setInstalador={setInstalador}
                      notasPrevias={notasPrevias}         setNotasPrevias={setNotasPrevias}
                      productosChecked={productosChecked} toggleProducto={toggleProducto}
                      trabajadores={trabajadoresActivos}
                    />
              )}

              {tab === 'Checklist' && (
                visita
                  ? <TabChecklist visita={visita} onProductosGuardados={handleProductosGuardados} />
                  : <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                      <ClipboardList className="w-8 h-8 mb-2 text-slate-300" />
                      <p className="text-sm">Primero crea una visita en el tab Datos.</p>
                    </div>
              )}

              {(tab === 'Fotos' || tab === 'Resumen IA') && (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400 py-12">
                  {(() => { const Icon = TAB_ICONS[tab]; return <Icon className="w-8 h-8 mb-3 text-slate-300" /> })()}
                  <p className="text-sm">Próximamente...</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer navegación ── */}
        {!loading && (
          <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 shrink-0 bg-slate-50/70">
            {renderFooter()}
          </div>
        )}

      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   TAB DATOS — modo lectura
══════════════════════════════════════════════ */
function TabDatosLectura({ visita }) {
  return (
    <div className="px-6 py-5 space-y-1 max-w-2xl">
      <Row label="Estado"         value={visita.estado} />
      <Row label="Cliente"        value={visita.cliente} />
      <Row label="Dirección"      value={visita.direccion ?? '—'} />
      <Row label="Comuna"         value={visita.comuna ?? '—'} />
      <Row label="Teléfono"       value={visita.telefono_cliente ?? '—'} />
      <Row label="Proyecto"       value={visita.nombre_proyecto ?? '—'} />
      <Row label="Fecha agendada" value={visita.fecha_agendada ?? '—'} />
      <Row label="Responsable"    value={visita.responsable_visita ?? '—'} />
      <Row label="Instalador"     value={visita.instalador_nombre ?? '—'} />
      <Row label="Productos"      value={
        Array.isArray(visita.productos) && visita.productos.length
          ? visita.productos.join(', ')
          : '—'
      } />
      {visita.notas_previas && (
        <div className="pt-3">
          <p className="text-xs font-medium text-slate-400 mb-1">Notas previas</p>
          <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 leading-relaxed">{visita.notas_previas}</p>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   TAB DATOS — formulario de creación
══════════════════════════════════════════════ */
function TabDatosCrear({
  fechaAgendada, setFechaAgendada,
  responsable, setResponsable,
  instalador, setInstalador,
  notasPrevias, setNotasPrevias,
  productosChecked, toggleProducto,
  trabajadores,
}) {
  return (
    <div className="px-6 py-5 space-y-5">
      <Field label="Fecha agendada">
        <input
          type="date"
          value={fechaAgendada}
          onChange={e => setFechaAgendada(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </Field>

      <Field label="Responsable de visita">
        <input
          type="text"
          value={responsable}
          onChange={e => setResponsable(e.target.value)}
          placeholder="Nombre del responsable"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </Field>

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

      <Field label="Productos">
        <div className="flex flex-col gap-2">
          {PRODUCTOS_OPCIONES.map(p => (
            <label key={p.id} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={productosChecked.includes(p.label)}
                onChange={() => toggleProducto(p.label)}
                className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
              />
              <span className="text-sm text-slate-700">{p.label}</span>
            </label>
          ))}
        </div>
      </Field>

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
  )
}

/* ═══════════════════════════════════════════════
   TAB CHECKLIST
══════════════════════════════════════════════ */
function TabChecklist({ visita, onProductosGuardados }) {
  const [productosLocales, setProductosLocales] = useState(
    Array.isArray(visita.productos) ? visita.productos : []
  )
  const [preguntas,  setPreguntas]  = useState([])
  const [respuestas, setRespuestas] = useState({})
  const [loadingCL,  setLoadingCL]  = useState(
    Array.isArray(visita.productos) && visita.productos.length > 0
  )
  const timers  = useRef({})
  const saveRef = useRef(null)

  useEffect(() => {
    if (productosLocales.length === 0) {
      setPreguntas([])
      setLoadingCL(false)
      return
    }
    async function load() {
      setLoadingCL(true)
      const productosSnake = productosLocales.map(p => LABEL_TO_SNAKE[p] || p)
      const { data: preguntasDB } = await supabase
        .from('visita_preguntas')
        .select('*')
        .eq('empresa_id', visita.empresa_id)
        .eq('activo', true)
        .order('orden')
      if (preguntasDB) {
        setPreguntas(
          preguntasDB
            .filter(p => p.producto === 'general' || productosSnake.includes(p.producto))
            .map(p => ({
              id:       p.id,
              label:    p.label,
              critical: p.critical,
              kind:     p.producto === 'general' ? 'date' : null,
              product:  p.producto === 'general' ? null : p.producto,
              general:  p.producto === 'general',
            }))
        )
      }
      const { data: answers } = await supabase
        .from('visita_checklist')
        .select('*')
        .eq('visita_id', visita.id)
      if (answers) {
        const map = {}
        answers.forEach(row => { map[row.pregunta_id] = row.respuesta })
        setRespuestas(map)
      }
      setLoadingCL(false)
    }
    void load()
  }, [visita.id, visita.empresa_id, productosLocales])

  function toggleProducto(label) {
    const next = productosLocales.includes(label)
      ? productosLocales.filter(x => x !== label)
      : [...productosLocales, label]
    setProductosLocales(next)
    clearTimeout(saveRef.current)
    saveRef.current = setTimeout(async () => {
      await supabase.from('visitas').update({ productos: next }).eq('id', visita.id)
      onProductosGuardados(next)
    }, 500)
  }

  function handleChange(pregunta, valor) {
    setRespuestas(prev => ({ ...prev, [pregunta.id]: valor }))
    clearTimeout(timers.current[pregunta.id])
    timers.current[pregunta.id] = setTimeout(() => {
      supabase.from('visita_checklist').upsert(
        {
          visita_id:      visita.id,
          pregunta_id:    pregunta.id,
          pregunta_label: pregunta.label,
          respuesta:      valor,
          critical:       pregunta.critical,
        },
        { onConflict: 'visita_id,pregunta_id' }
      )
    }, 600)
  }

  /* Separar generales de las de producto */
  const preguntasGenerales = preguntas.filter(q => q.general)
  const preguntasProducto  = preguntas.filter(q => !q.general)

  /* Agrupar por producto usando Map (preserva orden de primera aparición, sin duplicados) */
  const gruposMap = new Map()
  preguntasProducto.forEach(q => {
    const key = SNAKE_TO_LABEL[q.product] || q.product
    if (!gruposMap.has(key)) gruposMap.set(key, [])
    gruposMap.get(key).push(q)
  })
  const grupos = Array.from(gruposMap, ([key, items]) => ({ key, preguntas: items }))

  const respondidas = preguntas.filter(q => (respuestas[q.id] || '').trim() !== '').length
  const pct         = preguntas.length > 0 ? Math.round((respondidas / preguntas.length) * 100) : 0

  return (
    <div className="px-6 py-5 space-y-5">

      {/* ── Selector de productos — siempre visible ── */}
      <div className="flex flex-wrap gap-2 pb-3 border-b border-slate-100">
        {PRODUCTOS_OPCIONES.map(p => {
          const checked = productosLocales.includes(p.label)
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggleProducto(p.label)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors ${
                checked
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                checked ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 bg-white'
              }`}>
                {checked && <Check className="w-2 h-2 text-white" strokeWidth={3.5} />}
              </span>
              {p.label}
            </button>
          )
        })}
      </div>

      {/* ── Sin productos: estado vacío ── */}
      {productosLocales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <ClipboardList className="w-10 h-10 mb-3 text-slate-200" />
          <p className="text-sm font-medium text-slate-500">Selecciona al menos un producto</p>
          <p className="text-xs text-slate-400 mt-1">Las preguntas del checklist aparecerán aquí.</p>
        </div>
      ) : loadingCL ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : (
        <>
          {/* Barra de progreso */}
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>{respondidas} de {preguntas.length} preguntas respondidas</span>
              <span className="font-semibold text-slate-700">{pct}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: pct === 100 ? '#10b981' : '#6366f1' }}
              />
            </div>
          </div>

          {/* Fechas generales — tarjeta compacta sin badge Crítica */}
          {preguntasGenerales.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Fechas estimadas</p>
              <div className="space-y-3">
                {preguntasGenerales.map(q => (
                  <div key={q.id} className="flex items-center justify-between gap-4">
                    <span className="text-xs text-slate-600 flex-1">{q.label}</span>
                    <input
                      type="date"
                      value={respuestas[q.id] || ''}
                      onChange={e => handleChange(q, e.target.value)}
                      className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grupos por producto */}
          <div className="space-y-6">
            {grupos.map(grupo => {
              const style = GRUPO_STYLES[grupo.key] || { header: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' }
              return (
                <div key={grupo.key}>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg mb-3 ${style.header}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                    <span className="text-xs font-bold tracking-wide uppercase">{grupo.key}</span>
                  </div>
                  <div className="space-y-2.5">
                    {grupo.preguntas.map(q => (
                      <PreguntaRow
                        key={q.id}
                        pregunta={q}
                        valor={respuestas[q.id] || ''}
                        onChange={handleChange}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Fila de pregunta individual
══════════════════════════════════════════════ */
function PreguntaRow({ pregunta, valor, onChange }) {
  return (
    <div className={`rounded-xl p-3 border ${pregunta.critical ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
      <div className="flex items-start gap-2 mb-2">
        <p className={`text-sm flex-1 leading-snug ${pregunta.critical ? 'font-semibold text-slate-800' : 'font-medium text-slate-700'}`}>
          {pregunta.label}
        </p>
        {pregunta.critical && (
          <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700 whitespace-nowrap">
            ⚠ Crítica
          </span>
        )}
      </div>
      <input
        type={pregunta.kind === 'date' ? 'date' : 'text'}
        value={valor}
        onChange={e => onChange(pregunta, e.target.value)}
        placeholder={pregunta.kind === 'date' ? '' : 'Respuesta...'}
        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Helpers
══════════════════════════════════════════════ */
function Row({ label, value }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
      <span className="text-slate-400 text-xs font-medium min-w-[150px] shrink-0 mt-0.5">{label}</span>
      <span className="text-slate-800 text-sm">{value}</span>
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
