import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useApp } from '../../context/AppContext'
import { apiClient } from '../../services/apiClient'
import { Send, Plus, MessageSquare, Clock, RefreshCw } from 'lucide-react'

const SUGERENCIAS = [
  '¿Cuál es mi situación financiera actual?',
  '¿Qué gastos tengo pendientes de aprobar?',
  '¿Hay proyectos en riesgo?',
  '¿Cuáles son mis cotizaciones más importantes?',
  '¿Qué debo hacer hoy?',
]

/* ── Renderizador de markdown básico ─────────────────────────────── */
function parseBold(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
      : part
  )
}

function MarkdownText({ text }) {
  const lines = text.split('\n')
  const elements = []
  let listItems = []
  let listType = null

  const flushList = (key) => {
    if (!listItems.length) return
    elements.push(
      <ul key={`list-${key}`} className="my-1.5 space-y-1 pl-1">
        {listItems.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-slate-400 flex-shrink-0 mt-px">•</span>
            <span>{parseBold(item)}</span>
          </li>
        ))}
      </ul>
    )
    listItems = []
    listType = null
  }

  lines.forEach((line, i) => {
    const isBullet   = /^[-•]\s/.test(line)
    const isNumbered = /^\d+\.\s/.test(line)
    const isHeader3  = line.startsWith('### ')
    const isHeader2  = line.startsWith('## ')
    const isHeader1  = line.startsWith('# ')

    if (isBullet || isNumbered) {
      listType = isBullet ? 'bullet' : 'number'
      listItems.push(line.replace(/^[-•]\s/, '').replace(/^\d+\.\s/, ''))
    } else {
      flushList(i)
      if (isHeader1) {
        elements.push(<p key={i} className="font-bold text-base mt-2 mb-0.5">{parseBold(line.slice(2))}</p>)
      } else if (isHeader2) {
        elements.push(<p key={i} className="font-bold mt-2 mb-0.5">{parseBold(line.slice(3))}</p>)
      } else if (isHeader3) {
        elements.push(<p key={i} className="font-semibold mt-1.5 mb-0.5 text-slate-700">{parseBold(line.slice(4))}</p>)
      } else if (line === '') {
        if (elements.length > 0) elements.push(<div key={i} className="h-1.5" />)
      } else {
        elements.push(<p key={i}>{parseBold(line)}</p>)
      }
    }
  })
  flushList('end')

  return <div className="text-sm leading-relaxed space-y-0.5">{elements}</div>
}

