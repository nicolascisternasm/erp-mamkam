import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../../services/supabase'
import { Calendar, Plus, Trash2, RefreshCw, X } from 'lucide-react'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmtFecha(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${parseInt(d)} de ${MESES[parseInt(m) - 1]} de ${y}`
}

export default function DiasNoLaborablesPage() {
  const { user } = useAuth()
  const empresaId = user?.empresa_id
  const anioActual = new Date().getFullYear()

  const [feriados, setFeriados] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({ fecha: '', nombre: '' })
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('feriados')
      .select('id, fecha, nombre, tipo')
      .gte('fecha', `${anioActual}-01-01`)
      .lte('fecha', `${anioActual}-12-31`)
      .or(empresaId ? `empresa_id.is.null,empresa_id.eq.${empresaId}` : 'empresa_id.is.null')
      .order('fecha', { ascending: true })
    setLoading(false)
    setFeriados(data || [])
  }, [empresaId, anioActual])

  useEffect(() => { cargar() }, [cargar])

  const abrirModal = () => {
    setForm({ fecha: '', nombre: '' })
    setError(null)
    setModal(true)
  }

  const agregar = async () => {
    if (!form.fecha || !form.nombre.trim()) return
    setGuardando(true)
    setError(null)
    const { error: err } = await supabase
      .from('feriados')
      .insert({ fecha: form.fecha, nombre: form.nombre.trim(), tipo: 'empresa', empresa_id: empresaId })
    setGuardando(false)
    if (err) { setError(err.message); return }
    setModal(false)
    cargar()
  }

  const eliminar = async (id) => {
    await supabase.from('feriados').delete().eq('id', id).eq('tipo', 'empresa')
    cargar()
  }

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Días no laborables</h2>
          <p className="text-sm text-slate-500 mt-0.5">Feriados {anioActual} · Legales y días empresa</p>
        </div>
        <button onClick={abrirModal} className="btn-primary">
          <Plus className="w-4 h-4" />Agregar día no laborable
        </button>
      </div>

      {/* Lista */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : feriados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">No hay feriados registrados para {anioActual}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {feriados.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{f.nombre}</p>
                  <p className="text-xs text-slate-400">{fmtFecha(f.fecha)}</p>
                </div>
                {f.tipo === 'legal' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">Legal</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">Empresa</span>
                    <button
                      onClick={() => eliminar(f.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal agregar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Agregar día no laborable</h3>
              <button onClick={() => setModal(false)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                  className="input-base"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nombre / Motivo</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Aniversario empresa, Día del fundador..."
                  className="input-base"
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
              <button
                onClick={agregar}
                disabled={!form.fecha || !form.nombre.trim() || guardando}
                className="btn-primary disabled:opacity-50"
              >
                {guardando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
