import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../auth/AuthContext'
import { formatCLP, formatDate, addBusinessDays } from '../../utils/formatters'
import { apiClient } from '../../services/apiClient'
import { downloadPDF, generatePDFBlob } from '../../utils/pdf'
import Badge from '../../components/Badge'
import Toast from '../../components/Toast'
import { ConfirmModal } from '../../components/Modal'
import {
  ArrowLeft, Pencil, Trash2, MessageCircle, Mail, Download,
  ShoppingCart, CheckCircle, XCircle, Send, Loader2, ChevronRight,
  MapPin, Play, X, Search, AlertCircle,
} from 'lucide-react'
import { supabase } from '../../services/supabase'

function buildPublicUrl(cot, empresa) {
  const lean = {
    n: cot.numero, c: cot.cliente, m: cot.comuna || '', r: cot.direccion || '',
    e: cot.email || '', t: cot.telefono || '', f: cot.fecha, s: cot.estado,
    o: cot.observaciones || '',
    i: (cot.items || []).map((it) => ({
      p: it.producto,
      b: it.incluirDescripcion ? (it.descripcion || '') : '',
      q: it.cantidad, u: it.medicion || 'Unidad', v: it.valorUnitario,
    })),
    nt: cot.neto || 0, iv: cot.iva || 0, tt: cot.total || 0,
    el: empresa?.logo_url                          || null,
    en: empresa?.razon_social  || empresa?.nombre  || null,
    ee: empresa?.email_contacto || empresa?.email  || null,
    eg: empresa?.giro                              || null,
    eb: empresa?.datos_bancarios                   || null,
  }
  const base = import.meta.env.VITE_PUBLIC_URL || window.location.origin
  return `${base}/ver?d=${btoa(unescape(encodeURIComponent(JSON.stringify(lean))))}`
}

function buildWhatsAppMessage(cot, empresa) {
  const nombreEmpresa = empresa?.nombre_fantasia || empresa?.razon_social || 'nosotros'
  const proyecto = cot.glosa?.trim() || cot.items?.[0]?.producto || 'su proyecto'
  const cliente = cot.cliente?.split(' ')[0] || 'cliente'
  return [
    `Hola *${cliente}*, esperamos que te encuentres muy bien.`,
    ``,
    `Tenemos lista tu cotizacion, preparada especialmente para ti:`,
    ``,
    `*Cotizacion:* ${cot.numero}`,
    `*Proyecto:* ${proyecto}`,
    ``,
    `Quedamos atentos ante cualquier consulta o ajuste que necesites.`,
    ``,
    `Gracias por comunicarte con *${nombreEmpresa}*.`,
  ].join('\n')
}

const PIPELINE_FLOW = ['borrador', 'enviada', 'visita', 'aprobada', 'en_ejecucion', 'cerrada']
const PIPELINE_LABELS = {
  borrador: 'Borrador', enviada: 'Enviada', visita: 'Visita',
  aprobada: 'Aprobada', en_ejecucion: 'En ejecución', cerrada: 'Cerrada',
  rechazada: 'Rechazada', perdida: 'Perdida',
}
const PIPELINE_COLORS = {
  borrador:     { active: 'bg-slate-600 text-white',   done: 'bg-slate-200 text-slate-500',    pending: 'bg-slate-100 text-slate-300' },
  enviada:      { active: 'bg-blue-600 text-white',    done: 'bg-blue-100 text-blue-400',      pending: 'bg-slate-100 text-slate-300' },
  visita:       { active: 'bg-purple-600 text-white',  done: 'bg-purple-100 text-purple-400',  pending: 'bg-slate-100 text-slate-300' },
  aprobada:     { active: 'bg-emerald-600 text-white', done: 'bg-emerald-100 text-emerald-400',pending: 'bg-slate-100 text-slate-300' },
  en_ejecucion: { active: 'bg-amber-500 text-white',   done: 'bg-amber-100 text-amber-400',    pending: 'bg-slate-100 text-slate-300' },
  cerrada:      { active: 'bg-emerald-800 text-white', done: 'bg-slate-100 text-slate-300',    pending: 'bg-slate-100 text-slate-300' },
  rechazada:    { active: 'bg-red-500 text-white' },
  perdida:      { active: 'bg-red-800 text-white' },
}

