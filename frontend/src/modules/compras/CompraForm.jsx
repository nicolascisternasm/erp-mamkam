import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../auth/AuthContext'
import { formatCLP, formatDate } from '../../utils/formatters'
import {
  ArrowLeft, Save, Plus, Trash2, AlertCircle,
  Search, Building2, UserPlus, Check, FileText, X,
  MapPin, Phone, Mail, Zap,
} from 'lucide-react'

const EMPTY_ITEM = { producto: '', cantidad: 1, precio: 0, descripcion: '', incluirDescripcion: false }

function NuevoProveedorForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ nombre: '', rut: '', email: '', telefono: '', direccion: '', comuna: '' })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const valid = form.nombre.trim() && form.rut.trim()

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      <p className="text-sm font-semibold text-slate-700">Nuevo proveedor</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label-base">Nombre / Razón Social *</label>
          <input value={form.nombre} onChange={e => set('nombre', e.target.value)} className="input-base" placeholder="Empresa o persona" />
        </div>
        <div>
          <label className="label-base">RUT *</label>
          <input value={form.rut} onChange={e => set('rut', e.target.value)} className="input-base" placeholder="76.111.111-1" />
        </div>
        <div>
          <label className="label-base">Email</label>
          <input value={form.email} onChange={e => set('email', e.target.value)} className="input-base" placeholder="ventas@proveedor.cl" />
        </div>
        <div>
          <label className="label-base">Teléfono</label>
          <input value={form.telefono} onChange={e => set('telefono', e.target.value)} className="input-base" placeholder="+562 2111 0000" />
        </div>
        <div className="sm:col-span-2">
          <label className="label-base">Dirección</label>
          <input value={form.direccion} onChange={e => set('direccion', e.target.value)} className="input-base" placeholder="Calle / N°" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary text-sm py-1.5 px-3">Cancelar</button>
        <button type="button" disabled={!valid} onClick={() => onSave(form)} className="btn-primary text-sm py-1.5 px-3 disabled:opacity-50">
          <Check className="w-3.5 h-3.5" /> Guardar proveedor
        </button>
      </div>
    </div>
  )
}

