import { useState, useEffect, useMemo } from 'react'
import { X, Mail, Loader2, AlertCircle, ImageIcon, FileText } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { apiClient } from '../../services/apiClient'
import { formatCLP } from '../../utils/formatters'

function buildDefaultMsg(cot, condicionesConSaldo, totalSaldo) {
  const nombre = cot.cliente?.split(' ')[0] || 'Cliente'
  const lineasSaldo = condicionesConSaldo.length
    ? condicionesConSaldo.map(c => `  • ${c.descripcion || 'Sin descripción'}: ${formatCLP(c.saldo)} pendiente`).join('\n')
    : '  (sin condiciones de pago definidas)'
  return [
    `Estimado/a ${nombre},`,
    ``,
    `Nos complace comunicarle que el proyecto asociado a la cotización ${cot.numero} ha sido ejecutado satisfactoriamente.`,
    ``,
    `Detalle de saldo pendiente:`,
    lineasSaldo,
    ``,
    `Total pendiente: ${formatCLP(totalSaldo)}`,
    ``,
    `Quedamos a su disposición para cualquier consulta o coordinación del pago pendiente.`,
    ``,
    `Saludos cordiales,`,
    `Equipo MAMKAM`,
  ].join('\n')
}

export default function ModalEnviarEjecucion({ cot, onClose, onSuccess }) {
  const condicionesPago  = cot.condicionesPago  ?? []
  const pagosComprobantes = cot.pagosComprobantes ?? []

  const condicionesConSaldo = useMemo(() =>
    condicionesPago.map(cp => {
      const monto = cp.monto || Math.round((cot.total || 0) * (cp.porcentaje || 0) / 100)
      const pagado = pagosComprobantes
        .filter(p => String(p.condicion_id) === String(cp.id))
        .reduce((s, p) => s + (Number(p.monto) || 0), 0)
      return { ...cp, monto, pagado, saldo: monto - pagado }
    }),
    [condicionesPago, pagosComprobantes, cot.total]
  )
  const totalSaldo = useMemo(
    () => (cot.total || 0) - pagosComprobantes.reduce((s, p) => s + (Number(p.monto) || 0), 0),
    [cot.total, pagosComprobantes]
  )

  const [destinatario, setDestinatario] = useState(cot.email || '')
  const [mensaje, setMensaje] = useState(() => buildDefaultMsg(cot, condicionesConSaldo, totalSaldo))

  const [fotos, setFotos] = useState([])
  const [fotosLoading, setFotosLoading] = useState(true)
  const [fotosSeleccionadas, setFotosSeleccionadas] = useState([])

  const [comprobantesSeleccionados, setComprobantesSeleccionados] = useState([])

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function cargarFotos() {
      setFotosLoading(true)
      try {
        const { data: visitas } = await supabase
          .from('visitas')
          .select('id')
          .eq('cotizacion_id', cot.id)
        if (cancelled) return
        const visitaIds = (visitas || []).map(v => v.id)
        if (!visitaIds.length) { setFotos([]); return }

        const { data: fotoRows } = await supabase
          .from('visita_fotos')
          .select('id, url, nombre_archivo, tipo')
          .in('visita_id', visitaIds)
          .eq('tipo', 'foto')
        if (!cancelled) setFotos(fotoRows || [])
      } catch (e) {
        if (!cancelled) setFotos([])
      } finally {
        if (!cancelled) setFotosLoading(false)
      }
    }
    cargarFotos()
    return () => { cancelled = true }
  }, [cot.id])

  const toggleFoto = (id) =>
    setFotosSeleccionadas(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )

  const toggleComprobante = (idx) =>
    setComprobantesSeleccionados(prev =>
      prev.includes(idx) ? prev.filter(x => x !== idx) : [...prev, idx]
    )

  const handleEnviar = async () => {
    if (!destinatario.trim()) { setError('El destinatario es requerido.'); return }
    setEnviando(true)
    setError(null)
    try {
      await apiClient.post(`cotizaciones/${cot.id}/enviar-email-ejecucion`, {
        destinatario: destinatario.trim(),
        mensaje,
        fotosIds: fotosSeleccionadas,
        comprobantesIncluidos: comprobantesSeleccionados,
      })
      onSuccess?.()
      onClose()
    } catch (e) {
      setError(e?.response?.data?.error?.message || e.message || 'Error al enviar el email.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
              <Mail className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Notificación de término de proyecto</h3>
              <p className="text-xs text-slate-400">{cot.numero} · {cot.cliente}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Destinatario */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Destinatario
            </label>
            <input
              type="email"
              value={destinatario}
              onChange={e => setDestinatario(e.target.value)}
              placeholder="correo@cliente.cl"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            />
            {!destinatario && (
              <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> No hay email registrado para este cliente.
              </p>
            )}
          </div>

          {/* Saldo resumido */}
          {condicionesConSaldo.length > 0 && (
            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Saldo pendiente</p>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {condicionesConSaldo.map((c, i) => (
                    <tr key={i} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2 text-slate-600">{c.descripcion || '—'}</td>
                      <td className="px-4 py-2 text-right text-slate-400 text-xs">{formatCLP(c.monto)}</td>
                      <td className="px-4 py-2 text-right text-emerald-600 text-xs">−{formatCLP(c.pagado)}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${c.saldo > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatCLP(c.saldo)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50">
                    <td className="px-4 py-2.5 font-bold text-slate-900 text-sm" colSpan={3}>Total pendiente</td>
                    <td className={`px-4 py-2.5 text-right font-black text-sm ${totalSaldo > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatCLP(totalSaldo)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Mensaje */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Mensaje
            </label>
            <textarea
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              rows={9}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent resize-y"
            />
          </div>

          {/* Fotos adjuntas */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Fotos del proyecto
              </span>
              {fotosLoading && <Loader2 className="w-3 h-3 text-slate-300 animate-spin" />}
              {!fotosLoading && (
                <span className="text-xs text-slate-400">({fotos.length} disponibles)</span>
              )}
            </div>
            {!fotosLoading && fotos.length === 0 && (
              <p className="text-xs text-slate-400 italic">Sin fotos registradas en las visitas.</p>
            )}
            {fotos.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {fotos.map(f => {
                  const sel = fotosSeleccionadas.includes(f.id)
                  return (
                    <button
                      key={f.id}
                      onClick={() => toggleFoto(f.id)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        sel ? 'border-teal-500 ring-2 ring-teal-300' : 'border-transparent hover:border-slate-300'
                      }`}
                    >
                      <img src={f.url} alt={f.nombre_archivo || 'foto'} className="w-full h-full object-cover" />
                      {sel && (
                        <div className="absolute inset-0 bg-teal-600/30 flex items-center justify-center">
                          <div className="w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
            {fotosSeleccionadas.length > 0 && (
              <p className="mt-1.5 text-xs text-teal-600">{fotosSeleccionadas.length} foto(s) se adjuntarán al email.</p>
            )}
          </div>

          {/* Comprobantes de pago adjuntos */}
          {pagosComprobantes.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Comprobantes de pago
                </span>
              </div>
              <div className="space-y-1.5">
                {pagosComprobantes.map((p, idx) => {
                  const sel = comprobantesSeleccionados.includes(idx)
                  return (
                    <label key={idx} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={() => toggleComprobante(idx)}
                        className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-400"
                      />
                      <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors truncate">
                        {p.nombre_archivo || `Comprobante ${idx + 1}`}
                        {p.monto ? <span className="ml-2 text-slate-400 text-xs">{formatCLP(p.monto)}</span> : null}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={enviando}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleEnviar}
            disabled={enviando || !destinatario.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {enviando ? 'Enviando…' : 'Enviar notificación'}
          </button>
        </div>

      </div>
    </div>
  )
}