export default function CotizacionDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { cotizaciones, updateCotizacion, deleteCotizacion, changeCotizacionStatus, addCompra, empresa } = useApp()
  const { user } = useAuth()
  const docRef = useRef(null)

  const [loadingPDF, setLoadingPDF] = useState(false)
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [loadingWA, setLoadingWA] = useState(false)
  const [modalEnvioEmail, setModalEnvioEmail] = useState(false)
  const [mensajeEmail, setMensajeEmail] = useState('')
  const [toast, setToast] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmCerrar, setConfirmCerrar] = useState(false)
  const [confirmVolverAprobada, setConfirmVolverAprobada] = useState(false)
  const [confirmVolverVisita,   setConfirmVolverVisita]   = useState(false)
  const [confirmVolverEnviada,  setConfirmVolverEnviada]  = useState(false)
  const [confirmVolverBorrador, setConfirmVolverBorrador] = useState(false)
  const [asociarFacturaModal, setAsociarFacturaModal] = useState(null)
  const [facturasLoaded, setFacturasLoaded]           = useState([])
  const [facturasLoading, setFacturasLoading]         = useState(false)
  const [searchFactura, setSearchFactura]             = useState('')

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4500)
  }

  const cot = cotizaciones.find((c) => c.id === id)

  useEffect(() => {
    console.log('[CotizacionDetalle] user.empresa:', JSON.stringify(user?.empresa, null, 2))
  }, [user?.empresa])

  useEffect(() => {
    if (searchParams.get('print') === '1') setTimeout(() => window.print(), 300)
    if (searchParams.get('accion') === 'enviar-email') setModalEnvioEmail(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!asociarFacturaModal) { setFacturasLoaded([]); setSearchFactura(''); return }
    const empresaId = user?.empresa?.id
    if (!supabase || !empresaId) return
    setFacturasLoading(true)
    supabase
      .from('facturas_sii')
      .select('id, folio, razon_social, total, fecha')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'venta')
      .order('fecha', { ascending: false })
      .limit(200)
      .then(({ data }) => { setFacturasLoaded(data || []); setFacturasLoading(false) })
  }, [asociarFacturaModal]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!cot) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-slate-400">Cotización no encontrada.</p>
          <button onClick={() => navigate('/cotizaciones')} className="btn-secondary mt-3">Volver</button>
        </div>
      </div>
    )
  }

  /* ── Acciones ─────────────────────────────────────────── */

  const markSent = () => {
    if (cot.estado === 'borrador') changeCotizacionStatus(cot.id, 'enviada')
  }

  const handleDownloadPDF = async () => {
    if (!docRef.current) return
    setLoadingPDF(true)
    try {
      await downloadPDF(docRef.current, `${cot.numero}.pdf`)
      showToast('success', `PDF "${cot.numero}.pdf" descargado correctamente`)
    } catch {
      showToast('error', 'No se pudo generar el PDF. Intenta de nuevo.')
    } finally {
      setLoadingPDF(false)
    }
  }

  const handleWhatsapp = async () => {
    if (!cot.telefono) {
      showToast('error', 'El cliente no tiene teléfono registrado')
      return
    }
    if (!docRef.current) {
      showToast('error', 'No se pudo acceder al documento')
      return
    }
    setLoadingWA(true)
    try {
      const empresaId = user?.empresa?.id
      const path = `${empresaId}/${cot.numero}.pdf`

      // Generar blob del PDF
      const pdfBlob = await generatePDFBlob(docRef.current)

      // Subir a Supabase Storage
      const { error: upErr } = await supabase.storage
        .from('cotizaciones-pdf')
        .upload(path, pdfBlob, { contentType: 'application/pdf', upsert: true })
      if (upErr) throw upErr

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('cotizaciones-pdf')
        .getPublicUrl(path)

      // Enviar template + documento por WhatsApp
      await apiClient.post('/whatsapp/cotizacion-pdf', {
        telefono: cot.telefono,
        nombre:   cot.cliente?.split(' ')[0] || 'cliente',
        numero:   cot.numero,
        total:    formatCLP(cot.total),
        fecha:    formatDate(cot.fecha),
        pdfUrl:   publicUrl,
      })

      markSent()
      updateCotizacion(id, { enviadoWhatsapp: true })
      showToast('success', 'Cotización enviada por WhatsApp con PDF adjunto')
    } catch (err) {
      showToast('error', err.message || 'Error al enviar por WhatsApp')
    } finally {
      setLoadingWA(false)
    }
  }

  const handleEmail = () => {
    if (!cot.email) {
      showToast('error', 'El cliente no tiene correo electrónico registrado')
      return
    }
    setMensajeEmail('')
    setModalEnvioEmail(true)
  }

  const handleEnviarEmail = async () => {
    if (!docRef.current) return
    setLoadingEmail(true)
    try {
      const pdfBlob = await generatePDFBlob(docRef.current)
      const pdfBase64 = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result.split(',')[1])
        reader.readAsDataURL(pdfBlob)
      })
      console.log('[email] pdfBase64 length:', pdfBase64?.length)
      console.log('[email] mensaje:', mensajeEmail)
      await apiClient.post(`/cotizaciones/${cot.id}/enviar-email`, { mensaje: mensajeEmail, pdfBase64 })
      markSent()
      updateCotizacion(id, { enviadoEmail: true })
      setModalEnvioEmail(false)
      showToast('success', 'Cotización enviada por correo correctamente')
    } catch {
      showToast('error', 'Error al enviar el correo. Intenta de nuevo.')
    } finally {
      setLoadingEmail(false)
    }
  }

  const handleAsociarFactura = async (factura) => {
    if (!asociarFacturaModal) return
    const { condicionIdx } = asociarFacturaModal
    const updatedCondiciones = (cot.condicionesPago || []).map((cp, i) =>
      i === condicionIdx
        ? { ...cp, factura_sii_id: factura.id, factura_folio: factura.folio }
        : cp
    )
    const { error } = await supabase
      .from('cotizaciones')
      .update({ condiciones_pago: updatedCondiciones })
      .eq('id', cot.id)
    if (!error) {
      updateCotizacion(cot.id, { condicionesPago: updatedCondiciones })
      showToast('success', `Factura Nº${factura.folio} asociada a ${asociarFacturaModal.condicion.descripcion}`)
      setAsociarFacturaModal(null)
    }
  }

  const handleConvertirOC = () => {
    addCompra({
      proveedor: '',
      cotizacionId: cot.id,
      cotizacionNumero: cot.numero,
      items: cot.items.map((i) => ({ id: i.id, producto: i.producto, cantidad: i.cantidad, precio: i.valorUnitario })),
      monto: cot.total,
      observaciones: `Generada desde ${cot.numero}`,
    })
    navigate('/compras')
  }

  const anyLoading = loadingPDF || loadingEmail || loadingWA

  /* ── Render ───────────────────────────────────────────── */

  return (
    <div className="w-full md:max-w-3xl lg:max-w-5xl space-y-5">
      {/* Barra de acciones */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button onClick={() => navigate('/cotizaciones')} className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900">{cot.numero}</h2>
            <Badge status={cot.estado} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Editar */}
          <button onClick={() => navigate(`/cotizaciones/${id}/editar`)} className="btn-secondary">
            <Pencil className="w-4 h-4" />
            <span className="hidden sm:inline">Editar</span>
          </button>

          {/* Descargar PDF */}
          <button
            onClick={handleDownloadPDF}
            disabled={anyLoading}
            className="btn-secondary disabled:opacity-50"
            title="Descargar PDF"
          >
            {loadingPDF
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Download className="w-4 h-4" />
            }
            <span className="hidden sm:inline">PDF</span>
          </button>

          {/* WhatsApp */}
          <button
            onClick={handleWhatsapp}
            disabled={anyLoading}
            className="btn-secondary text-emerald-600 border-emerald-200 hover:bg-emerald-50 disabled:opacity-50"
            title="Enviar por WhatsApp con PDF"
          >
            {loadingWA
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <MessageCircle className="w-4 h-4" />
            }
            <span className="hidden sm:inline">{loadingWA ? 'Generando PDF...' : 'WhatsApp'}</span>
          </button>

          {/* Email */}
          <button
            onClick={handleEmail}
            disabled={anyLoading}
            className="btn-secondary text-blue-600 border-blue-200 hover:bg-blue-50 disabled:opacity-50"
            title="Enviar por correo"
          >
            {loadingEmail
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Mail className="w-4 h-4" />
            }
            <span className="hidden sm:inline">Email</span>
          </button>

          {/* Eliminar — admin o creador */}
          {(user?.rol === 'admin' || cot.usuarioId === user?.id) && (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={anyLoading}
              className="btn-secondary text-red-500 border-red-200 hover:bg-red-50 disabled:opacity-50"
              title="Eliminar cotización"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Eliminar</span>
            </button>
          )}
        </div>
      </div>

      {/* Sección de estado */}
      <div className="card p-5 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Estado actual + pipeline visual */}
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Estado de la cotización</p>
            <div className="flex items-center gap-1 flex-wrap">
              {(() => {
                const currentIdx = PIPELINE_FLOW.indexOf(cot.estado)
                const isNegative = ['rechazada', 'perdida'].includes(cot.estado)
                return (
                  <>
                    {PIPELINE_FLOW.map((s, i) => {
                      const isActive = cot.estado === s
                      const isDone = !isNegative && currentIdx > i
                      const colorKey = isActive ? 'active' : isDone ? 'done' : 'pending'
                      return (
                        <div key={s} className="flex items-center gap-1">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${PIPELINE_COLORS[s][colorKey]}`}>
                            {PIPELINE_LABELS[s]}
                          </span>
                          {i < PIPELINE_FLOW.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />}
                        </div>
                      )
                    })}
                    {isNegative && (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-300 text-xs mx-1">·</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${PIPELINE_COLORS[cot.estado].active}`}>
                          {PIPELINE_LABELS[cot.estado]}
                        </span>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          </div>

          {/* Acciones de estado */}
          <div className="flex flex-col gap-3 sm:items-end">
            {/* Acción principal según estado */}
            {cot.estado === 'borrador' && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-slate-400 sm:text-right">¿Ya enviaste esta cotización al cliente?</p>
                <button onClick={() => changeCotizacionStatus(cot.id, 'enviada')} className="btn-primary">
                  <Send className="w-4 h-4" /> Marcar como Enviada
                </button>
              </div>
            )}
            {cot.estado === 'enviada' && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-slate-400 sm:text-right">¿Cuál es el siguiente paso?</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => changeCotizacionStatus(cot.id, 'visita')} className="btn-secondary text-purple-600 border-purple-200 hover:bg-purple-50">
                    <MapPin className="w-4 h-4" /> Agendar Visita
                  </button>
                  <button onClick={() => changeCotizacionStatus(cot.id, 'aprobada')} className="btn-primary">
                    <CheckCircle className="w-4 h-4" /> Cliente Aprobó
                  </button>
                </div>
                <button
                  onClick={() => setConfirmVolverBorrador(true)}
                  className="mt-1 self-start px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors flex items-center gap-1"
                >
                  ← Volver a Borrador
                </button>
              </div>
            )}
            {cot.estado === 'visita' && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-slate-400 sm:text-right">¿Resultado de la visita?</p>
                <button onClick={() => changeCotizacionStatus(cot.id, 'aprobada')} className="btn-primary">
                  <CheckCircle className="w-4 h-4" /> Cliente Aprobó
                </button>
                <button
                  onClick={() => setConfirmVolverEnviada(true)}
                  className="mt-1 self-start px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors flex items-center gap-1"
                >
                  ← Volver a Enviada
                </button>
              </div>
            )}
            {cot.estado === 'aprobada' && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-slate-400 sm:text-right">Cotización aprobada</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleConvertirOC} className="btn-secondary">
                    <ShoppingCart className="w-4 h-4" /> Crear OC
                  </button>
                  <button onClick={() => changeCotizacionStatus(cot.id, 'en_ejecucion')} className="btn-primary">
                    <Play className="w-4 h-4" /> Iniciar Ejecución
                  </button>
                </div>
                <button
                  onClick={() => setConfirmVolverVisita(true)}
                  className="mt-1 self-start px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors flex items-center gap-1"
                >
                  ← Volver a Visita
                </button>
              </div>
            )}
            {cot.estado === 'en_ejecucion' && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-slate-400 sm:text-right">Proyecto en ejecución</p>
                <button onClick={() => setConfirmCerrar(true)} className="btn-primary">
                  <CheckCircle className="w-4 h-4" /> Cerrar Proyecto
                </button>
                <button
                  onClick={() => setConfirmVolverAprobada(true)}
                  className="mt-1 self-start px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors flex items-center gap-1"
                >
                  ← Volver a Aprobada
                </button>
              </div>
            )}
            {cot.estado === 'cerrada' && (
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-800 text-white">
                Proyecto cerrado
              </span>
            )}
            {(cot.estado === 'rechazada' || cot.estado === 'perdida') && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-slate-400 sm:text-right">¿Quieres revisar y reenviar esta cotización?</p>
                <button onClick={() => changeCotizacionStatus(cot.id, 'borrador')} className="btn-secondary">
                  <Pencil className="w-4 h-4" /> Reabrir como Borrador
                </button>
              </div>
            )}

            {/* Estados negativos — siempre disponibles excepto en estados finales */}
            {!['cerrada', 'rechazada', 'perdida'].includes(cot.estado) && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => changeCotizacionStatus(cot.id, 'rechazada')}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1"
                >
                  <XCircle className="w-3 h-3" /> Cliente Rechazó
                </button>
                <button
                  onClick={() => changeCotizacionStatus(cot.id, 'perdida')}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-red-200 text-red-800 hover:bg-red-50 transition-colors flex items-center gap-1"
                >
                  <XCircle className="w-3 h-3" /> Marcar como perdida
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Documento — este div es el que se convierte en PDF */}
      <div ref={docRef} className="card p-6 sm:p-8 space-y-6 bg-white">
        {/* Cabecera empresa + número */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            {empresa?.logo_url ? (
              <img src={empresa.logo_url} alt={empresa.razon_social || empresa.nombre} className="max-h-[120px] w-auto max-w-[200px] object-contain mb-2" />
            ) : (
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{(empresa?.razon_social || empresa?.nombre)?.[0] || 'M'}</span>
                </div>
                <span className="font-bold text-slate-900 text-xl tracking-tight">{empresa?.razon_social || empresa?.nombre || 'MAMKAM'}</span>
              </div>
            )}
            {empresa?.nombre_fantasia                     && <p className="text-sm text-slate-600 font-medium">{empresa.nombre_fantasia}</p>}
            {empresa?.rut                                 && <p className="text-xs text-slate-400">RUT: {empresa.rut}</p>}
            {(empresa?.email_contacto || empresa?.email)  && <p className="text-xs text-slate-400">{empresa.email_contacto || empresa.email}</p>}
            {empresa?.telefono                            && <p className="text-xs text-slate-400">{empresa.telefono}</p>}
          </div>
          <div className="sm:text-right">
            <div className="text-2xl font-bold text-slate-900">{cot.numero}</div>
            <div className="text-sm text-slate-500 mt-1">Fecha: {formatDate(cot.fecha)}</div>
            {cot.fechaExpiracion && (() => {
              const hoy = new Date().toISOString().split('T')[0]
              const vencida = cot.fechaExpiracion < hoy && cot.estado !== 'aprobada'
              return vencida
                ? <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Vencida</span>
                : <div className="text-xs text-slate-400 mt-1">Válida hasta: {formatDate(cot.fechaExpiracion)}</div>
            })()}
          </div>
        </div>

        <hr className="border-slate-200" />

        {/* Glosa */}
        {cot.glosa && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">Descripción del proyecto</p>
            <p className="text-sm text-slate-700">{cot.glosa}</p>
          </div>
        )}

        {/* Datos del cliente */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Cotización para</p>
            <p className="font-semibold text-slate-800">{cot.cliente}</p>
            {(cot.direccion || cot.comuna) && (
              <p className="text-sm text-slate-500 mt-1">
                {[cot.direccion, cot.comuna].filter(Boolean).join(', ')}
              </p>
            )}
            {cot.email && <p className="text-sm text-slate-500">{cot.email}</p>}
            {cot.telefono && <p className="text-sm text-slate-500">{cot.telefono}</p>}
          </div>
          <div className="flex sm:justify-end items-start gap-5">
            <div className="text-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto ${cot.enviadoWhatsapp ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                <MessageCircle className={`w-4 h-4 ${cot.enviadoWhatsapp ? 'text-emerald-600' : 'text-slate-300'}`} />
              </div>
              <p className="text-xs text-slate-400 mt-1">WhatsApp</p>
            </div>
            <div className="text-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto ${cot.enviadoEmail ? 'bg-blue-100' : 'bg-slate-100'}`}>
                <Mail className={`w-4 h-4 ${cot.enviadoEmail ? 'text-blue-600' : 'text-slate-300'}`} />
              </div>
              <p className="text-xs text-slate-400 mt-1">Email</p>
            </div>
          </div>
        </div>

        {/* Tabla de ítems */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 rounded-lg">
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 rounded-l-lg w-1/2">Producto / Servicio</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Cant.</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Medida</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500">Valor Neto</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 rounded-r-lg">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cot.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-800">{item.producto}</p>
                    {item.incluirDescripcion && item.descripcion && (
                      <p className="text-xs text-slate-400 mt-0.5">{item.descripcion}</p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-slate-700">{item.cantidad}</td>
                  <td className="px-3 py-3 text-center text-slate-500 text-xs">{item.medicion || 'Unidad'}</td>
                  <td className="px-3 py-3 text-right text-slate-700">{formatCLP(item.valorUnitario)}</td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-900">{formatCLP(item.cantidad * item.valorUnitario)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totales: Subtotal + Descuento + Neto + IVA + Total */}
        <div className="flex justify-end">
          <div className="w-full sm:w-72 space-y-2">
            {cot.descuentoValor > 0 && (() => {
              const subtotalBruto = cot.items.reduce((s, i) => s + i.cantidad * i.valorUnitario, 0)
              const descMonto = cot.descuentoTipo === 'porcentaje'
                ? Math.round(subtotalBruto * cot.descuentoValor / 100)
                : cot.descuentoValor
              return (
                <>
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Subtotal</span>
                    <span>{formatCLP(subtotalBruto)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Descuento {cot.descuentoTipo === 'porcentaje' ? `(${cot.descuentoValor}%)` : ''}</span>
                    <span>−{formatCLP(descMonto)}</span>
                  </div>
                </>
              )
            })()}
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal Neto</span>
              <span>{formatCLP(cot.neto ?? cot.total)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>IVA (19%)</span>
              <span>{formatCLP(cot.iva ?? 0)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
              <span>Total</span>
              <span className="text-lg">{formatCLP(cot.total)}</span>
            </div>
          </div>
        </div>

        {/* Condiciones de pago */}
        {(() => {
          if (cot.condicionesPago?.length > 0) {
            return (
              <div className="border border-slate-200 rounded-xl" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <div className="bg-slate-50 px-4 py-2.5 rounded-t-xl">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-center">Condiciones de Pago</p>
                </div>
                <div className="px-4 py-2">
                  {cot.condicionesPago.map((cp, i) => {
                    const monto        = cp.monto || Math.round(cot.total * cp.porcentaje / 100)
                    const conciliado   = !!cp.movimiento_id
                    const tieneFactura = !!cp.factura_sii_id
                    return (
                      <div
                        key={cp.id || i}
                        className="py-3 border-b border-slate-100 last:border-b-0"
                        style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-2.5 flex-1">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                            <div>
                              <p className="text-sm font-medium text-slate-700">{cp.descripcion}</p>
                              {cp.porcentaje > 0 && <p className="text-xs text-slate-400 mt-0.5">{cp.porcentaje}% del total</p>}
                            </div>
                          </div>
                          <span className="text-sm font-bold text-slate-900 flex-shrink-0">{formatCLP(monto)}</span>
                        </div>
                        {conciliado && !tieneFactura && (
                          <div className="flex items-center justify-between mt-2 pl-7">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                              <AlertCircle className="w-3 h-3" /> Pagado · Sin factura
                            </span>
                            <button
                              onClick={() => setAsociarFacturaModal({ condicion: cp, condicionIdx: i })}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline"
                            >
                              Asociar factura
                            </button>
                          </div>
                        )}
                        {conciliado && tieneFactura && (
                          <div className="mt-2 pl-7">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                              ✓ Pagado · Factura Nº{cp.factura_folio}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          }

          // Pago único
          return (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pago</p>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-700">Pago único</span>
                  <span className="text-sm font-semibold text-slate-800">{formatCLP(cot.total)}</span>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Observaciones */}
        {cot.observaciones && (
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Observaciones</p>
            <p className="text-sm text-slate-600">{cot.observaciones}</p>
          </div>
        )}

        {/* Datos bancarios */}
        {(() => {
          const db = empresa?.datos_bancarios
          if (!db || !db.banco) return null
          return (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Datos de Transferencia</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
                {db.banco           && <div><span className="text-slate-400">Banco: </span>{db.banco}</div>}
                {db.tipo_cuenta     && <div><span className="text-slate-400">Tipo: </span>{db.tipo_cuenta}</div>}
                {db.numero_cuenta   && <div><span className="text-slate-400">N° cuenta: </span>{db.numero_cuenta}</div>}
                {db.rut_titular     && <div><span className="text-slate-400">RUT: </span>{db.rut_titular}</div>}
                {db.nombre_titular  && <div><span className="text-slate-400">Titular: </span>{db.nombre_titular}</div>}
                {db.email_transferencia && <div className="col-span-2"><span className="text-slate-400">Email: </span>{db.email_transferencia}</div>}
              </div>
            </div>
          )
        })()}

        <div className="pt-4 border-t border-slate-100 text-xs text-slate-400 text-center">
          Este documento es una cotización y no constituye una factura. Válida por 15 días desde su emisión.
        </div>
      </div>

      {/* Modal envío de email */}
      {modalEnvioEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !loadingEmail && setModalEnvioEmail(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Enviar cotización {cot.numero}</h3>
              <p className="text-sm text-slate-500 mt-0.5">a {cot.cliente}</p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Destinatario</label>
                <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{cot.email}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Mensaje para el cliente <span className="font-normal text-slate-400">(opcional)</span></label>
                <textarea
                  value={mensajeEmail}
                  onChange={(e) => setMensajeEmail(e.target.value)}
                  rows={4}
                  placeholder={`Estimado/a ${cot.cliente?.split(' ')[0] || 'cliente'}, adjunto encontrará nuestra propuesta comercial. Quedamos atentos a sus consultas.`}
                  className="input-base resize-none text-sm"
                  disabled={loadingEmail}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 pb-5">
              <button onClick={() => setModalEnvioEmail(false)} disabled={loadingEmail} className="btn-secondary disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleEnviarEmail} disabled={loadingEmail} className="btn-primary disabled:opacity-50">
                {loadingEmail
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Generando PDF…</>
                  : <><Mail className="w-4 h-4" />Enviar cotización</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast de estado */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteCotizacion(cot.id)
          navigate('/cotizaciones')
        }}
        title={cot.estado === 'aprobada' ? 'Eliminar cotización aprobada' : 'Eliminar cotización'}
        message={`¿Estás seguro que deseas eliminar la cotización ${cot.numero}? Esta acción no se puede deshacer.`}
        warningNote={
          cot.estado === 'aprobada'
            ? 'Esta cotización está aprobada. Al eliminarla se borrarán también los movimientos de ingresos asociados en Finanzas, lo que afectará el flujo de caja.'
            : undefined
        }
      />

      <ConfirmModal
        open={confirmCerrar}
        onClose={() => setConfirmCerrar(false)}
        onConfirm={() => {
          changeCotizacionStatus(cot.id, 'cerrada')
          setConfirmCerrar(false)
        }}
        title="Cerrar proyecto"
        message={`¿Confirmas que el proyecto de la cotización ${cot.numero} ha finalizado? Se marcará como cerrada.`}
      />

      <ConfirmModal
        open={confirmVolverAprobada}
        onClose={() => setConfirmVolverAprobada(false)}
        onConfirm={() => {
          changeCotizacionStatus(cot.id, 'aprobada')
          setConfirmVolverAprobada(false)
        }}
        title="Volver a Aprobada"
        message={`¿Volver la cotización ${cot.numero} a estado Aprobada?`}
      />

      <ConfirmModal
        open={confirmVolverVisita}
        onClose={() => setConfirmVolverVisita(false)}
        onConfirm={() => {
          changeCotizacionStatus(cot.id, 'visita')
          setConfirmVolverVisita(false)
        }}
        title="Volver a Visita"
        message={`¿Volver la cotización ${cot.numero} a estado Visita?`}
      />

      <ConfirmModal
        open={confirmVolverEnviada}
        onClose={() => setConfirmVolverEnviada(false)}
        onConfirm={() => {
          changeCotizacionStatus(cot.id, 'enviada')
          setConfirmVolverEnviada(false)
        }}
        title="Volver a Enviada"
        message={`¿Volver la cotización ${cot.numero} a estado Enviada?`}
      />

      <ConfirmModal
        open={confirmVolverBorrador}
        onClose={() => setConfirmVolverBorrador(false)}
        onConfirm={() => {
          changeCotizacionStatus(cot.id, 'borrador')
          setConfirmVolverBorrador(false)
        }}
        title="Volver a Borrador"
        message={`¿Volver la cotización ${cot.numero} a estado Borrador?`}
      />

      {asociarFacturaModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Asociar factura de venta</h3>
                <p className="text-xs text-slate-500 mt-0.5">{asociarFacturaModal.condicion.descripcion}</p>
              </div>
              <button onClick={() => setAsociarFacturaModal(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-500">
                Monto de referencia:{' '}
                <span className="font-semibold text-slate-800">
                  {formatCLP(asociarFacturaModal.condicion.monto || Math.round(cot.total * (asociarFacturaModal.condicion.porcentaje || 0) / 100))}
                </span>
              </p>
            </div>
            <div className="px-5 py-3 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchFactura}
                  onChange={e => setSearchFactura(e.target.value)}
                  placeholder="Buscar por folio o razón social..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
              {facturasLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : (() => {
                const montoRef = asociarFacturaModal.condicion.monto || Math.round(cot.total * (asociarFacturaModal.condicion.porcentaje || 0) / 100)
                const lista = searchFactura
                  ? facturasLoaded.filter(f =>
                      String(f.folio || '').toLowerCase().includes(searchFactura.toLowerCase()) ||
                      (f.razon_social || '').toLowerCase().includes(searchFactura.toLowerCase())
                    )
                  : facturasLoaded
                if (lista.length === 0) return <p className="text-center text-sm text-slate-400 py-10">No se encontraron facturas</p>
                return lista.map(f => (
                  <div key={f.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-700">Nº{f.folio}</span>
                        <span className="text-sm text-slate-600 truncate">{f.razon_social}</span>
                        {f.total === montoRef && (
                          <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-semibold rounded-full">Monto coincide</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{formatCLP(f.total)} · {formatDate(f.fecha)}</p>
                    </div>
                    <button
                      onClick={() => handleAsociarFactura(f)}
                      className="ml-3 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 whitespace-nowrap"
                    >
                      Seleccionar
                    </button>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
