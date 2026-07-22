import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../../services/supabase'
import { formatCLP, formatDate } from '../../utils/formatters'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import { ConfirmModal } from '../../components/Modal'
import Toast from '../../components/Toast'
import {
  Plus, Search, ShoppingCart, ExternalLink,
  CreditCard, Truck, Lock, Eye, Trash2,
  Paperclip, Loader2, Send, FileText, X, CheckCircle2,
} from 'lucide-react'
import { analizarComprobanteIA } from '../../utils/analizarComprobante'
import { generatePDFBlob } from '../../utils/pdf'

const ESTADOS = ['todos', 'creada', 'pagada', 'enviada', 'entregada', 'cerrada']

const ESTADO_META = {
  creada:    { color: 'text-amber-600 bg-amber-50 border-amber-100',       icon: ShoppingCart },
  pagada:    { color: 'text-blue-600 bg-blue-50 border-blue-100',          icon: CreditCard   },
  enviada:   { color: 'text-indigo-600 bg-indigo-50 border-indigo-100',    icon: Send         },
  entregada: { color: 'text-violet-600 bg-violet-50 border-violet-100',    icon: Truck        },
  cerrada:   { color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: Lock         },
}

export default function ComprasPage() {
  const { compras, cotizaciones, deleteCompra, updateCompra, empresa } = useApp()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [search,              setSearch]              = useState('')
  const [filtroEstado,        setFiltroEstado]        = useState('todos')
  const [deleteId,            setDeleteId]            = useState(null)
  const [enviandoId,          setEnviandoId]          = useState(null)
  const [confirmEnvio,        setConfirmEnvio]        = useState(null)
  const [toast,               setToast]               = useState(null)

  // Modales de documentos
  const [modalComprobantesId, setModalComprobantesId] = useState(null)
  const [modalFacturasId,     setModalFacturasId]     = useState(null)
  const [uploading,           setUploading]           = useState(false)
  const [confirmDeleteDoc,    setConfirmDeleteDoc]    = useState(null)

  // Estado del flujo IA para comprobantes de OC
  const [estadoModalComp,    setEstadoModalComp]    = useState('idle')
  const [formConfirmacionOC, setFormConfirmacionOC] = useState(null)
  const [ocIdConfirmando,    setOcIdConfirmando]    = useState(null)
  const [uploadedUrlOC,      setUploadedUrlOC]      = useState(null)

  const addComprobanteRef = useRef(null)
  const addFacturaRef     = useRef(null)
  const ocPdfRef          = useRef(null)
  const [ocParaPdf,        setOcParaPdf]        = useState(null)
  const [generandoPdfId,   setGenerandoPdfId]   = useState(null)

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4500) }

  const modalComprobantesOC = compras.find((c) => c.id === modalComprobantesId) ?? null
  const modalFacturasOC     = compras.find((c) => c.id === modalFacturasId) ?? null

  /* ── Subir comprobante de pago (con análisis IA) ────────────────── */
  const handleSubirComprobante = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !modalComprobantesId) return
    const oc = compras.find((c) => c.id === modalComprobantesId)
    if (!oc) return
    const empresaId = empresa?.id || user?.empresa_id || 'sin-empresa'
    const ts = Date.now()
    const path = `${empresaId}/${oc.id}/${ts}_${file.name}`

    setEstadoModalComp('subiendo')
    let url
    try {
      const { error } = await supabase.storage
        .from('pago_proveedores')
        .upload(path, file, { upsert: false, contentType: file.type })
      if (error) throw error
      url = supabase.storage.from('pago_proveedores').getPublicUrl(path).data.publicUrl
    } catch (err) {
      showToast('error', err.message || 'Error al subir el archivo')
      setEstadoModalComp('idle')
      return
    }

    setEstadoModalComp('analizando')
    const iaData = await analizarComprobanteIA(file)

    setUploadedUrlOC({ url, nombre: file.name })
    setOcIdConfirmando(oc.id)
    setFormConfirmacionOC({
      monto: iaData?.monto ?? '',
      fecha: iaData?.fecha ?? new Date().toISOString().slice(0, 10),
      banco_origen: iaData?.banco_origen ?? '',
      numero_transferencia: iaData?.numero_transferencia ?? '',
      glosa: iaData?.glosa ?? `Pago OC ${oc.numero} - ${oc.proveedor}`,
    })
    setEstadoModalComp('confirmando')
  }

  /* ── Confirmar comprobante OC + crear movimiento contable ────────── */
  const handleConfirmarOC = async () => {
    const oc = compras.find((c) => c.id === ocIdConfirmando)
    if (!oc || !uploadedUrlOC) return
    const empresaId = empresa?.id || user?.empresa_id || 'sin-empresa'
    setEstadoModalComp('guardando')
    try {
      const montoNum = Number(String(formConfirmacionOC.monto).replace(/\./g, '').replace(',', '.'))
      const movId = crypto.randomUUID()
      const { error: movError } = await supabase
        .from('movimientos')
        .insert({
          id: movId,
          empresa_id: empresaId,
          cuenta_bancaria_id: null,
          fecha: formConfirmacionOC.fecha,
          glosa: formConfirmacionOC.glosa,
          tipo: 'cargo',
          monto: montoNum,
          conciliado: false,
          gasto_id: String(oc.id),
          gasto_descripcion: `Pago OC: ${oc.numero} | Proveedor: ${oc.proveedor} | ${formConfirmacionOC.glosa}`,
        })
      if (movError) throw movError
      const newArray = [
        ...(oc.comprobantes || []),
        { url: uploadedUrlOC.url, nombre: uploadedUrlOC.nombre, fecha: formConfirmacionOC.fecha, movimiento_id: movId },
      ]
      updateCompra(oc.id, { comprobantes: newArray })
      setEstadoModalComp('idle')
      setFormConfirmacionOC(null)
      setOcIdConfirmando(null)
      setUploadedUrlOC(null)
      showToast('success', 'Comprobante registrado y movimiento contable creado')
    } catch (err) {
      showToast('error', err.message || 'Error al registrar movimiento')
      setEstadoModalComp('idle')
    }
  }

  /* ── Subir factura del proveedor ─────────────────────────────────── */
  const handleSubirFactura = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !modalFacturasId) return
    const oc = compras.find((c) => c.id === modalFacturasId)
    if (!oc) return
    const ts = Date.now()
    const path = `compras/${oc.id}/${ts}_${file.name}`
    setUploading(true)
    try {
      const { error } = await supabase.storage
        .from('documentos')
        .upload(path, file, { upsert: false, contentType: file.type })
      if (error) throw error
      const url = supabase.storage.from('documentos').getPublicUrl(path).data.publicUrl
      const newArray = [...(oc.facturas || []), { url, nombre: file.name, fecha: new Date().toISOString().slice(0, 10) }]
      updateCompra(oc.id, { facturas: newArray })
      showToast('success', 'Factura agregada')
    } catch (err) {
      showToast('error', err.message || 'Error al subir el archivo')
    } finally {
      setUploading(false)
    }
  }

  /* ── Eliminar documento ──────────────────────────────────────────── */
  const handleEliminarDoc = () => {
    if (!confirmDeleteDoc) return
    const { tipo, ocId, url } = confirmDeleteDoc
    const oc = compras.find((c) => c.id === ocId)
    if (oc) {
      if (tipo === 'comprobante') {
        updateCompra(ocId, { comprobantes: (oc.comprobantes || []).filter((d) => d.url !== url) })
      } else {
        updateCompra(ocId, { facturas: (oc.facturas || []).filter((d) => d.url !== url) })
      }
    }
    showToast('success', 'Archivo eliminado')
    setConfirmDeleteDoc(null)
  }

  /* ── Envío por email ─────────────────────────────────────────────── */
  const handleEnviarEmail = (oc, e) => {
    e.stopPropagation()
    if (!(oc.comprobantes?.length > 0)) {
      setConfirmEnvio(oc)
      return
    }
    doEnviarEmail(oc)
  }

  const doEnviarEmail = async (oc) => {
    setConfirmEnvio(null)
    setEnviandoId(oc.id)
    let pdfUrl = null
    try {
      /* 1. Generar PDF de la OC */
      setGenerandoPdfId(oc.id)
      setOcParaPdf(oc)
      await new Promise(r => setTimeout(r, 400))

      if (ocPdfRef.current) {
        const pdfBlob  = await generatePDFBlob(ocPdfRef.current)
        const empresaId = empresa?.id || user?.empresa_id
        const path      = `${empresaId}/${oc.numero}.pdf`
        const { error: upErr } = await supabase.storage
          .from('ocs-pdf')
          .upload(path, pdfBlob, { contentType: 'application/pdf', upsert: true })
        if (!upErr) {
          pdfUrl = supabase.storage.from('ocs-pdf').getPublicUrl(path).data.publicUrl
        } else {
          console.error('[doEnviarEmail] error subiendo PDF:', upErr.message)
        }
      }
    } catch (pdfErr) {
      console.error('[doEnviarEmail] error generando PDF:', pdfErr.message)
    } finally {
      setOcParaPdf(null)
      setGenerandoPdfId(null)
    }

    try {
      /* 2. Enviar email con pdfUrl */
      const stored = localStorage.getItem('mamkam_auth')
      const token  = stored ? JSON.parse(stored).token : null
      const base   = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
      const res    = await fetch(`${base}/compras/${oc.id}/enviar-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ pdfUrl }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Error al enviar el correo')
      updateCompra(oc.id, { estado: 'enviada' })
      showToast('success', `OC ${oc.numero} enviada por correo`)
    } catch (err) {
      showToast('error', err.message || 'Error al enviar el correo')
    } finally {
      setEnviandoId(null)
    }
  }

  /* ── Datos ───────────────────────────────────────────────────────── */
  const toDeleteItem = compras.find((oc) => oc.id === deleteId)

  const filtered = compras.filter((oc) => {
    const matchSearch =
      (oc.proveedor || '').toLowerCase().includes(search.toLowerCase()) ||
      oc.numero.toLowerCase().includes(search.toLowerCase()) ||
      (oc.cotizacionNumero || '').toLowerCase().includes(search.toLowerCase())
    const matchEstado = filtroEstado === 'todos' || oc.estado === filtroEstado
    return matchSearch && matchEstado
  })

  const sinOC = cotizaciones.filter(
    (c) => c.estado === 'aprobada' && !compras.some((oc) => oc.cotizacionId === c.id)
  )

  /* ── Modal de documentos ─────────────────────────────────────────── */
  const ModalDocumentos = ({ oc, tipo, onClose }) => {
    if (!oc) return null
    const docs   = tipo === 'comprobante' ? (oc.comprobantes || []) : (oc.facturas || [])
    const titulo = tipo === 'comprobante' ? 'Comprobantes de pago' : 'Facturas del proveedor'
    const ref    = tipo === 'comprobante' ? addComprobanteRef : addFacturaRef
    const isProcessing = tipo === 'comprobante' && (estadoModalComp === 'subiendo' || estadoModalComp === 'analizando' || estadoModalComp === 'guardando')

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={isProcessing ? undefined : onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div>
              <p className="font-semibold text-slate-900 text-sm">{titulo}</p>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{oc.numero}</p>
            </div>
            {!isProcessing && (
              <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Spinner: subiendo / analizando / guardando */}
          {isProcessing && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm text-slate-500">
                {estadoModalComp === 'subiendo' ? 'Subiendo archivo...'
                  : estadoModalComp === 'analizando' ? 'Analizando comprobante con IA...'
                  : 'Guardando movimiento contable...'}
              </p>
            </div>
          )}

          {/* Formulario confirmación (comprobante) */}
          {tipo === 'comprobante' && estadoModalComp === 'confirmando' && formConfirmacionOC && (
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-700">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                Datos extraídos automáticamente — verifica y confirma
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Monto</label>
                  <input
                    type="number"
                    value={formConfirmacionOC.monto}
                    onChange={(e) => setFormConfirmacionOC((f) => ({ ...f, monto: e.target.value }))}
                    className="input-base text-sm w-full"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={formConfirmacionOC.fecha}
                    onChange={(e) => setFormConfirmacionOC((f) => ({ ...f, fecha: e.target.value }))}
                    className="input-base text-sm w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Banco origen</label>
                  <input
                    type="text"
                    value={formConfirmacionOC.banco_origen}
                    onChange={(e) => setFormConfirmacionOC((f) => ({ ...f, banco_origen: e.target.value }))}
                    className="input-base text-sm w-full"
                    placeholder="—"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">N° operación</label>
                  <input
                    type="text"
                    value={formConfirmacionOC.numero_transferencia}
                    onChange={(e) => setFormConfirmacionOC((f) => ({ ...f, numero_transferencia: e.target.value }))}
                    className="input-base text-sm w-full"
                    placeholder="—"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
                <input
                  type="text"
                  value={formConfirmacionOC.glosa}
                  onChange={(e) => setFormConfirmacionOC((f) => ({ ...f, glosa: e.target.value }))}
                  className="input-base text-sm w-full"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setFormConfirmacionOC(null); setEstadoModalComp('idle') }}
                  className="flex-1 btn-ghost text-xs"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmarOC}
                  disabled={!formConfirmacionOC.monto || !formConfirmacionOC.fecha}
                  className="flex-1 btn-primary text-xs disabled:opacity-50"
                >
                  Confirmar y registrar movimiento
                </button>
              </div>
            </div>
          )}

          {/* Vista idle — lista + botón agregar */}
          {(tipo !== 'comprobante' || estadoModalComp === 'idle') && (
            <>
              <div className="overflow-y-auto flex-1 p-4">
                {docs.length === 0 ? (
                  <div className="py-10 text-center">
                    <FileText className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">No hay archivos adjuntos.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {docs.map((doc, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100"
                      >
                        <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{doc.nombre}</p>
                          {doc.fecha && <p className="text-xs text-slate-400">{formatDate(doc.fecha)}</p>}
                          {tipo === 'comprobante' && (
                            doc.movimiento_id
                              ? <span className="text-[10px] text-emerald-600 font-medium">✓ Movimiento contable registrado</span>
                              : <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Sin registro contable</span>
                          )}
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex-shrink-0"
                          title="Ver archivo"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => setConfirmDeleteDoc({ tipo, ocId: oc.id, url: doc.url, nombre: doc.nombre })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-4 py-3 border-t border-slate-100">
                <button
                  onClick={() => ref.current?.click()}
                  disabled={tipo !== 'comprobante' && uploading}
                  className="btn-primary w-full justify-center disabled:opacity-50"
                >
                  {tipo !== 'comprobante' && uploading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Plus className="w-4 h-4" />}
                  {tipo !== 'comprobante' && uploading ? 'Subiendo...' : 'Agregar archivo'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Órdenes de Compra</h2>
          <p className="text-sm text-slate-500 mt-0.5">{compras.length} órdenes en total</p>
        </div>
        <button onClick={() => navigate('/compras/nueva')} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nueva OC</span>
        </button>
      </div>

      {/* Alerta: cotizaciones aprobadas sin OC */}
      {sinOC.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <ShoppingCart className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              {sinOC.length === 1
                ? `Tienes 1 cotización aprobada sin OC generada`
                : `Tienes ${sinOC.length} cotizaciones aprobadas sin OC generada`}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {sinOC.map(c => (
                <button
                  key={c.id}
                  onClick={() => navigate('/compras/nueva')}
                  className="inline-flex items-center gap-1 text-xs bg-white border border-amber-300 text-amber-700 rounded-lg px-2 py-1 hover:bg-amber-50"
                >
                  {c.numero} · {c.cliente}
                  <Plus className="w-3 h-3" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(ESTADO_META).map(([estado, meta]) => {
          const Icon = meta.icon
          const count = compras.filter(c => c.estado === estado).length
          return (
            <button
              key={estado}
              onClick={() => setFiltroEstado(filtroEstado === estado ? 'todos' : estado)}
              className={`card p-4 flex items-center gap-3 border transition-all hover:shadow-md ${
                filtroEstado === estado ? meta.color + ' ring-1 ring-current/30' : 'border-slate-200'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${meta.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xl font-bold text-slate-900">{count}</div>
                <div className="text-xs font-medium text-slate-500 capitalize">{estado}</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por proveedor, número o cotización..."
              className="input-base pl-9"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {ESTADOS.map((e) => (
              <button
                key={e}
                onClick={() => setFiltroEstado(e)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  filtroEstado === e ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {e === 'todos' ? 'Todos' : e.charAt(0).toUpperCase() + e.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Sin órdenes de compra"
            description={search ? 'No hay resultados para tu búsqueda.' : 'Crea una OC desde una cotización aprobada.'}
            action={
              !search && (
                <button onClick={() => navigate('/compras/nueva')} className="btn-primary">
                  <Plus className="w-4 h-4" /> Nueva OC
                </button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="table-th">Número</th>
                  <th className="table-th">Proveedor</th>
                  <th className="table-th hidden lg:table-cell">Materiales</th>
                  <th className="table-th hidden sm:table-cell">Cot. Ref.</th>
                  <th className="table-th hidden md:table-cell">Fecha</th>
                  <th className="table-th text-right">Monto</th>
                  <th className="table-th">Estado</th>
                  <th className="table-th text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((oc) => (
                  <tr
                    key={oc.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => navigate(`/compras/${oc.id}`)}
                  >
                    <td className="table-td font-mono text-xs text-slate-500">{oc.numero}</td>
                    <td className="table-td">
                      <div className="font-medium text-slate-800">{oc.proveedor || <span className="text-slate-400 italic">Sin proveedor</span>}</div>
                      {oc.proveedorRut && <div className="text-xs text-slate-400">RUT {oc.proveedorRut}</div>}
                    </td>
                    <td className="table-td hidden lg:table-cell">
                      {(() => {
                        const items = oc.items || []
                        if (items.length === 0) return <span className="text-slate-400 text-xs">—</span>
                        const visibles = items.slice(0, 2)
                        const resto = items.length - 2
                        return (
                          <div className="flex flex-col gap-0.5">
                            {visibles.map((item, i) => (
                              <span key={i} className="text-xs text-slate-600">
                                • {item.cantidad ? `${item.cantidad} × ` : ''}
                                {item.descripcion || item.nombre || item.producto || '—'}
                              </span>
                            ))}
                            {resto > 0 && (
                              <span className="text-xs text-slate-400">+ {resto} más</span>
                            )}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="table-td hidden sm:table-cell" onClick={e => e.stopPropagation()}>
                      {oc.cotizacionNumero ? (
                        <button
                          onClick={() => navigate(`/cotizaciones/${oc.cotizacionId}`)}
                          className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-mono"
                        >
                          {oc.cotizacionNumero} <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="table-td hidden md:table-cell text-slate-500">{formatDate(oc.fecha)}</td>
                    <td className="table-td text-right font-semibold text-slate-900">{formatCLP(oc.monto)}</td>
                    <td className="table-td"><Badge status={oc.estado} /></td>
                    <td className="table-td text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">

                        {/* Ver detalle */}
                        <button
                          onClick={() => navigate(`/compras/${oc.id}`)}
                          title="Ver detalle"
                          className="btn-ghost p-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* 📎 Comprobantes de pago */}
                        <button
                          title={oc.comprobantes?.length > 0
                            ? `${oc.comprobantes.length} comprobante(s)`
                            : 'Sin comprobantes'}
                          onClick={(e) => { e.stopPropagation(); setEstadoModalComp('idle'); setFormConfirmacionOC(null); setModalComprobantesId(oc.id) }}
                          className="btn-ghost p-1.5"
                        >
                          <span style={{ position: 'relative', display: 'inline-block' }}>
                            <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                            <span style={{ position: 'absolute', top: '-3px', right: '-3px', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: oc.comprobantes?.length > 0 ? '#22c55e' : '#ef4444' }} />
                          </span>
                        </button>

                        {/* ✉️ Enviar email */}
                        <button
                          title={generandoPdfId === oc.id ? 'Generando PDF...' : oc.estado === 'enviada' ? 'Enviado al proveedor' : 'Enviar al proveedor'}
                          onClick={(e) => handleEnviarEmail(oc, e)}
                          disabled={enviandoId === oc.id}
                          className="btn-ghost p-1.5"
                        >
                          {enviandoId === oc.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : (
                              <span style={{ position: 'relative', display: 'inline-block' }}>
                                <Send className="w-3.5 h-3.5 text-slate-500" />
                                <span style={{ position: 'absolute', top: '-3px', right: '-3px', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: oc.estado === 'enviada' ? '#22c55e' : '#ef4444' }} />
                              </span>
                            )
                          }
                        </button>

                        {/* 📎 Facturas del proveedor (solo post-creada) */}
                        {oc.estado !== 'creada' && (
                          <button
                            title={oc.facturas?.length > 0
                              ? `${oc.facturas.length} factura(s)`
                              : 'Sin facturas del proveedor'}
                            onClick={(e) => { e.stopPropagation(); setModalFacturasId(oc.id) }}
                            className="btn-ghost p-1.5"
                          >
                            <span style={{ position: 'relative', display: 'inline-block' }}>
                              <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                              <span style={{ position: 'absolute', top: '-3px', right: '-3px', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: oc.facturas?.length > 0 ? '#22c55e' : '#ef4444' }} />
                            </span>
                          </button>
                        )}

                        {user?.rol === 'admin' && (
                          <button
                            title="Eliminar OC"
                            onClick={() => setDeleteId(oc.id)}
                            className="btn-ghost p-1.5 text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal comprobantes ─────────────────────────────────────── */}
      <ModalDocumentos
        oc={modalComprobantesOC}
        tipo="comprobante"
        onClose={() => setModalComprobantesId(null)}
      />

      {/* ── Modal facturas ─────────────────────────────────────────── */}
      <ModalDocumentos
        oc={modalFacturasOC}
        tipo="factura"
        onClose={() => setModalFacturasId(null)}
      />

      {/* Confirmar eliminar OC */}
      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { deleteCompra(deleteId); setDeleteId(null) }}
        title={`¿Eliminar OC ${toDeleteItem?.numero}?`}
        message="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        warningNote={
          toDeleteItem?.estado !== 'creada'
            ? 'Esta OC ya fue pagada. Al eliminarla se borrará también el egreso registrado en Finanzas, lo que afectará el flujo de caja de la empresa.'
            : undefined
        }
      />

      {/* Confirmar envío sin comprobante */}
      <ConfirmModal
        open={!!confirmEnvio}
        onClose={() => setConfirmEnvio(null)}
        onConfirm={() => doEnviarEmail(confirmEnvio)}
        title="OC sin comprobante de pago"
        message="Esta OC no tiene comprobantes de pago adjuntos. ¿Desea enviar la OC de todas formas?"
        confirmLabel="Enviar sin comprobante"
      />

      {/* Confirmar eliminar documento */}
      <ConfirmModal
        open={!!confirmDeleteDoc}
        onClose={() => setConfirmDeleteDoc(null)}
        onConfirm={handleEliminarDoc}
        title="¿Eliminar archivo?"
        message={`Se eliminará "${confirmDeleteDoc?.nombre}" de la lista. El archivo en Storage no se borra.`}
        confirmLabel="Eliminar"
      />

      {/* Inputs ocultos para upload */}
      <input
        ref={addComprobanteRef}
        type="file"
        accept=".pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleSubirComprobante}
      />
      <input
        ref={addFacturaRef}
        type="file"
        accept=".pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleSubirFactura}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* Div oculto fuera de pantalla para generar PDF de la OC */}
      {ocParaPdf && (
        <div
          ref={ocPdfRef}
          style={{ position: 'fixed', left: '-9999px', top: 0, width: '800px', background: 'white', fontFamily: 'Arial, sans-serif' }}
        >
          {/* Cabecera */}
          <div style={{ background: '#1e293b', padding: '24px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Orden de Compra</div>
              <div style={{ color: '#ffffff', fontSize: '28px', fontWeight: '900' }}>{ocParaPdf.numero}</div>
              <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>Fecha: {formatDate(ocParaPdf.fecha)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {empresa?.logo_url
                ? <img src={empresa.logo_url} alt="" style={{ maxHeight: '48px', maxWidth: '160px', objectFit: 'contain' }} />
                : <div style={{ color: '#ffffff', fontSize: '18px', fontWeight: '700' }}>{empresa?.razon_social || empresa?.nombre || 'MAMKAM'}</div>
              }
              <div style={{ color: '#3b82f6', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', marginTop: '8px', border: '1px solid #3b82f6', padding: '2px 10px', borderRadius: '12px', display: 'inline-block' }}>{ocParaPdf.estado ?? 'creada'}</div>
            </div>
          </div>
          {/* Cuerpo */}
          <div style={{ padding: '24px 36px' }}>
            {/* Proveedor */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px' }}>Proveedor</div>
              <div style={{ fontWeight: '700', fontSize: '16px', color: '#1e293b' }}>{ocParaPdf.proveedor}</div>
              {ocParaPdf.proveedorRut && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>RUT {ocParaPdf.proveedorRut}</div>}
            </div>
            {/* Tabla de items */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '8px' }}>Detalle de productos</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Producto', 'Cant.', 'Precio Unit.', 'Subtotal'].map((h, i) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: i === 0 ? 'left' : i === 1 ? 'center' : 'right', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(ocParaPdf.items || []).map((item, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px 12px', fontSize: '13px', color: '#1e293b' }}>
                        <strong>{item.producto}</strong>
                        {item.incluirDescripcion && item.descripcion && <div style={{ fontSize: '11px', color: '#64748b' }}>{item.descripcion}</div>}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '13px', color: '#475569' }}>{item.cantidad ?? 1}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#475569' }}>{formatCLP(item.precio)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{formatCLP((item.cantidad ?? 1) * (item.precio ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Totales */}
            {(() => {
              const neto = Math.round((ocParaPdf.monto ?? 0) / 1.19)
              const iva  = (ocParaPdf.monto ?? 0) - neto
              return (
                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                  {[['Subtotal Neto', neto], ['IVA (19%)', iva]].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '13px', color: '#64748b' }}>
                      <span>{label}</span><span>{formatCLP(val)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontSize: '16px', fontWeight: '700', color: '#0f172a', borderTop: '2px solid #e2e8f0', marginTop: '8px' }}>
                    <span>Total Orden de Compra</span>
                    <span style={{ color: '#3b82f6' }}>{formatCLP(ocParaPdf.monto)}</span>
                  </div>
                </div>
              )
            })()}
            {/* Observaciones */}
            {ocParaPdf.observaciones && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#92400e', marginBottom: '4px' }}>Observaciones</div>
                <div style={{ fontSize: '13px', color: '#78350f' }}>{ocParaPdf.observaciones}</div>
              </div>
            )}
          </div>
          {/* Footer */}
          <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '16px 36px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Este documento es una orden de compra interna y no constituye una factura.</div>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', marginTop: '6px' }}>Equipo MAMKAM &nbsp;|&nbsp; contacto@mamkam.cl</div>
          </div>
        </div>
      )}
    </div>
  )
}
