import { useState, useEffect } from 'react'
import { X, CalendarDays, ClipboardList, Image as ImageIcon, Bot, Plus, Loader2 } from 'lucide-react'
import { supabase } from '../../services/supabase'

const TABS = ['Datos', 'Checklist', 'Fotos', 'Resumen IA']

export default function ModalVisita({ cot, onClose }) {
  const [tab,     setTab]     = useState('Datos')
  const [visita,  setVisita]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    async function fetchVisita() {
      setLoading(true)
      const { data } = await supabase
        .from('visitas')
        .select('*')
        .eq('cotizacion_id', cot.id)
        .maybeSingle()
      setVisita(data ?? null)
      setLoading(false)
    }
    void fetchVisita()
  }, [cot.id])

  const handleCrearVisita = async () => {
    setCreando(true)
    const { data, error } = await supabase
      .from('visitas')
      .insert({
        cotizacion_id: cot.id,
        empresa_id:    cot.empresa_id,
        cliente:       cot.cliente,
        email_cliente: cot.email    || null,
        telefono_cliente: cot.telefono || null,
        direccion:     cot.direccion || null,
        comuna:        cot.comuna   || null,
        estado:        'agendada',
      })
      .select()
      .single()
    if (!error && data) setVisita(data)
    setCreando(false)
  }

  const TAB_ICONS = {
    'Datos':      CalendarDays,
    'Checklist':  ClipboardList,
    'Fotos':      ImageIcon,
    'Resumen IA': Bot,
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
        <div>
          <h2 className="font-bold text-slate-900 text-lg leading-tight">
            Visita — {cot.numero}
          </h2>
          {loading ? (
            <p className="text-xs text-slate-400 mt-0.5">Cargando...</p>
          ) : visita ? (
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-500">{visita.cliente}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
                ${visita.estado === 'completada' ? 'bg-emerald-100 text-emerald-700'
                  : visita.estado === 'en_curso'  ? 'bg-amber-100 text-amber-700'
                  : visita.estado === 'realizada' ? 'bg-violet-100 text-violet-700'
                  : 'bg-blue-100 text-blue-700'}`}
              >
                {visita.estado}
              </span>
            </div>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">Sin visita asociada</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 px-5 pt-3 border-b border-slate-100 shrink-0 overflow-x-auto">
        {TABS.map(t => {
          const Icon = TAB_ICONS[t]
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors whitespace-nowrap border-b-2 -mb-px
                ${tab === t
                  ? 'text-indigo-600 border-indigo-500 bg-indigo-50/60'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t}
            </button>
          )
        })}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-5 py-6 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : (
          <>
            {tab === 'Datos' && (
              <div className="max-w-lg mx-auto space-y-4">
                {visita ? (
                  <div className="rounded-xl border border-slate-200 p-5 space-y-3">
                    <Row label="Estado"     value={visita.estado} />
                    <Row label="Cliente"    value={visita.cliente} />
                    <Row label="Dirección"  value={visita.direccion ?? '—'} />
                    <Row label="Comuna"     value={visita.comuna ?? '—'} />
                    <Row label="Teléfono"   value={visita.telefono_cliente ?? '—'} />
                    <Row label="Agendada"   value={visita.fecha_agendada ?? '—'} />
                    <Row label="Responsable" value={visita.responsable_visita ?? '—'} />
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm mb-5">No hay visita asociada a esta cotización.</p>
                    <button
                      onClick={handleCrearVisita}
                      disabled={creando}
                      className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
                    >
                      {creando
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Plus className="w-4 h-4" />}
                      Crear visita
                    </button>
                  </div>
                )}
              </div>
            )}

            {tab !== 'Datos' && (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                {(() => { const Icon = TAB_ICONS[tab]; return <Icon className="w-8 h-8 mb-3 text-slate-300" /> })()}
                <p className="text-sm">Próximamente...</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-slate-400 text-xs font-medium min-w-[130px] shrink-0 mt-0.5">{label}</span>
      <span className="text-slate-800 text-sm">{value}</span>
    </div>
  )
}
