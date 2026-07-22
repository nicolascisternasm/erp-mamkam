import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../auth/AuthContext'
import { formatCLP, formatDate } from '../../utils/formatters'
import { downloadPDF } from '../../utils/pdf'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import Toast from '../../components/Toast'
import {
  ArrowLeft, Pencil, ShoppingCart,
  CreditCard, Truck, Lock, CheckCircle2, XCircle,
  AlertTriangle, Receipt, Plus, FileDown, Zap,
  MapPin, Phone, Mail,
} from 'lucide-react'

/* ── Timeline de estados ─────────────────────────────────────────── */
const STEPS = [
  { key: 'creada',    label: 'Creada',    icon: ShoppingCart },
  { key: 'pagada',    label: 'Pagada',    icon: CreditCard   },
  { key: 'enviada',   label: 'Enviada',   icon: Truck        },
  { key: 'entregada', label: 'Entregada', icon: Truck        },
  { key: 'cerrada',   label: 'Cerrada',   icon: Lock         },
]
const STEP_IDX = { creada: 0, pagada: 1, enviada: 2, entregada: 3, cerrada: 4 }

function Timeline({ estado }) {
  const current = STEP_IDX[estado] ?? 0
  const steps = estado === 'enviada' || estado === 'entregada' || estado === 'cerrada'
    ? STEPS
    : STEPS.filter(s => s.key !== 'enviada')
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, idx) => {
        const stepIdx = STEP_IDX[step.key] ?? 0
        const done    = stepIdx < current
        const active  = stepIdx === current
        const Icon    = step.icon
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                done   ? 'bg-indigo-600 text-white' :
                active ? 'bg-indigo-100 border-2 border-indigo-500 text-indigo-600' :
                         'bg-slate-100 text-slate-300'
              }`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-xs mt-1 font-medium ${active ? 'text-indigo-600' : done ? 'text-slate-600' : 'text-slate-300'}`}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 mb-4 transition-colors ${done ? 'bg-indigo-400' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Modal: Verificación SII ─────────────────────────────────────── */
function SIIModal({ open, onClose, oc, factura, onConfirm, onAgregarFactura }) {
  if (!oc) return null
  const encontrada = Boolean(factura)

  return (
    <Modal open={open} onClose={onClose} title="Verificación de factura SII" size="md">
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Buscando factura para</p>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Proveedor</span>
            <span className="font-medium text-slate-800">{oc.proveedor}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-slate-600">RUT</span>
            <span className="font-medium text-slate-800">{oc.proveedorRut}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-slate-600">Monto OC</span>
            <span className="font-bold text-slate-900">{formatCLP(oc.monto)}</span>
          </div>
        </div>

        {encontrada ? (
          <>
            <div className="flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-800 text-sm">Factura encontrada en SII</p>
                <p className="text-xs text-emerald-600 mt-0.5">Los datos coinciden con la OC</p>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Folio</span>
                <span className="font-mono font-medium text-slate-800">#{factura.folio}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Emisión</span>
                <span className="text-slate-800">{formatDate(factura.fecha)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Neto</span>
                <span className="text-slate-800">{formatCLP(factura.neto)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">IVA</span>
                <span className="text-slate-800">{formatCLP(factura.iva)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-slate-100 pt-2 mt-1">
                <span className="text-slate-700">Total factura</span>
                <span className="text-slate-900">{formatCLP(factura.total)}</span>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={onClose}>Cancelar</button>
              <button onClick={() => onConfirm(factura)} className="btn-primary">
                <Lock className="w-4 h-4" /> Conciliar y cerrar OC
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-4">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-700 text-sm">Factura no encontrada en SII</p>
                <p className="text-xs text-red-500 mt-0.5">
                  No existe una factura de <strong>{oc.proveedor}</strong> por <strong>{formatCLP(oc.monto)}</strong> (±10%) en el sistema.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                La OC no puede cerrarse hasta que la factura esté registrada. Si ya tienes la factura del SII, puedes ingresarla manualmente.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={onClose}>Cerrar</button>
              <button onClick={onAgregarFactura} className="btn-primary">
                <Plus className="w-4 h-4" /> Ingresar factura manualmente
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

/* ── Modal: Agregar Factura ──────────────────────────────────────── */
function AgregarFacturaModal({ open, onClose, oc, onSave }) {
  const [form, setForm] = useState({ folio: '', fecha: new Date().toISOString().split('T')[0], neto: '', iva: '', total: '' })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleNeto = (v) => {
    const neto = Number(v) || 0
    const iva  = Math.round(neto * 0.19)
    setForm(p => ({ ...p, neto: v, iva: String(iva), total: String(neto + iva) }))
  }

  const valid = form.folio.trim() && form.fecha && Number(form.total) > 0

  if (!oc) return null
  return (
    <Modal open={open} onClose={onClose} title="Ingresar factura manualmente" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Ingresa la factura de <strong className="text-slate-700">{oc.proveedor}</strong> obtenida desde el SII.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-base">Folio *</label>
            <input value={form.folio} onChange={e => set('folio', e.target.value)} placeholder="12345" className="input-base" />
          </div>
          <div>
            <label className="label-base">Fecha emisión *</label>
            <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="label-base">Neto ($)</label>
            <input type="number" value={form.neto} onChange={e => handleNeto(e.target.value)} placeholder="0" className="input-base" />
          </div>
          <div>
            <label className="label-base">IVA ($)</label>
            <input type="number" value={form.iva} onChange={e => set('iva', e.target.value)} placeholder="0" className="input-base" />
          </div>
          <div className="col-span-2">
            <label className="label-base">Total factura ($) *</label>
            <input type="number" value={form.total} onChange={e => set('total', e.target.value)} placeholder="0" className="input-base font-semibold" />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button disabled={!valid} onClick={() => onSave({ ...form, neto: Number(form.neto), iva: Number(form.iva), total: Number(form.total) })} className="btn-primary disabled:opacity-50">
            <Receipt className="w-4 h-4" /> Guardar factura
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ── Componente principal ────────────────────────────────────────── */
export default function CompraDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { compras, cotizaciones, proveedores, updateCompra, buscarFacturaSII, addFacturaSII, empresa } = useApp()
  const { user } = useAuth()

  const [showSII,     setShowSII]     = useState(false)
  const [showAgregar, setShowAgregar] = useState(false)
  const [toast,       setToast]       = useState(null)
  const docRef = useRef(null)

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4500) }

  const oc  = compras.find(c => c.id === id)

  if (!oc) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-slate-400">Orden de compra no encontrada.</p>
          <button onClick={() => navigate('/compras')} className="btn-secondary mt-3">Volver</button>
        </div>
      </div>
    )
  }

  const handleEntregada = () => {
    updateCompra(id, { estado: 'entregada' })
    showToast('success', 'OC marcada como Entregada')
  }

  const handleVerificarSII = () => setShowSII(true)

  const handleCerrar = (factura) => {
    updateCompra(id, { estado: 'cerrada', facturaVerificada: { folio: factura.folio, fecha: factura.fecha, monto: factura.total } })
    setShowSII(false)
    showToast('success', `OC cerrada y conciliada con factura N° ${factura.folio}`)
  }

  const handleAgregarFactura = (data) => {
    const nueva = addFacturaSII({ ...data, proveedor: oc.proveedor, proveedorRut: oc.proveedorRut })
    setShowAgregar(false)
    setShowSII(false)
    updateCompra(id, { estado: 'cerrada', facturaVerificada: { folio: nueva.folio, fecha: nueva.fecha, monto: nueva.total } })
    showToast('success', `Factura N° ${nueva.folio} registrada. OC cerrada correctamente.`)
  }

  const facturaMatch    = buscarFacturaSII(oc.proveedorRut, oc.monto)
  const proveedorDetalle = proveedores.find(p => p.id === oc.proveedorId)

  const handleDownloadPDF = () => downloadPDF(docRef.current, `${oc.numero}.pdf`)

  return (
    <div className="w-full space-y-5">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => navigate('/compras')} className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{oc.numero}</h2>
            <Badge status={oc.estado} />
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Creada el {formatDate(oc.fecha)}</p>
        </div>

        {empresa?.logo_url && (
          <img src={empresa.logo_url} alt={empresa.razon_social || empresa.nombre} className="h-10 w-auto max-w-[120px] object-contain opacity-80" />
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={handleDownloadPDF} className="btn-secondary">
            <FileDown className="w-4 h-4" /><span className="hidden sm:inline">PDF</span>
          </button>

          {oc.estado === 'creada' && (
            <button onClick={() => navigate(`/compras/${id}/editar`)} className="btn-secondary">
              <Pencil className="w-4 h-4" /><span className="hidden sm:inline">Editar</span>
            </button>
          )}

          {(oc.estado === 'pagada' || oc.estado === 'enviada') && (
            <button onClick={handleEntregada} className="btn-primary">
              <Truck className="w-4 h-4" /><span className="hidden sm:inline">Marcar Entregada</span>
            </button>
          )}

          {oc.estado === 'entregada' && (
            <button onClick={handleVerificarSII} className="btn-primary">
              <Lock className="w-4 h-4" /><span className="hidden sm:inline">Cerrar OC</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Timeline ──────────────────────────────────────────── */}
      <div className="card p-5">
        <Timeline estado={oc.estado} />
      </div>

      {/* ── Referencia interna ────────────────────────────────── */}
      {oc.cotizacionNumero && (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-5 py-4 print:hidden">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 uppercase tracking-wider">
              Solo uso interno
            </span>
            <span className="text-xs text-amber-500">· No se incluye en el PDF ni en impresion</span>
          </div>
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-0.5">Referencia cotizacion</p>
          <p className="text-sm font-medium text-amber-900">{oc.cotizacionNumero}</p>
          {oc.cotizacionCliente && (
            <p className="text-xs text-amber-700 mt-0.5">{oc.cotizacionCliente}</p>
          )}
        </div>
      )}

      {/* ── Documento OC ──────────────────────────────────────── */}
      <div ref={docRef} className="bg-white rounded-2xl shadow-lg overflow-hidden" style={{ fontSize: '15px' }}>
        {/* Cabecera empresa */}
        <div className="bg-slate-900 px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {empresa?.logo_url ? (
              <img
                src={empresa.logo_url}
                alt={empresa.razon_social || empresa.nombre}
                className="max-h-[48px] w-auto max-w-[160px] object-contain"
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-indigo-500 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              {!empresa?.logo_url && (
                <div className="text-white font-bold text-lg tracking-tight">{empresa?.razon_social || empresa?.nombre || 'MAMKAM'}</div>
              )}
              {(empresa?.email_contacto || empresa?.email) && (
                <div className="text-slate-400 text-xs">{empresa.email_contacto || empresa.email}</div>
              )}
              {empresa?.giro && <div className="text-slate-500 text-xs">{empresa.giro}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Orden de Compra</div>
            <div className="text-white font-black text-3xl tracking-tight">{oc.numero}</div>
            <div className="mt-1">
              <Badge status={oc.estado} />
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Proveedor + fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Proveedor</p>
              <p className="font-bold text-slate-800 text-base">{oc.proveedor}</p>
              <p className="text-xs font-mono text-slate-500 mt-0.5">RUT {oc.proveedorRut}</p>
              {proveedorDetalle && (
                <div className="mt-2 space-y-1">
                  {(proveedorDetalle.direccion || proveedorDetalle.comuna) && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-slate-500">
                        {[proveedorDetalle.direccion, proveedorDetalle.comuna].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  {proveedorDetalle.telefono && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="text-xs text-slate-500">{proveedorDetalle.telefono}</span>
                    </div>
                  )}
                  {proveedorDetalle.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="text-xs text-slate-500">{proveedorDetalle.email}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Fecha de emision</p>
              <p className="text-sm text-slate-600">{formatDate(oc.fecha)}</p>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Itemes */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Detalle de productos</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 rounded-tl-lg">Producto</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500">Cantidad</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">Precio Unit.</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 rounded-tr-lg">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {oc.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <div>{item.producto}</div>
                        {item.incluirDescripcion && item.descripcion && (
                          <div className="text-xs text-slate-500 mt-0.5 font-normal">{item.descripcion}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">{item.cantidad}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCLP(item.precio)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCLP(item.cantidad * item.precio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totales */}
          {(() => {
            const neto  = Math.round(oc.monto / 1.19)
            const iva   = oc.monto - neto
            return (
              <div className="bg-slate-50 rounded-xl p-5 space-y-2">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotal Neto</span>
                  <span>{formatCLP(neto)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>IVA (19%)</span>
                  <span>{formatCLP(iva)}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-slate-200 mt-2">
                  <span className="font-bold text-slate-800">Total Orden de Compra</span>
                  <span className="text-2xl font-bold text-indigo-600">{formatCLP(oc.monto)}</span>
                </div>
              </div>
            )
          })()}

          {/* Factura SII conciliada */}
          {oc.facturaVerificada && (
            <div className="border border-emerald-100 bg-emerald-50 rounded-xl p-4 flex items-center gap-3">
              <Receipt className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-0.5">Factura SII conciliada</p>
                <p className="text-sm text-emerald-800 font-medium">Folio #{oc.facturaVerificada.folio}</p>
                <p className="text-xs text-emerald-600">{formatDate(oc.facturaVerificada.fecha)} · {formatCLP(oc.facturaVerificada.monto)}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Conciliada
              </span>
            </div>
          )}

          {/* Observaciones */}
          {oc.observaciones && (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Observaciones</p>
              <p className="text-sm text-amber-800">{oc.observaciones}</p>
            </div>
          )}

          {/* Datos para facturacion */}
          {(empresa?.razon_social || empresa?.nombre || empresa?.rut) && (
            <div className="border-t border-slate-100 pt-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Datos para facturacion</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs text-slate-600">
                {(empresa?.razon_social || empresa?.nombre) && (
                  <div>
                    <span className="text-slate-400">Razon social: </span>
                    <span className="font-medium text-slate-700">{empresa.razon_social || empresa.nombre}</span>
                  </div>
                )}
                {empresa?.rut && (
                  <div>
                    <span className="text-slate-400">RUT: </span>
                    <span className="font-medium text-slate-700">{empresa.rut}</span>
                  </div>
                )}
                {empresa?.giro && (
                  <div className="col-span-2">
                    <span className="text-slate-400">Giro: </span>{empresa.giro}
                  </div>
                )}
                {empresa?.direccion && (
                  <div className="col-span-2">
                    <span className="text-slate-400">Direccion: </span>{empresa.direccion}
                  </div>
                )}
                {(empresa?.email_contacto || empresa?.email) && (
                  <div>
                    <span className="text-slate-400">Email: </span>{empresa.email_contacto || empresa.email}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pie */}
          <div className="text-center pt-4 pb-1">
            <p className="text-xs text-slate-400">
              Este documento es una orden de compra interna y no constituye una factura.
            </p>
          </div>
        </div>
      </div>

      {/* ── Modales ───────────────────────────────────────────── */}
      <SIIModal
        open={showSII}
        onClose={() => setShowSII(false)}
        oc={oc}
        factura={facturaMatch}
        onConfirm={handleCerrar}
        onAgregarFactura={() => { setShowSII(false); setShowAgregar(true) }}
      />
      <AgregarFacturaModal
        open={showAgregar}
        onClose={() => setShowAgregar(false)}
        oc={oc}
        onSave={handleAgregarFactura}
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
