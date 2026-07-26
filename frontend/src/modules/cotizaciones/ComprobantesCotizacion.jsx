import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../../services/supabase'
import { formatCLP } from '../../utils/formatters'
import { apiClient } from '../../services/apiClient'
import Modal from '../../components/Modal'
import {
  Plus, Eye, Trash2, FileText, Loader2, Paperclip, AlertTriangle, CheckCircle2,
} from 'lucide-react'

/*
 * Gestión de comprobantes de pago de una cotización.
 * Props:
 *   - cot: la cotización (con condicionesPago y pagosComprobantes)
 *   - onUpdate: callback que el padre usa para refrescar la cotización tras cambios
 *
 * Renderiza un botón/trigger por condición de pago (o un único trigger para
 * "pago único") y contiene todo el flujo de subida → análisis IA → confirmación,
 * más el listado y borrado de comprobantes.
 */
export default function ComprobantesCotizacion({ cot, onUpdate }) {
  const { user } = useAuth()

  const fileRef = useRef(null)
  const [modalComprobantes, setModalComprobantes] = useState(null)  // { condicionId, descripcion, monto }
  const [estadoModalComp, setEstadoModalComp]     = useState('idle') // idle|subiendo|analizando|confirmando|guardando
  const [formConfirmacion, setFormConfirmacion]   = useState(null)
  const [toastComp, setToastComp]                 = useState('')
  const [confirmElimComp, setConfirmElimComp]     = useState(null)
  const [movimientosCot, setMovimientosCot]       = useState([])

  // Carga los movimientos bancarios de la empresa (para mostrar el estado pagado)
  useEffect(() => {
    if (!user?.empresa_id || !supabase) return
    supabase
      .from('movimientos')
      .select('id, gasto_id, monto, fecha, glosa, tipo')
      .eq('empresa_id', user.empresa_id)
      .then(({ data }) => { if (data) setMovimientosCot(data) })
  }, [user?.empresa_id])

  /* ── Handlers ──────────────────────────────────────────────── */

  const handleAgregarComprobante = async (file) => {
    if (!file || !modalComprobantes) return
    const { condicionId, descripcion } = modalComprobantes
    if (fileRef.current) fileRef.current.value = ''

    setEstadoModalComp('subiendo')
    let url
    try {
      const ts   = Date.now()
      const path = `comprobantes-pago/${cot.id}/${condicionId}_${ts}_${file.name}`
      const { error: upErr } = await supabase.storage
        .from('proyectos-documentos')
        .upload(path, file, { upsert: false, contentType: file.type })
      if (upErr) throw upErr
      url = supabase.storage.from('proyectos-documentos').getPublicUrl(path).data.publicUrl
    } catch (err) {
      console.error('Error al subir comprobante:', err)
      setEstadoModalComp('idle')
      return
    }

    const esImagen = file.type.startsWith('image/')
    const esPdf    = file.type === 'application/pdf'
    const apiKey   = import.meta.env.VITE_ANTHROPIC_API_KEY
    let datosIA  = null
    let iaSaltada = false

    if (!esImagen && !esPdf) {
      iaSaltada = true
    } else if (apiKey) {
      setEstadoModalComp('analizando')
      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        const contentBlock = esImagen
          ? { type: 'image',    source: { type: 'base64', media_type: file.type,         data: base64 } }
          : { type: 'document', source: { type: 'base64', media_type: 'application/pdf',  data: base64 } }
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 400,
            messages: [{
              role: 'user',
              content: [
                contentBlock,
                { type: 'text', text: 'Analiza este comprobante de pago bancario/transferencia. Extrae y responde SOLO con un JSON con esta estructura exacta, sin texto adicional ni backticks:\n{"monto":número sin puntos ni comas,"fecha":"YYYY-MM-DD","banco_origen":"nombre del banco emisor o null","banco_destino":"nombre del banco receptor o null","numero_transferencia":"número de operación o null","glosa":"descripción del pago","tipo_documento":"Transferencia o Depósito o Cheque"}' },
              ],
            }],
          }),
        })
        if (res.ok) {
          const data = await res.json()
          const texto = data.content?.[0]?.text ?? ''
          datosIA = JSON.parse(texto.trim())
        }
      } catch (err) {
        console.warn('No se pudo analizar con IA:', err)
      }
    }

    const glosaDefault = `Pago ${descripcion || ''} - ${cot.numero || ''}`
    setFormConfirmacion({
      url,
      fileName: file.name,
      condicionId,
      monto:                datosIA?.monto               ?? '',
      fecha:                datosIA?.fecha               ?? new Date().toISOString().slice(0, 10),
      banco_origen:         datosIA?.banco_origen        ?? '',
      numero_transferencia: datosIA?.numero_transferencia ?? '',
      glosa:                datosIA?.glosa               ?? glosaDefault,
      tipo_documento:       datosIA?.tipo_documento      ?? 'Transferencia',
      ia_ok:      datosIA !== null,
      ia_saltada: iaSaltada,
    })
    setEstadoModalComp('confirmando')
  }

  const handleEliminarComprobante = async (url) => {
    try {
      const compLegacy = (cot.pagosComprobantes || []).find((p) => p.url === url)
      const compNuevo  = (cot.condicionesPago || [])
        .flatMap((cp) => cp.comprobantes || [])
        .find((p) => p.url === url)
      const movimientoId = compLegacy?.movimiento_id || compNuevo?.movimiento_id
      if (movimientoId) {
        await supabase.from('movimientos').delete().eq('id', movimientoId)
      }
      const newPagos = (cot.pagosComprobantes || []).filter((p) => p.url !== url)
      const newCondiciones = (cot.condicionesPago || []).map((cp) => {
        const newComps = (cp.comprobantes || []).filter((c) => c.url !== url)
        if (newComps.length === (cp.comprobantes || []).length) return cp
        return {
          ...cp,
          comprobantes: newComps,
          ...(newComps.length === 0 ? { pagado: false, estado: 'pendiente' } : {}),
        }
      })
      await apiClient.patch(`/cotizaciones/${cot.id}`, {
        pagos_comprobantes: newPagos,
        condiciones_pago:   newCondiciones,
      })
      onUpdate?.({ pagosComprobantes: newPagos, condicionesPago: newCondiciones })
      setConfirmElimComp(null)
    } catch (err) {
      console.error('Error al eliminar comprobante:', err)
    }
  }

  const handleConfirmarComprobante = async () => {
    if (!formConfirmacion || !modalComprobantes) return
    const { url, fileName, condicionId, monto, fecha, glosa } = formConfirmacion
    const { descripcion } = modalComprobantes

    setEstadoModalComp('guardando')
    try {
      const movId = crypto.randomUUID()
      const montoNum = Number(String(monto).replace(/\./g, '').replace(/,/g, ''))
      await supabase.from('movimientos').insert({
        id: movId,
        empresa_id: user?.empresa_id,
        fecha,
        glosa,
        descripcion: glosa,
        tipo: 'abono',
        monto: montoNum,
        conciliado: false,
        cuenta_bancaria_id: null,
        gasto_id: String(condicionId),
        gasto_descripcion: `Pago condición: ${descripcion || ''} | Cotización: ${cot.numero || ''}`,
      })
      setMovimientosCot((prev) => [...prev, { id: movId, gasto_id: String(condicionId), monto: montoNum, fecha, glosa, tipo: 'abono' }])

      const newPagos = [
        ...(cot.pagosComprobantes || []),
        { condicion_id: condicionId, url, nombre: fileName, fecha, movimiento_id: movId },
      ]
      const newCondiciones = (cot.condicionesPago || []).map((cp) =>
        String(cp.id) === String(condicionId)
          ? { ...cp, pagado: true, estado: 'pagado', comprobantes: [...(cp.comprobantes || []), { url, fecha_subida: new Date().toISOString(), movimiento_id: movId, monto: montoNum }] }
          : cp
      )
      await apiClient.patch(`/cotizaciones/${cot.id}`, {
        pagos_comprobantes: newPagos,
        condiciones_pago:   newCondiciones,
      })
      onUpdate?.({ pagosComprobantes: newPagos, condicionesPago: newCondiciones })
      setFormConfirmacion(null)
      setEstadoModalComp('idle')
      setToastComp('Comprobante registrado y movimiento contable creado')
      setTimeout(() => setToastComp(''), 4000)
    } catch (err) {
      console.error('Error al confirmar comprobante:', err)
      setEstadoModalComp('confirmando')
    }
  }

  /* ── Triggers por condición ────────────────────────────────── */

  const abrir = (condicionId, descripcion, monto) =>
    setModalComprobantes({ condicionId: String(condicionId), descripcion, monto })

  const condiciones = cot.condicionesPago || []

  const contarComprobantes = (condicionId) =>
    (cot.pagosComprobantes || []).filter((p) => String(p.condicion_id) === String(condicionId)).length

  return (
    <>
      <div className="space-y-2">
        {condiciones.length === 0 ? (
          <button
            onClick={() => abrir('default', 'Pago único', cot.total || 0)}
            className="btn-secondary text-sm w-full justify-between"
          >
            <span className="flex items-center gap-2"><Paperclip className="w-4 h-4" /> Comprobantes de pago</span>
            {contarComprobantes('default') > 0 && (
              <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 rounded-full">{contarComprobantes('default')}</span>
            )}
          </button>
        ) : (
          condiciones.map((cp, i) => {
            const monto = cp.monto || Math.round((cot.total || 0) * (cp.porcentaje || 0) / 100)
            const n = contarComprobantes(cp.id)
            return (
              <button
                key={cp.id || i}
                onClick={() => abrir(cp.id, cp.descripcion || 'Condición', monto)}
                className="btn-secondary text-sm w-full justify-between"
              >
                <span className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4" />
                  {cp.descripcion || `Condición ${i + 1}`}
                  {cp.pagado && <span className="text-xs font-semibold text-emerald-600">· Pagado</span>}
                </span>
                {n > 0 && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 rounded-full">{n}</span>}
              </button>
            )
          })
        )}
      </div>

      {/* Modal: comprobantes de pago */}
      {modalComprobantes && (() => {
        const { condicionId, descripcion } = modalComprobantes
        const comprobantes = (cot.pagosComprobantes || []).filter((p) => String(p.condicion_id) === String(condicionId))
        const ocupado      = estadoModalComp !== 'idle'
        return (
          <Modal
            open
            onClose={() => {
              if (ocupado) return
              setModalComprobantes(null)
              setFormConfirmacion(null)
              setEstadoModalComp('idle')
            }}
            title={`Comprobantes — ${descripcion || 'condición'}`}
            size="md"
          >
            {toastComp && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                {toastComp}
              </div>
            )}

            {(estadoModalComp === 'subiendo' || estadoModalComp === 'analizando') && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                <p className="text-sm text-slate-500">
                  {estadoModalComp === 'subiendo' ? 'Subiendo archivo…' : 'Analizando comprobante con IA…'}
                </p>
              </div>
            )}

            {estadoModalComp === 'confirmando' && formConfirmacion && (
              <div className="space-y-3">
                {formConfirmacion.ia_saltada && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    Formato no compatible con análisis IA, ingresa los datos manualmente
                  </div>
                )}
                {!formConfirmacion.ia_ok && !formConfirmacion.ia_saltada && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    No se pudo leer automáticamente, ingresa los datos manualmente
                  </div>
                )}
                {formConfirmacion.ia_ok && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-700">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    Datos extraídos automáticamente — verifica y confirma
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Monto</label>
                    <input
                      type="number"
                      value={formConfirmacion.monto}
                      onChange={(e) => setFormConfirmacion((f) => ({ ...f, monto: e.target.value }))}
                      className="input-base text-sm w-full"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
                    <input
                      type="date"
                      value={formConfirmacion.fecha}
                      onChange={(e) => setFormConfirmacion((f) => ({ ...f, fecha: e.target.value }))}
                      className="input-base text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Banco origen</label>
                    <input
                      type="text"
                      value={formConfirmacion.banco_origen}
                      onChange={(e) => setFormConfirmacion((f) => ({ ...f, banco_origen: e.target.value }))}
                      className="input-base text-sm w-full"
                      placeholder="—"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">N° operación</label>
                    <input
                      type="text"
                      value={formConfirmacion.numero_transferencia}
                      onChange={(e) => setFormConfirmacion((f) => ({ ...f, numero_transferencia: e.target.value }))}
                      className="input-base text-sm w-full"
                      placeholder="—"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
                  <input
                    type="text"
                    value={formConfirmacion.glosa}
                    onChange={(e) => setFormConfirmacion((f) => ({ ...f, glosa: e.target.value }))}
                    className="input-base text-sm w-full"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => { setFormConfirmacion(null); setEstadoModalComp('idle') }}
                    className="flex-1 btn-ghost text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmarComprobante}
                    disabled={!formConfirmacion.monto || !formConfirmacion.fecha}
                    className="flex-1 btn-primary text-xs disabled:opacity-50"
                  >
                    Confirmar y registrar movimiento
                  </button>
                </div>
              </div>
            )}

            {estadoModalComp === 'guardando' && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                <p className="text-sm text-slate-500">Guardando movimiento…</p>
              </div>
            )}

            {estadoModalComp === 'idle' && (
              <div className="space-y-3">
                {comprobantes.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Sin comprobantes adjuntos para esta condición</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {comprobantes.map((comp, i) => {
                        const ext    = comp.nombre?.split('.').pop()?.toLowerCase() ?? ''
                        const esPdf  = ext === 'pdf'
                        const mov    = movimientosCot.find((m) => m.id === comp.movimiento_id)
                        const montoMov      = mov ? Number(mov.monto) : null
                        const montoAcordado = modalComprobantes?.monto ?? 0
                        const coincide = montoMov !== null && montoMov === montoAcordado
                        return (
                          <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                            <div className="flex items-start gap-3">
                              <FileText className={`w-4 h-4 flex-shrink-0 mt-0.5 ${esPdf ? 'text-red-400' : 'text-indigo-400'}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-700 truncate">{comp.nombre}</p>
                                <p className="text-xs text-slate-400">{comp.fecha || ''}</p>
                                {mov ? (
                                  <div className="mt-1 space-y-0.5">
                                    <p className={`text-xs font-semibold ${coincide ? 'text-emerald-600' : 'text-amber-600'}`}>
                                      {formatCLP(montoMov)}
                                    </p>
                                    {mov.glosa && <p className="text-[10px] text-slate-500 truncate">{mov.glosa}</p>}
                                  </div>
                                ) : (
                                  <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                                    Sin registro contable
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <a
                                  href={comp.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                  title="Ver"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </a>
                                {confirmElimComp === comp.url ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-red-600">¿Eliminar?</span>
                                    <button onClick={() => handleEliminarComprobante(comp.url)} className="text-xs px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700">Sí</button>
                                    <button onClick={() => setConfirmElimComp(null)} className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-600 hover:bg-slate-300">No</button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmElimComp(comp.url)}
                                    className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {(() => {
                      const conMov = comprobantes.filter((c) => c.movimiento_id)
                      if (conMov.length === 0) return null
                      const totalPagado = conMov.reduce((sum, c) => {
                        const m = movimientosCot.find((mv) => mv.id === c.movimiento_id)
                        return sum + (m ? Number(m.monto) : 0)
                      }, 0)
                      const montoAcordado = modalComprobantes?.monto ?? 0
                      const diff = totalPagado - montoAcordado
                      return (
                        <div className="pt-3 border-t border-slate-200 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">Total pagado</span>
                            <span className="text-sm font-bold text-slate-800">{formatCLP(totalPagado)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">{formatCLP(montoAcordado)} acordado</span>
                            {diff === 0 ? (
                              <span className="text-xs font-semibold text-emerald-600">✓ Monto completo</span>
                            ) : diff < 0 ? (
                              <span className="text-xs font-semibold text-red-500">Falta: {formatCLP(Math.abs(diff))}</span>
                            ) : (
                              <span className="text-xs font-semibold text-blue-500">Exceso: {formatCLP(diff)}</span>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </>
                )}
                <div className="pt-3 border-t border-slate-100">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="btn-primary text-xs w-full"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar comprobante
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleAgregarComprobante(file)
                    }}
                  />
                </div>
              </div>
            )}
          </Modal>
        )
      })()}
    </>
  )
}
