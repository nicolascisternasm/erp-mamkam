import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { X, CalendarDays, ClipboardList, Image as ImageIcon, Bot, Loader2, ChevronRight, ChevronLeft, ChevronDown, Upload, Trash2, Download, FileText } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../auth/AuthContext'
import { useApp } from '../../context/AppContext'
import { apiClient } from '../../services/apiClient'
import { downloadPDF } from '../../utils/pdf'

const TABS = ['Datos', 'Checklist', 'Fotos', 'Resumen IA']
const TAB_ICONS = { Datos: CalendarDays, Checklist: ClipboardList, Fotos: ImageIcon, 'Resumen IA': Bot }

const PRODUCTOS_OPCIONES = [
  { id: 'toldo_vela',       label: 'Toldo Vela' },
  { id: 'pasto_sintetico',  label: 'Pasto Sintético' },
  { id: 'caucho_continuo',  label: 'Caucho Continuo' },
]

const ESTADO_STYLES = {
  planificada: 'bg-blue-100 text-blue-700',
  ejecutada:   'bg-emerald-100 text-emerald-700',
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

  const checklistRef = useRef(null)
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
  const [fechasEstimadas,  setFechasEstimadas]  = useState({})

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
        estado:             'planificada',
      })
      .select()
      .single()
    if (!error && data) {
      /* Guardar fechas estimadas si el usuario las completó antes de crear */
      const filas = Object.entries(fechasEstimadas)
        .filter(([, v]) => v)
        .map(([pregunta_id, respuesta]) => ({
          visita_id:      data.id,
          pregunta_id,
          pregunta_label: '',
          respuesta,
          critical:       false,
          unidad:         1,
        }))
      if (filas.length > 0) {
        await supabase.from('visita_checklist').upsert(filas, { onConflict: 'visita_id,pregunta_id,unidad' })
      }
      setVisita(data)
      setTab('Checklist')
    }
    setGuardando(false)
  }

  /* ── Render footer de navegación ── */
  function renderFooter() {
    const btnBase = 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors'
    const btnGray = `${btnBase} text-slate-600 bg-slate-100 hover:bg-slate-200`
    const btnIndigo = `${btnBase} text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60`

    /* Tab Datos sin visita → Cancelar + Siguiente (crea visita al avanzar) */
    if (tab === 'Datos' && !visita) {
      return (
        <>
          <button className={btnGray} onClick={onClose}>Cancelar</button>
          <button className={btnIndigo} onClick={handleCrear} disabled={guardando}>
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            Siguiente <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )
    }

    /* Tab Resumen IA → Anterior + Finalizar visita */
    if (tab === 'Resumen IA') {
      return (
        <>
          <button className={btnGray} onClick={() => setTab(TABS[tabIdx - 1])}>
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <button className={btnIndigo} onClick={onClose}>Finalizar visita</button>
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
        <button className={btnGray} onClick={async () => { await checklistRef.current?.flushAll(); setTab(TABS[tabIdx - 1]) }}>
          <ChevronLeft className="w-4 h-4" /> Anterior
        </button>
        <button className={btnIndigo} onClick={async () => { await checklistRef.current?.flushAll(); setTab(TABS[tabIdx + 1]) }}>
          Siguiente <ChevronRight className="w-4 h-4" />
        </button>
      </>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={async e => { if (e.target === e.currentTarget) { await checklistRef.current?.flushAll(); onClose() } }}
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
            onClick={async () => { await checklistRef.current?.flushAll(); onClose() }}
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
                onClick={async () => { await checklistRef.current?.flushAll(); setTab(t) }}
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
                      empresaId={user?.empresa_id}
                      fechasEstimadas={fechasEstimadas}   setFechasEstimadas={setFechasEstimadas}
                    />
              )}

              {tab === 'Checklist' && (
                visita
                  ? <TabChecklist ref={checklistRef} visita={visita} />
                  : <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                      <ClipboardList className="w-8 h-8 mb-2 text-slate-300" />
                      <p className="text-sm">Primero crea una visita en el tab Datos.</p>
                    </div>
              )}

              {tab === 'Fotos' && (
                visita
                  ? <TabFotos visita={visita} />
                  : <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                      <ImageIcon className="w-8 h-8 mb-2 text-slate-300" />
                      <p className="text-sm">Primero crea una visita en el tab Datos.</p>
                    </div>
              )}

              {tab === 'Resumen IA' && (
                visita
                  ? <TabResumenIA visita={visita} />
                  : <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                      <Bot className="w-8 h-8 mb-2 text-slate-300" />
                      <p className="text-sm">Primero crea una visita en el tab Datos.</p>
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
   FECHAS ESTIMADAS — sección reutilizable
══════════════════════════════════════════════ */
function FechasEstimadas({ visita }) {
  const [preguntas, setPreguntas]   = useState([])
  const [respuestas, setRespuestas] = useState({})

  useEffect(() => {
    async function load() {
      const [{ data: preguntasDB }, { data: answers }] = await Promise.all([
        supabase
          .from('visita_preguntas')
          .select('*')
          .eq('empresa_id', visita.empresa_id)
          .eq('producto', 'general')
          .eq('activo', true)
          .order('orden'),
        supabase
          .from('visita_checklist')
          .select('pregunta_id, respuesta')
          .eq('visita_id', visita.id)
          .eq('unidad', 1),
      ])
      if (preguntasDB) setPreguntas(preguntasDB)
      if (answers) {
        const map = {}
        answers.forEach(row => { map[row.pregunta_id] = row.respuesta })
        setRespuestas(map)
      }
    }
    void load()
  }, [visita.id, visita.empresa_id])

  async function handleChange(pregunta, valor) {
    setRespuestas(prev => ({ ...prev, [pregunta.id]: valor }))
    const { error } = await supabase.from('visita_checklist').upsert(
      {
        visita_id:      visita.id,
        pregunta_id:    pregunta.id,
        pregunta_label: pregunta.label,
        respuesta:      valor,
        critical:       false,
        unidad:         1,
      },
      { onConflict: 'visita_id,pregunta_id,unidad' }
    )
    if (error) console.error('[FechasEstimadas] error guardando:', error)
    else console.log('[FechasEstimadas] guardado OK:', pregunta.label, valor)
  }

  if (preguntas.length === 0) return null

  return (
    <div className="pt-4 border-t border-slate-100">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Fechas estimadas</p>
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        {preguntas.map(q => (
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
      <FechasEstimadas visita={visita} />
    </div>
  )
}

/* ═══════════════════════════════════════════════
   FECHAS ESTIMADAS — versión creación (sin visita_id)
══════════════════════════════════════════════ */
function FechasEstimadasCrear({ empresaId, valores, onChange }) {
  const [preguntas, setPreguntas] = useState([])

  useEffect(() => {
    if (!empresaId) return
    supabase
      .from('visita_preguntas')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('producto', 'general')
      .eq('activo', true)
      .order('orden')
      .then(({ data }) => { if (data) setPreguntas(data) })
  }, [empresaId])

  if (preguntas.length === 0) return null

  return (
    <div className="pt-4 border-t border-slate-100">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Fechas estimadas</p>
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        {preguntas.map(q => (
          <div key={q.id} className="flex items-center justify-between gap-4">
            <span className="text-xs text-slate-600 flex-1">{q.label}</span>
            <input
              type="date"
              value={valores[q.id] || ''}
              onChange={e => onChange({ ...valores, [q.id]: e.target.value })}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        ))}
      </div>
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
  empresaId,
  fechasEstimadas, setFechasEstimadas,
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

      <FechasEstimadasCrear
        empresaId={empresaId}
        valores={fechasEstimadas}
        onChange={setFechasEstimadas}
      />
    </div>
  )
}

/* ═══════════════════════════════════════════════
   TAB CHECKLIST
══════════════════════════════════════════════ */
const TabChecklist = forwardRef(function TabChecklist({ visita }, ref) {
  /* Fix 2: normalizar valores de visita.productos al montar (labels o snake_case) */
  const [productosLocales] = useState(() => {
    if (!Array.isArray(visita.productos)) return []
    const validLabels = new Set(PRODUCTOS_OPCIONES.map(p => p.label))
    return visita.productos
      .map(v => {
        if (validLabels.has(v))  return v
        if (SNAKE_TO_LABEL[v])   return SNAKE_TO_LABEL[v]
        console.warn('[checklist] valor desconocido en visita.productos:', v)
        return null
      })
      .filter(Boolean)
  })
  const [preguntas,      setPreguntas]      = useState([])
  const [respuestas,     setRespuestas]     = useState({})
  const [cantidadToldos, setCantidadToldos] = useState(visita.cantidad_toldos ?? 1)
  const [toldoAbierto,   setToldoAbierto]   = useState(1)
  const [loadingCL,      setLoadingCL]      = useState(
    Array.isArray(visita.productos) && visita.productos.length > 0
  )
  const timers       = useRef({})
  const toldoSaveRef = useRef(null)
  const fetchIdRef   = useRef(0)  /* Fix 1: guard contra race conditions */

  useEffect(() => {
    if (productosLocales.length === 0) {
      setPreguntas([])
      setLoadingCL(false)
      return
    }
    const fetchId = ++fetchIdRef.current
    async function load() {
      setLoadingCL(true)
      const productosSnake = productosLocales.map(p => LABEL_TO_SNAKE[p] || p)
      const { data: preguntasDB } = await supabase
        .from('visita_preguntas')
        .select('*')
        .eq('empresa_id', visita.empresa_id)
        .eq('activo', true)
        .order('orden')
      if (fetchId !== fetchIdRef.current) return
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
      if (fetchId !== fetchIdRef.current) return
      if (answers) {
        const map = {}
        /* Clave compuesta para soportar multi-unidad */
        answers.forEach(row => { map[`${row.pregunta_id}_${row.unidad ?? 1}`] = row.respuesta })
        setRespuestas(map)
      }
      setLoadingCL(false)
    }
    void load()
  }, [visita.id, visita.empresa_id, productosLocales])

  function handleCantidadToldos(newCant) {
    setCantidadToldos(newCant)
    if (toldoAbierto > newCant) setToldoAbierto(1)
    clearTimeout(toldoSaveRef.current)
    toldoSaveRef.current = setTimeout(async () => {
      await supabase.from('visitas').update({ cantidad_toldos: newCant }).eq('id', visita.id)
    }, 500)
  }

  /* Clave: `${pregunta.id}_${unidad}` — unidad=1 para todo lo que no es toldo */
  function handleChange(pregunta, valor, unidad = 1) {
    const key = `${pregunta.id}_${unidad}`
    setRespuestas(prev => ({ ...prev, [key]: valor }))
    clearTimeout(timers.current[key]?.timeoutId)
    const doUpsert = () => supabase.from('visita_checklist').upsert(
      {
        visita_id:      visita.id,
        pregunta_id:    pregunta.id,
        pregunta_label: pregunta.label,
        respuesta:      valor,
        critical:       pregunta.critical,
        unidad:         unidad,
      },
      { onConflict: 'visita_id,pregunta_id,unidad' }
    )
    timers.current[key] = { timeoutId: setTimeout(doUpsert, 600), flush: doUpsert }
  }

  async function flushAll() {
    const promises = Object.values(timers.current).map(entry => {
      clearTimeout(entry.timeoutId)
      return entry.flush()
    })
    timers.current = {}
    await Promise.all(promises)
  }

  useImperativeHandle(ref, () => ({ flushAll }))

  /* Separar generales / toldo_vela / otros productos */
  const preguntasGenerales = preguntas.filter(q => q.general)
  const preguntasToldo     = preguntas.filter(q => !q.general && q.product === 'toldo_vela')
  const preguntasOtros     = preguntas.filter(q => !q.general && q.product !== 'toldo_vela')

  /* Grupos de otros productos (Map para preservar orden, sin duplicados) */
  const gruposMap = new Map()
  preguntasOtros.forEach(q => {
    const key = SNAKE_TO_LABEL[q.product] || q.product
    if (!gruposMap.has(key)) gruposMap.set(key, [])
    gruposMap.get(key).push(q)
  })
  const gruposOtros = Array.from(gruposMap, ([key, items]) => ({ key, preguntas: items }))

  /* Progreso: solo preguntas de producto (generales se muestran en tab Datos) */
  let totalSlots  = 0
  let respondidas = 0
  preguntasToldo.forEach(q => {
    for (let u = 1; u <= cantidadToldos; u++) {
      totalSlots++
      if ((respuestas[`${q.id}_${u}`] || '').trim() !== '') respondidas++
    }
  })
  preguntasOtros.forEach(q => {
    totalSlots++
    if ((respuestas[`${q.id}_1`] || '').trim() !== '') respondidas++
  })
  const pct = totalSlots > 0 ? Math.round((respondidas / totalSlots) * 100) : 0

  return (
    <div className="px-6 py-5 space-y-5">

      {/* ── Sin productos: redirigir al tab Datos ── */}
      {productosLocales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <ClipboardList className="w-10 h-10 mb-3 text-slate-200" />
          <p className="text-sm font-medium text-slate-500">Ve al tab Datos para seleccionar los productos</p>
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
              <span>{respondidas} de {totalSlots} preguntas respondidas</span>
              <span className="font-semibold text-slate-700">{pct}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: pct === 100 ? '#10b981' : '#6366f1' }}
              />
            </div>
          </div>

          {/* Grupo Toldo Vela — acordeón multi-unidad */}
          {preguntasToldo.length > 0 && (
            <div>
              {/* Header + stepper de cantidad */}
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg flex-1 ${GRUPO_STYLES['Toldo Vela'].header}`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${GRUPO_STYLES['Toldo Vela'].dot}`} />
                  <span className="text-xs font-bold tracking-wide uppercase">Toldo Vela</span>
                </div>
                <StepperToldos cantidad={cantidadToldos} onChange={handleCantidadToldos} />
              </div>

              {/* Acordeón — una sección por toldo */}
              <div className="space-y-2">
                {Array.from({ length: cantidadToldos }, (_, i) => {
                  const unidad  = i + 1
                  const abierto = toldoAbierto === unidad
                  const respU   = preguntasToldo.filter(
                    q => (respuestas[`${q.id}_${unidad}`] || '').trim() !== ''
                  ).length
                  return (
                    <div key={unidad} className="border border-amber-100 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setToldoAbierto(abierto ? null : unidad)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-amber-50/60 hover:bg-amber-50 transition-colors"
                      >
                        <span className="text-sm font-semibold text-amber-900">Toldo {unidad}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-amber-600">{respU}/{preguntasToldo.length}</span>
                          <ChevronDown
                            className={`w-4 h-4 text-amber-500 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </button>
                      {abierto && (
                        <div className="px-3 py-3 space-y-2.5 bg-white">
                          {preguntasToldo.map(q => (
                            <PreguntaRow
                              key={`${q.id}_${unidad}`}
                              pregunta={q}
                              valor={respuestas[`${q.id}_${unidad}`] || ''}
                              onChange={(pq, val) => handleChange(pq, val, unidad)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Grupos de otros productos (Pasto Sintético, Caucho Continuo, etc.) */}
          <div className="space-y-6">
            {gruposOtros.map(grupo => {
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
                        valor={respuestas[`${q.id}_1`] || ''}
                        onChange={(pq, val) => handleChange(pq, val, 1)}
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
})

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
   Stepper de cantidad de toldos
══════════════════════════════════════════════ */
function StepperToldos({ cantidad, onChange }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-xs text-slate-500 whitespace-nowrap">Cantidad de toldos</span>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, cantidad - 1))}
          disabled={cantidad <= 1}
          className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold leading-none"
        >
          −
        </button>
        <span className="w-7 text-center text-sm font-semibold text-slate-800">{cantidad}</span>
        <button
          type="button"
          onClick={() => onChange(cantidad + 1)}
          className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 text-sm font-bold leading-none"
        >
          +
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   TAB FOTOS
══════════════════════════════════════════════ */
// NOTA: bucket 'visitas-audios' se reutiliza para VIDEO de visitas (no audio).
// Nombre heredado de una creación manual en Supabase; revisar si conviene
// migrar a un bucket 'visitas-videos' más adelante.

function docIconColor(nombre) {
  const ext = nombre?.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'text-red-400'
  if (ext === 'doc' || ext === 'docx') return 'text-blue-400'
  if (ext === 'xls' || ext === 'xlsx') return 'text-green-500'
  return 'text-slate-400'
}

function TabFotos({ visita }) {
  const { user }      = useAuth()
  const [archivos,    setArchivos]    = useState([])
  const [subiendo,    setSubiendo]    = useState([])   // [{ id, name }]
  const [loadingFotos, setLoadingFotos] = useState(true)
  const [error,       setError]       = useState(null)
  const [lightbox,    setLightbox]    = useState(null) // URL imagen en fullscreen
  const fileInputRef  = useRef(null)

  useEffect(() => {
    async function cargar() {
      setLoadingFotos(true)
      const { data } = await supabase
        .from('visita_fotos')
        .select('*')
        .eq('visita_id', visita.id)
        .order('created_at', { ascending: false })
      setArchivos(data || [])
      setLoadingFotos(false)
    }
    void cargar()
  }, [visita.id])

  async function handleSubir(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    setError(null)

    for (const file of files) {
      const isVideo = file.type.startsWith('video/')
      const isImage = file.type.startsWith('image/')
      const maxMB   = isVideo ? 200 : isImage ? 10 : 20
      if (file.size > maxMB * 1024 * 1024) {
        setError(`"${file.name}" excede el límite de ${maxMB} MB y no fue subido.`)
        continue
      }

      const uploadId    = `${Date.now()}_${Math.random()}`
      const bucket      = isVideo ? 'visitas-audios'     : isImage ? 'visitas-fotos' : 'visitas-documentos'
      const tipo        = isVideo ? 'video'               : isImage ? 'foto'          : 'documento'
      const sanitized   = file.name.replace(/\s/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')
      const storagePath = `${visita.id}/${Date.now()}_${sanitized}`

      setSubiendo(prev => [...prev, { id: uploadId, name: file.name }])

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(storagePath, file, { upsert: false, contentType: file.type })

      if (upErr) {
        console.error('[TabFotos] upload error:', upErr)
        setError(`Error subiendo "${file.name}": ${upErr.message}`)
        setSubiendo(prev => prev.filter(s => s.id !== uploadId))
        continue
      }

      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(storagePath)

      await supabase.from('visita_fotos').insert({
        visita_id:      visita.id,
        tipo,
        url:            publicUrl,
        nombre_archivo: file.name,
        tamano_kb:      Math.round(file.size / 1024),
        subido_por:     user?.nombre || user?.email || null,
      })

      setSubiendo(prev => prev.filter(s => s.id !== uploadId))
    }

    /* Refrescar grilla tras terminar todos los uploads */
    const { data } = await supabase
      .from('visita_fotos')
      .select('*')
      .eq('visita_id', visita.id)
      .order('created_at', { ascending: false })
    setArchivos(data || [])
  }

  async function handleEliminar(archivo) {
    if (!window.confirm(`¿Eliminar "${archivo.nombre_archivo}"?`)) return

    const bucket    = archivo.tipo === 'video' ? 'visitas-audios' : archivo.tipo === 'documento' ? 'visitas-documentos' : 'visitas-fotos'
    const urlParts  = archivo.url.split(`/${bucket}/`)
    const storagePath = urlParts[1]

    if (storagePath) {
      await supabase.storage.from(bucket).remove([storagePath])
    }
    await supabase.from('visita_fotos').delete().eq('id', archivo.id)
    setArchivos(prev => prev.filter(a => a.id !== archivo.id))
  }

  return (
    <div className="px-6 py-5">

      {/* ── Barra superior ── */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs text-slate-400">Fotos máx. 10 MB · Videos máx. 200 MB · Documentos máx. 20 MB</p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Subir archivos
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
          multiple
          className="hidden"
          onChange={handleSubir}
        />
      </div>

      {/* ── Error de validación ── */}
      {error && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Spinners de archivos en curso ── */}
      {subiendo.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {subiendo.map(s => (
            <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500 shrink-0" />
              <span className="text-xs text-indigo-700 truncate">{s.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Contenido principal ── */}
      {loadingFotos ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : archivos.length === 0 && subiendo.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <ImageIcon className="w-10 h-10 mb-3 text-slate-200" />
          <p className="text-sm font-medium text-slate-500">Aún no hay fotos, videos ni documentos en esta visita</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {archivos.map(a => (
            <div key={a.id} className="relative group rounded-xl overflow-hidden bg-slate-100 aspect-square">
              {a.tipo === 'video' ? (
                <video src={a.url} controls className="w-full h-full object-cover" />
              ) : (a.tipo === 'documento' || ['pdf','doc','docx','xls','xlsx'].includes(a.nombre_archivo?.split('.').pop()?.toLowerCase())) ? (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 hover:bg-slate-200 transition-colors"
                >
                  <FileText className={`w-10 h-10 ${docIconColor(a.nombre_archivo)}`} />
                  <span className="text-[11px] font-semibold text-slate-600 text-center line-clamp-2 leading-tight px-1">{a.nombre_archivo}</span>
                  <span className="mt-auto px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-500 uppercase tracking-wide">
                    {a.nombre_archivo?.split('.').pop()}
                  </span>
                </a>
              ) : (
                <img
                  src={a.url}
                  alt={a.nombre_archivo}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setLightbox(a.url)}
                />
              )}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); handleEliminar(a) }}
                className="absolute top-2 right-2 z-10 w-7 h-7 rounded-lg bg-white/80 hover:bg-red-50 text-slate-500 hover:text-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              {a.tipo === 'video' && (
                <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/60 text-white tracking-wide">
                  VIDEO
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

/* ── Markdown utilities (usadas en modal y PDF) ──────────────── */

function inlineMd(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part)
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  )
}

function parseMarkdown(text) {
  if (!text) return null
  return text.split('\n').map((line, i) => {
    if (/^#{1,3}\s+/.test(line)) {
      const content = line.replace(/^#{1,3}\s+/, '')
      return (
        <div key={i} style={{ fontWeight: 700, color: '#1e3a5f', fontSize: '14px', marginTop: '12px', marginBottom: '4px' }}>
          {inlineMd(content)}
        </div>
      )
    }
    if (/^[\*\-]\s+/.test(line)) {
      const content = line.replace(/^[\*\-]\s+/, '')
      return (
        <div key={i} style={{ display: 'flex', gap: '8px', paddingLeft: '8px', marginBottom: '3px' }}>
          <span style={{ color: '#64748b', flexShrink: 0 }}>•</span>
          <span>{inlineMd(content)}</span>
        </div>
      )
    }
    if (line.trim() === '') return <div key={i} style={{ height: '6px' }} />
    return <p key={i} style={{ margin: '0 0 8px 0', lineHeight: '1.6' }}>{inlineMd(line)}</p>
  })
}

const GRUPO_PDF_STYLES = {
  general:         { label: 'Información General', bg: '#f8fafc', border: '#94a3b8', text: '#475569' },
  toldo_vela:      { label: 'Toldo Vela',          bg: '#fffbeb', border: '#f59e0b', text: '#92400e' },
  pasto_sintetico: { label: 'Pasto Sintético',     bg: '#f0fdf4', border: '#15803d', text: '#166534' },
  caucho_continuo: { label: 'Caucho Continuo',     bg: '#fef2f2', border: '#dc2626', text: '#991b1b' },
}

/* ═══════════════════════════════════════════════
   TAB RESUMEN IA
══════════════════════════════════════════════ */
function TabResumenIA({ visita }) {
  const [resumen,      setResumen]      = useState(visita.resumen_ia || '')
  const [generando,    setGenerando]    = useState(false)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [error,        setError]        = useState(null)
  const [pdfData,      setPdfData]      = useState(null)
  const pdfRef = useRef(null)

  /* Descarga PDF tras renderizar el div off-screen */
  useEffect(() => {
    if (!pdfData) return
    const el = pdfRef.current
    if (!el) return
    let cancelled = false
    downloadPDF(el, `Informe_Visita_${visita.id}.pdf`)
      .finally(() => {
        if (!cancelled) {
          setPdfData(null)
          setGenerandoPdf(false)
        }
      })
    return () => { cancelled = true }
  }, [pdfData, visita.id])

  async function handleGenerar() {
    setGenerando(true)
    setError(null)
    try {
      const { resumen: texto } = await apiClient.post(`/visitas/${visita.id}/resumen-ia`)
      setResumen(texto)
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('credit balance is too low') || msg.includes('429')) {
        setError('⚠️ Los créditos de IA están agotados. Recarga en console.anthropic.com → Billing para continuar generando resúmenes.')
      } else {
        setError(msg || 'Error al generar el resumen')
      }
    } finally {
      setGenerando(false)
    }
  }

  async function handleDescargarPdf() {
    setGenerandoPdf(true)
    setError(null)
    try {
      const [{ data: rawChecklist }, { data: fotos }, { data: preguntas }] = await Promise.all([
        supabase
          .from('visita_checklist')
          .select('pregunta_id, pregunta_label, respuesta, critical, unidad')
          .eq('visita_id', visita.id)
          .not('respuesta', 'is', null)
          .neq('respuesta', '')
          .order('unidad')
          .order('created_at'),
        supabase
          .from('visita_fotos')
          .select('*')
          .eq('visita_id', visita.id)
          .eq('tipo', 'foto')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('visita_preguntas')
          .select('id, producto')
          .eq('empresa_id', visita.empresa_id),
      ])
      const pregProducto = {}
      ;(preguntas || []).forEach(p => { pregProducto[p.id] = p.producto })
      const checklist = (rawChecklist || []).map(row => ({
        ...row,
        producto: pregProducto[row.pregunta_id] || 'general',
      }))
      setPdfData({ checklist, fotos: fotos || [] })
    } catch {
      setError('Error al preparar el PDF')
      setGenerandoPdf(false)
    }
  }

  /* Agrupar checklist por (producto, unidad) para el PDF */
  const checklistPorGrupo = pdfData
    ? (() => {
        const map = new Map()
        pdfData.checklist.forEach(row => {
          const prod = row.producto || 'general'
          const key  = prod === 'toldo_vela' ? `toldo_vela_${row.unidad ?? 1}` : prod
          if (!map.has(key)) map.set(key, { producto: prod, unidad: row.unidad ?? 1, rows: [] })
          map.get(key).rows.push(row)
        })
        return Array.from(map.values())
      })()
    : []

  const productos = Array.isArray(visita.productos) ? visita.productos.join(', ') : '—'
  const fechaGen  = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="px-6 py-5 space-y-5">

      {/* ── Error ── */}
      {error && (
        <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Estado vacío ── */}
      {!resumen && !generando && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Bot className="w-10 h-10 text-slate-300" />
          <p className="text-sm text-slate-500 text-center max-w-xs">
            Genera un resumen ejecutivo de la visita usando inteligencia artificial.
          </p>
          <button
            onClick={handleGenerar}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            <Bot className="w-4 h-4" />
            Generar resumen con IA
          </button>
        </div>
      )}

      {/* ── Generando ── */}
      {generando && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-500">Analizando información de la visita...</p>
        </div>
      )}

      {/* ── Resumen listo ── */}
      {resumen && !generando && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Resumen generado por IA</p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerar}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <Bot className="w-3.5 h-3.5" />
                Regenerar
              </button>
              <button
                onClick={handleDescargarPdf}
                disabled={generandoPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition-colors"
              >
                {generandoPdf
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Download className="w-3.5 h-3.5" />}
                {generandoPdf ? 'Preparando...' : 'Descargar PDF'}
              </button>
            </div>
          </div>
          {/* Markdown parseado — sin ## ni ** visibles */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 leading-relaxed">
            {parseMarkdown(resumen)}
          </div>
        </div>
      )}

      {/* ── Div off-screen para html2canvas (A4 794px, solo cuando pdfData está listo) ── */}
      {pdfData && (
        <div
          ref={pdfRef}
          style={{
            position: 'fixed', top: 0, left: '-9999px',
            width: '794px', background: '#ffffff',
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            fontSize: '13px', color: '#1e293b', lineHeight: '1.6',
            boxSizing: 'border-box',
          }}
        >
          {/* ── Header franja azul oscuro ── */}
          <div style={{ background: '#1e3a5f', padding: '28px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px' }}>MAMKAM</div>
              <div style={{ fontSize: '13px', fontWeight: 400, color: '#93c5fd', marginTop: '4px' }}>Informe de Visita Técnica</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '12px', color: '#bfdbfe', lineHeight: '1.8' }}>
              {visita.nombre_proyecto && (
                <div style={{ fontWeight: 600, color: '#ffffff' }}>{visita.nombre_proyecto}</div>
              )}
              <div>Generado: {fechaGen}</div>
              <div>Estado: <span style={{ fontWeight: 600, color: '#ffffff' }}>{visita.estado}</span></div>
            </div>
          </div>

          {/* ── Body ── */}
          <div style={{ padding: '32px 40px' }}>

            {/* Sección Datos */}
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '16px' }}>
              Datos de la Visita
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 32px', marginBottom: '20px' }}>
              {[
                ['Cliente',         visita.cliente            || '—'],
                ['Proyecto',        visita.nombre_proyecto    || '—'],
                ['Dirección',       visita.direccion          || '—'],
                ['Comuna',          visita.comuna             || '—'],
                ['Productos',       productos],
                ['Fecha agendada',  visita.fecha_agendada     || '—'],
                ['Responsable',     visita.responsable_visita || '—'],
                ['Instalador',      visita.instalador_nombre  || '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '13px', color: '#1e293b' }}>{value}</div>
                </div>
              ))}
            </div>
            {visita.notas_previas && (
              <div style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', color: '#475569', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: '#1e293b' }}>Notas previas: </span>{visita.notas_previas}
              </div>
            )}

            {/* Sección Checklist */}
            {pdfData.checklist.length > 0 && (
              <>
                <div style={{ borderTop: '1px solid #e2e8f0', margin: '24px 0 16px' }} />
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '16px' }}>
                  Checklist ({pdfData.checklist.length} respuestas)
                </div>
                {checklistPorGrupo.map(({ producto, unidad, rows }) => {
                  const gStyle = GRUPO_PDF_STYLES[producto] || GRUPO_PDF_STYLES.general
                  const gLabel = producto === 'toldo_vela' ? `Toldo ${unidad}` : gStyle.label
                  return (
                    <div key={`${producto}_${unidad}`} style={{ marginBottom: '18px' }}>
                      <div style={{ background: gStyle.bg, borderLeft: `3px solid ${gStyle.border}`, padding: '5px 10px', borderRadius: '0 4px 4px 0', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: gStyle.text, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {gLabel}
                        </span>
                      </div>
                      {rows.map((row, i) => (
                        <div key={i} style={{
                          borderLeft: row.critical ? '2px solid #ef4444' : '2px solid #e2e8f0',
                          paddingLeft: '10px', marginBottom: '8px', paddingBottom: '6px',
                          borderBottom: i < rows.length - 1 ? '1px solid #f8fafc' : 'none',
                        }}>
                          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {row.critical && (
                              <span style={{ fontSize: '10px', fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '1px 5px', borderRadius: '3px' }}>
                                Crítica
                              </span>
                            )}
                            {row.pregunta_label}
                          </div>
                          <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500 }}>{row.respuesta}</div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </>
            )}

            {/* Sección Resumen IA */}
            {resumen && (
              <>
                <div style={{ borderTop: '1px solid #e2e8f0', margin: '24px 0 16px' }} />
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '16px' }}>
                  Resumen IA
                </div>
                <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.7' }}>
                  {parseMarkdown(resumen)}
                </div>
              </>
            )}

            {/* Sección Fotos */}
            {pdfData.fotos.length > 0 && (
              <>
                <div style={{ borderTop: '1px solid #e2e8f0', margin: '24px 0 16px' }} />
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '16px' }}>
                  Fotos ({pdfData.fotos.length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {pdfData.fotos.map(a => (
                    <div key={a.id}>
                      <div style={{ height: '160px', background: '#f8f8f8', borderRadius: '4px', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img
                          src={a.url}
                          alt={a.nombre_archivo}
                          crossOrigin="anonymous"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      </div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.nombre_archivo}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

          </div>
        </div>
      )}
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
