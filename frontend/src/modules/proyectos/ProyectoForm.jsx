import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Save, Users, FileText, ShoppingCart, ChevronDown, ChevronUp,
} from 'lucide-react'
import { apiClient } from '../../services/apiClient'
import { useApp } from '../../context/AppContext'
import { formatCLP } from '../../utils/formatters'

function SectionHeader({ icon: Icon, title, expanded, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-3 px-0 text-left"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-indigo-600" />
        <span className="text-sm font-semibold text-slate-800">{title}</span>
      </div>
      {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
    </button>
  )
}

export default function ProyectoForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { cotizaciones: allCotizaciones, compras: allCompras } = useApp()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Datos generales
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [cliente, setCliente] = useState('')
  const [responsableId, setResponsableId] = useState('')
  const [responsableNombre, setResponsableNombre] = useState('')
  const [fechaInicioEst, setFechaInicioEst] = useState('')
  const [fechaFinEst, setFechaFinEst] = useState('')

  // Secciones expandidas
  const [showCots, setShowCots] = useState(true)
  const [showTrabs, setShowTrabs] = useState(true)
  const [showOCs, setShowOCs] = useState(false)

  // Datos externos
  const [trabajadores, setTrabajadores] = useState([])

  // Cotizaciones aprobadas y compras desde el contexto
  const cotizaciones = useMemo(
    () => allCotizaciones.filter((c) => c.estado === 'aprobada'),
    [allCotizaciones],
  )
  const compras = allCompras

  // Selecciones
  const [selectedCots, setSelectedCots] = useState(new Set())
  const [selectedTrabs, setSelectedTrabs] = useState(new Set())
  const [selectedOCs, setSelectedOCs] = useState(new Set())

  useEffect(() => {
    apiClient.get('/trabajadores').catch(() => []).then((trabs) => {
      setTrabajadores(trabs || [])
    })
  }, [])

  // BUG 3 — auto-seleccionar OCs vinculadas a las cotizaciones seleccionadas
  useEffect(() => {
    if (selectedCots.size === 0) return
    const autoOCIds = compras
      .filter((c) => c.cotizacionId && selectedCots.has(c.cotizacionId))
      .map((c) => c.id)
    if (autoOCIds.length > 0) {
      setSelectedOCs((prev) => new Set([...prev, ...autoOCIds]))
      setShowOCs(true)
    }
  }, [selectedCots, compras])

  useEffect(() => {
    if (!isEdit) return
    apiClient.get(`/proyectos/${id}`)
      .then((data) => {
        setNombre(data.nombre || '')
        setDescripcion(data.descripcion || '')
        setCliente(data.cliente || '')
        setResponsableId(data.responsableId || '')
        setResponsableNombre(data.responsableNombre || '')
        setFechaInicioEst(data.fechaInicioEst || '')
        setFechaFinEst(data.fechaFinEst || '')
        setSelectedCots(new Set(data.cotizacionIds || []))
        setSelectedTrabs(new Set((data.trabajadorIds || []).map((t) => t.trabajadorId)))
        setSelectedOCs(new Set(data.ocIds || []))
      })
      .catch(() => setError('No se pudo cargar el proyecto.'))
  }, [id, isEdit])

  const toggleSet = (setter, val) =>
    setter((prev) => {
      const next = new Set(prev)
      next.has(val) ? next.delete(val) : next.add(val)
      return next
    })

  const totalCots = cotizaciones
    .filter((c) => selectedCots.has(c.id))
    .reduce((s, c) => s + (c.total ?? 0), 0)

  const totalOCs = compras
    .filter((c) => selectedOCs.has(c.id))
    .reduce((s, c) => s + (c.monto ?? 0), 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nombre.trim() || !cliente.trim()) {
      setError('Nombre y cliente son requeridos.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        cliente: cliente.trim(),
        responsable_id: responsableId || null,
        fecha_inicio_est: fechaInicioEst || null,
        fecha_fin_est: fechaFinEst || null,
        cotizacion_ids: [...selectedCots],
        trabajador_ids: [...selectedTrabs],
      }
      if (isEdit) {
        await apiClient.patch(`/proyectos/${id}`, body)
      } else {
        await apiClient.post('/proyectos', body)
      }
      navigate('/proyectos')
    } catch (err) {
      setError(err.message || 'Error al guardar el proyecto.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/proyectos')}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {isEdit ? 'Editar proyecto' : 'Nuevo proyecto'}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {isEdit ? 'Modifica los datos del proyecto.' : 'Completa los datos para crear el proyecto.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Datos generales */}
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            Datos generales
          </h3>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del proyecto *</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Instalación HVAC Edificio Central"
              className="input-base"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción del alcance del proyecto..."
              rows={3}
              className="input-base resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cliente *</label>
              <input
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nombre del cliente"
                className="input-base"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Responsable</label>
              <select
                value={responsableId}
                onChange={(e) => {
                  const uid = e.target.value
                  setResponsableId(uid)
                  const trab = trabajadores.find((t) => t.usuarioId === uid)
                  setResponsableNombre(trab ? trab.nombre : '')
                }}
                className="input-base"
              >
                <option value="">Sin responsable</option>
                {trabajadores.filter((t) => t.usuarioId).map((t) => (
                  <option key={t.usuarioId} value={t.usuarioId}>{t.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha inicio estimada</label>
              <input
                type="date"
                value={fechaInicioEst}
                onChange={(e) => setFechaInicioEst(e.target.value)}
                className="input-base"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha fin estimada</label>
              <input
                type="date"
                value={fechaFinEst}
                onChange={(e) => setFechaFinEst(e.target.value)}
                className="input-base"
              />
            </div>
          </div>
        </div>

        {/* Cotizaciones */}
        <div className="card px-5 pt-1 pb-4">
          <div className="border-b border-slate-100">
            <SectionHeader
              icon={FileText}
              title={`Cotizaciones aprobadas (${selectedCots.size} seleccionadas)`}
              expanded={showCots}
              onToggle={() => setShowCots((v) => !v)}
            />
          </div>
          {showCots && (
            <div className="mt-3 space-y-2">
              {cotizaciones.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No hay cotizaciones aprobadas disponibles.</p>
              ) : (
                <>
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
                        {cotizaciones.map((c) => (
                          <tr
                            key={c.id}
                            onClick={() => toggleSet(setSelectedCots, c.id)}
                            className={`cursor-pointer transition-colors ${selectedCots.has(c.id) ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}
                          >
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={selectedCots.has(c.id)}
                                onChange={() => toggleSet(setSelectedCots, c.id)}
                                className="accent-indigo-600"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-600">{c.numero}</td>
                            <td className="px-3 py-2 text-slate-700 truncate max-w-[160px]">{c.cliente}</td>
                            <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatCLP(c.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {selectedCots.size > 0 && (
                    <div className="flex justify-end">
                      <span className="text-xs font-semibold text-emerald-700">
                        Total seleccionado: {formatCLP(totalCots)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Trabajadores */}
        <div className="card px-5 pt-1 pb-4">
          <div className="border-b border-slate-100">
            <SectionHeader
              icon={Users}
              title={`Equipo (${selectedTrabs.size} seleccionados)`}
              expanded={showTrabs}
              onToggle={() => setShowTrabs((v) => !v)}
            />
          </div>
          {showTrabs && (
            <div className="mt-3">
              {trabajadores.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No hay trabajadores disponibles.</p>
              ) : (
                <div className="rounded-xl border border-slate-200 overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 w-8"></th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Nombre</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Cargo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {trabajadores.map((t) => (
                        <tr
                          key={t.id}
                          onClick={() => toggleSet(setSelectedTrabs, t.id)}
                          className={`cursor-pointer transition-colors ${selectedTrabs.has(t.id) ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedTrabs.has(t.id)}
                              onChange={() => toggleSet(setSelectedTrabs, t.id)}
                              className="accent-indigo-600"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-700">{t.nombre}</td>
                          <td className="px-3 py-2 text-slate-500">{t.cargo || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* OC */}
        <div className="card px-5 pt-1 pb-4">
          <div className="border-b border-slate-100">
            <SectionHeader
              icon={ShoppingCart}
              title={`Órdenes de Compra (${selectedOCs.size} seleccionadas)`}
              expanded={showOCs}
              onToggle={() => setShowOCs((v) => !v)}
            />
          </div>
          {showOCs && (
            <div className="mt-3 space-y-2">
              {compras.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No hay órdenes de compra disponibles.</p>
              ) : (
                <>
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
                        {compras.map((c) => (
                          <tr
                            key={c.id}
                            onClick={() => toggleSet(setSelectedOCs, c.id)}
                            className={`cursor-pointer transition-colors ${selectedOCs.has(c.id) ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}
                          >
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={selectedOCs.has(c.id)}
                                onChange={() => toggleSet(setSelectedOCs, c.id)}
                                className="accent-indigo-600"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-600">{c.numero}</td>
                            <td className="px-3 py-2 text-slate-700 truncate max-w-[160px]">{c.proveedor || c.proveedorNombre || '—'}</td>
                            <td className="px-3 py-2 text-right font-semibold text-red-700">{formatCLP(c.monto)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {selectedOCs.size > 0 && (
                    <div className="flex justify-end">
                      <span className="text-xs font-semibold text-red-700">
                        Total OC seleccionado: {formatCLP(totalOCs)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Acciones */}
        <div className="flex justify-end gap-3 pb-6">
          <button
            type="button"
            onClick={() => navigate('/proyectos')}
            className="btn-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEdit ? 'Guardar cambios' : 'Crear proyecto'}
          </button>
        </div>
      </form>
    </div>
  )
}
