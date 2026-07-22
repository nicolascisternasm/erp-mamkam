import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Edit2, FileText, Users, BookOpen, TrendingUp,
  TrendingDown, Plus, Trash2, MessageSquare, Flag, AlertTriangle,
  X, CheckCircle2, ShoppingCart, Receipt, User, CalendarDays,
  ClipboardList, Smartphone, Send, Paperclip, Eye, Loader2,
} from 'lucide-react'
import { apiClient } from '../../services/apiClient'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../../services/supabase'
import { formatCLP, formatDate, generateId } from '../../utils/formatters'
import { analizarComprobanteIA } from '../../utils/analizarComprobante'
import GanttView from '../../components/planificacion/GanttView'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

/* ── Helpers ────────────────────────────────────────────────────── */

const ESTADO_CONFIG = {
  planificacion: { label: 'Planificación', cls: 'bg-slate-100 text-slate-600'     },
  ejecucion:     { label: 'Ejecución',     cls: 'bg-emerald-100 text-emerald-700' },
  cierre:        { label: 'Cierre',        cls: 'bg-blue-100 text-blue-700'       },
  pausado:       { label: 'Pausado',       cls: 'bg-yellow-100 text-yellow-700'   },
  cancelado:     { label: 'Cancelado',     cls: 'bg-red-100 text-red-700'         },
}

const TIPO_BITACORA = {
  nota:   { label: 'Nota',    Icon: MessageSquare, cls: 'bg-slate-100 text-slate-600'      },
  hito:   { label: 'Hito',    Icon: Flag,          cls: 'bg-indigo-100 text-indigo-700'    },
  alerta: { label: 'Alerta',  Icon: AlertTriangle, cls: 'bg-amber-100 text-amber-700'      },
}

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, cls: 'bg-slate-100 text-slate-600' }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function ProgressBar({ value }) {
  const pct = Math.min(100, Math.max(0, value ?? 0))
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-indigo-500' : 'bg-amber-500'
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

/* ── Modal genérico ─────────────────────────────────────────────── */

function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${sizes[size]} flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <p className="font-semibold text-slate-900 text-sm">{title}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
      </div>
    </div>
  )
}

/* ── Monto Pagado Cell ──────────────────────────────────────────── */

function MontoPagadoCell({ montoPagado, montoAcordado, tieneComprobantes }) {
  if (!tieneComprobantes) return <span className="text-slate-400">—</span>
  if (montoPagado === montoAcordado) {
    return (
      <div className="text-right">
        <span className="text-green-600 font-medium">{formatCLP(montoPagado)}</span>
        <div className="text-green-500 text-[10px]">✓ Completo</div>
      </div>
    )
  }
  if (montoPagado < montoAcordado) {
    return (
      <div className="text-right">
        <span className="text-amber-600 font-medium">{formatCLP(montoPagado)}</span>
        <div className="text-red-500 text-[10px]">Falta: {formatCLP(montoAcordado - montoPagado)}</div>
      </div>
    )
  }
  return (
    <div className="text-right">
      <span className="text-amber-600 font-medium">{formatCLP(montoPagado)}</span>
      <div className="text-blue-500 text-[10px]">Exceso: {formatCLP(montoPagado - montoAcordado)}</div>
    </div>
  )
}

/* ── Componente principal ───────────────────────────────────────── */