export default function CompraForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { compras, cotizaciones, proveedores, addCompra, updateCompra, addProveedor } = useApp()
  const { user } = useAuth()

  const isEdit = Boolean(id)
  const existing = isEdit ? compras.find((oc) => oc.id === id) : null
  const aprobadas = cotizaciones.filter((c) => c.estado === 'aprobada')

  const [form, setForm] = useState({
    cotizacionId: '', cotizacionNumero: '', cotizacionCliente: '',
    proveedorId: '', proveedor: '', proveedorRut: '',
    observaciones: '',
    items: [{ ...EMPTY_ITEM, id: Date.now() }],
  })
  const [cotSearch,  setCotSearch]  = useState('')
  const [provSearch, setProvSearch] = useState('')
  const [showNuevo,  setShowNuevo]  = useState(false)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (existing) {
      setForm({
        cotizacionId:     existing.cotizacionId     || '',
        cotizacionNumero: existing.cotizacionNumero || '',
        cotizacionCliente:existing.cotizacionCliente|| '',
        proveedorId:      existing.proveedorId      || '',
        proveedor:        existing.proveedor        || '',
        proveedorRut:     existing.proveedorRut     || '',
        observaciones:    existing.observaciones    || '',
        items:            existing.items.map(i => ({ ...i })),
      })
      setProvSearch(existing.proveedor || '')
    }
  }, [])

  /* ── Cotización ──────────────────────────────────────────────── */
  const handleCotizacion = (cotId) => {
    const cot = cotizaciones.find(c => c.id === cotId)
    if (!cot) return
    setForm(p => ({
      ...p,
      cotizacionId:      cot.id,
      cotizacionNumero:  cot.numero,
      cotizacionCliente: cot.cliente,
      items: cot.items.map(i => ({ id: i.id, producto: i.producto, cantidad: i.cantidad, precio: i.valorUnitario })),
    }))
    setCotSearch('')
  }

  /* ── Proveedor ───────────────────────────────────────────────── */
  const provFiltered = proveedores.filter(p =>
    p.nombre.toLowerCase().includes(provSearch.toLowerCase()) ||
    p.rut.includes(provSearch)
  )

  const selectProveedor = (prov) => {
    setForm(p => ({ ...p, proveedorId: prov.id, proveedor: prov.nombre, proveedorRut: prov.rut }))
    setProvSearch(prov.nombre)
    setShowNuevo(false)
  }

  const handleNuevoProveedor = (data) => {
    const nuevo = addProveedor(data)
    selectProveedor(nuevo)
  }

  /* ── Items ───────────────────────────────────────────────────── */
  const set = (field, value) => setForm(p => ({ ...p, [field]: value }))
  const setItem = (idx, field, value) =>
    setForm(p => ({
      ...p,
      items: p.items.map((it, i) =>
        i === idx ? { ...it, [field]: field === 'cantidad' || field === 'precio' ? Number(value) || 0 : value } : it
      ),
    }))
  const addItem    = () => setForm(p => ({ ...p, items: [...p.items, { ...EMPTY_ITEM, id: Date.now() }] }))
  const removeItem = (idx) => setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))

  const neto  = form.items.reduce((s, i) => s + i.cantidad * i.precio, 0)
  const iva   = Math.round(neto * 0.19)
  const total = neto + iva

  /* ── Validación ──────────────────────────────────────────────── */
  const validate = () => {
    const e = {}
    if (!form.cotizacionId) e.cotizacion = 'Debes seleccionar una cotización aprobada'
    if (!form.proveedorId)  e.proveedor  = 'Debes seleccionar un proveedor'
    if (form.items.some(i => !i.producto.trim())) e.items = 'Todos los productos deben tener nombre'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    await new Promise(r => setTimeout(r, 300))
    const data = { ...form, monto: total }
    if (isEdit) { updateCompra(id, data); navigate(`/compras/${id}`) }
    else { const nueva = addCompra(data); navigate(`/compras/${nueva.id}`) }
  }

  const proveedorDetalle = proveedores.find(p => p.id === form.proveedorId)
  const fechaMostrar = isEdit ? formatDate(existing?.fecha) : formatDate(new Date().toISOString().split('T')[0])

  return (
    <div className="w-full space-y-4">
      {/* Cabecera de navegación */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/compras')} className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-lg font-bold text-slate-900">
          {isEdit ? `Editando ${existing?.numero}` : 'Nueva Orden de Compra'}
        </h2>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── DOCUMENTO EDITABLE ───────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">

          {/* Cabecera empresa */}
          <div className="bg-slate-900 px-8 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {user?.empresa?.logoUrl ? (
                <img src={user.empresa.logoUrl} alt={user.empresa.nombre} className="h-12 w-auto max-w-[140px] object-contain" />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-indigo-500 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
              )}
              <div>
                <div className="text-white font-bold text-lg tracking-tight">{user?.empresa?.nombre || 'MAMKAM'}</div>
                {user?.empresa?.email && <div className="text-slate-400 text-xs">{user.empresa.email}</div>}
                {user?.empresa?.giro  && <div className="text-slate-500 text-xs">{user.empresa.giro}</div>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Orden de Compra</div>
              <div className="text-white font-bold text-xl">{isEdit ? existing?.numero : 'Nueva'}</div>
            </div>
          </div>

          <div className="px-8 py-6 space-y-6">

            {/* ── Cotización de origen ─────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Cotización de origen *
              </p>

              {form.cotizacionId ? (
                <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5">
                  <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-indigo-700 text-sm">{form.cotizacionNumero}</span>
                    <span className="text-slate-500 text-sm ml-2 truncate">{form.cotizacionCliente}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setForm(p => ({ ...p, cotizacionId: '', cotizacionNumero: '', cotizacionCliente: '', items: [{ ...EMPTY_ITEM, id: Date.now() }] }))
                      setCotSearch('')
                    }}
                    className="text-indigo-400 hover:text-indigo-700 flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : aprobadas.length === 0 ? (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700">No hay cotizaciones en estado <strong>Aprobada</strong>. Aprueba una cotización primero.</p>
                </div>
              ) : (
                <>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={cotSearch}
                      onChange={e => setCotSearch(e.target.value)}
                      placeholder="Buscar por número o cliente..."
                      className="input-base pl-9"
                      autoFocus
                    />
                  </div>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-50">
                      {aprobadas
                        .filter(c =>
                          !cotSearch ||
                          c.numero.toLowerCase().includes(cotSearch.toLowerCase()) ||
                          c.cliente.toLowerCase().includes(cotSearch.toLowerCase())
                        )
                        .map(cot => (
                          <button
                            key={cot.id}
                            type="button"
                            onClick={() => handleCotizacion(cot.id)}
                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left gap-4"
                          >
                            <span className="font-mono text-xs text-indigo-600 font-semibold">{cot.numero}</span>
                            <span className="flex-1 text-sm text-slate-700 truncate">{cot.cliente}</span>
                            <span className="text-sm font-semibold text-slate-800 flex-shrink-0">{formatCLP(cot.total)}</span>
                          </button>
                        ))
                      }
                    </div>
                    <div className="px-4 py-1.5 bg-slate-50 border-t text-xs text-slate-400 text-right">
                      {aprobadas.length} cotización{aprobadas.length !== 1 ? 'es' : ''} aprobada{aprobadas.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </>
              )}

              {errors.cotizacion && (
                <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />{errors.cotizacion}
                </p>
              )}
            </div>

            <hr className="border-slate-100" />

            {/* ── Proveedor + Fecha ─────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Proveedor *</p>

                {form.proveedorId ? (
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <p className="font-bold text-slate-800">{form.proveedor}</p>
                      <p className="text-xs font-mono text-slate-500">RUT {form.proveedorRut}</p>
                      {proveedorDetalle && (
                        <div className="mt-1 space-y-0.5">
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
                    <button
                      type="button"
                      onClick={() => {
                        setForm(p => ({ ...p, proveedorId: '', proveedor: '', proveedorRut: '' }))
                        setProvSearch('')
                        setShowNuevo(false)
                      }}
                      className="p-1 text-slate-400 hover:text-slate-700 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : showNuevo ? (
                  <NuevoProveedorForm onSave={handleNuevoProveedor} onCancel={() => setShowNuevo(false)} />
                ) : (
                  <>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        value={provSearch}
                        onChange={e => setProvSearch(e.target.value)}
                        placeholder="Buscar por nombre o RUT..."
                        className="input-base pl-9"
                      />
                    </div>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="max-h-44 overflow-y-auto divide-y divide-slate-50">
                        {provFiltered.length > 0 ? provFiltered.map(prov => (
                          <button
                            key={prov.id}
                            type="button"
                            onClick={() => selectProveedor(prov)}
                            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-indigo-50 transition-colors text-left gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{prov.nombre}</p>
                              {prov.comuna && <p className="text-xs text-slate-400 truncate">{prov.comuna}</p>}
                            </div>
                            <span className="text-xs font-mono text-slate-400 flex-shrink-0">{prov.rut}</span>
                          </button>
                        )) : (
                          <div className="px-3 py-4 text-center text-sm text-slate-400">
                            Sin resultados para "{provSearch}"
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-2 bg-slate-50 border-t flex justify-between items-center">
                        <span className="text-xs text-slate-400">{proveedores.length} registrado{proveedores.length !== 1 ? 's' : ''}</span>
                        <button
                          type="button"
                          onClick={() => setShowNuevo(true)}
                          className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Nuevo proveedor
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {errors.proveedor && (
                  <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />{errors.proveedor}
                  </p>
                )}
              </div>

              <div className="sm:text-right">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Fecha de emisión</p>
                <p className="text-sm text-slate-600">{fechaMostrar}</p>
                {form.cotizacionNumero && (
                  <>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 mt-3">Ref. cotización</p>
                    <p className="text-sm text-slate-600">{form.cotizacionNumero}</p>
                    {form.cotizacionCliente && <p className="text-xs text-slate-400">{form.cotizacionCliente}</p>}
                  </>
                )}
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* ── Detalle de productos ─────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Detalle de productos</p>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar ítem
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Producto</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 w-20">Cant.</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 w-32">Precio Unit.</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 w-28">Subtotal</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {form.items.map((item, idx) => (
                      <>
                        <tr key={item.id || idx}>
                          <td className="px-1 py-1.5">
                            <input
                              value={item.producto}
                              onChange={e => setItem(idx, 'producto', e.target.value)}
                              placeholder="Nombre del producto"
                              className="input-base text-sm"
                            />
                            <label className="flex items-center gap-1.5 mt-1 cursor-pointer w-fit">
                              <input
                                type="checkbox"
                                checked={item.incluirDescripcion}
                                onChange={e => setItem(idx, 'incluirDescripcion', e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <span className="text-xs text-slate-500">Incluir descripción</span>
                            </label>
                          </td>
                          <td className="px-1 py-1.5">
                            <input
                              type="number" min="1"
                              value={item.cantidad}
                              onChange={e => setItem(idx, 'cantidad', e.target.value)}
                              className="input-base text-sm text-center"
                            />
                          </td>
                          <td className="px-1 py-1.5">
                            <input
                              type="number" min="0"
                              value={item.precio}
                              onChange={e => setItem(idx, 'precio', e.target.value)}
                              className="input-base text-sm text-right"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right font-medium text-slate-700 whitespace-nowrap">
                            {formatCLP(item.cantidad * item.precio)}
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            {form.items.length > 1 && (
                              <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 p-1">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                        {item.incluirDescripcion && (
                          <tr key={`desc-${item.id || idx}`}>
                            <td colSpan={5} className="px-1 pb-2">
                              <textarea
                                value={item.descripcion}
                                onChange={e => setItem(idx, 'descripcion', e.target.value)}
                                placeholder="Detalle del producto: especificaciones, materiales, alcance..."
                                rows={2}
                                className="input-base text-sm resize-none"
                              />
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
              {errors.items && <p className="text-xs text-red-500 mt-2">{errors.items}</p>}
            </div>

            {/* ── Totales ──────────────────────────────────────── */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal Neto</span>
                <span>{formatCLP(neto)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>IVA (19%)</span>
                <span>{formatCLP(iva)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-800">Total OC</span>
                <span className="text-xl font-bold text-indigo-600">{formatCLP(total)}</span>
              </div>
            </div>

            {/* ── Observaciones ────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Observaciones</p>
              <textarea
                value={form.observaciones}
                onChange={e => set('observaciones', e.target.value)}
                rows={3}
                placeholder="Instrucciones de entrega, plazos, condiciones de pago..."
                className="input-base resize-none text-sm"
              />
            </div>

            {/* Pie */}
            <div className="text-center pt-1 pb-1">
              <p className="text-xs text-slate-400">
                Este documento es una orden de compra interna y no constituye una factura.
              </p>
            </div>

          </div>
        </div>

        {/* ── Acciones ─────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button type="button" onClick={() => navigate('/compras')} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
            <Save className="w-4 h-4" />
            {saving ? 'Guardando…' : isEdit ? 'Guardar Cambios' : 'Crear Orden de Compra'}
          </button>
        </div>
      </form>
    </div>
  )
}
