import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../../services/supabase'
import { formatCLP, formatDate, STATUS_LABELS } from '../../utils/formatters'
import { apiClient } from '../../services/apiClient'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Toast from '../../components/Toast'
import Modal, { ConfirmModal } from '../../components/Modal'
import {
  Plus, Search, Eye, Pencil, Trash2, FileText,
  MessageCircle, Mail, Download, Loader2, Copy, User, Calendar,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Package, X,
  Paperclip, AlertTriangle, CheckCircle2,
} from 'lucide-react'

const FECHA_FILTROS = [
  { id: 'todos', label: 'Todas' },
  { id: 'hoy',   label: 'Hoy' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes',   label: 'Este mes' },
]

function buildPublicUrl(c) {
  const lean = {
    n: c.numero, c: c.cliente, m: c.comuna || '', r: c.direccion || '',
    e: c.email || '', t: c.telefono || '', f: c.fecha, s: c.estado,
    o: c.observaciones || '',
    i: (c.items || []).map((it) => ({
      p: it.producto,
      b: it.incluirDescripcion ? (it.descripcion || '') : '',
      q: it.cantidad, u: it.medicion || 'Unidad', v: it.valorUnitario,
    })),
    nt: c.neto || 0, iv: c.iva || 0, tt: c.total || 0,
  }
  const base = import.meta.env.VITE_PUBLIC_URL || window.location.origin
  return `${base}/ver?d=${btoa(unescape(encodeURIComponent(JSON.stringify(lean))))}`
}

function buildWhatsAppMessage(c, empresa) {
  const nombreEmpresa = empresa?.nombre_fantasia || empresa?.razon_social || 'nosotros'
  const proyecto = c.glosa?.trim() || c.items?.[0]?.producto || 'su proyecto'
  const cliente = c.cliente?.split(' ')[0] || 'cliente'
  return [
    `Hola *${cliente}*, esperamos que te encuentres muy bien.`,
    ``,
    `Tenemos lista tu cotizacion, preparada especialmente para ti:`,
    ``,
    `*Cotizacion:* ${c.numero}`,
    `*Proyecto:* ${proyecto}`,
    ``,
    `Quedamos atentos ante cualquier consulta o ajuste que necesites.`,
    ``,
    `Gracias por comunicarte con *${nombreEmpresa}*.`,
  ].join('\n')
}

const ESTADOS = ['todos', 'borrador', 'enviada', 'visita', 'aprobada', 'en_ejecucion', 'cerrada', 'rechazada', 'perdida']

const PRODUCTO_CHIP = {
  'CAUCHO CONTINUO':  { cls: 'bg-blue-100 text-blue-700',     label: 'Caucho' },
  'TOLDOS VELA':      { cls: 'bg-emerald-100 text-emerald-700', label: 'Toldos' },
  'PASTO SINTETICO':  { cls: 'bg-orange-100 text-orange-700',  label: 'Pasto'  },
}

function abreviarProducto(nombre) {
  return PRODUCTO_CHIP[nombre]?.label ?? nombre.split(' ')[0]
}

function ProductosChips({ productos }) {
  if (!productos?.length) return <span className="text-slate-300 text-xs">—</span>
  const visible = productos.slice(0, 2)
  const extra   = productos.length - 2
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((p) => (
        <span
          key={p}
          className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium leading-tight ${
            PRODUCTO_CHIP[p]?.cls ?? 'bg-slate-100 text-slate-600'
          }`}
        >
          {abreviarProducto(p)}
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium leading-tight bg-slate-100 text-slate-500">
          +{extra}
        </span>
      )}
    </div>
  )
}

export default function CotizacionesPage() {
  const { cotizaciones, deleteCotizacion, updateCotizacion, duplicateCotizacion } = useApp()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroVendedor, setFiltroVendedor] = useState('todos')
  const [filtroFecha, setFiltroFecha] = useState('todos')
  const [filtroProductos, setFiltroProductos] = useState([])
  const [productosDisponibles, setProductosDisponibles] = useState([])
  const [itemsPorPagina, setItemsPorPagina] = useState(25)
  const [paginaActual,   setPaginaActual]   = useState(1)
  const [deleteId, setDeleteId] = useState(null)
  const [duplicateId, setDuplicateId] = useState(null)
  const [modalEnvioEmailCot, setModalEnvioEmailCot] = useState(null)
  const [toast, setToast] = useState(null)
  const comprobanteModalFileRef = useRef(null)
  const [modalPickerCot, setModalPickerCot] = useState(null)
  const [modalComprobantes, setModalComprobantes] = useState(null)
  const [estadoModalComp, setEstadoModalComp] = useState('idle')
  const [formConfirmacion, setFormConfirmacion] = useState(null)
  const [toastComp, setToastComp] = useState('')
  const [confirmElimComp, setConfirmElimComp] = useState(null)
  const [movimientosCot, setMovimientosCot] = useState([])

  const cargarProductos = useCallback(async () => {
    if (!supabase || !user?.empresa_id) return
    const { data } = await supabase
      .from('productos').select('nombre').eq('empresa_id', user.empresa_id).eq('activo', true).order('nombre')
    if (data) setProductosDisponibles(data.map((p) => p.nombre))
  }, [user?.empresa_id])

  useEffect(() => { cargarProductos() }, [cargarProductos])

  useEffect(() => {
    if (!user?.empresa_id || !supabase) return
    supabase
      .from('movimientos')
      .select('id, gasto_id, monto, fecha, glosa, tipo')
      .eq('empresa_id', user.empresa_id)
      .then(({ data }) => { if (data) setMovimientosCot(data) })
  }, [user?.empresa_id])

  // Resetear a página 1 cuando cambia cualquier filtro o el tamaño de página
  useEffect(() => { setPaginaActual(1) }, [search, filtroEstado, filtroVendedor, filtroFecha, filtroProductos, itemsPorPagina])

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4500)
  }

  const vendedores = useMemo(() => {
    const map = new Map()
    cotizaciones.forEach((c) => {
      if (c.usuarioId && !map.has(c.usuarioId)) {
        map.set(c.usuarioId, c.creadoPor || c.usuarioId)
      }
    })
    return [...map.entries()]
      .map(([uid, label]) => ({ uid, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [cotizaciones])

  const filtered = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10)
    const now = new Date()

    return cotizaciones.filter((c) => {
      const matchSearch =
        c.cliente.toLowerCase().includes(search.toLowerCase()) ||
        c.numero.toLowerCase().includes(search.toLowerCase())

      const matchEstado = filtroEstado === 'todos' || c.estado === filtroEstado

      const matchVendedor = filtroVendedor === 'todos' || c.usuarioId === filtroVendedor

      let matchFecha = true
      if (filtroFecha === 'hoy') {
        matchFecha = c.fecha === hoy
      } else if (filtroFecha === 'semana') {
        const dow = now.getDay()
        const diff = dow === 0 ? -6 : 1 - dow
        const lunes = new Date(now)
        lunes.setDate(now.getDate() + diff)
        const lunesStr = lunes.toISOString().slice(0, 10)
        matchFecha = c.fecha >= lunesStr && c.fecha <= hoy
      } else if (filtroFecha === 'mes') {
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        matchFecha = c.fecha?.startsWith(ym)
      }

      const matchProductos = filtroProductos.length === 0 ||
        filtroProductos.some((p) => (c.productos_asociados || []).includes(p))

      return matchSearch && matchEstado && matchVendedor && matchFecha && matchProductos
    })
  }, [cotizaciones, search, filtroEstado, filtroVendedor, filtroFecha, filtroProductos])

  const esActiva = (c) => c.estado === 'aprobada' || c.estado === 'en_ejecucion'

  const totalAprobadas = useMemo(() => filtered.filter(esActiva).length, [filtered])
  const totalOtras     = useMemo(() => filtered.filter(c => !esActiva(c)).length, [filtered])

  const sortedFiltered = useMemo(() => {
    const aprobadas = filtered
      .filter(esActiva)
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
    const otras = filtered
      .filter(c => !esActiva(c))
      .sort((a, b) => (b.fechaCreacion || b.fecha || '').localeCompare(a.fechaCreacion || a.fecha || ''))
    return [...aprobadas, ...otras]
  }, [filtered])

  const totalPaginas = Math.ceil(sortedFiltered.length / itemsPorPagina)
  const cotizacionesPaginadas = sortedFiltered.slice(
    (paginaActual - 1) * itemsPorPagina,
    paginaActual * itemsPorPagina,
  )
  const pageAprobadas = cotizacionesPaginadas.filter(esActiva)
  const pageOtras     = cotizacionesPaginadas.filter(c => !esActiva(c))
  const inicioPag = filtered.length === 0 ? 0 : (paginaActual - 1) * itemsPorPagina + 1
  const finPag    = Math.min(paginaActual * itemsPorPagina, filtered.length)

  const paginasVisibles = (() => {
    if (totalPaginas <= 5) return Array.from({ length: totalPaginas }, (_, i) => i + 1)
    let start = Math.max(1, paginaActual - 2)
    let end   = Math.min(totalPaginas, start + 4)
    if (end - start < 4) start = Math.max(1, end - 4)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  })()

  const PgBtn = ({ onClick, disabled, active, children }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-8 min-w-[2rem] px-2 rounded-lg text-xs font-medium transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed
        ${active
          ? 'bg-indigo-600 text-white'
          : 'text-slate-600 hover:bg-slate-100 disabled:hover:bg-transparent'
        }`}
    >
      {children}
    </button>
  )

  const handleWhatsapp = (c) => {
    if (!c.telefono) {
      showToast('error', 'El cliente no tiene teléfono registrado')
      return
    }
    const msg = buildWhatsAppMessage(c, user?.empresa)
    const phone = c.telefono.replace(/\D/g, '')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
    if (c.estado === 'borrador') changeCotizacionStatus(c.id, 'enviada')
    updateCotizacion(c.id, { enviadoWhatsapp: true })
    showToast('success', `WhatsApp abierto · Para enviar el PDF, abre el detalle`)
  }

  const handleEmail = (c) => {
    if (!c.email) {
      showToast('error', 'El cliente no tiene correo registrado')
      return
    }
    setModalEnvioEmailCot(c)
  }

  const handlePDF = (c) => navigate(`/cotizaciones/${c.id}`)

  const handleAgregarComprobante = async (file) => {
    if (!file || !modalComprobantes) return
    const { cotId, condicionId, descripcion } = modalComprobantes
    const cot = cotizaciones.find((c) => c.id === cotId)
    if (!cot) return
    if (comprobanteModalFileRef.current) comprobanteModalFileRef.current.value = ''

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

    const esImagen = file.type.startsWith('image/')
    const esPdf    = file.type === 'application/pdf'
    const apiKey   = import.meta.env.VITE_ANTHROPIC_API_KEY
    let datosIA  = null
    let iaSaltada = false

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
          ? { type: 'image',    source: { type: 'base64', media_type: file.type,         data: base64 } }
          : { type: 'document', source: { type: 'base64', media_type: 'application/pdf',  data: base64 } }
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
      }
    }

    const glosaDefault = `Pago ${descripcion || ''} - ${cot.numero || ''}`
    setFormConfirmacion({
      url,
      fileName: file.name,
      cotId,
      condicionId,
      monto:                datosIA?.monto               ?? '',
      fecha:                datosIA?.fecha               ?? new Date().toISOString().slice(0, 10),
      banco_origen:         datosIA?.banco_origen        ?? '',
      numero_transferencia: datosIA?.numero_transferencia ?? '',
      glosa:                datosIA?.glosa               ?? glosaDefault,
      tipo_documento:       datosIA?.tipo_documento      ?? 'Transferencia',
      ia_ok:      datosIA !== null,
      ia_saltada: iaSaltada,
    })
    setEstadoModalComp('confirmando')
  }

  const handleEliminarComprobante = async (cotId, url) => {
    const cot = cotizaciones.find((c) => c.id === cotId)
    if (!cot) return
    try {
      const compLegacy = (cot.pagosComprobantes || []).find((p) => p.url === url)
      const compNuevo  = (cot.condicionesPago || [])
        .flatMap((cp) => cp.comprobantes || [])
        .find((p) => p.url === url)
      const movimientoId = compLegacy?.movimiento_id || compNuevo?.movimiento_id
      if (movimientoId) {
        await supabase.from('movimientos').delete().eq('id', movimientoId)
      }
      const newPagos = (cot.pagosComprobantes || []).filter((p) => p.url !== url)
      const newCondiciones = (cot.condicionesPago || []).map((cp) => {
        const newComps = (cp.comprobantes || []).filter((c) => c.url !== url)
        if (newComps.length === (cp.comprobantes || []).length) return cp
        return {
          ...cp,
          comprobantes: newComps,
          ...(newComps.length === 0 ? { pagado: false, estado: 'pendiente' } : {}),
        }
      })
      await apiClient.patch(`/cotizaciones/${cotId}`, {
        pagos_comprobantes: newPagos,
        condiciones_pago:   newCondiciones,
      })
      updateCotizacion(cotId, { pagosComprobantes: newPagos, condicionesPago: newCondiciones })
      setConfirmElimComp(null)
    } catch (err) {
      console.error('Error al eliminar comprobante:', err)
    }
  }

  const handleConfirmarComprobante = async () => {
    if (!formConfirmacion || !modalComprobantes) return
    const { url, fileName, cotId, condicionId, monto, fecha, glosa } = formConfirmacion
    const { descripcion } = modalComprobantes
    const cot = cotizaciones.find((c) => c.id === cotId)
    if (!cot) return

    setEstadoModalComp('guardando')
    try {
      const movId = crypto.randomUUID()
      const montoNum = Number(String(monto).replace(/\./g, '').replace(/,/g, ''))
      await supabase.from('movimientos').insert({
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
        gasto_descripcion: `Pago condición: ${descripcion || ''} | Cotización: ${cot.numero || ''}`,
      })
      setMovimientosCot((prev) => [...prev, { id: movId, gasto_id: String(condicionId), monto: montoNum, fecha, glosa, tipo: 'abono' }])

      const newPagos = [
        ...(cot.pagosComprobantes || []),
        { condicion_id: condicionId, url, nombre: fileName, fecha, movimiento_id: movId },
      ]
      const newCondiciones = (cot.condicionesPago || []).map((cp) =>
        String(cp.id) === String(condicionId)
          ? { ...cp, pagado: true, estado: 'pagado', comprobantes: [...(cp.comprobantes || []), { url, fecha_subida: new Date().toISOString(), movimiento_id: movId }] }
          : cp
      )
      await apiClient.patch(`/cotizaciones/${cotId}`, {
        pagos_comprobantes: newPagos,
        condiciones_pago:   newCondiciones,
      })
      updateCotizacion(cotId, { pagosComprobantes: newPagos, condicionesPago: newCondiciones })
      setFormConfirmacion(null)
      setEstadoModalComp('idle')
      setToastComp('Comprobante registrado y movimiento contable creado')
      setTimeout(() => setToastComp(''), 4000)
    } catch (err) {
      console.error('Error al confirmar comprobante:', err)
      setEstadoModalComp('confirmando')
    }
  }

  const handleDuplicate = () => {
    if (!duplicateId) return
    const nueva = duplicateCotizacion(duplicateId)
    setDuplicateId(null)
    if (nueva) navigate(`/cotizaciones/${nueva.id}/editar`)
  }

  const toDeleteItem = cotizaciones.find((c) => c.id === deleteId)

  const renderFila = (c, trClass) => (
    <tr key={c.id} className={`transition-colors ${trClass} ${['cerrada', 'perdida'].includes(c.estado) ? 'opacity-60' : ''}`}>
      <td className="table-td font-mono text-xs text-slate-500">{c.numero}</td>
      <td className="table-td">
        <div className="font-medium text-slate-800">{c.cliente}</div>
        <div className="text-xs text-slate-400">{c.email}</div>
      </td>
      <td className="table-td hidden lg:table-cell max-w-[180px]">
        <ProductosChips productos={c.productos_asociados} />
      </td>
      <td className="table-td hidden md:table-cell text-slate-500">{formatDate(c.fecha)}</td>
      <td className="table-td text-right font-semibold text-slate-900">
        {formatCLP(c.total)}
        {esActiva(c) && (() => {
          const totalPagado = (c.pagosComprobantes || []).reduce((s, p) => {
            const mov = movimientosCot.find((m) => m.id === p.movimiento_id)
            return s + (mov ? Number(mov.monto) : 0)
          }, 0)
          const pct = c.total > 0 ? Math.min(100, (totalPagado / c.total) * 100) : 0
          const pctR = Math.round(pct)
          const barColor = pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-slate-200'
          const txtColor = pct >= 100 ? 'text-emerald-600' : pct > 0 ? 'text-amber-500' : 'text-slate-400'
          return (
            <div className="mt-1">
              <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pctR}%` }} />
              </div>
              <p className={`text-[10px] font-semibold mt-0.5 ${txtColor}`}>
                {pct >= 100 ? '✓ 100%' : `${pctR}%`}
              </p>
            </div>
          )
        })()}
      </td>
      <td className="table-td"><Badge status={c.estado} /></td>
      <td className="table-td hidden xl:table-cell">
        {c.creadoPor ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-bold text-indigo-600">
                {c.creadoPor.split(' ').map((n) => n[0]).slice(0, 2).join('')}
              </span>
            </div>
            <span className="text-xs text-slate-600">{c.creadoPor}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>
      <td className="table-td hidden lg:table-cell">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${c.enviadoWhatsapp ? 'bg-emerald-500' : 'bg-slate-200'}`} />
          <span className="text-xs text-slate-400">WA</span>
          <span className={`w-2 h-2 rounded-full ${c.enviadoEmail ? 'bg-blue-500' : 'bg-slate-200'}`} />
          <span className="text-xs text-slate-400">Mail</span>
        </div>
      </td>
      <td className="table-td">
        <div className="flex items-center justify-end gap-1">
          <button title="Ver detalle" onClick={() => navigate(`/cotizaciones/${c.id}`)} className="btn-ghost p-1.5">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button title="Duplicar" onClick={() => setDuplicateId(c.id)} className="btn-ghost p-1.5 text-indigo-500 hidden sm:flex">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button title="Ver PDF" onClick={() => handlePDF(c)} className="btn-ghost p-1.5 text-slate-500 hidden sm:flex">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button title="Enviar por email" onClick={() => handleEmail(c)} className="btn-ghost p-1.5 text-blue-400 hover:text-blue-600 hidden sm:flex">
            <Mail className="w-3.5 h-3.5" />
          </button>
          {esActiva(c) && (
            <button
              title="Comprobantes de pago"
              onClick={() => {
                const conds = c.condicionesPago || []
                if (conds.length <= 1) {
                  const cp = conds[0]
                  setModalComprobantes({
                    cotId: c.id,
                    condicionId: cp ? String(cp.id) : 'default',
                    descripcion: cp?.descripcion || 'Pago total',
                    monto: cp?.monto ?? (c.total || 0),
                  })
                } else {
                  setModalPickerCot({ cotId: c.id })
                }
              }}
              className="btn-ghost p-1.5 text-indigo-500 hidden sm:flex"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
          )}
          {(user?.rol === 'admin' || c.usuarioId === user?.id) && (
            <button title="Eliminar" onClick={() => setDeleteId(c.id)} className="btn-ghost p-1.5 text-red-400 hover:text-red-600">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Cotizaciones</h2>
          <p className="text-sm text-slate-500 mt-0.5">{cotizaciones.length} cotizaciones en total</p>
        </div>
        <button onClick={() => navigate('/cotizaciones/nueva')} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nueva </span>Cotización
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        {/* Fila 1: búsqueda + vendedor */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente o número..."
              className="input-base pl-9"
            />
          </div>
          {vendedores.length > 0 && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={filtroVendedor}
                onChange={(e) => setFiltroVendedor(e.target.value)}
                className="input-base pl-9 pr-8 min-w-[180px]"
              >
                <option value="todos">Todos los vendedores</option>
                {vendedores.map((v) => (
                  <option key={v.uid} value={v.uid}>{v.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Fila 2: estado + fecha */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex gap-1.5 flex-wrap">
            {ESTADOS.map((e) => (
              <button
                key={e}
                onClick={() => setFiltroEstado(e)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filtroEstado === e
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {e === 'todos' ? 'Todos' : (STATUS_LABELS[e] ?? e)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 sm:ml-auto flex-wrap">
            <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            {FECHA_FILTROS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltroFecha(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filtroFecha === f.id
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fila 3: filtro por producto */}
        {productosDisponibles.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-500">Filtrar por producto:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {productosDisponibles.map((nombre) => {
                const activo = filtroProductos.includes(nombre)
                return (
                  <button
                    key={nombre}
                    onClick={() => setFiltroProductos((p) =>
                      activo ? p.filter((n) => n !== nombre) : [...p, nombre]
                    )}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      activo
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {nombre}
                    {activo && <X className="w-3 h-3" />}
                  </button>
                )
              })}
              {filtroProductos.length > 0 && (
                <button
                  onClick={() => setFiltroProductos([])}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors underline ml-1"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sin cotizaciones"
            description="No hay cotizaciones que coincidan con tu búsqueda."
            action={
              <button onClick={() => navigate('/cotizaciones/nueva')} className="btn-primary">
                <Plus className="w-4 h-4" /> Nueva Cotización
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="table-th">Número</th>
                  <th className="table-th">Cliente</th>
                  <th className="table-th hidden lg:table-cell">Productos</th>
                  <th className="table-th hidden md:table-cell">Fecha</th>
                  <th className="table-th text-right">Total</th>
                  <th className="table-th">Estado</th>
                  <th className="table-th hidden xl:table-cell">Vendedor</th>
                  <th className="table-th hidden lg:table-cell">Canales</th>
                  <th className="table-th text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* ── Sección APROBADAS ─────────────────────────────── */}
                {pageAprobadas.length > 0 && (
                  <>
                    <tr className="bg-green-50 border-b border-green-100">
                      <td colSpan={9} className="px-4 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-green-800 uppercase tracking-wide">Activas</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-200 text-green-800">
                            {totalAprobadas} activa{totalAprobadas !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {pageAprobadas.map(c => renderFila(c, 'bg-green-50/60 hover:bg-green-100/50 border-l-4 border-green-500'))}
                  </>
                )}

                {/* ── Sección OTRAS ─────────────────────────────────── */}
                {pageOtras.length > 0 && (
                  <>
                    {pageAprobadas.length > 0 && (
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <td colSpan={9} className="px-4 py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Otras cotizaciones</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-600">
                              {totalOtras} cotización{totalOtras !== 1 ? 'es' : ''}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {pageOtras.map(c => renderFila(c, 'hover:bg-slate-50/80'))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 flex-wrap gap-3">
            <p className="text-xs text-slate-500">
              Mostrando <span className="font-medium text-slate-700">{inicioPag}–{finPag}</span> de{' '}
              <span className="font-medium text-slate-700">{filtered.length}</span> cotizaciones
            </p>

            {totalPaginas > 1 && (
              <div className="flex items-center gap-0.5">
                <PgBtn onClick={() => setPaginaActual(1)} disabled={paginaActual === 1}>
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </PgBtn>
                <PgBtn onClick={() => setPaginaActual((p) => p - 1)} disabled={paginaActual === 1}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </PgBtn>
                {paginasVisibles.map((p) => (
                  <PgBtn key={p} onClick={() => setPaginaActual(p)} active={p === paginaActual}>
                    {p}
                  </PgBtn>
                ))}
                <PgBtn onClick={() => setPaginaActual((p) => p + 1)} disabled={paginaActual === totalPaginas}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </PgBtn>
                <PgBtn onClick={() => setPaginaActual(totalPaginas)} disabled={paginaActual === totalPaginas}>
                  <ChevronsRight className="w-3.5 h-3.5" />
                </PgBtn>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Filas:</span>
              <select
                value={itemsPorPagina}
                onChange={(e) => setItemsPorPagina(Number(e.target.value))}
                className="input-base py-1 text-xs w-16"
              >
                {[10, 25, 50, 100].map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteCotizacion(deleteId)}
        title={toDeleteItem?.estado === 'aprobada' ? 'Eliminar cotización aprobada' : 'Eliminar cotización'}
        message={`¿Estás seguro que deseas eliminar la cotización ${toDeleteItem?.numero}? Esta acción no se puede deshacer.`}
        warningNote={
          toDeleteItem?.estado === 'aprobada'
            ? 'Esta cotización está aprobada. Al eliminarla se borrarán también los movimientos de ingresos asociados en Finanzas, lo que afectará el flujo de caja de la empresa.'
            : undefined
        }
      />

      <ConfirmModal
        open={!!duplicateId}
        onClose={() => setDuplicateId(null)}
        onConfirm={handleDuplicate}
        title="Duplicar cotización"
        message={`¿Deseas duplicar la cotización ${cotizaciones.find(c => c.id === duplicateId)?.numero}? Se creará una copia en estado borrador con fecha de hoy.`}
      />

      {/* Modal: selector de condición cuando hay múltiples */}
      {modalPickerCot && (() => {
        const cot = cotizaciones.find((c) => c.id === modalPickerCot.cotId)
        const conds = cot?.condicionesPago || []
        return (
          <Modal open onClose={() => setModalPickerCot(null)} title="Seleccionar condición de pago" size="sm">
            <div className="space-y-2">
              <p className="text-xs text-slate-500 mb-3">Elige la condición a la que quieres adjuntar el comprobante:</p>
              {conds.map((cp) => (
                <button
                  key={cp.id}
                  onClick={() => {
                    setModalPickerCot(null)
                    setModalComprobantes({
                      cotId: cot.id,
                      condicionId: String(cp.id),
                      descripcion: cp.descripcion || 'Condición',
                      monto: cp.monto || 0,
                    })
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{cp.descripcion || 'Sin descripción'}</p>
                    <p className="text-xs text-slate-400">{formatCLP(cp.monto || 0)}</p>
                  </div>
                  {cp.pagado && (
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Pagado</span>
                  )}
                </button>
              ))}
            </div>
          </Modal>
        )
      })()}

      {/* Modal: comprobantes de pago */}
      {modalComprobantes && (() => {
        const { cotId, condicionId, descripcion } = modalComprobantes
        const cot          = cotizaciones.find((c) => c.id === cotId)
        const comprobantes = (cot?.pagosComprobantes || []).filter((p) => String(p.condicion_id) === String(condicionId))
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
            {toastComp && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                {toastComp}
              </div>
            )}

            {(estadoModalComp === 'subiendo' || estadoModalComp === 'analizando') && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                <p className="text-sm text-slate-500">
                  {estadoModalComp === 'subiendo' ? 'Subiendo archivo…' : 'Analizando comprobante con IA…'}
                </p>
              </div>
            )}

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

            {estadoModalComp === 'guardando' && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                <p className="text-sm text-slate-500">Guardando movimiento…</p>
              </div>
            )}

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
                        const mov    = movimientosCot.find((m) => m.id === comp.movimiento_id)
                        const montoMov      = mov ? Number(mov.monto) : null
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

                    {(() => {
                      const conMov = comprobantes.filter((c) => c.movimiento_id)
                      if (conMov.length === 0) return null
                      const totalPagado = conMov.reduce((sum, c) => {
                        const m = movimientosCot.find((mv) => mv.id === c.movimiento_id)
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

      {modalEnvioEmailCot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModalEnvioEmailCot(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Enviar cotización {modalEnvioEmailCot.numero}</h3>
              <p className="text-sm text-slate-500 mt-0.5">a {modalEnvioEmailCot.cliente}</p>
            </div>
            <div className="px-6 py-4">
              <label className="block text-xs font-medium text-slate-500 mb-1">Destinatario</label>
              <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{modalEnvioEmailCot.email}</p>
            </div>
            <div className="flex justify-end gap-2 px-6 pb-5">
              <button onClick={() => setModalEnvioEmailCot(null)} className="btn-secondary">Cancelar</button>
              <button
                onClick={() => {
                  navigate(`/cotizaciones/${modalEnvioEmailCot.id}?accion=enviar-email`)
                  setModalEnvioEmailCot(null)
                }}
                className="btn-primary"
              >
                <Mail className="w-4 h-4" />
                Enviar cotización
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