export default function ProyectoDetalle() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useAuth()
  const isAdmin = user?.rol === 'admin'
  const { cotizaciones: allCots, compras: allCompras, gastos: allGastos, trabajadores, proyectos: allProyectos, updateCotizacion, updateCotizacionLocal, updateCompra, addMovimiento, movimientos } = useApp()
  const [proyecto, setProyecto] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab,  setActiveTab]  = useState('planificacion')

  // Estado inline
  const [estadoEdit, setEstadoEdit] = useState(false)
  const [avanceLocal, setAvanceLocal] = useState(0)

  // Datos adicionales
  const [bitacora, setBitacora] = useState([])
  const [gastosAsignadosGlobal, setGastosAsignadosGlobal] = useState([])
  const [tareas, setTareas] = useState([])
  const [usuarios, setUsuarios] = useState([])

  // Form nueva/editar tarea
  const [taFormOpen,      setTaFormOpen]      = useState(false)
  const [taEditando,      setTaEditando]      = useState(null) // tarea en edición o null
  const [taSaving,        setTaSaving]        = useState(false)
  const [taNombre,        setTaNombre]        = useState('')
  const [taFechaInicio,   setTaFechaInicio]   = useState('')
  const [taFechaFin,      setTaFechaFin]      = useState('')
  const [taResponsableId, setTaResponsableId] = useState('')
  const [taError,         setTaError]         = useState('')

  // Modal recordatorio WhatsApp
  const [modalRecordatorio, setModalRecordatorio] = useState(null)
  const [recTelefono,  setRecTelefono]  = useState('')
  const [recEnviando,  setRecEnviando]  = useState(false)
  const [recError,     setRecError]     = useState('')
  const [recEnviado,   setRecEnviado]   = useState(false)

  // Proyectos activos para selector de destino en modal gastos
  const proyectosActivos = allProyectos.filter((p) => p.estado === 'ejecucion')

  // Modales
  const [modalCot, setModalCot] = useState(false)
  const [modalOC, setModalOC] = useState(false)
  const [modalGasto, setModalGasto] = useState(false)
  const [modalTrab, setModalTrab] = useState(false)

  // Selecciones en modales
  const [cotSel, setCotSel] = useState(null)
  const [ocSel, setOcSel] = useState(null)
  const [trabSel, setTrabSel] = useState(null)
  const [trabRol, setTrabRol] = useState('')
  const [gastosSelModal, setGastosSelModal] = useState(new Set())
  const [gastosFilTrab, setGastosFilTrab] = useState('todos')
  const [gastosFilFecha, setGastosFilFecha] = useState('')
  const [gastosFilFechaHasta, setGastosFilFechaHasta] = useState('')
  const [proyectoDestino, setProyectoDestino] = useState('')

  // Bitácora — nuevo registro
  const [bitContenido, setBitContenido] = useState('')
  const [bitTipo, setBitTipo] = useState('nota')
  const [bitSaving, setBitSaving] = useState(false)
  const [bitFiles, setBitFiles] = useState([])
  const [bitUploading, setBitUploading] = useState(false)
  const bitFileRef = useRef(null)

  // Bitácora — editar
  const [bitEditando, setBitEditando] = useState(null)
  const [bitEditContenido, setBitEditContenido] = useState('')
  const [bitEditTipo, setBitEditTipo] = useState('nota')
  const [bitEditSaving, setBitEditSaving] = useState(false)

  // Bitácora — eliminar
  const [bitConfirmEliminar, setBitConfirmEliminar] = useState(null)
  const [bitEliminando, setBitEliminando] = useState(false)

  // Análisis IA
  const [subiendoPdf, setSubiendoPdf] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [errorAnalisis, setErrorAnalisis] = useState('')
  const pdfCalcRef = useRef(null)

  // Chat ARIA
  const [chatHistorial, setChatHistorial] = useState([])
  const [chatMensaje, setChatMensaje] = useState('')
  const [chatEnviando, setChatEnviando] = useState(false)
  const [chatError, setChatError] = useState('')
  const [mostrarAnalisis, setMostrarAnalisis] = useState(false)
  const chatEndRef = useRef(null)

  // Comprobantes de pago de cotización (upload directo legacy)
  const [subiendoComprobante, setSubiendoComprobante] = useState({})
  const [comprobanteTarget, setComprobanteTarget] = useState(null)
  const comprobanteFileRef = useRef(null)

  // Modal comprobantes por condición
  const [modalComprobantes, setModalComprobantes] = useState(null) // { cotId, condicionId, descripcion }
  // 'idle' | 'subiendo' | 'analizando' | 'confirmando' | 'guardando'
  const [estadoModalComp, setEstadoModalComp] = useState('idle')
  const [formConfirmacion, setFormConfirmacion] = useState(null)
  const [toastComp, setToastComp] = useState('')
  const [confirmElimComp, setConfirmElimComp] = useState(null) // url a confirmar
  const comprobanteModalFileRef = useRef(null)

  // Movimientos asociados a condiciones de pago (local, frescos de Supabase)
  const [movimientosProyecto, setMovimientosProyecto] = useState([])

  // Modal comprobantes de OC
  const [modalOCComprobantes,  setModalOCComprobantes]  = useState(null) // { ocId }
  const [estadoModalOCComp,    setEstadoModalOCComp]    = useState('idle')
  const [formConfirmacionOCPD, setFormConfirmacionOCPD] = useState(null)
  const [uploadedUrlOCPD,      setUploadedUrlOCPD]      = useState(null)
  const ocComprobanteModalRef = useRef(null)

  // Eliminar proyecto
  const [modalEliminarProyecto, setModalEliminarProyecto] = useState(false)
  const [eliminarConfirmNombre, setEliminarConfirmNombre] = useState('')
  const [eliminandoProyecto, setEliminandoProyecto] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  const fmtFechaCorta = (iso) => {
    if (!iso) return ''
    const [, m, d] = iso.split('-')
    return `${d}/${m}`
  }

  const cargarProyecto = useCallback(() => {
    return apiClient.get(`/proyectos/${id}`).then((data) => {
      setProyecto(data)
      setAvanceLocal(data.porcentajeAvance ?? 0)
      setTareas(data.tareas || [])
      setChatHistorial(data.chatIa || [])
    })
  }, [id])

  useEffect(() => {
    Promise.all([
      cargarProyecto(),
      apiClient.get(`/proyectos/${id}/bitacora`).catch(() => []),
      apiClient.get('/proyectos/gastos-asignados').catch(() => []),
    ]).then(([, bit, asignados]) => {
      setBitacora(bit || [])
      setGastosAsignadosGlobal(asignados || [])
    }).finally(() => setLoading(false))
  }, [id, cargarProyecto])

  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`proyecto-gastos-${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'proyecto_gastos',
        filter: `proyecto_id=eq.${id}`,
      }, () => {
        cargarProyecto()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id, cargarProyecto])

  useEffect(() => {
    if (!user?.empresa_id) return
    supabase
      .from('movimientos')
      .select('id, gasto_id, monto, fecha, glosa, tipo, gasto_descripcion')
      .eq('empresa_id', user.empresa_id)
      .then(({ data }) => { if (data) setMovimientosProyecto(data) })
  }, [user?.empresa_id])

  const handleEstadoChange = async (estado) => {
    try {
      const data = await apiClient.patch(`/proyectos/${id}/estado`, { estado })
      setProyecto((prev) => ({ ...prev, estado: data.estado }))
      setEstadoEdit(false)
    } catch (err) {
      console.error('Error al cambiar estado:', err)
    }
  }

  const handleAvanceRelease = async () => {
    try {
      await apiClient.patch(`/proyectos/${id}/avance`, { porcentaje_avance: avanceLocal })
      setProyecto((prev) => ({ ...prev, porcentajeAvance: avanceLocal }))
    } catch (err) {
      console.error('Error al guardar avance:', err)
    }
  }

  /* ── Cotizaciones asignadas/disponibles ── */
  const cotsAsignadas = allCots.filter((c) => proyecto?.cotizacionIds?.includes(c.id))
  const cotsDisponibles = allCots.filter(
    (c) => c.estado === 'aprobada' && !proyecto?.cotizacionIds?.includes(c.id)
  )

  const agregarCotizacion = async () => {
    if (!cotSel) return
    try {
      await apiClient.post(`/proyectos/${id}/cotizaciones`, { cotizacion_id: cotSel })
      await cargarProyecto()
      setModalCot(false)
      setCotSel(null)
    } catch (err) {
      console.error('Error al agregar cotización:', err)
    }
  }

  const quitarCotizacion = async (cotId) => {
    try {
      await apiClient.delete(`/proyectos/${id}/cotizaciones/${cotId}`)
      await cargarProyecto()
    } catch (err) {
      console.error('Error al quitar cotización:', err)
    }
  }

  /* ── OC asignadas/disponibles ── */
  const ocsAsignadas = allCompras.filter((c) => proyecto?.ocIds?.includes(c.id))
  const ocsDisponibles = allCompras.filter((c) => !proyecto?.ocIds?.includes(c.id))

  const agregarOC = async () => {
    if (!ocSel) return
    try {
      await apiClient.post(`/proyectos/${id}/oc`, { oc_id: ocSel })
      await cargarProyecto()
      setModalOC(false)
      setOcSel(null)
    } catch (err) {
      console.error('Error al agregar OC:', err)
    }
  }

  const quitarOC = async (ocId) => {
    try {
      await apiClient.delete(`/proyectos/${id}/oc/${ocId}`)
      await cargarProyecto()
    } catch (err) {
      console.error('Error al quitar OC:', err)
    }
  }

  /* ── Gastos ── */
  const gastosAsignados = allGastos.filter((g) => proyecto?.gastoIds?.includes(g.id))
  const gastosDisponibles = allGastos.filter((g) => {
    if (gastosAsignadosGlobal.includes(g.id)) return false
    if (gastosFilTrab !== 'todos' && g.trabajadorId !== gastosFilTrab) return false
    if (gastosFilFecha && g.fecha < gastosFilFecha) return false
    if (gastosFilFechaHasta && g.fecha > gastosFilFechaHasta) return false
    return true
  })

  const agregarGastos = async () => {
    if (gastosSelModal.size === 0) return
    const targetId = proyectoDestino || id
    try {
      await apiClient.post(`/proyectos/${targetId}/gastos`, { gasto_ids: [...gastosSelModal] })
      setGastosAsignadosGlobal((prev) => [...new Set([...prev, ...gastosSelModal])])
      if (targetId === id) await cargarProyecto()
      setModalGasto(false)
      setGastosSelModal(new Set())
    } catch (err) {
      console.error('Error al agregar gastos:', err)
    }
  }

  const quitarGasto = async (gastoId) => {
    try {
      await apiClient.delete(`/proyectos/${id}/gastos/${gastoId}`)
      await cargarProyecto()
    } catch (err) {
      console.error('Error al quitar gasto:', err)
    }
  }

  /* ── Trabajadores ── */
  const trabsAsignados = (proyecto?.trabajadorIds || []).map((t) => ({
    ...t,
    ...(trabajadores.find((w) => w.id === t.trabajadorId) ?? {}),
  }))
  const trabsDisponibles = trabajadores.filter(
    (t) => !(proyecto?.trabajadorIds || []).some((a) => a.trabajadorId === t.id)
  )

  const agregarTrabajador = async () => {
    if (!trabSel) return
    try {
      await apiClient.post(`/proyectos/${id}/trabajadores`, { trabajador_id: trabSel, rol: trabRol || null })
      await cargarProyecto()
      setModalTrab(false)
      setTrabSel(null)
      setTrabRol('')
    } catch (err) {
      console.error('Error al agregar trabajador:', err)
    }
  }

  const removerTrabajador = async (trabId) => {
    try {
      await apiClient.delete(`/proyectos/${id}/trabajadores/${trabId}`)
      await cargarProyecto()
    } catch (err) {
      console.error('Error al remover trabajador:', err)
    }
  }

  /* ── Bitácora ── */
  const uploadBitacoraFiles = async (files) => {
    const resultado = []
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `bitacora/${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage
        .from('proyectos-documentos')
        .upload(path, file, { upsert: false, contentType: file.type })
      if (error) throw error
      const publicUrl = supabase.storage.from('proyectos-documentos').getPublicUrl(path).data.publicUrl
      resultado.push({ url: publicUrl, nombre: file.name, tipo: file.type })
    }
    return resultado
  }

  const handleBitacora = async () => {
    if (!bitContenido.trim()) return
    setBitSaving(true)
    try {
      let archivos = []
      if (bitFiles.length > 0) {
        setBitUploading(true)
        archivos = await uploadBitacoraFiles(bitFiles)
        setBitUploading(false)
      }
      const entry = await apiClient.post(`/proyectos/${id}/bitacora`, {
        contenido: bitContenido.trim(),
        tipo: bitTipo,
        archivos,
      })
      setBitacora((prev) => [entry, ...prev])
      setBitContenido('')
      setBitTipo('nota')
      setBitFiles([])
      if (bitFileRef.current) bitFileRef.current.value = ''
    } catch (err) {
      console.error('Error al guardar bitácora:', err)
    } finally {
      setBitSaving(false)
      setBitUploading(false)
    }
  }

  const abrirEdicionBitacora = (b) => {
    setBitEditando(b)
    setBitEditContenido(b.contenido)
    setBitEditTipo(b.tipo || 'nota')
  }

  const handleEditarBitacora = async () => {
    if (!bitEditContenido.trim() || !bitEditando) return
    setBitEditSaving(true)
    try {
      const entry = await apiClient.patch(`/proyectos/${id}/bitacora/${bitEditando.id}`, {
        contenido: bitEditContenido.trim(),
        tipo: bitEditTipo,
      })
      setBitacora((prev) => prev.map((b) => (b.id === bitEditando.id ? entry : b)))
      setBitEditando(null)
    } catch (err) {
      console.error('Error al editar bitácora:', err)
    } finally {
      setBitEditSaving(false)
    }
  }

  const handleEliminarBitacora = async (entradaId) => {
    setBitEliminando(true)
    try {
      await apiClient.delete(`/proyectos/${id}/bitacora/${entradaId}`)
      setBitacora((prev) => prev.filter((b) => b.id !== entradaId))
      setBitConfirmEliminar(null)
    } catch (err) {
      console.error('Error al eliminar bitácora:', err)
    } finally {
      setBitEliminando(false)
    }
  }

  /* ── Análisis IA ── */
  const handleSubirPdfCalc = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !proyecto) return
    setSubiendoPdf(true)
    setErrorAnalisis('')
    try {
      const ts   = Date.now()
      const path = `calculadoras/${proyecto.id}/${ts}_${file.name}`
      const { error: upErr } = await supabase.storage
        .from('proyectos-documentos')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage
        .from('proyectos-documentos')
        .getPublicUrl(path)
      await apiClient.patch(`/proyectos/${proyecto.id}`, {
        calculadora_pdf_url: publicUrl,
        calculadora_pdf_nombre: file.name,
      })
      setProyecto((prev) => ({ ...prev, calculadoraPdfUrl: publicUrl, calculadoraPdfNombre: file.name }))
      // Disparar análisis automáticamente
      await handleAnalizarProyecto(publicUrl)
    } catch (err) {
      console.error('Error al subir PDF calculadora:', err)
      setErrorAnalisis('Error al subir el PDF: ' + (err.message || 'intenta de nuevo'))
    } finally {
      setSubiendoPdf(false)
      e.target.value = ''
    }
  }

  const handleAnalizarProyecto = async () => {
    setAnalizando(true)
    setErrorAnalisis('')
    try {
      const data = await apiClient.post(`/proyectos/${id}/analizar`, {})
      const nuevoAnalisis = data.analisis
      setProyecto((prev) => ({ ...prev, analisisIa: nuevoAnalisis, analisisIaFecha: data.fecha }))
      // Agregar mensaje automático al chat
      const msgAuto = {
        role: 'assistant',
        content: `He actualizado el análisis del proyecto. ${nuevoAnalisis?.resumen_ejecutivo ?? ''}`,
        pendientes: [],
      }
      setChatHistorial((prev) => {
        const nuevo = [...prev, msgAuto]
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        return nuevo
      })
    } catch (err) {
      console.error('Error al analizar proyecto:', err)
      setErrorAnalisis('Error al generar el análisis: ' + (err.message || 'intenta de nuevo'))
    } finally {
      setAnalizando(false)
    }
  }

  const handleEnviarChat = async (e) => {
    e?.preventDefault()
    const texto = chatMensaje.trim()
    if (!texto || chatEnviando) return
    setChatMensaje('')
    setChatError('')
    const historialActual = chatHistorial
    setChatHistorial((prev) => [...prev, { role: 'user', content: texto }])
    setChatEnviando(true)
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    try {
      const data = await apiClient.post(`/proyectos/${id}/chat`, { mensaje: texto, historial: historialActual })
      setChatHistorial(data.historial)
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (err) {
      console.error('Error en chat:', err)
      setChatError('Error al conectar con ARIA. Intenta de nuevo.')
      setChatHistorial(historialActual)
    } finally {
      setChatEnviando(false)
    }
  }

  const handleEliminarProyecto = async () => {
    if (eliminarConfirmNombre !== proyecto.nombre) return
    setEliminandoProyecto(true)
    try {
      await apiClient.delete(`/proyectos/${id}`)
      navigate('/proyectos')
    } catch (err) {
      console.error('Error al eliminar proyecto:', err)
      setEliminandoProyecto(false)
    }
  }

  /* ── Comprobantes de pago ── */
  const handleComprobanteChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !comprobanteTarget) return
    const { cotId, condicionId } = comprobanteTarget
    const cot = allCots.find((c) => c.id === cotId)
    if (!cot) return
    const key = `${cotId}_${condicionId}`
    setSubiendoComprobante((prev) => ({ ...prev, [key]: true }))
    try {
      const ext = file.name.split('.').pop()
      const path = `comprobantes-pago/${cotId}/${condicionId}_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('proyectos-documentos')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const url = supabase.storage.from('proyectos-documentos').getPublicUrl(path).data.publicUrl
      const newArray = [
        ...(cot.pagosComprobantes || []).filter((p) => p.condicion_id !== condicionId),
        { condicion_id: condicionId, url, nombre: file.name, fecha: new Date().toISOString().slice(0, 10) },
      ]
      await supabase.from('cotizaciones').update({ pagos_comprobantes: newArray }).eq('id', cotId)
      updateCotizacion(cotId, { pagosComprobantes: newArray })
    } catch (err) {
      console.error('Error al subir comprobante:', err)
    } finally {
      setSubiendoComprobante((prev) => ({ ...prev, [key]: false }))
      setComprobanteTarget(null)
      if (comprobanteFileRef.current) comprobanteFileRef.current.value = ''
    }
  }

  const handleAgregarComprobante = async (file) => {
    if (!file || !modalComprobantes) return
    const { cotId, condicionId, descripcion } = modalComprobantes
    const cot = allCots.find((c) => c.id === cotId)
    if (!cot) return
    if (comprobanteModalFileRef.current) comprobanteModalFileRef.current.value = ''

    // 1. Subir a Storage
    setEstadoModalComp('subiendo')
    let url
    try {
      const ts   = Date.now()
      const path = `comprobantes-pago/${cotId}/${condicionId}_${ts}_${file.name}`
      const { error: upErr } = await supabase.storage
        .from('proyectos-documentos')
        .upload(path, file, { upsert: false, contentType: file.type })
      if (upErr) throw upErr
      url = supabase.storage.from('proyectos-documentos').getPublicUrl(path).data.publicUrl
    } catch (err) {
      console.error('Error al subir comprobante:', err)
      setEstadoModalComp('idle')
      return
    }

    // 2. Analizar con IA
    const esImagen = file.type.startsWith('image/')
    const esPdf    = file.type === 'application/pdf'
    const apiKey   = import.meta.env.VITE_ANTHROPIC_API_KEY
    let datosIA  = null
    let iaSaltada = false  // true cuando el formato no es compatible

    if (!esImagen && !esPdf) {
      iaSaltada = true
    } else if (apiKey) {
      setEstadoModalComp('analizando')
      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        const contentBlock = esImagen
          ? { type: 'image',    source: { type: 'base64', media_type: file.type,          data: base64 } }
          : { type: 'document', source: { type: 'base64', media_type: 'application/pdf',   data: base64 } }

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 400,
            messages: [{
              role: 'user',
              content: [
                contentBlock,
                { type: 'text', text: 'Analiza este comprobante de pago bancario/transferencia. Extrae y responde SOLO con un JSON con esta estructura exacta, sin texto adicional ni backticks:\n{"monto":número sin puntos ni comas,"fecha":"YYYY-MM-DD","banco_origen":"nombre del banco emisor o null","banco_destino":"nombre del banco receptor o null","numero_transferencia":"número de operación o null","glosa":"descripción del pago","tipo_documento":"Transferencia o Depósito o Cheque"}' },
              ],
            }],
          }),
        })
        if (res.ok) {
          const data = await res.json()
          const texto = data.content?.[0]?.text ?? ''
          datosIA = JSON.parse(texto.trim())
        }
      } catch (err) {
        console.warn('No se pudo analizar con IA:', err)
        // datosIA queda null → formulario vacío con aviso
      }
    }

    // 3. Mostrar formulario de confirmación
    const glosaDefault = `Pago ${descripcion || ''} - ${proyecto?.nombre || ''} - ${cot.numero || ''}`
    setFormConfirmacion({
      url,
      fileName: file.name,
      cotId,
      condicionId,
      monto:               datosIA?.monto               ?? '',
      fecha:               datosIA?.fecha               ?? new Date().toISOString().slice(0, 10),
      banco_origen:        datosIA?.banco_origen        ?? '',
      numero_transferencia: datosIA?.numero_transferencia ?? '',
      glosa:               datosIA?.glosa               ?? glosaDefault,
      tipo_documento:      datosIA?.tipo_documento      ?? 'Transferencia',
      ia_ok:      datosIA !== null,
      ia_saltada: iaSaltada,
    })
    setEstadoModalComp('confirmando')
  }

  const handleEliminarComprobante = async (cotId, url) => {
    const cot = allCots.find((c) => c.id === cotId)
    if (!cot) return
    try {
      // 1. Buscar movimiento_id en ambos flujos
      const compLegacy = (cot.pagosComprobantes || []).find((p) => p.url === url)
      const compNuevo  = (cot.condicionesPago || [])
        .flatMap((cp) => cp.comprobantes || [])
        .find((p) => p.url === url)
      const movimientoId = compLegacy?.movimiento_id || compNuevo?.movimiento_id

      // 2. Eliminar movimiento en Supabase si existe
      if (movimientoId) {
        await supabase.from('movimientos').delete().eq('id', movimientoId)
      }

      // 3. Actualizar pagos_comprobantes (flujo legacy)
      const newPagos = (cot.pagosComprobantes || []).filter((p) => p.url !== url)

      // 4. Actualizar condiciones_pago: quitar comprobante y resetear si queda sin comprobantes
      const newCondiciones = (cot.condicionesPago || []).map((cp) => {
        const newComps = (cp.comprobantes || []).filter((c) => c.url !== url)
        if (newComps.length === (cp.comprobantes || []).length) return cp
        const sinComprobantes = newComps.length === 0
        return {
          ...cp,
          comprobantes: newComps,
          ...(sinComprobantes ? { pagado: false, estado: 'pendiente' } : {}),
        }
      })

      // 5. PATCH con ambos campos actualizados
      await apiClient.patch(`/cotizaciones/${cotId}`, {
        pagos_comprobantes: newPagos,
        condiciones_pago:   newCondiciones,
      })

      // 6. Actualizar estado local
      updateCotizacionLocal(cotId, { pagosComprobantes: newPagos, condicionesPago: newCondiciones })
      setConfirmElimComp(null)
    } catch (err) {
      console.error('Error al eliminar comprobante:', err)
    }
  }

  const handleConfirmarComprobante = async () => {
    if (!formConfirmacion || !modalComprobantes) return
    const { url, fileName, cotId, condicionId, monto, fecha, banco_origen, numero_transferencia, glosa } = formConfirmacion
    const { descripcion } = modalComprobantes
    const cot = allCots.find((c) => c.id === cotId)
    if (!cot) return

    setEstadoModalComp('guardando')
    try {
      const movId = crypto.randomUUID()
      const montoNum = Number(String(monto).replace(/\./g, '').replace(/,/g, ''))

      // 1. Insertar movimiento directamente con todos los campos
      const { error } = await supabase.from('movimientos').insert({
        id: movId,
        empresa_id: user?.empresa_id,
        fecha,
        glosa,
        descripcion: glosa,
        tipo: 'abono',
        monto: montoNum,
        conciliado: false,
        cuenta_bancaria_id: null,
        gasto_id: String(condicionId),
        gasto_descripcion: `Pago condición: ${descripcion || ''} | Proyecto: ${proyecto?.nombre || ''} | Cotización: ${cot.numero || ''}`,
      })
      // Actualizar estado local de movimientos (sin pasar por AppContext para evitar doble insert)
      setMovimientosProyecto((prev) => [...prev, { id: movId, gasto_id: String(condicionId), monto: montoNum, fecha, glosa, tipo: 'abono' }])

      // 2. Actualizar pagos_comprobantes (mantiene la lista del modal)
      const newPagos = [
        ...(cot.pagosComprobantes || []),
        { condicion_id: condicionId, url, nombre: fileName, fecha, movimiento_id: movId },
      ]

      // 3. Actualizar condiciones_pago marcando la condición como pagada
      const newCondiciones = (cot.condicionesPago || []).map((cp) =>
        String(cp.id) === String(condicionId)
          ? { ...cp, pagado: true, estado: 'pagado', comprobantes: [...(cp.comprobantes || []), { url, fecha_subida: new Date().toISOString(), movimiento_id: movId }] }
          : cp
      )

      await apiClient.patch(`/cotizaciones/${cotId}`, {
        pagos_comprobantes: newPagos,
        condiciones_pago:   newCondiciones,
      })
      updateCotizacionLocal(cotId, { pagosComprobantes: newPagos, condicionesPago: newCondiciones })

      setFormConfirmacion(null)
      setEstadoModalComp('idle')
      setToastComp('Comprobante registrado y movimiento contable creado')
      setTimeout(() => setToastComp(''), 4000)
    } catch (err) {
      console.error('Error al confirmar comprobante:', err)
      setEstadoModalComp('confirmando')
    }
  }

  /* ── Comprobantes de OC ── */
  const handleSubirComprobanteOC = async (file) => {
    if (!file || !modalOCComprobantes) return
    if (ocComprobanteModalRef.current) ocComprobanteModalRef.current.value = ''
    const oc = allCompras.find((c) => c.id === modalOCComprobantes.ocId)
    if (!oc) return
    const empresaId = user?.empresa_id || 'sin-empresa'
    const ts = Date.now()
    const path = `${empresaId}/${oc.id}/${ts}_${file.name}`

    setEstadoModalOCComp('subiendo')
    let url
    try {
      const { error } = await supabase.storage
        .from('pago_proveedores')
        .upload(path, file, { upsert: false, contentType: file.type })
      if (error) throw error
      url = supabase.storage.from('pago_proveedores').getPublicUrl(path).data.publicUrl
    } catch (err) {
      setEstadoModalOCComp('idle')
      return
    }

    setEstadoModalOCComp('analizando')
    const iaData = await analizarComprobanteIA(file)

    setUploadedUrlOCPD({ url, nombre: file.name })
    setFormConfirmacionOCPD({
      monto: iaData?.monto ?? '',
      fecha: iaData?.fecha ?? new Date().toISOString().slice(0, 10),
      banco_origen: iaData?.banco_origen ?? '',
      numero_transferencia: iaData?.numero_transferencia ?? '',
      glosa: iaData?.glosa ?? `Pago OC ${oc.numero} - ${oc.proveedor}`,
    })
    setEstadoModalOCComp('confirmando')
  }

  const handleConfirmarOCPD = async () => {
    const oc = allCompras.find((c) => c.id === modalOCComprobantes?.ocId)
    if (!oc || !uploadedUrlOCPD) return
    const empresaId = user?.empresa_id || 'sin-empresa'
    setEstadoModalOCComp('guardando')
    try {
      const montoNum = Number(String(formConfirmacionOCPD.monto).replace(/\./g, '').replace(',', '.'))
      const movId = crypto.randomUUID()
      const { error: movError } = await supabase
        .from('movimientos')
        .insert({
          id: movId,
          empresa_id: empresaId,
          cuenta_bancaria_id: null,
          fecha: formConfirmacionOCPD.fecha,
          glosa: formConfirmacionOCPD.glosa,
          tipo: 'cargo',
          monto: montoNum,
          conciliado: false,
          gasto_id: String(oc.id),
          gasto_descripcion: `Pago OC: ${oc.numero} | Proveedor: ${oc.proveedor} | ${formConfirmacionOCPD.glosa}`,
        })
      if (movError) throw movError
      const newArray = [
        ...(oc.comprobantes || []),
        { url: uploadedUrlOCPD.url, nombre: uploadedUrlOCPD.nombre, fecha: formConfirmacionOCPD.fecha, movimiento_id: movId },
      ]
      updateCompra(oc.id, { comprobantes: newArray })
      setEstadoModalOCComp('idle')
      setFormConfirmacionOCPD(null)
      setUploadedUrlOCPD(null)
    } catch (err) {
      setEstadoModalOCComp('idle')
    }
  }

  /* ── Tareas ── */
  const recalcularAvance = async (listaTareas) => {
    const total = listaTareas.length
    if (total === 0) return
    const completadas = listaTareas.filter((t) => t.estado === 'completada').length
    const porcentaje = Math.round((completadas / total) * 100)
    setAvanceLocal(porcentaje)
    try {
      await apiClient.patch(`/proyectos/${id}/avance`, { porcentaje_avance: porcentaje })
      setProyecto((prev) => ({ ...prev, porcentajeAvance: porcentaje }))
    } catch (err) {
      console.error('Error al recalcular avance:', err)
    }
  }

  const handleCrearTarea = async () => {
    if (!taNombre.trim() || !taFechaFin) return
    if (taFechaInicio && taFechaFin && taFechaFin < taFechaInicio) {
      setTaError('La fecha fin no puede ser anterior a la fecha inicio')
      return
    }
    setTaSaving(true)
    setTaError('')
    try {
      const nuevaTarea = await apiClient.post(`/proyectos/${id}/tareas`, {
        nombre:         taNombre.trim(),
        fecha_inicio:   taFechaInicio || null,
        fecha_fin:      taFechaFin,
        responsable_id: taResponsableId || null,
      })
      const nuevaLista = [...tareas, nuevaTarea]
      setTareas(nuevaLista)
      await recalcularAvance(nuevaLista)
      setTaFormOpen(false)
      setTaNombre('')
      setTaFechaInicio('')
      setTaFechaFin('')
      setTaResponsableId('')
    } catch (err) {
      console.error('Error al crear tarea:', err)
      setTaError(err.message || 'Error al guardar la tarea')
    } finally {
      setTaSaving(false)
    }
  }

  const abrirEdicionTarea = (t) => {
    setTaEditando(t)
    setTaNombre(t.nombre)
    setTaFechaInicio(t.fechaInicio || '')
    setTaFechaFin(t.fechaFin || '')
    setTaResponsableId(t.responsableId || '')
    setTaError('')
    setTaFormOpen(true)
  }

  const handleGuardarEdicionTarea = async () => {
    if (!taNombre.trim() || !taFechaFin) return
    if (taFechaInicio && taFechaFin && taFechaFin < taFechaInicio) {
      setTaError('La fecha fin no puede ser anterior a la fecha inicio')
      return
    }
    setTaSaving(true)
    setTaError('')
    try {
      const updated = await apiClient.patch(`/proyectos/${id}/tareas/${taEditando.id}`, {
        nombre:         taNombre.trim(),
        fecha_inicio:   taFechaInicio || null,
        fecha_fin:      taFechaFin,
        responsable_id: taResponsableId || null,
      })
      const nuevaLista = tareas.map((t) => (t.id === taEditando.id ? updated : t))
      setTareas(nuevaLista)
      await recalcularAvance(nuevaLista)
      setTaFormOpen(false)
      setTaEditando(null)
      setTaNombre('')
      setTaFechaInicio('')
      setTaFechaFin('')
      setTaResponsableId('')
    } catch (err) {
      console.error('Error al editar tarea:', err)
      setTaError(err.message || 'Error al guardar los cambios')
    } finally {
      setTaSaving(false)
    }
  }

  const handleCambiarEstadoTarea = async (tareaId, estado) => {
    try {
      const updated = await apiClient.patch(`/proyectos/${id}/tareas/${tareaId}`, { estado })
      const nuevaLista = tareas.map((t) => (t.id === tareaId ? updated : t))
      setTareas(nuevaLista)
      await recalcularAvance(nuevaLista)
    } catch (err) {
      console.error('Error al cambiar estado tarea:', err)
    }
  }

  const openRecordatorio = (tarea) => {
    const trabResp = trabajadores.find((t) => t.usuarioId === tarea.responsableId)
    setModalRecordatorio(tarea)
    setRecTelefono(trabResp?.telefono || '')
    setRecError('')
    setRecEnviado(false)
  }

  const handleEnviarRecordatorio = async () => {
    if (!recTelefono.trim()) { setRecError('Ingresa un número de teléfono'); return }
    setRecEnviando(true)
    setRecError('')
    try {
      await apiClient.post('/whatsapp/recordatorio-tarea', {
        telefono: recTelefono,
        nombre:   modalRecordatorio.responsableNombre || 'Equipo',
        proyecto: proyecto.nombre,
        tarea:    modalRecordatorio.nombre,
        fecha:    modalRecordatorio.fechaFin ? formatDate(modalRecordatorio.fechaFin) : '—',
      })
      setRecEnviado(true)
    } catch (err) {
      setRecError(err.message || 'Error al enviar')
    } finally {
      setRecEnviando(false)
    }
  }

  const handleEliminarTarea = async (tareaId) => {
    try {
      await apiClient.delete(`/proyectos/${id}/tareas/${tareaId}`)
      const nuevaLista = tareas.filter((t) => t.id !== tareaId)
      setTareas(nuevaLista)
      await recalcularAvance(nuevaLista)
    } catch (err) {
      console.error('Error al eliminar tarea:', err)
    }
  }

  /* ── Stats financieras ── */
  const ingresosEsperados = cotsAsignadas.reduce((s, c) => s + (c.total ?? 0), 0)
  const costosOC = ocsAsignadas.reduce((s, c) => s + (c.monto ?? 0), 0)
  const gastosTerreno = gastosAsignados.reduce((s, g) => s + (g.monto ?? 0), 0)
  const margenBruto = ingresosEsperados - costosOC - gastosTerreno
  const pctMargen = ingresosEsperados > 0 ? Math.round((margenBruto / ingresosEsperados) * 100) : 0

  const TABS = [
    { key: 'planificacion', label: 'Planificación',  Icon: CalendarDays  },
    { key: 'tareas',        label: 'Tareas',         Icon: ClipboardList },
    { key: 'equipo',        label: 'Equipo',         Icon: Users         },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!proyecto) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileText className="w-12 h-12 text-slate-300 mb-3" />
        <p className="text-sm text-slate-500">Proyecto no encontrado.</p>
        <button onClick={() => navigate('/proyectos')} className="btn-secondary mt-4">
          <ArrowLeft className="w-4 h-4" />Volver
        </button>
      </div>
    )
  }

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate('/proyectos')}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors mt-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-slate-400">{proyecto.codigo}</p>
              <h2 className="text-xl font-bold text-slate-900 truncate">{proyecto.nombre}</h2>
              {proyecto.cliente && <p className="text-sm text-slate-500 mt-0.5">{proyecto.cliente}</p>}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Estado editable */}
              {estadoEdit ? (
                <select
                  autoFocus
                  value={proyecto.estado}
                  onChange={(e) => handleEstadoChange(e.target.value)}
                  onBlur={() => setEstadoEdit(false)}
                  className="input-base text-xs py-1 px-2 w-36"
                >
                  {Object.entries(ESTADO_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              ) : (
                <button onClick={() => setEstadoEdit(true)} title="Cambiar estado">
                  <EstadoBadge estado={proyecto.estado} />
                </button>
              )}

              <button
                onClick={() => navigate(`/proyectos/${id}/editar`)}
                className="btn-secondary text-xs"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Editar
              </button>
              {isAdmin && (
                <button
                  onClick={() => { setModalEliminarProyecto(true); setEliminarConfirmNombre('') }}
                  className="btn-secondary text-xs text-red-600 hover:bg-red-50 border-red-200"
                  title="Eliminar proyecto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar
                </button>
              )}
            </div>
          </div>

          {/* Slider avance */}
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Avance del proyecto</span>
              <span className="text-xs font-semibold text-slate-700">{avanceLocal}%</span>
            </div>
            {tareas.length === 0 ? (
              <input
                type="range"
                min={0}
                max={100}
                value={avanceLocal}
                onChange={(e) => setAvanceLocal(Number(e.target.value))}
                onMouseUp={handleAvanceRelease}
                onTouchEnd={handleAvanceRelease}
                className="w-full accent-indigo-600"
              />
            ) : (
              <div className="flex items-center gap-2">
                <ProgressBar value={avanceLocal} />
                <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                  {tareas.filter((t) => t.estado === 'completada').length}/{tareas.length} tareas
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ─── TAB TAREAS ──────────────────────────────────────────── */}
      {activeTab === 'tareas' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Tareas ({tareas.length})</h3>
              {tareas.length > 0 && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {tareas.filter((t) => t.estado === 'completada').length} completadas
                  {tareas.filter((t) => t.fechaFin < today && t.estado !== 'completada').length > 0 && (
                    <> · <span className="text-red-600 font-semibold">{tareas.filter((t) => t.fechaFin < today && t.estado !== 'completada').length} vencidas</span></>
                  )}
                </p>
              )}
            </div>
            <button onClick={() => setTaFormOpen((v) => !v)} className="btn-primary text-xs py-1.5 px-3">
              {taFormOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {taFormOpen ? 'Cancelar' : 'Nueva tarea'}
            </button>
          </div>

          {/* Formulario nueva / editar tarea */}
          {taFormOpen && (
            <div className="card p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
                  <input
                    value={taNombre}
                    onChange={(e) => setTaNombre(e.target.value)}
                    placeholder="Nombre de la tarea"
                    className="input-base"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Fecha inicio</label>
                  <input
                    type="date"
                    value={taFechaInicio}
                    onChange={(e) => { setTaFechaInicio(e.target.value); setTaError('') }}
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Fecha fin *</label>
                  <input
                    type="date"
                    value={taFechaFin}
                    onChange={(e) => { setTaFechaFin(e.target.value); setTaError('') }}
                    className="input-base"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Responsable</label>
                  <select
                    value={taResponsableId}
                    onChange={(e) => setTaResponsableId(e.target.value)}
                    className="input-base"
                  >
                    <option value="">Sin responsable</option>
                    {trabajadores
                      .filter((t) => t.usuarioId && t.estado === 'activo')
                      .map((t) => (
                        <option key={t.id} value={t.usuarioId}>{t.nombre}</option>
                      ))}
                  </select>
                </div>
              </div>
              {taError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {taError}
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button className="btn-secondary" onClick={() => { setTaFormOpen(false); setTaEditando(null); setTaError(''); setTaNombre(''); setTaFechaInicio(''); setTaFechaFin(''); setTaResponsableId('') }}>Cancelar</button>
                <button
                  className="btn-primary disabled:opacity-50"
                  disabled={!taNombre.trim() || !taFechaFin || taSaving}
                  onClick={taEditando ? handleGuardarEdicionTarea : handleCrearTarea}
                >
                  {taSaving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : taEditando ? (
                    <Edit2 className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {taEditando ? 'Guardar cambios' : 'Crear tarea'}
                </button>
              </div>
            </div>
          )}

          {/* Lista de tareas */}
          {tareas.length === 0 ? (
            <div className="card py-12 text-center">
              <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400">Sin tareas. Crea la primera con el botón de arriba.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="divide-y divide-slate-50">
                {tareas.map((t) => {
                  const completada = t.estado === 'completada'
                  const msPerDay = 1000 * 60 * 60 * 24
                  const dias = Math.round((new Date(t.fechaFin) - new Date(today)) / msPerDay)
                  const colorDot = completada ? 'bg-slate-300'
                    : dias > 4  ? 'bg-emerald-500'
                    : dias >= 1 ? 'bg-amber-400'
                    : 'bg-red-500'
                  const diasText = completada ? null
                    : dias < 0  ? `Venció hace ${Math.abs(dias)}d`
                    : dias === 0 ? 'Vence hoy'
                    : `${dias} día${dias !== 1 ? 's' : ''}`
                  const diasCls = dias <= 0 ? 'text-red-600 font-semibold'
                    : dias <= 4 ? 'text-amber-600 font-semibold'
                    : 'text-slate-400'
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors">
                      {/* Indicador de color */}
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colorDot}`} />
                      {/* Nombre + responsable */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${completada ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {t.nombre}
                        </p>
                        {t.fechaInicio && t.fechaFin && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            Del {fmtFechaCorta(t.fechaInicio)} al {fmtFechaCorta(t.fechaFin)}
                          </p>
                        )}
                        {t.responsableNombre && (
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3" />{t.responsableNombre}
                          </p>
                        )}
                      </div>
                      {/* Fecha + días */}
                      <div className="text-right flex-shrink-0 hidden sm:block min-w-[90px]">
                        <p className="text-xs text-slate-500 flex items-center gap-1 justify-end">
                          <CalendarDays className="w-3 h-3" />{formatDate(t.fechaFin)}
                        </p>
                        {diasText && (
                          <p className={`text-xs mt-0.5 ${diasCls}`}>{diasText}</p>
                        )}
                      </div>
                      {/* Checkbox completada */}
                      <label
                        className="flex items-center cursor-pointer flex-shrink-0 ml-1"
                        title={completada ? 'Marcar como pendiente' : 'Marcar como completada'}
                      >
                        <input
                          type="checkbox"
                          checked={completada}
                          onChange={() => handleCambiarEstadoTarea(t.id, completada ? 'pendiente' : 'completada')}
                          className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                        />
                      </label>
                      {/* Recordatorio WhatsApp */}
                      {!completada && t.responsableId && (
                        <button
                          onClick={() => openRecordatorio(t)}
                          title="Enviar recordatorio por WhatsApp"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors flex-shrink-0"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {/* Editar */}
                      <button
                        onClick={() => abrirEdicionTarea(t)}
                        title="Editar tarea"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex-shrink-0"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {/* Eliminar */}
                      <button
                        onClick={() => handleEliminarTarea(t.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB PLANIFICACIÓN ───────────────────────────────────── */}
      {activeTab === 'planificacion' && proyecto && (() => {
        const proyPlan   = [{ ...proyecto, porcentajeAvance: avanceLocal ?? proyecto.porcentajeAvance ?? 0 }]
        const tareasPlan = tareas.map((t) => ({ ...t, proyectoId: proyecto.id, proyectoNombre: proyecto.nombre }))
        const colorMap   = { [proyecto.id]: '#6366f1' }
        return (
          <div className="space-y-4">

            {/* Cards financieras */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="card p-4">
                <div className="text-xs text-slate-500 mb-1">Ingresos esperados</div>
                <div className="text-base font-bold text-emerald-700">{formatCLP(ingresosEsperados)}</div>
                <div className="text-xs text-slate-400 mt-0.5">{cotsAsignadas.length} cotizaciones</div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-slate-500 mb-1">Costos OC</div>
                <div className="text-base font-bold text-red-700">{formatCLP(costosOC)}</div>
                <div className="text-xs text-slate-400 mt-0.5">{ocsAsignadas.length} OC</div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-slate-500 mb-1">Gastos terreno</div>
                <div className="text-base font-bold text-orange-700">{formatCLP(gastosTerreno)}</div>
                <div className="text-xs text-slate-400 mt-0.5">{gastosAsignados.length} gastos</div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-slate-500 mb-1">Margen bruto</div>
                <div className={`text-base font-bold ${margenBruto >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>
                  {formatCLP(margenBruto)}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Ingresos − costos</div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-slate-500 mb-1">% Margen</div>
                <div className={`text-base font-bold flex items-center gap-1 ${pctMargen >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>
                  {pctMargen >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {pctMargen}%
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Sobre ingresos</div>
              </div>
            </div>

            {/* Datos del proyecto */}
            <div className="card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">Información del proyecto</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Cliente</p>
                  <p className="font-medium text-slate-800">{proyecto.cliente || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Responsable</p>
                  <p className="font-medium text-slate-800">{proyecto.responsableNombre || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Fecha inicio estimada</p>
                  <p className="font-medium text-slate-800">{proyecto.fechaInicioEst ? formatDate(proyecto.fechaInicioEst) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Fecha fin estimada</p>
                  <p className="font-medium text-slate-800">{proyecto.fechaFinEst ? formatDate(proyecto.fechaFinEst) : '—'}</p>
                </div>
                {proyecto.descripcion && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-500 mb-0.5">Descripción</p>
                    <p className="text-slate-700 whitespace-pre-wrap">{proyecto.descripcion}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Barra progreso */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Progreso general</span>
                <span className="text-sm font-bold text-slate-900">{proyecto.porcentajeAvance}%</span>
              </div>
              <ProgressBar value={proyecto.porcentajeAvance} />
            </div>

            <div className="border-t border-slate-200 my-2" />

            {/* Sección — Gantt */}
            <GanttView proyectos={proyPlan} tareas={tareasPlan} colorMap={colorMap} />

            <div className="border-t border-slate-200 my-6" />

            {/* Sección 2 — Documentos + Bitácora */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Columna izquierda — Documentos */}
              <div className="space-y-4">

                {/* Cotizaciones */}
                <div className="card overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      Cotizaciones ({cotsAsignadas.length})
                    </h3>
                    <button onClick={() => setModalCot(true)} className="btn-primary text-xs py-1.5 px-3">
                      <Plus className="w-3.5 h-3.5" />Agregar
                    </button>
                  </div>
                  {cotsAsignadas.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">Sin cotizaciones asignadas.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-slate-50 border-b border-slate-100">
                          <th className="table-th">Número</th>
                          <th className="table-th">Cliente</th>
                          <th className="table-th text-right">Monto</th>
                          <th className="table-th hidden sm:table-cell">Fecha</th>
                          <th className="table-th text-center">Acción</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-50">
                          {cotsAsignadas.map((c) => (
                            <Fragment key={c.id}>
                              <tr className="hover:bg-slate-50/80">
                                <td className="table-td font-mono">{c.numero}</td>
                                <td className="table-td">{c.cliente}</td>
                                <td className="table-td text-right font-semibold text-emerald-700">{formatCLP(c.total)}</td>
                                <td className="table-td hidden sm:table-cell text-slate-500">{formatDate(c.fecha)}</td>
                                <td className="table-td text-center">
                                  <button onClick={() => quitarCotizacion(c.id)} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                              {c.condicionesPago?.length > 0 && (
                                <tr>
                                  <td colSpan={5} className="p-0 border-b border-slate-100">
                                    <div className="bg-[#f9fafb] px-5 py-2.5">
                                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Condiciones de pago</p>
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="text-slate-400">
                                            <th className="text-left py-1 font-medium">Descripción</th>
                                            <th className="text-center py-1 font-medium w-12">%</th>
                                            <th className="text-right py-1 font-medium w-28 hidden sm:table-cell">Monto</th>
                                            <th className="text-right py-1 font-medium w-28 hidden sm:table-cell">Pagado</th>
                                            <th className="text-center py-1 font-medium w-24">Comprobante</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {c.condicionesPago.map((cp) => {
                                            const monto       = Math.round(((cp.porcentaje ?? 0) / 100) * (c.total ?? 0))
                                            const comps       = (c.pagosComprobantes || []).filter((p) => p.condicion_id === cp.id)
                                            const tieneDoc    = comps.length > 0
                                            const movsCondicion = (movimientosProyecto || []).filter((m) =>
                                              String(m.gasto_id) === String(cp.id) &&
                                              (m.gasto_descripcion || '').includes(String(c.numero))
                                            )
                                            const montoPagado = movsCondicion.reduce((sum, m) => sum + (Number(m.monto) || 0), 0)
                                            return (
                                              <tr key={cp.id}>
                                                <td className="py-1.5 text-slate-700 pr-2">{cp.descripcion || '—'}</td>
                                                <td className="py-1.5 text-center text-slate-500">{cp.porcentaje}%</td>
                                                <td className="py-1.5 text-right font-medium text-slate-700 hidden sm:table-cell">{formatCLP(monto)}</td>
                                                <td className="py-1.5 text-right hidden sm:table-cell">
                                                  <MontoPagadoCell montoPagado={montoPagado} montoAcordado={monto} tieneComprobantes={tieneDoc} />
                                                </td>
                                                <td className="py-1.5">
                                                  <div className="flex items-center justify-center gap-1.5">
                                                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: tieneDoc ? '#22c55e' : '#ef4444', display: 'inline-block', flexShrink: 0 }} />
                                                    <button
                                                      onClick={() => { setConfirmElimComp(null); setEstadoModalComp('idle'); setModalComprobantes({ cotId: c.id, condicionId: cp.id, descripcion: cp.descripcion, monto }) }}
                                                      className="p-0.5 rounded text-slate-400 hover:text-slate-600 transition-colors"
                                                      title={tieneDoc ? `${comps.length} comprobante(s)` : 'Adjuntar comprobante'}
                                                    >
                                                      <Paperclip className="w-3 h-3" />
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>
                                            )
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* OC */}
                <div className="card overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-indigo-600" />
                      Órdenes de Compra ({ocsAsignadas.length})
                    </h3>
                    <button onClick={() => setModalOC(true)} className="btn-primary text-xs py-1.5 px-3">
                      <Plus className="w-3.5 h-3.5" />Agregar
                    </button>
                  </div>
                  {ocsAsignadas.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">Sin OC asignadas.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-slate-50 border-b border-slate-100">
                          <th className="table-th">Número</th>
                          <th className="table-th">Proveedor</th>
                          <th className="table-th hidden md:table-cell">Materiales</th>
                          <th className="table-th text-right">Monto</th>
                          <th className="table-th hidden sm:table-cell">Fecha</th>
                          <th className="table-th text-right hidden sm:table-cell w-28">Pagado</th>
                          <th className="table-th text-center w-16">Pago</th>
                          <th className="table-th text-center">Acción</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-50">
                          {ocsAsignadas.map((c) => {
                            const items = c.items ?? []
                            const visibles = items.slice(0, 3)
                            const resto = items.length - visibles.length
                            const movOC = (movimientosProyecto || []).filter((m) => String(m.gasto_id) === String(c.id))
                            const montoPagadoOC = movOC.reduce((sum, m) => sum + (m.monto || 0), 0)
                            return (
                              <tr key={c.id} className="hover:bg-slate-50/80">
                                <td className="table-td font-mono">{c.numero}</td>
                                <td className="table-td">{c.proveedor || c.proveedorNombre || '—'}</td>
                                <td className="table-td hidden md:table-cell">
                                  {items.length === 0 ? (
                                    <span className="text-slate-400">—</span>
                                  ) : (
                                    <div className="flex flex-col gap-0.5">
                                      {visibles.map((item, i) => {
                                        const nombre = item.descripcion || item.nombre || item.producto || '—'
                                        return (
                                          <span key={i} className="text-slate-600">
                                            {item.cantidad != null ? `• ${item.cantidad} × ${nombre}` : `• ${nombre}`}
                                          </span>
                                        )
                                      })}
                                      {resto > 0 && <span className="text-slate-400 text-[10px]">+ {resto} más</span>}
                                    </div>
                                  )}
                                </td>
                                <td className="table-td text-right font-semibold text-red-700">{formatCLP(c.monto)}</td>
                                <td className="table-td hidden sm:table-cell text-slate-500">{formatDate(c.fecha)}</td>
                                <td className="table-td text-right hidden sm:table-cell">
                                  <MontoPagadoCell
                                    montoPagado={montoPagadoOC}
                                    montoAcordado={c.monto}
                                    tieneComprobantes={(c.comprobantes || []).length > 0}
                                  />
                                </td>
                                <td className="table-td text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: c.comprobantes?.length > 0 ? '#22c55e' : '#ef4444', display: 'inline-block', flexShrink: 0 }} />
                                    <button
                                      onClick={() => { setEstadoModalOCComp('idle'); setFormConfirmacionOCPD(null); setModalOCComprobantes({ ocId: c.id }) }}
                                      className="p-0.5 rounded text-slate-400 hover:text-slate-600 transition-colors"
                                      title={c.comprobantes?.length > 0 ? `${c.comprobantes.length} comprobante(s)` : 'Sin comprobantes'}
                                    >
                                      <Paperclip className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                                <td className="table-td text-center">
                                  <button onClick={() => quitarOC(c.id)} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Alerta: cotizaciones sin OC */}
                {cotsAsignadas.length > 0 && cotsAsignadas.some((c) => !allCompras.some((oc) => oc.cotizacionId === c.id)) && (
                  <div className="space-y-1.5">
                    {cotsAsignadas.map((c) => {
                      const tieneOC = allCompras.some((oc) => oc.cotizacionId === c.id)
                      if (tieneOC) return null
                      return (
                        <div key={c.id} className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-700">
                          <ShoppingCart className="w-3.5 h-3.5 flex-shrink-0" />
                          La cotización <span className="font-mono font-semibold mx-1">{c.numero}</span> aún no tiene órdenes de compra asociadas.
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Gastos */}
                <div className="card overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-indigo-600" />
                      Gastos de terreno ({gastosAsignados.length})
                    </h3>
                    <button onClick={() => setModalGasto(true)} className="btn-primary text-xs py-1.5 px-3">
                      <Plus className="w-3.5 h-3.5" />Adjuntar gastos
                    </button>
                  </div>
                  {gastosAsignados.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">Sin gastos adjuntos.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-slate-50 border-b border-slate-100">
                          <th className="table-th">Trabajador</th>
                          <th className="table-th hidden sm:table-cell">Fecha</th>
                          <th className="table-th">Comercio</th>
                          <th className="table-th hidden md:table-cell">Categoría</th>
                          <th className="table-th">Estado</th>
                          <th className="table-th text-right">Monto</th>
                          <th className="table-th text-center">Acción</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-50">
                          {gastosAsignados.map((g) => (
                            <tr key={g.id} className="hover:bg-slate-50/80">
                              <td className="table-td">{g.trabajadorNombre || '—'}</td>
                              <td className="table-td hidden sm:table-cell text-slate-500">{formatDate(g.fecha)}</td>
                              <td className="table-td">{g.comercio || g.descripcion || '—'}</td>
                              <td className="table-td hidden md:table-cell">
                                {g.categoria ? (
                                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">{g.categoria}</span>
                                ) : '—'}
                              </td>
                              <td className="table-td">
                                <span className={`px-2 py-0.5 rounded-full font-medium ${
                                  g.estado === 'aprobado' || g.estado === 'aprobada'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : g.estado === 'rechazado' || g.estado === 'rechazada'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}>{g.estado}</span>
                              </td>
                              <td className="table-td text-right font-semibold text-red-700">{formatCLP(g.monto)}</td>
                              <td className="table-td text-center">
                                <button onClick={() => quitarGasto(g.id)} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>

              {/* Columna derecha — Bitácora */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  Bitácora del proyecto
                </h3>

                <div className="space-y-3">
                  {bitacora.length === 0 ? (
                    <div className="card py-12 text-center">
                      <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">La bitácora está vacía. Registra el primer evento.</p>
                    </div>
                  ) : (
                    bitacora.map((b) => {
                      const cfg = TIPO_BITACORA[b.tipo] ?? TIPO_BITACORA.nota
                      const puedeEditar = isAdmin || b.usuario_id === user?.id
                      const esImagenes = (b.archivos || []).filter((a) => a.tipo?.startsWith('image/'))
                      const esArchivos = (b.archivos || []).filter((a) => !a.tipo?.startsWith('image/'))

                      if (bitEditando?.id === b.id) {
                        return (
                          <div key={b.id} className="card p-4 space-y-3 border border-indigo-200">
                            <textarea
                              value={bitEditContenido}
                              onChange={(e) => setBitEditContenido(e.target.value)}
                              rows={3}
                              className="input-base resize-none"
                              autoFocus
                            />
                            <div className="flex items-center gap-3">
                              <select
                                value={bitEditTipo}
                                onChange={(e) => setBitEditTipo(e.target.value)}
                                className="input-base w-36"
                              >
                                <option value="nota">Nota</option>
                                <option value="hito">Hito</option>
                                <option value="alerta">Alerta</option>
                              </select>
                              <div className="flex-1" />
                              <button className="btn-secondary text-xs" onClick={() => setBitEditando(null)}>Cancelar</button>
                              <button
                                className="btn-primary text-xs disabled:opacity-50"
                                disabled={!bitEditContenido.trim() || bitEditSaving}
                                onClick={handleEditarBitacora}
                              >
                                {bitEditSaving
                                  ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Guardar
                              </button>
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div key={b.id} className="card p-4 flex gap-3">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.cls}`}>
                            <cfg.Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2 mb-1 flex-wrap">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
                                {cfg.label}
                              </span>
                              {b.usuario_nombre && (
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <User className="w-3 h-3" />{b.usuario_nombre}
                                </span>
                              )}
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <CalendarDays className="w-3 h-3" />
                                {b.created_at ? formatDate(b.created_at.slice(0, 10)) : '—'}
                              </span>
                              {puedeEditar && (
                                <div className="flex items-center gap-1 ml-auto">
                                  <button
                                    onClick={() => abrirEdicionBitacora(b)}
                                    className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                    title="Editar"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  {bitConfirmEliminar === b.id ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-red-600">¿Eliminar?</span>
                                      <button
                                        onClick={() => handleEliminarBitacora(b.id)}
                                        disabled={bitEliminando}
                                        className="text-xs px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                                      >
                                        {bitEliminando ? '...' : 'Sí'}
                                      </button>
                                      <button
                                        onClick={() => setBitConfirmEliminar(null)}
                                        className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-600 hover:bg-slate-300"
                                      >
                                        No
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setBitConfirmEliminar(b.id)}
                                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                      title="Eliminar"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{b.contenido}</p>

                            {esImagenes.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {esImagenes.map((arch, i) => (
                                  <a key={i} href={arch.url} target="_blank" rel="noopener noreferrer">
                                    <img
                                      src={arch.url}
                                      alt={arch.nombre}
                                      className="w-16 h-16 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition-opacity"
                                    />
                                  </a>
                                ))}
                              </div>
                            )}

                            {esArchivos.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {esArchivos.map((arch, i) => (
                                  <a
                                    key={i}
                                    href={arch.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-xs text-slate-600 hover:bg-slate-200 transition-colors max-w-[180px] truncate"
                                  >
                                    <Paperclip className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{arch.nombre}</span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="card p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-800">Nuevo registro</h3>
                  <textarea
                    value={bitContenido}
                    onChange={(e) => setBitContenido(e.target.value)}
                    placeholder="Describe el evento, avance o alerta..."
                    rows={3}
                    className="input-base resize-none"
                  />

                  {bitFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {bitFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-xs text-slate-600">
                          <Paperclip className="w-3 h-3 flex-shrink-0" />
                          <span className="max-w-[140px] truncate">{f.name}</span>
                          <button
                            onClick={() => setBitFiles((prev) => prev.filter((_, idx) => idx !== i))}
                            className="text-slate-400 hover:text-red-500 ml-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <select
                      value={bitTipo}
                      onChange={(e) => setBitTipo(e.target.value)}
                      className="input-base w-36"
                    >
                      <option value="nota">Nota</option>
                      <option value="hito">Hito</option>
                      <option value="alerta">Alerta</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => bitFileRef.current?.click()}
                      disabled={bitFiles.length >= 3}
                      className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40"
                      title={bitFiles.length >= 3 ? 'Máximo 3 archivos' : 'Adjuntar archivo'}
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <input
                      ref={bitFileRef}
                      type="file"
                      className="hidden"
                      multiple
                      onChange={(e) => {
                        const nuevos = Array.from(e.target.files || [])
                        setBitFiles((prev) => [...prev, ...nuevos].slice(0, 3))
                        e.target.value = ''
                      }}
                    />

                    <div className="flex-1" />
                    <button
                      onClick={handleBitacora}
                      disabled={!bitContenido.trim() || bitSaving || bitUploading}
                      className="btn-primary disabled:opacity-50"
                    >
                      {bitSaving || bitUploading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      {bitUploading ? 'Subiendo...' : 'Agregar'}
                    </button>
                  </div>
                </div>
                {/* ARIA — Chat + Análisis IA */}
                {(() => {
                  const analisis = proyecto?.analisisIa
                  const pdfUrl   = proyecto?.calculadoraPdfUrl
                  const pdfNom   = proyecto?.calculadoraPdfNombre
                  const fecha    = proyecto?.analisisIaFecha

                  const fmtMiles = (n) => {
                    if (n == null) return '—'
                    return '$' + Math.round(n).toLocaleString('es-CL')
                  }

                  const ALERTA_STYLE = {
                    danger:  'bg-red-50 border-l-4 border-red-400 text-red-700',
                    warning: 'bg-amber-50 border-l-4 border-amber-400 text-amber-700',
                    ok:      'bg-emerald-50 border-l-4 border-emerald-400 text-emerald-700',
                  }
                  const ALERTA_ICON = { danger: '🔴', warning: '🟡', ok: '🟢' }

                  return (
                    <div className="card overflow-hidden">
                      {/* Header */}
                      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                          🤖 ARIA — Asistente del Proyecto
                        </h3>
                        <div className="flex items-center gap-2">
                          {pdfUrl && (
                            <button
                              onClick={handleAnalizarProyecto}
                              disabled={analizando}
                              className="btn-ghost text-xs py-1.5 px-3 disabled:opacity-50"
                              title="Generar nuevo análisis"
                            >
                              {analizando ? (
                                <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                              ) : '🔄'}
                              Nuevo análisis
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="p-5 space-y-4">
                        {/* Upload PDF si no hay */}
                        {!pdfUrl && !subiendoPdf && (
                          <div className="flex flex-col items-center gap-3 py-4 text-center">
                            <p className="text-xs text-slate-500">Sube el PDF de la calculadora para que ARIA tenga contexto completo</p>
                            <button onClick={() => pdfCalcRef.current?.click()} className="btn-primary text-xs py-2 px-4">
                              📎 Subir PDF Calculadora
                            </button>
                          </div>
                        )}

                        {subiendoPdf && (
                          <div className="flex items-center justify-center gap-3 py-4">
                            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs text-slate-500">Subiendo PDF...</span>
                          </div>
                        )}

                        {errorAnalisis && (
                          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            {errorAnalisis}
                          </div>
                        )}

                        {/* PDF cargado */}
                        {pdfUrl && !subiendoPdf && (
                          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                            <FileText className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                            <span className="text-xs text-slate-600 flex-1 truncate">{pdfNom || 'calculadora.pdf'}</span>
                            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded text-slate-400 hover:text-indigo-600 transition-colors"><Eye className="w-3 h-3" /></a>
                            <button onClick={() => pdfCalcRef.current?.click()} className="text-xs text-slate-400 hover:text-indigo-600 transition-colors" title="Reemplazar PDF">📎</button>
                            {fecha && <span className="text-[10px] text-slate-400 flex-shrink-0">Análisis: {formatDate(fecha.slice(0, 10))}</span>}
                          </div>
                        )}

                        {/* Panel de análisis colapsable */}
                        {analisis && !analizando && (
                          <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <button
                              onClick={() => setMostrarAnalisis((v) => !v)}
                              className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-xs font-medium text-slate-600"
                            >
                              <span>📊 Ver análisis completo</span>
                              <span className="text-slate-400">{mostrarAnalisis ? '▲' : '▼'}</span>
                            </button>
                            {mostrarAnalisis && (
                              <div className="p-4 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div className="card p-3 text-center border border-slate-200">
                                    <p className="text-xs text-slate-500 mb-1">💰 Presupuesto</p>
                                    <p className="text-base font-bold text-slate-800">{fmtMiles(analisis.estado_financiero?.presupuesto_total)}</p>
                                  </div>
                                  <div className="card p-3 text-center border border-indigo-100">
                                    <p className="text-xs text-slate-500 mb-1">📊 Ejecutado</p>
                                    <p className="text-base font-bold text-indigo-700">{analisis.estado_financiero?.porcentaje_ejecutado ?? 0}%</p>
                                    <ProgressBar value={analisis.estado_financiero?.porcentaje_ejecutado ?? 0} />
                                  </div>
                                  <div className="card p-3 text-center border border-emerald-100">
                                    <p className="text-xs text-slate-500 mb-1">✅ Disponible</p>
                                    <p className={`text-base font-bold ${(analisis.estado_financiero?.disponible ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                      {fmtMiles(analisis.estado_financiero?.disponible)}
                                    </p>
                                  </div>
                                </div>
                                {(() => {
                                  const ef = analisis.estado_financiero || {}
                                  const chartData = [
                                    { categoria: 'Materiales', Presupuestado: ef.presupuesto_materiales || 0, Gastado: ef.gastado_oc || 0 },
                                    { categoria: 'Operativo', Presupuestado: ef.presupuesto_operativo || 0, Gastado: ef.gastado_terreno || 0 },
                                    { categoria: 'Total', Presupuestado: ef.presupuesto_total || 0, Gastado: (ef.gastado_oc || 0) + (ef.gastado_terreno || 0) },
                                  ]
                                  return (
                                    <div className="card p-3 border border-slate-200">
                                      <p className="text-xs font-semibold text-slate-600 mb-2">Presupuestado vs Gastado</p>
                                      <ResponsiveContainer width="100%" height={160}>
                                        <BarChart data={chartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                                          <XAxis dataKey="categoria" tick={{ fontSize: 10 }} />
                                          <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                                          <Tooltip formatter={(v) => fmtMiles(v)} />
                                          <Legend wrapperStyle={{ fontSize: 10 }} />
                                          <Bar dataKey="Presupuestado" fill="#6366f1" radius={[3, 3, 0, 0]} />
                                          <Bar dataKey="Gastado" fill="#10b981" radius={[3, 3, 0, 0]} />
                                        </BarChart>
                                      </ResponsiveContainer>
                                    </div>
                                  )
                                })()}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="space-y-1.5">
                                    <p className="text-xs font-semibold text-slate-600">Alertas</p>
                                    {(analisis.alertas || []).length === 0 ? (
                                      <p className="text-xs text-slate-400">Sin alertas</p>
                                    ) : (analisis.alertas || []).map((a, i) => (
                                      <div key={i} className={`text-xs p-2 rounded-lg ${ALERTA_STYLE[a.tipo] || ALERTA_STYLE.warning}`}>
                                        {ALERTA_ICON[a.tipo] || '🟡'} {a.mensaje}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="space-y-1.5">
                                    <p className="text-xs font-semibold text-slate-600">Recomendaciones</p>
                                    {(analisis.recomendaciones || []).length === 0 ? (
                                      <p className="text-xs text-slate-400">Sin recomendaciones</p>
                                    ) : (
                                      <ol className="space-y-1 list-none">
                                        {(analisis.recomendaciones || []).map((r, i) => (
                                          <li key={i} className="text-xs text-slate-700 flex gap-2">
                                            <span className="text-indigo-500 font-bold flex-shrink-0">{i + 1}.</span>
                                            <span>{r}</span>
                                          </li>
                                        ))}
                                      </ol>
                                    )}
                                  </div>
                                </div>
                                {analisis.resumen_ejecutivo && (
                                  <div className="p-3 rounded-lg border-l-4 border-blue-400 bg-blue-50">
                                    <p className="text-xs font-semibold text-blue-700 mb-1">Resumen ejecutivo</p>
                                    <p className="text-xs text-blue-800 leading-relaxed">{analisis.resumen_ejecutivo}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {analizando && (
                          <div className="flex items-center justify-center gap-3 py-4">
                            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs text-slate-500">Generando análisis... (puede tardar unos segundos)</span>
                          </div>
                        )}

                        {/* ── Chat ARIA ── */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                          {/* Historial */}
                          <div className="flex flex-col gap-3 p-4 max-h-80 overflow-y-auto">
                            {chatHistorial.length === 0 ? (
                              <div className="flex items-start gap-2">
                                <span className="text-lg flex-shrink-0">🤖</span>
                                <div className="bg-slate-100 text-slate-700 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-xs leading-relaxed max-w-[85%]">
                                  Hola, soy ARIA. Tengo acceso completo a este proyecto. ¿En qué te puedo ayudar?
                                </div>
                              </div>
                            ) : (
                              chatHistorial.filter(msg => !msg.oculto).map((msg, i) => {
                                if (msg.role === 'user') {
                                  return (
                                    <div key={i} className="flex justify-end">
                                      <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-xs leading-relaxed max-w-[85%] whitespace-pre-wrap">
                                        {msg.content}
                                      </div>
                                    </div>
                                  )
                                }
                                const pendientes = msg.pendientes || []
                                const [pendOpen, setPendOpen] = [false, () => {}]
                                return (
                                  <div key={i} className="flex items-start gap-2">
                                    <span className="text-base flex-shrink-0">🤖</span>
                                    <div className="flex flex-col gap-1.5 max-w-[85%]">
                                      <div className="bg-slate-100 text-slate-700 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap">
                                        {msg.content}
                                      </div>
                                      {pendientes.length > 0 && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs">
                                          <p className="font-semibold text-amber-700 mb-1">📌 Pendientes detectados</p>
                                          <ul className="space-y-0.5">
                                            {pendientes.map((p, pi) => (
                                              <li key={pi} className="text-amber-800">• {p}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })
                            )}
                            {chatEnviando && (
                              <div className="flex items-start gap-2">
                                <span className="text-base flex-shrink-0">🤖</span>
                                <div className="bg-slate-100 text-slate-500 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-xs flex items-center gap-1.5">
                                  <span>ARIA está analizando</span>
                                  <span className="flex gap-0.5">
                                    <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                  </span>
                                </div>
                              </div>
                            )}
                            {chatError && (
                              <p className="text-xs text-red-500 text-center">{chatError}</p>
                            )}
                            <div ref={chatEndRef} />
                          </div>

                          {/* Input */}
                          <form onSubmit={handleEnviarChat} className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-200 bg-white">
                            <input
                              type="text"
                              value={chatMensaje}
                              onChange={(e) => setChatMensaje(e.target.value)}
                              disabled={chatEnviando}
                              placeholder="Escribe tu pregunta..."
                              className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50"
                            />
                            <button
                              type="submit"
                              disabled={chatEnviando || !chatMensaje.trim()}
                              className="btn-primary text-xs px-3 py-2 disabled:opacity-50 flex-shrink-0"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        </div>

                        <input
                          ref={pdfCalcRef}
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={handleSubirPdfCalc}
                        />
                      </div>
                    </div>
                  )
                })()}
              </div>

            </div>
          </div>
        )
      })()}

      {/* ─── TAB DOCUMENTOS ──────────────────────────────────────── */}
      {null && (
        <div className="space-y-4">
          {/* Cotizaciones */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                Cotizaciones ({cotsAsignadas.length})
              </h3>
              <button onClick={() => setModalCot(true)} className="btn-primary text-xs py-1.5 px-3">
                <Plus className="w-3.5 h-3.5" />Agregar
              </button>
            </div>
            {cotsAsignadas.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">Sin cotizaciones asignadas.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50 border-b border-slate-100">
                    <th className="table-th">Número</th>
                    <th className="table-th">Cliente</th>
                    <th className="table-th text-right">Monto</th>
                    <th className="table-th hidden sm:table-cell">Fecha</th>
                    <th className="table-th text-center">Acción</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {cotsAsignadas.map((c) => (
                      <Fragment key={c.id}>
                        <tr className="hover:bg-slate-50/80">
                          <td className="table-td font-mono">{c.numero}</td>
                          <td className="table-td">{c.cliente}</td>
                          <td className="table-td text-right font-semibold text-emerald-700">{formatCLP(c.total)}</td>
                          <td className="table-td hidden sm:table-cell text-slate-500">{formatDate(c.fecha)}</td>
                          <td className="table-td text-center">
                            <button onClick={() => quitarCotizacion(c.id)} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                        {c.condicionesPago?.length > 0 && (
                          <tr>
                            <td colSpan={5} className="p-0 border-b border-slate-100">
                              <div className="bg-[#f9fafb] px-5 py-2.5">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Condiciones de pago</p>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-slate-400">
                                      <th className="text-left py-1 font-medium">Descripción</th>
                                      <th className="text-center py-1 font-medium w-12">%</th>
                                      <th className="text-right py-1 font-medium w-28 hidden sm:table-cell">Monto</th>
                                      <th className="text-right py-1 font-medium w-28 hidden sm:table-cell">Pagado</th>
                                      <th className="text-center py-1 font-medium w-24">Comprobante</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {c.condicionesPago.map((cp) => {
                                      const monto       = Math.round(((cp.porcentaje ?? 0) / 100) * (c.total ?? 0))
                                      const comps       = (c.pagosComprobantes || []).filter((p) => p.condicion_id === cp.id)
                                      const tieneDoc    = comps.length > 0
                                      const movsCondicion = (movimientosProyecto || []).filter((m) =>
                                        String(m.gasto_id) === String(cp.id) &&
                                        (m.gasto_descripcion || '').includes(String(c.numero))
                                      )
                                      const montoPagado = movsCondicion.reduce((sum, m) => sum + (Number(m.monto) || 0), 0)
                                      return (
                                        <tr key={cp.id}>
                                          <td className="py-1.5 text-slate-700 pr-2">{cp.descripcion || '—'}</td>
                                          <td className="py-1.5 text-center text-slate-500">{cp.porcentaje}%</td>
                                          <td className="py-1.5 text-right font-medium text-slate-700 hidden sm:table-cell">{formatCLP(monto)}</td>
                                          <td className="py-1.5 text-right hidden sm:table-cell">
                                            <MontoPagadoCell montoPagado={montoPagado} montoAcordado={monto} tieneComprobantes={tieneDoc} />
                                          </td>
                                          <td className="py-1.5">
                                            <div className="flex items-center justify-center gap-1.5">
                                              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: tieneDoc ? '#22c55e' : '#ef4444', display: 'inline-block', flexShrink: 0 }} />
                                              <button
                                                onClick={() => { setConfirmElimComp(null); setEstadoModalComp('idle'); setModalComprobantes({ cotId: c.id, condicionId: cp.id, descripcion: cp.descripcion, monto }) }}
                                                className="p-0.5 rounded text-slate-400 hover:text-slate-600 transition-colors"
                                                title={tieneDoc ? `${comps.length} comprobante(s)` : 'Adjuntar comprobante'}
                                              >
                                                <Paperclip className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* OC */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-indigo-600" />
                Órdenes de Compra ({ocsAsignadas.length})
              </h3>
              <button onClick={() => setModalOC(true)} className="btn-primary text-xs py-1.5 px-3">
                <Plus className="w-3.5 h-3.5" />Agregar
              </button>
            </div>
            {ocsAsignadas.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">Sin OC asignadas.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50 border-b border-slate-100">
                    <th className="table-th">Número</th>
                    <th className="table-th">Proveedor</th>
                    <th className="table-th hidden md:table-cell">Materiales</th>
                    <th className="table-th text-right">Monto</th>
                    <th className="table-th hidden sm:table-cell">Fecha</th>
                    <th className="table-th text-right hidden sm:table-cell w-28">Pagado</th>
                    <th className="table-th text-center w-16">Pago</th>
                    <th className="table-th text-center">Acción</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {ocsAsignadas.map((c) => {
                      const items = c.items ?? []
                      const visibles = items.slice(0, 3)
                      const resto = items.length - visibles.length
                      const movOC = (movimientosProyecto || []).filter((m) => String(m.gasto_id) === String(c.id))
                      const montoPagadoOC = movOC.reduce((sum, m) => sum + (m.monto || 0), 0)
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/80">
                          <td className="table-td font-mono">{c.numero}</td>
                          <td className="table-td">{c.proveedor || c.proveedorNombre || '—'}</td>
                          <td className="table-td hidden md:table-cell">
                            {items.length === 0 ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                {visibles.map((item, i) => {
                                  const nombre = item.descripcion || item.nombre || item.producto || '—'
                                  return (
                                    <span key={i} className="text-slate-600">
                                      {item.cantidad != null ? `• ${item.cantidad} × ${nombre}` : `• ${nombre}`}
                                    </span>
                                  )
                                })}
                                {resto > 0 && <span className="text-slate-400 text-[10px]">+ {resto} más</span>}
                              </div>
                            )}
                          </td>
                          <td className="table-td text-right font-semibold text-red-700">{formatCLP(c.monto)}</td>
                          <td className="table-td hidden sm:table-cell text-slate-500">{formatDate(c.fecha)}</td>
                          <td className="table-td text-right hidden sm:table-cell">
                            <MontoPagadoCell
                              montoPagado={montoPagadoOC}
                              montoAcordado={c.monto}
                              tieneComprobantes={(c.comprobantes || []).length > 0}
                            />
                          </td>
                          <td className="table-td text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: c.comprobantes?.length > 0 ? '#22c55e' : '#ef4444', display: 'inline-block', flexShrink: 0 }} />
                              <button
                                onClick={() => { setEstadoModalOCComp('idle'); setFormConfirmacionOCPD(null); setModalOCComprobantes({ ocId: c.id }) }}
                                className="p-0.5 rounded text-slate-400 hover:text-slate-600 transition-colors"
                                title={c.comprobantes?.length > 0 ? `${c.comprobantes.length} comprobante(s)` : 'Sin comprobantes'}
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="table-td text-center">
                            <button onClick={() => quitarOC(c.id)} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* MEJORA 2: cotizaciones sin OC */}
          {cotsAsignadas.length > 0 && cotsAsignadas.some((c) => !allCompras.some((oc) => oc.cotizacionId === c.id)) && (
            <div className="space-y-1.5">
              {cotsAsignadas.map((c) => {
                const tieneOC = allCompras.some((oc) => oc.cotizacionId === c.id)
                if (tieneOC) return null
                return (
                  <div key={c.id} className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-700">
                    <ShoppingCart className="w-3.5 h-3.5 flex-shrink-0" />
                    La cotización <span className="font-mono font-semibold mx-1">{c.numero}</span> aún no tiene órdenes de compra asociadas.
                  </div>
                )
              })}
            </div>
          )}

          {/* Gastos */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-600" />
                Gastos de terreno ({gastosAsignados.length})
              </h3>
              <button onClick={() => setModalGasto(true)} className="btn-primary text-xs py-1.5 px-3">
                <Plus className="w-3.5 h-3.5" />Adjuntar gastos
              </button>
            </div>
            {gastosAsignados.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">Sin gastos adjuntos.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50 border-b border-slate-100">
                    <th className="table-th">Trabajador</th>
                    <th className="table-th hidden sm:table-cell">Fecha</th>
                    <th className="table-th">Comercio</th>
                    <th className="table-th hidden md:table-cell">Categoría</th>
                    <th className="table-th">Estado</th>
                    <th className="table-th text-right">Monto</th>
                    <th className="table-th text-center">Acción</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {gastosAsignados.map((g) => (
                      <tr key={g.id} className="hover:bg-slate-50/80">
                        <td className="table-td">{g.trabajadorNombre || '—'}</td>
                        <td className="table-td hidden sm:table-cell text-slate-500">{formatDate(g.fecha)}</td>
                        <td className="table-td">{g.comercio || g.descripcion || '—'}</td>
                        <td className="table-td hidden md:table-cell">
                          {g.categoria ? (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">{g.categoria}</span>
                          ) : '—'}
                        </td>
                        <td className="table-td">
                          <span className={`px-2 py-0.5 rounded-full font-medium ${
                            g.estado === 'aprobado' || g.estado === 'aprobada'
                              ? 'bg-emerald-100 text-emerald-700'
                              : g.estado === 'rechazado' || g.estado === 'rechazada'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>{g.estado}</span>
                        </td>
                        <td className="table-td text-right font-semibold text-red-700">{formatCLP(g.monto)}</td>
                        <td className="table-td text-center">
                          <button onClick={() => quitarGasto(g.id)} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB EQUIPO ──────────────────────────────────────────── */}
      {activeTab === 'equipo' && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              Equipo del proyecto ({trabsAsignados.length})
            </h3>
            <button onClick={() => setModalTrab(true)} className="btn-primary text-xs py-1.5 px-3">
              <Plus className="w-3.5 h-3.5" />Agregar trabajador
            </button>
          </div>
          {trabsAsignados.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400">Sin trabajadores asignados.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {trabsAsignados.map((t) => (
                <div key={t.trabajadorId} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-indigo-700 text-xs font-bold">
                      {(t.nombre || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{t.nombre || '—'}</p>
                    <p className="text-xs text-slate-500">{t.cargo || '—'}</p>
                  </div>
                  <div className="text-xs text-indigo-600 font-medium mr-2">{t.rol || '—'}</div>
                  <button
                    onClick={() => removerTrabajador(t.trabajadorId)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Remover del proyecto"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB BITÁCORA ────────────────────────────────────────── */}
      {null && (
        <div className="space-y-4">
          {/* Lista de entradas */}
          <div className="space-y-3">
            {bitacora.length === 0 ? (
              <div className="card py-12 text-center">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">La bitácora está vacía. Registra el primer evento.</p>
              </div>
            ) : (
              bitacora.map((b) => {
                const cfg = TIPO_BITACORA[b.tipo] ?? TIPO_BITACORA.nota
                const puedeEditar = isAdmin || b.usuario_id === user?.id
                const esImagenes = (b.archivos || []).filter((a) => a.tipo?.startsWith('image/'))
                const esArchivos = (b.archivos || []).filter((a) => !a.tipo?.startsWith('image/'))

                if (bitEditando?.id === b.id) {
                  return (
                    <div key={b.id} className="card p-4 space-y-3 border border-indigo-200">
                      <textarea
                        value={bitEditContenido}
                        onChange={(e) => setBitEditContenido(e.target.value)}
                        rows={3}
                        className="input-base resize-none"
                        autoFocus
                      />
                      <div className="flex items-center gap-3">
                        <select
                          value={bitEditTipo}
                          onChange={(e) => setBitEditTipo(e.target.value)}
                          className="input-base w-36"
                        >
                          <option value="nota">Nota</option>
                          <option value="hito">Hito</option>
                          <option value="alerta">Alerta</option>
                        </select>
                        <div className="flex-1" />
                        <button className="btn-secondary text-xs" onClick={() => setBitEditando(null)}>Cancelar</button>
                        <button
                          className="btn-primary text-xs disabled:opacity-50"
                          disabled={!bitEditContenido.trim() || bitEditSaving}
                          onClick={handleEditarBitacora}
                        >
                          {bitEditSaving
                            ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Guardar
                        </button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={b.id} className="card p-4 flex gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.cls}`}>
                      <cfg.Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                        {b.usuario_nombre && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <User className="w-3 h-3" />{b.usuario_nombre}
                          </span>
                        )}
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {b.created_at ? formatDate(b.created_at.slice(0, 10)) : '—'}
                        </span>
                        {puedeEditar && (
                          <div className="flex items-center gap-1 ml-auto">
                            <button
                              onClick={() => abrirEdicionBitacora(b)}
                              className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            {bitConfirmEliminar === b.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-red-600">¿Eliminar?</span>
                                <button
                                  onClick={() => handleEliminarBitacora(b.id)}
                                  disabled={bitEliminando}
                                  className="text-xs px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                  {bitEliminando ? '...' : 'Sí'}
                                </button>
                                <button
                                  onClick={() => setBitConfirmEliminar(null)}
                                  className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-600 hover:bg-slate-300"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setBitConfirmEliminar(b.id)}
                                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{b.contenido}</p>

                      {/* Imágenes adjuntas */}
                      {esImagenes.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {esImagenes.map((arch, i) => (
                            <a key={i} href={arch.url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={arch.url}
                                alt={arch.nombre}
                                className="w-16 h-16 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition-opacity"
                              />
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Otros archivos adjuntos */}
                      {esArchivos.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {esArchivos.map((arch, i) => (
                            <a
                              key={i}
                              href={arch.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-xs text-slate-600 hover:bg-slate-200 transition-colors max-w-[180px] truncate"
                            >
                              <Paperclip className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{arch.nombre}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Formulario nueva entrada */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Nuevo registro</h3>
            <textarea
              value={bitContenido}
              onChange={(e) => setBitContenido(e.target.value)}
              placeholder="Describe el evento, avance o alerta..."
              rows={3}
              className="input-base resize-none"
            />

            {/* Archivos seleccionados (preview) */}
            {bitFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {bitFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-xs text-slate-600">
                    <Paperclip className="w-3 h-3 flex-shrink-0" />
                    <span className="max-w-[140px] truncate">{f.name}</span>
                    <button
                      onClick={() => setBitFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-slate-400 hover:text-red-500 ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <select
                value={bitTipo}
                onChange={(e) => setBitTipo(e.target.value)}
                className="input-base w-36"
              >
                <option value="nota">Nota</option>
                <option value="hito">Hito</option>
                <option value="alerta">Alerta</option>
              </select>

              {/* Botón adjuntar archivos */}
              <button
                type="button"
                onClick={() => bitFileRef.current?.click()}
                disabled={bitFiles.length >= 3}
                className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40"
                title={bitFiles.length >= 3 ? 'Máximo 3 archivos' : 'Adjuntar archivo'}
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                ref={bitFileRef}
                type="file"
                className="hidden"
                multiple
                onChange={(e) => {
                  const nuevos = Array.from(e.target.files || [])
                  setBitFiles((prev) => [...prev, ...nuevos].slice(0, 3))
                  e.target.value = ''
                }}
              />

              <div className="flex-1" />
              <button
                onClick={handleBitacora}
                disabled={!bitContenido.trim() || bitSaving || bitUploading}
                className="btn-primary disabled:opacity-50"
              >
                {bitSaving || bitUploading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {bitUploading ? 'Subiendo...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Comprobantes de condición de pago ────────────── */}
      {modalComprobantes && (() => {
        const { cotId, condicionId, descripcion } = modalComprobantes
        const cot          = allCots.find((c) => c.id === cotId)
        const comprobantes = (cot?.pagosComprobantes || []).filter((p) => p.condicion_id === condicionId)
        const ocupado      = estadoModalComp !== 'idle'
        return (
          <Modal
            open
            onClose={() => {
              if (ocupado) return
              setModalComprobantes(null)
              setFormConfirmacion(null)
              setEstadoModalComp('idle')
            }}
            title={`Comprobantes — ${descripcion || 'condición'}`}
            size="md"
          >
            {/* Toast de éxito */}
            {toastComp && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                {toastComp}
              </div>
            )}

            {/* Spinner — subiendo o analizando */}
            {(estadoModalComp === 'subiendo' || estadoModalComp === 'analizando') && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                <p className="text-sm text-slate-500">
                  {estadoModalComp === 'subiendo' ? 'Subiendo archivo…' : 'Analizando comprobante con IA…'}
                </p>
              </div>
            )}

            {/* Formulario de confirmación */}
            {estadoModalComp === 'confirmando' && formConfirmacion && (
              <div className="space-y-3">
                {formConfirmacion.ia_saltada && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    Formato no compatible con análisis IA, ingresa los datos manualmente
                  </div>
                )}
                {!formConfirmacion.ia_ok && !formConfirmacion.ia_saltada && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    No se pudo leer automáticamente, ingresa los datos manualmente
                  </div>
                )}
                {formConfirmacion.ia_ok && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-700">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    Datos extraídos automáticamente — verifica y confirma
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Monto</label>
                    <input
                      type="number"
                      value={formConfirmacion.monto}
                      onChange={(e) => setFormConfirmacion((f) => ({ ...f, monto: e.target.value }))}
                      className="input-base text-sm w-full"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
                    <input
                      type="date"
                      value={formConfirmacion.fecha}
                      onChange={(e) => setFormConfirmacion((f) => ({ ...f, fecha: e.target.value }))}
                      className="input-base text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Banco origen</label>
                    <input
                      type="text"
                      value={formConfirmacion.banco_origen}
                      onChange={(e) => setFormConfirmacion((f) => ({ ...f, banco_origen: e.target.value }))}
                      className="input-base text-sm w-full"
                      placeholder="—"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">N° operación</label>
                    <input
                      type="text"
                      value={formConfirmacion.numero_transferencia}
                      onChange={(e) => setFormConfirmacion((f) => ({ ...f, numero_transferencia: e.target.value }))}
                      className="input-base text-sm w-full"
                      placeholder="—"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
                  <input
                    type="text"
                    value={formConfirmacion.glosa}
                    onChange={(e) => setFormConfirmacion((f) => ({ ...f, glosa: e.target.value }))}
                    className="input-base text-sm w-full"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => { setFormConfirmacion(null); setEstadoModalComp('idle') }}
                    className="flex-1 btn-ghost text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmarComprobante}
                    disabled={!formConfirmacion.monto || !formConfirmacion.fecha}
                    className="flex-1 btn-primary text-xs disabled:opacity-50"
                  >
                    Confirmar y registrar movimiento
                  </button>
                </div>
              </div>
            )}

            {/* Guardando */}
            {estadoModalComp === 'guardando' && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                <p className="text-sm text-slate-500">Guardando movimiento…</p>
              </div>
            )}

            {/* Lista normal (idle) */}
            {estadoModalComp === 'idle' && (
              <div className="space-y-3">
                {comprobantes.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Sin comprobantes adjuntos para esta condición</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {comprobantes.map((comp, i) => {
                        const ext    = comp.nombre?.split('.').pop()?.toLowerCase() ?? ''
                        const esPdf  = ext === 'pdf'
                        const mov    = movimientosProyecto.find((m) => m.id === comp.movimiento_id)
                        const montoMov     = mov ? Number(mov.monto) : null
                        const montoAcordado = modalComprobantes?.monto ?? 0
                        const coincide = montoMov !== null && montoMov === montoAcordado
                        return (
                          <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                            <div className="flex items-start gap-3">
                              <FileText className={`w-4 h-4 flex-shrink-0 mt-0.5 ${esPdf ? 'text-red-400' : 'text-indigo-400'}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-700 truncate">{comp.nombre}</p>
                                <p className="text-xs text-slate-400">{comp.fecha || ''}</p>
                                {mov ? (
                                  <div className="mt-1 space-y-0.5">
                                    <p className={`text-xs font-semibold ${coincide ? 'text-emerald-600' : 'text-amber-600'}`}>
                                      {formatCLP(montoMov)}
                                    </p>
                                    {mov.glosa && <p className="text-[10px] text-slate-500 truncate">{mov.glosa}</p>}
                                  </div>
                                ) : (
                                  <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                                    Sin registro contable
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <a
                                  href={comp.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                  title="Ver"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </a>
                                {confirmElimComp === comp.url ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-red-600">¿Eliminar?</span>
                                    <button onClick={() => handleEliminarComprobante(cotId, comp.url)} className="text-xs px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700">Sí</button>
                                    <button onClick={() => setConfirmElimComp(null)} className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-600 hover:bg-slate-300">No</button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmElimComp(comp.url)}
                                    className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Footer totalizador */}
                    {(() => {
                      const conMov = comprobantes.filter((c) => c.movimiento_id)
                      if (conMov.length === 0) return null
                      const totalPagado = conMov.reduce((sum, c) => {
                        const m = movimientosProyecto.find((mv) => mv.id === c.movimiento_id)
                        return sum + (m ? Number(m.monto) : 0)
                      }, 0)
                      const montoAcordado = modalComprobantes?.monto ?? 0
                      const diff = totalPagado - montoAcordado
                      return (
                        <div className="pt-3 border-t border-slate-200 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">Total pagado</span>
                            <span className="text-sm font-bold text-slate-800">{formatCLP(totalPagado)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">{formatCLP(montoAcordado)} acordado</span>
                            {diff === 0 ? (
                              <span className="text-xs font-semibold text-emerald-600">✓ Monto completo</span>
                            ) : diff < 0 ? (
                              <span className="text-xs font-semibold text-red-500">Falta: {formatCLP(Math.abs(diff))}</span>
                            ) : (
                              <span className="text-xs font-semibold text-blue-500">Exceso: {formatCLP(diff)}</span>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </>
                )}
                <div className="pt-3 border-t border-slate-100">
                  <button
                    onClick={() => comprobanteModalFileRef.current?.click()}
                    className="btn-primary text-xs w-full"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar comprobante
                  </button>
                  <input
                    ref={comprobanteModalFileRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleAgregarComprobante(file)
                    }}
                  />
                </div>
              </div>
            )}
          </Modal>
        )
      })()}

      {/* ─── Modal: Comprobantes de OC ──────────────────────────── */}
      {modalOCComprobantes && (() => {
        const oc = allCompras.find((c) => c.id === modalOCComprobantes.ocId)
        if (!oc) return null
        const comprobantes = oc.comprobantes || []
        const ocupado = estadoModalOCComp !== 'idle'
        return (
          <Modal
            open
            onClose={() => {
              if (ocupado) return
              setModalOCComprobantes(null)
              setFormConfirmacionOCPD(null)
              setEstadoModalOCComp('idle')
            }}
            title={`Comprobantes — ${oc.numero}`}
            size="md"
          >
            {/* Spinner */}
            {(estadoModalOCComp === 'subiendo' || estadoModalOCComp === 'analizando' || estadoModalOCComp === 'guardando') && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                <p className="text-sm text-slate-500">
                  {estadoModalOCComp === 'subiendo' ? 'Subiendo archivo…'
                    : estadoModalOCComp === 'analizando' ? 'Analizando comprobante con IA…'
                    : 'Guardando movimiento contable…'}
                </p>
              </div>
            )}

            {/* Formulario confirmación */}
            {estadoModalOCComp === 'confirmando' && formConfirmacionOCPD && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-700">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  Datos extraídos automáticamente — verifica y confirma
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Monto</label>
                    <input
                      type="number"
                      value={formConfirmacionOCPD.monto}
                      onChange={(e) => setFormConfirmacionOCPD((f) => ({ ...f, monto: e.target.value }))}
                      className="input-base text-sm w-full"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
                    <input
                      type="date"
                      value={formConfirmacionOCPD.fecha}
                      onChange={(e) => setFormConfirmacionOCPD((f) => ({ ...f, fecha: e.target.value }))}
                      className="input-base text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Banco origen</label>
                    <input
                      type="text"
                      value={formConfirmacionOCPD.banco_origen}
                      onChange={(e) => setFormConfirmacionOCPD((f) => ({ ...f, banco_origen: e.target.value }))}
                      className="input-base text-sm w-full"
                      placeholder="—"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">N° operación</label>
                    <input
                      type="text"
                      value={formConfirmacionOCPD.numero_transferencia}
                      onChange={(e) => setFormConfirmacionOCPD((f) => ({ ...f, numero_transferencia: e.target.value }))}
                      className="input-base text-sm w-full"
                      placeholder="—"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
                  <input
                    type="text"
                    value={formConfirmacionOCPD.glosa}
                    onChange={(e) => setFormConfirmacionOCPD((f) => ({ ...f, glosa: e.target.value }))}
                    className="input-base text-sm w-full"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => { setFormConfirmacionOCPD(null); setEstadoModalOCComp('idle') }}
                    className="flex-1 btn-ghost text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmarOCPD}
                    disabled={!formConfirmacionOCPD.monto || !formConfirmacionOCPD.fecha}
                    className="flex-1 btn-primary text-xs disabled:opacity-50"
                  >
                    Confirmar y registrar movimiento
                  </button>
                </div>
              </div>
            )}

            {/* Lista idle */}
            {estadoModalOCComp === 'idle' && (
              <div className="space-y-3">
                {comprobantes.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Sin comprobantes adjuntos para esta OC</p>
                ) : (
                  <div className="space-y-2">
                    {comprobantes.map((comp, i) => (
                      <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="flex items-start gap-3">
                          <FileText className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate">{comp.nombre}</p>
                            <p className="text-xs text-slate-400">{comp.fecha || ''}</p>
                            {comp.movimiento_id
                              ? <span className="text-[10px] text-emerald-600 font-medium">✓ Movimiento contable registrado</span>
                              : <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Sin registro contable</span>
                            }
                          </div>
                          <a
                            href={comp.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex-shrink-0"
                            title="Ver"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="pt-3 border-t border-slate-100">
                  <button
                    onClick={() => ocComprobanteModalRef.current?.click()}
                    className="btn-primary text-xs w-full"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar comprobante
                  </button>
                  <input
                    ref={ocComprobanteModalRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleSubirComprobanteOC(file)
                    }}
                  />
                </div>
              </div>
            )}
          </Modal>
        )
      })()}

      {/* ─── Modal: Agregar cotización ───────────────────────────── */}
      <Modal open={modalCot} onClose={() => { setModalCot(false); setCotSel(null) }} title="Agregar cotización">
        {cotsDisponibles.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">No hay cotizaciones aprobadas disponibles para asociar.</p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">Número</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">Cliente</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-500">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {cotsDisponibles.map((c) => (
                    <tr key={c.id} onClick={() => setCotSel(c.id)} className={`cursor-pointer transition-colors ${cotSel === c.id ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}>
                      <td className="px-3 py-2 text-center">
                        <input type="radio" checked={cotSel === c.id} onChange={() => setCotSel(c.id)} className="accent-indigo-600" />
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-600">{c.numero}</td>
                      <td className="px-3 py-2 text-slate-700 truncate max-w-[140px]">{c.cliente}</td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatCLP(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => { setModalCot(false); setCotSel(null) }}>Cancelar</button>
              <button className="btn-primary" disabled={!cotSel} onClick={agregarCotizacion}>
                <Plus className="w-4 h-4" />Asociar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Modal: Agregar OC ───────────────────────────────────── */}
      <Modal open={modalOC} onClose={() => { setModalOC(false); setOcSel(null) }} title="Agregar Orden de Compra">
        {ocsDisponibles.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">No hay OC disponibles para asociar.</p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">Número</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">Proveedor</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-500">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {ocsDisponibles.map((c) => (
                    <tr key={c.id} onClick={() => setOcSel(c.id)} className={`cursor-pointer transition-colors ${ocSel === c.id ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}>
                      <td className="px-3 py-2 text-center">
                        <input type="radio" checked={ocSel === c.id} onChange={() => setOcSel(c.id)} className="accent-indigo-600" />
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-600">{c.numero}</td>
                      <td className="px-3 py-2 text-slate-700 truncate max-w-[140px]">{c.proveedor || c.proveedorNombre || '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold text-red-700">{formatCLP(c.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => { setModalOC(false); setOcSel(null) }}>Cancelar</button>
              <button className="btn-primary" disabled={!ocSel} onClick={agregarOC}>
                <Plus className="w-4 h-4" />Asociar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Modal: Adjuntar gastos ──────────────────────────────── */}
      <Modal
        open={modalGasto}
        onClose={() => { setModalGasto(false); setGastosSelModal(new Set()); setGastosFilFecha(''); setGastosFilFechaHasta(''); setGastosFilTrab('todos') }}
        title="Adjuntar gastos a proyecto"
        size="lg"
      >
        <div className="space-y-3">
          {/* Selector de proyecto destino */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Asignar a proyecto</label>
            <select
              value={proyectoDestino || id}
              onChange={(e) => setProyectoDestino(e.target.value)}
              className="input-base text-xs"
            >
              <option value={id}>{proyecto?.nombre ?? 'Proyecto actual'} (actual)</option>
              {proyectosActivos.filter((p) => p.id !== id).map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          {/* Filtros */}
          <div className="flex gap-2 flex-wrap">
            <select
              value={gastosFilTrab}
              onChange={(e) => setGastosFilTrab(e.target.value)}
              className="input-base text-xs py-1 px-2 w-44"
            >
              <option value="todos">Todos los trabajadores</option>
              {trabajadores.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
            <input
              type="date"
              value={gastosFilFecha}
              onChange={(e) => setGastosFilFecha(e.target.value)}
              className="input-base text-xs py-1 px-2"
              placeholder="Desde"
            />
            <input
              type="date"
              value={gastosFilFechaHasta}
              onChange={(e) => setGastosFilFechaHasta(e.target.value)}
              className="input-base text-xs py-1 px-2"
              placeholder="Hasta"
            />
          </div>
          {gastosDisponibles.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No hay gastos disponibles para adjuntar.</p>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 w-8"></th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500">Trabajador</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500">Comercio</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-500 hidden sm:table-cell">Categoría</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-500">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {gastosDisponibles.map((g) => (
                      <tr
                        key={g.id}
                        onClick={() => {
                          setGastosSelModal((prev) => {
                            const next = new Set(prev)
                            next.has(g.id) ? next.delete(g.id) : next.add(g.id)
                            return next
                          })
                        }}
                        className={`cursor-pointer transition-colors ${gastosSelModal.has(g.id) ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={gastosSelModal.has(g.id)} onChange={() => {}} className="accent-indigo-600" />
                        </td>
                        <td className="px-3 py-2 text-slate-700">{g.trabajadorNombre || '—'}</td>
                        <td className="px-3 py-2 text-slate-600 truncate max-w-[120px]">{g.comercio || g.descripcion || '—'}</td>
                        <td className="px-3 py-2 text-slate-500 hidden sm:table-cell">{g.categoria || '—'}</td>
                        <td className="px-3 py-2 text-right font-semibold text-red-700">{formatCLP(g.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-3">
                <button className="btn-secondary" onClick={() => { setModalGasto(false); setGastosSelModal(new Set()) }}>Cancelar</button>
                <button className="btn-primary" disabled={gastosSelModal.size === 0} onClick={agregarGastos}>
                  <CheckCircle2 className="w-4 h-4" />
                  Adjuntar {gastosSelModal.size > 0 ? gastosSelModal.size : ''} gasto{gastosSelModal.size !== 1 ? 's' : ''}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ─── Modal: Agregar trabajador ───────────────────────────── */}
      <Modal open={modalTrab} onClose={() => { setModalTrab(false); setTrabSel(null); setTrabRol('') }} title="Agregar trabajador">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Trabajador</label>
            <select
              value={trabSel || ''}
              onChange={(e) => setTrabSel(e.target.value)}
              className="input-base"
            >
              <option value="">Seleccionar trabajador...</option>
              {trabsDisponibles.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre} {t.cargo ? `— ${t.cargo}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Rol en el proyecto (opcional)</label>
            <input
              value={trabRol}
              onChange={(e) => setTrabRol(e.target.value)}
              placeholder="Ej: Capataz, Instalador, Inspector..."
              className="input-base"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => { setModalTrab(false); setTrabSel(null); setTrabRol('') }}>Cancelar</button>
            <button className="btn-primary" disabled={!trabSel} onClick={agregarTrabajador}>
              <Plus className="w-4 h-4" />Agregar
            </button>
          </div>
        </div>
      </Modal>

      {/* Input oculto para comprobantes de pago */}
      <input
        ref={comprobanteFileRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleComprobanteChange}
      />

      {/* ─── Modal: Eliminar proyecto ───────────────────────────── */}
      <Modal
        open={modalEliminarProyecto}
        onClose={() => { setModalEliminarProyecto(false); setEliminarConfirmNombre('') }}
        title="Eliminar proyecto"
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <p className="font-semibold mb-1">⚠️ Esta acción es permanente</p>
            <p>Se eliminará el proyecto y toda su información: tareas, bitácora, documentos y asignaciones.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Escribe <span className="font-semibold text-slate-800">"{proyecto?.nombre}"</span> para confirmar
            </label>
            <input
              value={eliminarConfirmNombre}
              onChange={(e) => setEliminarConfirmNombre(e.target.value)}
              placeholder="Nombre del proyecto..."
              className="input-base"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3">
            <button className="btn-secondary" onClick={() => { setModalEliminarProyecto(false); setEliminarConfirmNombre('') }}>
              Cancelar
            </button>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              disabled={eliminarConfirmNombre !== proyecto?.nombre || eliminandoProyecto}
              onClick={handleEliminarProyecto}
            >
              {eliminandoProyecto
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Trash2 className="w-4 h-4" />}
              Eliminar proyecto
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Modal: Recordatorio WhatsApp ───────────────────────── */}
      <Modal
        open={!!modalRecordatorio}
        onClose={() => { setModalRecordatorio(null); setRecEnviado(false) }}
        title="Enviar recordatorio por WhatsApp"
        size="sm"
      >
        {modalRecordatorio && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 space-y-1 text-sm">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Tarea</p>
              <p className="font-semibold text-slate-800">{modalRecordatorio.nombre}</p>
              {modalRecordatorio.responsableNombre && (
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <User className="w-3 h-3" />{modalRecordatorio.responsableNombre}
                </p>
              )}
              {modalRecordatorio.fechaFin && (
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />Vence {formatDate(modalRecordatorio.fechaFin)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Número de teléfono</label>
              <input
                type="tel"
                value={recTelefono}
                onChange={(e) => { setRecTelefono(e.target.value); setRecError('') }}
                placeholder="9XXXXXXXX o +569XXXXXXXX"
                className="input-base"
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-1">Se formateará como +56XXXXXXXXX si no incluye código de país.</p>
            </div>

            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs text-slate-600">
              <p className="font-semibold text-emerald-700 mb-1">Vista previa del mensaje</p>
              <p>
                Hola <strong>{modalRecordatorio.responsableNombre || 'Equipo'}</strong>, te recordamos que tienes
                pendiente la tarea <strong>"{modalRecordatorio.nombre}"</strong> del proyecto{' '}
                <strong>{proyecto?.nombre}</strong>
                {modalRecordatorio.fechaFin ? `, con fecha límite el ${formatDate(modalRecordatorio.fechaFin)}` : ''}.
              </p>
            </div>

            {recError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{recError}</div>
            )}
            {recEnviado && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />Recordatorio enviado correctamente.
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => { setModalRecordatorio(null); setRecEnviado(false) }}>
                {recEnviado ? 'Cerrar' : 'Cancelar'}
              </button>
              {!recEnviado && (
                <button
                  className="btn-primary disabled:opacity-50"
                  disabled={!recTelefono.trim() || recEnviando}
                  onClick={handleEnviarRecordatorio}
                >
                  {recEnviando
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Send className="w-4 h-4" />}
                  Enviar por WhatsApp
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
