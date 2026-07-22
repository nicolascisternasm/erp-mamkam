import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import Modal from '../../components/Modal'
import {
  MapPin, Plus, Pencil, Power, PowerOff, AlertCircle,
  Building2, Navigation, Ruler, Save,
} from 'lucide-react'

const EMPTY_FORM = {
  nombreLugar: '',
  direccion: '',
  latitud: '',
  longitud: '',
  radioPermitidoMetros: '150',
  activo: true,
}

function PuntoModal({ open, onClose, punto, onGuardado }) {
  const esEdicion = Boolean(punto)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (punto) {
      setForm({
        nombreLugar: punto.nombreLugar ?? '',
        direccion: punto.direccion ?? '',
        latitud: punto.latitud != null ? String(punto.latitud) : '',
        longitud: punto.longitud != null ? String(punto.longitud) : '',
        radioPermitidoMetros: String(punto.radioPermitidoMetros ?? 150),
        activo: punto.activo ?? true,
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [open, punto])

  const set = (k) => (e) => { setForm((p) => ({ ...p, [k]: e.target.value })); setError('') }
  const setBool = (k, v) => { setForm((p) => ({ ...p, [k]: v })); setError('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.nombreLugar.trim().length < 2) { setError('El nombre del lugar es obligatorio'); return }
    if (form.direccion.trim().length < 3)   { setError('La dirección es obligatoria'); return }
    const lat = parseFloat(form.latitud)
    const lng = parseFloat(form.longitud)
    if (isNaN(lat) || lat < -90 || lat > 90)   { setError('Latitud inválida (entre -90 y 90)'); return }
    if (isNaN(lng) || lng < -180 || lng > 180) { setError('Longitud inválida (entre -180 y 180)'); return }
    const radio = parseInt(form.radioPermitidoMetros, 10)
    if (isNaN(radio) || radio < 10 || radio > 5000) {
      setError('El radio debe estar entre 10 y 5000 metros'); return
    }

    setSaving(true)
    try {
      await onGuardado({
        nombreLugar: form.nombreLugar.trim(),
        direccion: form.direccion.trim(),
        latitud: lat,
        longitud: lng,
        radioPermitidoMetros: radio,
        activo: form.activo,
      })
      onClose()
    } catch (err) {
      setError(err?.message || 'No se pudo guardar el punto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={esEdicion ? 'Editar punto de trabajo' : 'Nuevo punto de trabajo'} size="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="label-base">Nombre del lugar *</label>
          <div className="flex">
            <span className="flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50">
              <Building2 className="w-4 h-4 text-slate-400" />
            </span>
            <input
              value={form.nombreLugar}
              onChange={set('nombreLugar')}
              placeholder="Obra Las Condes"
              className="input-base rounded-l-none"
              autoFocus
            />
          </div>
        </div>

        <div>
          <label className="label-base">Dirección *</label>
          <div className="flex">
            <span className="flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50">
              <MapPin className="w-4 h-4 text-slate-400" />
            </span>
            <input
              value={form.direccion}
              onChange={set('direccion')}
              placeholder="Av. Apoquindo 3000, Las Condes"
              className="input-base rounded-l-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-base">Latitud *</label>
            <div className="flex">
              <span className="flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50">
                <Navigation className="w-4 h-4 text-slate-400" />
              </span>
              <input
                type="number"
                step="0.000001"
                value={form.latitud}
                onChange={set('latitud')}
                placeholder="-33.408900"
                className="input-base rounded-l-none"
              />
            </div>
          </div>
          <div>
            <label className="label-base">Longitud *</label>
            <div className="flex">
              <span className="flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50">
                <Navigation className="w-4 h-4 text-slate-400" />
              </span>
              <input
                type="number"
                step="0.000001"
                value={form.longitud}
                onChange={set('longitud')}
                placeholder="-70.567500"
                className="input-base rounded-l-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="label-base">Radio permitido (metros) *</label>
          <div className="flex">
            <span className="flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50">
              <Ruler className="w-4 h-4 text-slate-400" />
            </span>
            <input
              type="number"
              min="10"
              max="5000"
              value={form.radioPermitidoMetros}
              onChange={set('radioPermitidoMetros')}
              placeholder="150"
              className="input-base rounded-l-none"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">Entre 10 y 5000 metros. Sugerido 50–300.</p>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
          <div>
            <div className="text-sm font-medium text-slate-700">Punto activo</div>
            <div className="text-xs text-slate-400">
              {form.activo ? 'Disponible para asignar a trabajadores' : 'Oculto en el selector de asignación'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBool('activo', !form.activo)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              form.activo ? 'bg-indigo-600' : 'bg-slate-300'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              form.activo ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear punto'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function PuntosTrabajoPage() {
  const { puntosTrabajo, createPuntoTrabajo, updatePuntoTrabajo, togglePuntoTrabajo } = useApp()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const abrirNuevo = () => { setEditing(null); setModalOpen(true) }
  const abrirEditar = (p) => { setEditing(p); setModalOpen(true) }

  const handleGuardar = useCallback(async (data) => {
    if (editing) {
      await updatePuntoTrabajo(editing.id, data)
    } else {
      await createPuntoTrabajo(data)
    }
  }, [editing, createPuntoTrabajo, updatePuntoTrabajo])

  const handleToggle = (p) => {
    togglePuntoTrabajo(p.id, !p.activo)
  }

  const activos = puntosTrabajo.filter((p) => p.activo).length

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Puntos de Trabajo</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {puntosTrabajo.length} punto{puntosTrabajo.length === 1 ? '' : 's'} · {activos} activo{activos === 1 ? '' : 's'}
          </p>
        </div>
        <button onClick={abrirNuevo} className="btn-primary">
          <Plus className="w-4 h-4" />
          Nuevo punto
        </button>
      </div>

      {/* Listado */}
      <div className="card overflow-hidden">
        {puntosTrabajo.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MapPin className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">Aún no hay puntos de trabajo</p>
            <p className="text-xs text-slate-400 mt-1">Crea el primero para empezar a asignar trabajadores con geocerca.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="table-th">Nombre</th>
                  <th className="table-th">Dirección</th>
                  <th className="table-th text-right">Radio (m)</th>
                  <th className="table-th text-center">Estado</th>
                  <th className="table-th text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {puntosTrabajo.map((p) => (
                  <tr key={p.id} className={`hover:bg-slate-50/80 transition-colors ${!p.activo ? 'opacity-60' : ''}`}>
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-800">{p.nombreLugar}</div>
                          <div className="text-xs text-slate-400 font-mono">
                            {Number(p.latitud).toFixed(5)}, {Number(p.longitud).toFixed(5)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="table-td">
                      <div className="text-sm text-slate-600 truncate max-w-xs">{p.direccion}</div>
                    </td>
                    <td className="table-td text-right text-sm font-semibold text-slate-700">
                      {p.radioPermitidoMetros}
                    </td>
                    <td className="table-td text-center">
                      {p.activo ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="table-td">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => abrirEditar(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggle(p)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                            p.activo
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                          title={p.activo ? 'Desactivar' : 'Activar'}
                        >
                          {p.activo ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                          {p.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PuntoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        punto={editing}
        onGuardado={handleGuardar}
      />
    </div>
  )
}