/* ── Burbuja de mensaje ───────────────────────────────────────────── */
function Burbuja({ mensaje }) {
  const esAria = mensaje.rol === 'assistant'
  return (
    <div className={`flex gap-2.5 ${esAria ? 'justify-start' : 'justify-end'}`}>
      {esAria && (
        <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-1 text-sm">
          🤖
        </div>
      )}
      <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl ${
        esAria
          ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
          : 'bg-indigo-600 text-white rounded-tr-sm'
      }`}>
        {esAria
          ? <MarkdownText text={mensaje.texto} />
          : <p className="text-sm leading-relaxed">{mensaje.texto}</p>
        }
      </div>
    </div>
  )
}

/* ── Indicador "pensando" ─────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="flex gap-2.5 justify-start">
      <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-1 text-sm">
        🤖
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-slate-400 ml-1">ARIA está analizando...</span>
        </div>
      </div>
    </div>
  )
}

/* ── Página principal ─────────────────────────────────────────────── */
export default function AsesoriaPage() {
  const { user } = useAuth()
  const { cotizaciones, gastos, solicitudesVacaciones, proyectos } = useApp()

  const [conversaciones,    setConversaciones]    = useState([])
  const [conversacionActual, setConversacionActual] = useState(null)
  const [mensajes,          setMensajes]          = useState([])
  const [input,             setInput]             = useState('')
  const [loading,           setLoading]           = useState(false)
  const [inicializando,     setInicializando]      = useState(true)
  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)
  const saludoEnviado  = useRef(false)

  const nombreEmpresa = user?.empresa?.nombre_fantasia || user?.empresa?.nombre || 'tu empresa'

  // Indicadores rápidos desde el contexto local
  const proyectosActivos  = (proyectos || []).filter(p => p.estado === 'activo').length
  const gastosPendientes  = (gastos || []).filter(g => g.estado === 'pendiente').length
  const solicPendientes   = (solicitudesVacaciones || []).filter(s => s.estado === 'pendiente').length
  const cotAprobadas      = (cotizaciones || []).filter(c => c.estado === 'aprobada').length

  /* ── Scroll automático ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes, loading])

  /* ── Cargar conversaciones al montar ── */
  useEffect(() => {
    apiClient.get('/asesoria/conversaciones')
      .then(data => setConversaciones(data || []))
      .catch(() => {})
      .finally(() => setInicializando(false))
  }, [])

  /* ── Saludo automático al abrir ── */
  useEffect(() => {
    if (!inicializando && !saludoEnviado.current && conversaciones.length === 0) {
      saludoEnviado.current = true
      enviarMensaje('Hola, soy nuevo en esta sesión. Preséntate y dame un resumen ejecutivo del estado actual de la empresa.', true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicializando])

  /* ── Enviar mensaje ── */
  const enviarMensaje = useCallback(async (texto, oculto = false) => {
    if (!texto.trim() || loading) return
    if (!oculto) {
      setMensajes(p => [...p, { id: Date.now(), rol: 'user', texto }])
      setInput('')
    }
    setLoading(true)
    try {
      const res = await apiClient.post('/asesoria/chat', {
        mensaje: texto,
        conversacion_id: conversacionActual || undefined,
      })
      if (!conversacionActual && res.conversacion_id) {
        setConversacionActual(res.conversacion_id)
        setConversaciones(p => [{
          id: res.conversacion_id,
          titulo: texto.length > 60 ? texto.slice(0, 60) + '...' : texto,
          updated_at: new Date().toISOString(),
        }, ...p].slice(0, 10))
      }
      setMensajes(p => [...p, { id: Date.now() + 1, rol: 'assistant', texto: res.respuesta }])
    } catch (err) {
      const detalle = err?.message || 'Error desconocido'
      console.error('[ARIA] error:', detalle)
      setMensajes(p => [...p, { id: Date.now() + 1, rol: 'assistant', texto: `⚠️ Error al conectar con ARIA: ${detalle}` }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [loading, conversacionActual])

  /* ── Seleccionar conversación anterior ── */
  const seleccionarConversacion = async (conv) => {
    setConversacionActual(conv.id)
    setMensajes([])
    try {
      const data = await apiClient.get(`/asesoria/conversaciones/${conv.id}/mensajes`)
      setMensajes((data || []).map(m => ({ id: m.id, rol: m.rol, texto: m.contenido })))
    } catch {}
  }

  /* ── Nueva conversación ── */
  const nuevaConversacion = () => {
    setConversacionActual(null)
    setMensajes([])
    saludoEnviado.current = true
    enviarMensaje('Nueva sesión. Dame un resumen ejecutivo rápido del estado actual de la empresa.', true)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(input) }
  }

  /* ── Render ── */
  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-5rem)] w-full">

      {/* ── PANEL IZQUIERDO ── */}
      <div className="lg:w-72 flex-shrink-0 flex flex-col gap-3 lg:overflow-y-auto">

        {/* ARIA identity */}
        <div className="card p-5 text-center">
          <div className="relative inline-block mb-3">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl mx-auto shadow-lg aria-robot">
              🤖
            </div>
            <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${loading ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">ARIA</h2>
          <p className="text-xs text-slate-500 mt-0.5">Asesora IA de {nombreEmpresa}</p>
          <p className={`text-xs font-medium mt-2 ${loading ? 'text-amber-600' : 'text-emerald-600'}`}>
            {loading ? '⏳ Analizando datos...' : '✅ Lista para asesorarte'}
          </p>
        </div>

        {/* Indicadores rápidos */}
        <div className="card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Estado actual</p>
          {[
            { label: 'Cotizaciones aprobadas', value: cotAprobadas,     color: 'text-emerald-700' },
            { label: 'Proyectos activos',      value: proyectosActivos, color: 'text-indigo-700'  },
            { label: 'Gastos por revisar',     value: gastosPendientes, color: gastosPendientes > 0 ? 'text-amber-700' : 'text-slate-500' },
            { label: 'Solicitudes pendientes', value: solicPendientes,  color: solicPendientes > 0 ? 'text-orange-700' : 'text-slate-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{label}</span>
              <span className={`text-sm font-bold ${color}`}>{value}</span>
            </div>
          ))}
        </div>

        {/* Nueva conversación */}
        <button onClick={nuevaConversacion} disabled={loading} className="btn-primary w-full disabled:opacity-50">
          <Plus className="w-4 h-4" />
          Nueva conversación
        </button>

        {/* Historial */}
        {conversaciones.length > 0 && (
          <div className="card overflow-hidden flex-1">
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Conversaciones</p>
            </div>
            <div className="divide-y divide-slate-100 overflow-y-auto max-h-48 lg:max-h-none">
              {conversaciones.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => seleccionarConversacion(conv)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors ${conv.id === conversacionActual ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${conv.id === conversacionActual ? 'text-indigo-500' : 'text-slate-400'}`} />
                    <span className="text-xs text-slate-700 line-clamp-2 leading-snug">{conv.titulo || 'Conversación'}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── PANEL DERECHO — Chat ── */}
      <div className="flex-1 flex flex-col card overflow-hidden min-h-0">

        {/* Header del chat */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-base">
            🤖
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">ARIA</p>
            <p className="text-xs text-slate-400">Asistente de Recursos e Inteligencia Administrativa</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span className="text-xs text-slate-400">{loading ? 'Procesando' : 'Activa'}</span>
          </div>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          {mensajes.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="text-4xl mb-3">🤖</div>
              <p className="text-sm font-medium text-slate-500">Iniciando ARIA...</p>
              <p className="text-xs text-slate-400 mt-1">Analizando los datos de {nombreEmpresa}</p>
            </div>
          )}
          {mensajes.map(m => <Burbuja key={m.id} mensaje={m} />)}
          {loading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Sugerencias */}
        {mensajes.length <= 1 && !loading && (
          <div className="px-4 py-2 flex gap-2 overflow-x-auto flex-shrink-0 border-t border-slate-100">
            {SUGERENCIAS.map(s => (
              <button
                key={s}
                onClick={() => enviarMensaje(s)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors border border-indigo-100 whitespace-nowrap"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-slate-200 bg-white flex-shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu consulta a ARIA... (Enter para enviar)"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none input-base py-2.5 text-sm disabled:opacity-60"
              style={{ minHeight: '42px', maxHeight: '120px' }}
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
            />
            <button
              onClick={() => enviarMensaje(input)}
              disabled={loading || !input.trim()}
              className="btn-primary h-[42px] px-3.5 flex-shrink-0 disabled:opacity-50"
              title="Enviar"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 px-1">ARIA analiza datos reales de {nombreEmpresa} en tiempo real.</p>
        </div>
      </div>

      <style>{`
        .aria-robot { animation: aria-float 3s ease-in-out infinite; }
        @keyframes aria-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}
