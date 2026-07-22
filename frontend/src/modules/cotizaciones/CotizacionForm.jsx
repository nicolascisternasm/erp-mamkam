import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../../services/supabase'
import { formatCLP, addBusinessDays } from '../../utils/formatters'
import { Plus, Trash2, ArrowLeft, Save, CheckCircle2, User } from 'lucide-react'

const MEDICIONES = ['Unidad', 'M2', 'ML', 'M3']

const EMPTY_ITEM = {
  producto: '',
  productoId: null,
  manual: false,
  incluirDescripcion: false,
  descripcion: '',
  cantidad: 1,
  medicion: 'Unidad',
  valorUnitario: 0,
}

export default function CotizacionForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { cotizaciones, addCotizacion, updateCotizacion } = useApp()
  const { user } = useAuth()
  const isEdit = Boolean(id)
  const existing = isEdit ? cotizaciones.find((c) => c.id === id) : null

  const defaultExpiracion = addBusinessDays(new Date(), 10).toISOString().split('T')[0]

  const [productosDisponibles, setProductosDisponibles] = useState([])
  const [form, setForm] = useState({
    cliente: '',
    comuna: '',
    direccion: '',
    telefono: '',
    email: '',
    glosa: '',
    fechaExpiracion: defaultExpiracion,
    descuentoTipo: 'porcentaje',
    descuentoValor: 0,
    observaciones: '',
    items: [{ ...EMPTY_ITEM, id: Date.now() }],
    condicionesPago: [],
    productosAsociados: [],
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const cargarProductos = useCallback(async () => {
    if (!supabase || !user?.empresa_id) return
    const { data } = await supabase
      .from('productos').select('*').eq('empresa_id', user.empresa_id).eq('activo', true).order('nombre')
    if (data) setProductosDisponibles(data)
  }, [user?.empresa_id])

  useEffect(() => { cargarProductos() }, [cargarProductos])

  useEffect(() => {
    if (existing) {
      setForm({
        cliente: existing.cliente || '',
        comuna: existing.comuna || '',
        direccion: existing.direccion || '',
        telefono: existing.telefono || '',
        email: existing.email || '',
        glosa: existing.glosa || '',
        fechaExpiracion: existing.fechaExpiracion || addBusinessDays(new Date(), 10).toISOString().split('T')[0],
        descuentoTipo: existing.descuentoTipo || 'porcentaje',
        descuentoValor: existing.descuentoValor || 0,
        observaciones: existing.observaciones || '',
        items: existing.items.map((item) => ({ ...item })),
        condicionesPago: existing.condicionesPago || [],
        productosAsociados: existing.productos_asociados || [],
      })
    }
  }, [])

  const set = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }))
    setErrors((e) => ({ ...e, [field]: '' }))
  }

  const seleccionarProducto = (idx, prodId) => {
    const medMap = { unidad: 'Unidad', m2: 'M2', ml: 'ML', m3: 'M3' }
    const prod = productosDisponibles.find((p) => p.id === prodId)
    setForm((p) => ({
      ...p,
      items: p.items.map((it, i) => {
        if (i !== idx) return it
        if (!prod) return { ...it, productoId: null, producto: '', valorUnitario: 0 }
        return {
          ...it,
          productoId: prod.id,
          producto: prod.nombre,
          medicion: medMap[prod.unidad_medida?.toLowerCase()] || it.medicion,
          valorUnitario: 0,
        }
      }),
    }))
  }

  const addManualItem = () =>
    setForm((p) => ({ ...p, items: [...p.items, { ...EMPTY_ITEM, id: Date.now(), manual: true }] }))

  const setItem = (idx, field, value) => {
    setForm((p) => ({
      ...p,
      items: p.items.map((item, i) => {
        if (i !== idx) return item
        const parsed =
          field === 'cantidad' || field === 'valorUnitario'
            ? Number(value) || 0
            : field === 'incluirDescripcion'
            ? value
            : value
        return { ...item, [field]: parsed }
      }),
    }))
  }

  const addItem = () =>
    setForm((p) => ({ ...p, items: [...p.items, { ...EMPTY_ITEM, id: Date.now() }] }))

  const removeItem = (idx) =>
    setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))

  const addCondicion = () =>
    setForm((p) => ({
      ...p,
      condicionesPago: [...p.condicionesPago, { id: Date.now(), descripcion: '', porcentaje: 50 }],
    }))

  const setCondicion = (idx, field, value) =>
    setForm((p) => ({
      ...p,
      condicionesPago: p.condicionesPago.map((c, i) => i === idx ? { ...c, [field]: value } : c),
    }))

  const removeCondicion = (idx) =>
    setForm((p) => ({ ...p, condicionesPago: p.condicionesPago.filter((_, i) => i !== idx) }))

  // Cálculos
  const subtotal = form.items.reduce((s, i) => s + i.cantidad * i.valorUnitario, 0)
  const descuentoMonto = form.descuentoTipo === 'porcentaje'
    ? Math.round(subtotal * (Number(form.descuentoValor) || 0) / 100)
    : Number(form.descuentoValor) || 0
  const neto = Math.max(0, subtotal - descuentoMonto)
  const iva = Math.round(neto * 0.19)
  const total = neto + iva

  const totalPct = form.condicionesPago.reduce((s, c) => s + (c.porcentaje || 0), 0)

  const validate = () => {
    const e = {}
    if (!form.cliente.trim()) e.cliente = 'El nombre del cliente es obligatorio'
    if (!form.comuna.trim()) e.comuna = 'La comuna es obligatoria'
    if (!form.direccion.trim()) e.direccion = 'La dirección es obligatoria'
    if (form.telefono && !/^\+569\d{8}$/.test(form.telefono.replace(/\s/g, ''))) {
      e.telefono = 'Formato: +569XXXXXXXX'
    }
    if (form.items.some((i) => !i.producto.trim())) e.items = 'Todos los ítems deben tener un producto seleccionado o descripción'
    if (form.items.some((i) => i.valorUnitario <= 0)) e.items = 'El valor unitario debe ser mayor a 0'
    if (form.condicionesPago.length > 0) {
      if (form.condicionesPago.some((c) => !c.descripcion.trim()))
        e.condicionesPago = 'Cada cuota debe tener una descripción'
      else if (totalPct !== 100)
        e.condicionesPago = `Las cuotas deben sumar 100% (actualmente ${totalPct}%)`
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    await new Promise((r) => setTimeout(r, 300))
    const condicionesPagoConMonto = form.condicionesPago.map((c) => ({
      ...c,
      monto: Math.round(total * c.porcentaje / 100),
    }))
    const productosAsociados = [
      ...new Set(
        form.items
          .filter((it) => !it.manual && it.productoId && it.producto)
          .map((it) => it.producto)
      ),
    ]
    const data = {
      ...form,
      neto, iva, total,
      condicionesPago: condicionesPagoConMonto,
      productos_asociados: productosAsociados,
      usuarioId: isEdit ? existing?.usuarioId : (user?.id || null),
      creadoPor: isEdit ? existing?.creadoPor : (user?.nombre || null),
    }
    if (isEdit) updateCotizacion(id, data)
    else addCotizacion(data)
    navigate('/cotizaciones')
  }

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/cotizaciones')} className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {isEdit ? `Editar ${existing?.numero}` : 'Nueva Cotización'}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {isEdit ? 'Modifica los datos de la cotización' : 'Completa los datos del cliente y los productos o servicios'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Vendedor */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 leading-none mb-0.5">
                {isEdit ? 'Creado por' : 'Cotización creada por'}
              </p>
              <p className="text-sm font-semibold text-slate-800">
                {isEdit ? (existing?.creadoPor || user?.nombre || '—') : (user?.nombre || '—')}
              </p>
            </div>
          </div>
        </div>

        {/* Datos del cliente */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Datos del Cliente</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nombre */}
            <div className="sm:col-span-2">
              <label className="label-base">Nombre / Empresa *</label>
              <input
                value={form.cliente}
                onChange={(e) => set('cliente', e.target.value)}
                placeholder="Constructora Ejemplo SpA"
                className={`input-base ${errors.cliente ? 'border-red-400' : ''}`}
              />
              {errors.cliente && <p className="text-xs text-red-500 mt-1">{errors.cliente}</p>}
            </div>

            {/* Comuna */}
            <div>
              <label className="label-base">Comuna *</label>
              <input
                value={form.comuna}
                onChange={(e) => set('comuna', e.target.value)}
                placeholder="Las Condes"
                className={`input-base ${errors.comuna ? 'border-red-400' : ''}`}
              />
              {errors.comuna && <p className="text-xs text-red-500 mt-1">{errors.comuna}</p>}
            </div>

            {/* Dirección */}
            <div>
              <label className="label-base">Dirección *</label>
              <input
                value={form.direccion}
                onChange={(e) => set('direccion', e.target.value)}
                placeholder="Av. Apoquindo 3000"
                className={`input-base ${errors.direccion ? 'border-red-400' : ''}`}
              />
              {errors.direccion && <p className="text-xs text-red-500 mt-1">{errors.direccion}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="label-base">Correo electrónico</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="cliente@empresa.cl"
                className={`input-base ${errors.email ? 'border-red-400' : ''}`}
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>

            {/* Teléfono */}
            <div>
              <label className="label-base">Teléfono (WhatsApp)</label>
              <input
                value={form.telefono}
                onChange={(e) => set('telefono', e.target.value)}
                placeholder="+56912345678"
                className={`input-base font-mono ${errors.telefono ? 'border-red-400' : ''}`}
              />
              {errors.telefono
                ? <p className="text-xs text-red-500 mt-1">{errors.telefono}</p>
                : <p className="text-xs text-slate-400 mt-1">Formato: +569XXXXXXXX</p>
              }
            </div>

            {/* Fecha de expiración */}
            <div>
              <label className="label-base">Fecha de expiración</label>
              <input
                type="date"
                value={form.fechaExpiracion}
                onChange={(e) => set('fechaExpiracion', e.target.value)}
                className="input-base"
              />
              <p className="text-xs text-slate-400 mt-1">Por defecto: 10 días hábiles desde hoy</p>
            </div>
          </div>
        </div>

        {/* Glosa */}
        <div className="card p-5">
          <label className="label-base">Glosa / Descripción del proyecto</label>
          <textarea
            value={form.glosa}
            onChange={(e) => set('glosa', e.target.value.slice(0, 500))}
            rows={3}
            placeholder="Descripción general del proyecto o trabajo a cotizar..."
            className="input-base resize-none"
          />
          <p className="text-xs text-slate-400 mt-1 text-right">{form.glosa.length}/500</p>
        </div>

        {/* Productos / Servicios */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Productos / Servicios</h3>
              <p className="text-xs text-slate-400 mt-0.5">Los precios son valores netos (sin IVA)</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={addManualItem} className="btn-ghost text-xs py-1.5 px-3 border border-slate-200">
                <Plus className="w-3.5 h-3.5" /> Ítem manual
              </button>
              <button type="button" onClick={addItem} className="btn-secondary text-xs py-1.5 px-3">
                <Plus className="w-3.5 h-3.5" /> Agregar ítem
              </button>
            </div>
          </div>

          {errors.items && (
            <p className="text-xs text-red-500 mb-3 bg-red-50 px-3 py-2 rounded-lg">{errors.items}</p>
          )}

          <div className="space-y-4">
            {form.items.map((item, idx) => (
              <div
                key={item.id || idx}
                className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50"
              >
                {/* Fila 1: Producto + botón eliminar */}
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    {item.manual ? (
                      <>
                        <label className="label-base text-xs">Descripción *</label>
                        <input
                          value={item.producto}
                          onChange={(e) => setItem(idx, 'producto', e.target.value)}
                          placeholder="Trabajo o material libre..."
                          className="input-base text-sm"
                        />
                      </>
                    ) : (
                      <>
                        <label className="label-base text-xs">Producto *</label>
                        <select
                          value={item.productoId || ''}
                          onChange={(e) => seleccionarProducto(idx, e.target.value)}
                          className="input-base text-sm"
                        >
                          <option value="">Seleccionar producto...</option>
                          {productosDisponibles.map((prod) => (
                            <option key={prod.id} value={prod.id}>{prod.nombre}</option>
                          ))}
                        </select>
                        {item.productoId && (() => {
                          const prod = productosDisponibles.find((p) => p.id === item.productoId)
                          if (!prod) return null
                          const tieneRef = prod.precio_referencia != null && prod.precio_referencia > 0
                          const tieneReal = prod.precio_real != null && prod.precio_real > 0
                          if (!tieneRef && !tieneReal) return null
                          return (
                            <div className="flex flex-wrap gap-2">
                              {tieneRef && (
                                <button type="button"
                                  onClick={() => setItem(idx, 'valorUnitario', prod.precio_referencia)}
                                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                                    item.valorUnitario === prod.precio_referencia
                                      ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-semibold'
                                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}>
                                  💡 Referencial: {formatCLP(prod.precio_referencia)}
                                </button>
                              )}
                              {tieneReal ? (
                                <button type="button"
                                  onClick={() => setItem(idx, 'valorUnitario', prod.precio_real)}
                                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                                    item.valorUnitario === prod.precio_real
                                      ? 'bg-emerald-50 border-emerald-400 text-emerald-700 font-semibold'
                                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}>
                                  📊 Real: {formatCLP(prod.precio_real)}
                                </button>
                              ) : (
                                <span className="text-xs px-3 py-1.5 rounded-lg border border-slate-100 text-slate-300 cursor-default">
                                  📊 Sin cálculo aún
                                </span>
                              )}
                            </div>
                          )
                        })()}
                      </>
                    )}
                  </div>
                  {form.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="mt-5 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Toggle descripción */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer w-fit">
                    <input
                      type="checkbox"
                      checked={item.incluirDescripcion}
                      onChange={(e) => setItem(idx, 'incluirDescripcion', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="text-xs font-medium text-slate-600">Incluir descripción</span>
                  </label>
                  {item.incluirDescripcion && (
                    <textarea
                      value={item.descripcion}
                      onChange={(e) => setItem(idx, 'descripcion', e.target.value)}
                      placeholder="Detalle del trabajo: materiales incluidos, alcance, especificaciones..."
                      rows={2}
                      className="input-base text-sm resize-none mt-2"
                    />
                  )}
                </div>

                {/* Fila 2: Cantidad + Medición + Valor Neto + Subtotal */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="label-base text-xs">Cantidad *</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.cantidad}
                      onChange={(e) => setItem(idx, 'cantidad', e.target.value)}
                      className="input-base text-sm text-center"
                    />
                  </div>
                  <div>
                    <label className="label-base text-xs">Medición</label>
                    <select
                      value={item.medicion}
                      onChange={(e) => setItem(idx, 'medicion', e.target.value)}
                      className="input-base text-sm"
                    >
                      {MEDICIONES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-base text-xs">Valor Neto *</label>
                    <input
                      type="number"
                      min="0"
                      value={item.valorUnitario}
                      onChange={(e) => setItem(idx, 'valorUnitario', e.target.value)}
                      placeholder="0"
                      className="input-base text-sm text-right"
                    />
                  </div>
                  <div>
                    <label className="label-base text-xs">Subtotal</label>
                    <div className="input-base text-sm text-right font-semibold text-slate-700 bg-slate-100 cursor-default select-none">
                      {formatCLP(item.cantidad * item.valorUnitario)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Resumen de totales */}
          <div className="mt-5 pt-4 border-t border-slate-200 space-y-4">
            {/* Descuento */}
            <div className="flex justify-end">
              <div className="w-full sm:w-72">
                <label className="label-base text-xs mb-1">Descuento</label>
                <div className="flex gap-2">
                  <select
                    value={form.descuentoTipo}
                    onChange={(e) => set('descuentoTipo', e.target.value)}
                    className="input-base text-sm w-32"
                  >
                    <option value="porcentaje">Porcentaje (%)</option>
                    <option value="monto">Monto fijo ($)</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={form.descuentoValor}
                    onChange={(e) => set('descuentoValor', e.target.value)}
                    placeholder="0"
                    className="input-base text-sm text-right flex-1"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <div className="w-full sm:w-72 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium text-slate-800">{formatCLP(subtotal)}</span>
                </div>
                {descuentoMonto > 0 && (
                  <div className="flex justify-between items-center text-sm text-emerald-600">
                    <span>Descuento {form.descuentoTipo === 'porcentaje' ? `(${form.descuentoValor}%)` : ''}</span>
                    <span>−{formatCLP(descuentoMonto)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Neto</span>
                  <span className="font-medium text-slate-800">{formatCLP(neto)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">IVA (19%)</span>
                  <span className="font-medium text-slate-800">{formatCLP(iva)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">Total</span>
                  <span className="text-xl font-bold text-slate-900">{formatCLP(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Condiciones de Pago */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Condiciones de Pago</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {form.condicionesPago.length === 0
                  ? 'El cliente paga el total al aprobar la cotización'
                  : `Dividido en ${form.condicionesPago.length} cuota${form.condicionesPago.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            {form.condicionesPago.length === 0 && (
              <button type="button" onClick={addCondicion} className="btn-secondary text-xs py-1.5 px-3">
                <Plus className="w-3.5 h-3.5" /> Dividir en cuotas
              </button>
            )}
          </div>

          {form.condicionesPago.length === 0 ? (
            <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800">Pago único</p>
                <p className="text-xs text-emerald-600">{formatCLP(total)} al momento de aprobar</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {form.condicionesPago.map((c, idx) => {
                const monto = Math.round(total * c.porcentaje / 100)
                return (
                  <div key={c.id} className="flex items-center gap-2">
                    <input
                      value={c.descripcion}
                      onChange={(e) => setCondicion(idx, 'descripcion', e.target.value)}
                      placeholder="Ej: Anticipo, Contra entrega, Al llegar material..."
                      className="input-base text-sm flex-1"
                    />
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <input
                        type="number" min="1" max="100" step="1"
                        value={c.porcentaje}
                        onChange={(e) => setCondicion(idx, 'porcentaje', Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="input-base text-sm w-16 text-center"
                      />
                      <span className="text-xs text-slate-400">%</span>
                    </div>
                    <div className="w-28 text-right flex-shrink-0">
                      <span className="text-sm font-semibold text-slate-700">{formatCLP(monto)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCondicion(idx)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={addCondicion} className="btn-secondary text-xs py-1.5 px-3">
                    <Plus className="w-3.5 h-3.5" /> Agregar cuota
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, condicionesPago: [] }))}
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    ← Volver a pago único
                  </button>
                </div>
                <span className={`text-xs font-semibold ${totalPct === 100 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {totalPct}% {totalPct < 100 ? `(faltan ${100 - totalPct}%)` : totalPct > 100 ? `(sobran ${totalPct - 100}%)` : '✓'}
                </span>
              </div>

              {errors.condicionesPago && (
                <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{errors.condicionesPago}</p>
              )}
            </div>
          )}
        </div>

        {/* Observaciones */}
        <div className="card p-5">
          <label className="label-base">Observaciones</label>
          <textarea
            value={form.observaciones}
            onChange={(e) => set('observaciones', e.target.value)}
            rows={3}
            placeholder="Condiciones de pago, plazos de ejecución, garantías..."
            className="input-base resize-none"
          />
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate('/cotizaciones')} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEdit ? 'Guardar Cambios' : 'Crear Cotización'}
          </button>
        </div>
      </form>

    </div>
  )
}
