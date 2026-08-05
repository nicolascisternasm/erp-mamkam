import { useState, useEffect, useMemo, useRef } from 'react'
import { X, Mail, Loader2, AlertCircle, ImageIcon, FileText, Plus, Paperclip } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { apiClient } from '../../services/apiClient'
import { formatCLP } from '../../utils/formatters'
import { useApp } from '../../context/AppContext'

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
  const { updateCotizacion } = useApp()

  const condicionesPago   = cot.condicionesPago   ?? []
  const pagosComprobantes = cot.pagosComprobantes ?? []

  const condicionesConSaldo = useMemo(() =>
    condicionesPago.map(cp => {
      const monto  = cp.monto || Math.round((cot.total || 0) * (cp.porcentaje || 0) / 100)
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

  // Fotos de visitas (BD)
  const [fotos, setFotos]             = useState([])
  const [fotosLoading, setFotosLoading] = useState(true)
  const [fotosSeleccionadas, setFotosSeleccionadas] = useState([])

  // Fotos manuales — solo viajan en el request, no se persisten
  const [fotosManuales, setFotosManuales] = useState([]) // [{nombre, dataUrl, base64}]
  const fotosManualRef = useRef(null)

  // Comprobantes (del contexto)
  const [comprobantesSeleccionados, setComprobantesSeleccionados] = useState([])

  // Mini-form comprobante nuevo
  const [compNuevoForm, setCompNuevoForm]       = useState(null) // null | {file, condicion_id, monto}
  const [compNuevoSubiendo, setCompNuevoSubiendo] = useState(false)
  const [compNuevoError, setCompNuevoError]     = useState(null)
  const compNuevoRef = useRef(null)

  const [enviando, setEnviando] = useState(false)
  const [error, setError]       = useState(null)

  // Cargar fotos de visitas
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
      } catch {
        if (!cancelled) setFotos([])
      } finally {
        if (!cancelled) setFotosLoading(false)
      }
    }
    cargarFotos()
    return () => { cancelled = true }
  }, [cot.id])

  /* ── Handlers fotos BD ─────────────────────────────────────────── */
  const toggleFoto = (id) =>
    setFotosSeleccionadas(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )

  /* ── Handlers fotos manuales ───────────────────────────────────── */
  const handleFotosManual = async (files) => {
    const nuevas = await Promise.all(
      Array.from(files).map(file => new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = e => resolve({
          nombre:  file.name,
          dataUrl: e.target.result,
          base64:  e.target.result.split(',')[1],
        })
        reader.readAsDataURL(file)
      }))
    )
    setFotosManuales(prev => [...prev, ...nuevas])
  }

  const quitarFotoManual = (idx) =>
    setFotosManuales(prev => prev.filter((_, i) => i !== idx))

  /* ── Handlers comprobantes ─────────────────────────────────────── */
  const toggleComprobante = (idx) =>
    setComprobantesSeleccionados(prev =>
      prev.includes(idx) ? prev.filter(x => x !== idx) : [...prev, idx]
    )

  const handleCompNuevoFile = (file) => {
    if (!file) return
    if (compNuevoRef.current) compNuevoRef.current.value = ''
    setCompNuevoForm({ file, condicion_id: '', monto: '' })
    setCompNuevoError(null)
  }

  const handleGuardarCompNuevo = async () => {
    if (!compNuevoForm) return
    const { file, condicion_id, monto } = compNuevoForm
    setCompNuevoSubiendo(true)
    setCompNuevoError(null)
    try {
      const ts   = Date.now()
      const path = `comprobantes-pago/${cot.id}/ejecucion_${ts}_${file.name}`
      const { error: upErr } = await supabase.storage
        .from('proyectos-documentos')
        .upload(path, file, { upsert: false, contentType: file.type })
      if (upErr) throw upErr

      const url      = supabase.storage.from('proyectos-documentos').getPublicUrl(path).data.publicUrl
      const montoNum = monto ? Number(String(monto).replace(/\./g, '').replace(/,/g, '')) : 0
      const condDesc = condicionesPago.find(c => String(c.id) === String(condicion_id))?.descripcion

      const nuevoComp = {
        condicion_id: condicion_id || null,
        monto:        montoNum,
        url,
        nombre:       file.name,
        fecha:        new Date().toISOString().slice(0, 10),
        glosa:        condDesc
          ? `Pago ${condDesc} - ${cot.numero}`
          : `Comprobante adicional - ${cot.numero}`,
      }

      const newPagos = [...pagosComprobantes, nuevoComp]
      await apiClient.patch(`cotizaciones/${cot.id}`, { pagos_comprobantes: newPagos })
      updateCotizacion(cot.id, { pagosComprobantes: newPagos })

      // Auto-seleccionar el recién agregado (índice = longitud anterior)
      const newIdx = pagosComprobantes.length
      setComprobantesSeleccionados(prev => [...prev, newIdx])
      setCompNuevoForm(null)
    } catch (e) {
      setCompNuevoError(e.message || 'Error al subir el archivo.')
    } finally {
      setCompNuevoSubiendo(false)
    }
  }

  /* ── Enviar email ──────────────────────────────────────────────── */
  const handleEnviar = async () => {
    if (!destinatario.trim()) { setError('El destinatario es requerido.'); return }
    setEnviando(true)
    setError(null)
    try {
      await apiClient.post(`cotizaciones/${cot.id}/enviar-email-ejecucion`, {
        destinatario:          destinatario.trim(),
        mensaje,
        fotosIds:              fotosSeleccionadas,
        comprobantesIncluidos: comprobantesSeleccionados,
        fotosManuales:         fotosManuales.map(f => ({ nombre: f.nombre, base64: f.base64 })),
      })
      onSuccess?.()
      onClose()
    } catch (e) {
      setError(e?.response?.data?.error?.message || e.message || 'Error al enviar el email.')
    } finally {
      setEnviando(false)
    }
  }

  /* ── Render ────────────────────────────────────────────────────── */
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
              Destinatario{' '}
              <span className="text-slate-300 normal-case font-normal">(CC automático: contacto@mamkam.cl)</span>
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

          {/* Saldo pendiente */}
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

          {/* ── Fotos del proyecto ─────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fotos del proyecto</span>
                {fotosLoading
                  ? <Loader2 className="w-3 h-3 text-slate-300 animate-spin" />
                  : <span className="text-xs text-slate-400">({fotos.length + fotosManuales.length} disponibles)</span>
                }
              </div>
              <button
                onClick={() => fotosManualRef.current?.click()}
                className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar fotos
              </button>
              <input
                ref={fotosManualRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => {
                  if (e.target.files?.length) handleFotosManual(e.target.files)
                  e.target.value = ''
                }}
              />
            </div>

            {!fotosLoading && fotos.length === 0 && fotosManuales.length === 0 && (
              <p className="text-xs text-slate-400 italic">
                Sin fotos en visitas. Usa "+ Agregar fotos" para adjuntar manualmente.
              </p>
            )}

            {(fotos.length > 0 || fotosManuales.length > 0) && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {/* Fotos de BD */}
                {fotos.map(f => {
                  const sel = fotosSeleccionadas.includes(f.id)
                  return (
                    <button
                      key={f.id}
                      type="button"
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

                {/* Fotos manuales */}
                {fotosManuales.map((f, idx) => (
                  <div
                    key={`manual-${idx}`}
                    className="relative aspect-square rounded-lg overflow-hidden border-2 border-teal-300 ring-2 ring-teal-200"
                  >
                    <img src={f.dataUrl} alt={f.nombre} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => quitarFotoManual(idx)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-teal-600/80 text-white text-[9px] text-center py-0.5 truncate px-1">
                      manual
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(fotosSeleccionadas.length + fotosManuales.length > 0) && (
              <p className="mt-1.5 text-xs text-teal-600">
                {fotosSeleccionadas.length + fotosManuales.length} foto(s) se adjuntarán al email.
              </p>
            )}
          </div>

          {/* ── Comprobantes de pago ───────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Comprobantes de pago</span>
              </div>
              {!compNuevoForm && (
                <button
                  type="button"
                  onClick={() => compNuevoRef.current?.click()}
                  className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar comprobante o factura
                </button>
              )}
              <input
                ref={compNuevoRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleCompNuevoFile(f)
                }}
              />
            </div>

            {/* Lista de comprobantes existentes */}
            {pagosComprobantes.length === 0 && !compNuevoForm && (
              <p className="text-xs text-slate-400 italic mb-2">
                Sin comprobantes. Usa el botón de arriba para agregar.
              </p>
            )}
            {pagosComprobantes.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {pagosComprobantes.map((p, idx) => {
                  const sel = comprobantesSeleccionados.includes(idx)
                  return (
                    <label key={idx} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={() => toggleComprobante(idx)}
                        className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-400 shrink-0"
                      />
                      <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors truncate min-w-0">
                        {p.nombre || p.nombre_archivo || `Comprobante ${idx + 1}`}
                        {p.monto ? <span className="ml-2 text-slate-400 text-xs">{formatCLP(p.monto)}</span> : null}
                        {p.glosa ? <span className="ml-1 text-slate-400 text-xs">· {p.glosa}</span> : null}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}

            {/* Mini-form comprobante nuevo */}
            {compNuevoForm && (
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-teal-600 shrink-0" />
                  <span className="text-sm font-semibold text-teal-700 truncate">{compNuevoForm.file.name}</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Corresponde a</label>
                  <select
                    value={compNuevoForm.condicion_id}
                    onChange={e => setCompNuevoForm(f => ({ ...f, condicion_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option value="">General / No aplica</option>
                    {condicionesPago.map(cp => (
                      <option key={cp.id} value={cp.id}>
                        {cp.descripcion || `Condición ${cp.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Monto (opcional)</label>
                  <input
                    type="number"
                    value={compNuevoForm.monto}
                    onChange={e => setCompNuevoForm(f => ({ ...f, monto: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
                {compNuevoError && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" /> {compNuevoError}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setCompNuevoForm(null); setCompNuevoError(null) }}
                    disabled={compNuevoSubiendo}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleGuardarCompNuevo}
                    disabled={compNuevoSubiendo}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {compNuevoSubiendo
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Plus className="w-3.5 h-3.5" />
                    }
                    {compNuevoSubiendo ? 'Subiendo…' : 'Guardar y adjuntar'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Error envío */}
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
            type="button"
            onClick={onClose}
            disabled={enviando}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleEnviar}
            disabled={enviando || !destinatario.trim() || !!compNuevoForm}
            className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={compNuevoForm ? 'Guarda o cancela el comprobante antes de enviar' : undefined}
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {enviando ? 'Enviando…' : 'Enviar notificación'}
          </button>
        </div>

      </div>
    </div>
  )
}
