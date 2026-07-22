import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Calculator, FileSpreadsheet, Plus, Eye, CheckCircle2,
  DollarSign, Download, RefreshCw, X, AlertTriangle, Trash2, Mail, Loader2, Paperclip,
} from 'lucide-react'
import { apiClient } from '../../services/apiClient'
import { supabase } from '../../services/supabase'
import Modal from '../../components/Modal'
import { generatePDFBlob } from '../../utils/pdf'

/* ── Constantes ─────────────────────────────────────────────────────── */
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const fmtCLP  = (n) => `$${new Intl.NumberFormat('es-CL').format(n ?? 0)}`
const periodoLabel = (p) => {
  if (!p) return ''
  const [y, m] = p.split('-')
  return `${MESES[parseInt(m) - 1]} ${y}`
}

/* ── Toast ─────────────────────────────────────────────────────────── */
function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [toast, onClose])
  if (!toast) return null
  const ok = toast.type !== 'error'
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border
      ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
      {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
           : <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
      {toast.message}
      <button onClick={onClose}><X className="w-3.5 h-3.5 opacity-50 hover:opacity-80" /></button>
    </div>
  )
}

/* ── Badge estado liquidación ───────────────────────────────────────── */
function EstadoBadge({ estado }) {
  const cfg = {
    borrador: 'bg-slate-100 text-slate-600 border-slate-200',
    aprobada: 'bg-blue-100 text-blue-700 border-blue-200',
    pagada:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border
      ${cfg[estado] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
      {estado?.charAt(0).toUpperCase() + estado?.slice(1)}
    </span>
  )
}

/* ── Modal Detalle Liquidación ──────────────────────────────────────── */
function DetalleModal({ liq, onClose }) {
  const [heData,          setHeData]          = useState(null)
  const [heLoading,       setHeLoading]       = useState(true)
  const [montoAjustado,   setMontoAjustado]   = useState('')
  const [bonos,           setBonos]           = useState([])
  const [adelantos,       setAdelantos]       = useState([])
  const [faltasInfo,      setFaltasInfo]      = useState({ faltas: [], valorDia: 0 })
  const [modalEmail,      setModalEmail]      = useState(false)
  const [mensajeEmail,    setMensajeEmail]    = useState('')
  const [comprobanteEmail, setComprobanteEmail] = useState(null)
  const [loadingEmail,    setLoadingEmail]    = useState(false)
  const [localToast,      setLocalToast]      = useState(null)
  const printRef       = useRef(null)
  const comprobanteRef = useRef(null)

  useEffect(() => {
    if (!liq) return
    let cancelled = false
    setHeLoading(true)
    apiClient.get(`/remuneraciones/horas-extras/${liq.trabajadorId}/${liq.periodo}`)
      .then(data => {
        if (cancelled) return
        setHeData(data)
        setMontoAjustado(String(data.monto_horas_extra ?? 0))
      })
      .catch(() => { if (!cancelled) setHeData(null) })
      .finally(() => { if (!cancelled) setHeLoading(false) })

    const [yearStr, monthStr] = liq.periodo.split('-')
    const year  = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)
    const inicioPeriodo = `${liq.periodo}-01`
    const ultimoDia = new Date(year, month, 0).getDate()
    const finPeriodo = `${yearStr}-${monthStr}-${String(ultimoDia).padStart(2, '0')}`

    Promise.all([
      supabase.from('bonos').select('*').eq('trabajador_id', liq.trabajadorId).eq('periodo', liq.periodo),
      supabase.from('adelantos').select('*').eq('trabajador_id', liq.trabajadorId).eq('periodo', liq.periodo),
      supabase.from('marcaciones')
        .select('fecha_hora_servidor, asistencia_observacion')
        .eq('trabajador_id', liq.trabajadorId)
        .eq('tipo_marcacion', 'falta')
        .eq('asistencia_confirmada', false)
        .gte('fecha_hora_servidor', `${inicioPeriodo}T00:00:00.000Z`)
        .lte('fecha_hora_servidor', `${finPeriodo}T23:59:59.999Z`),
      supabase.from('feriados')
        .select('fecha')
        .gte('fecha', inicioPeriodo)
        .lte('fecha', finPeriodo)
        .or('empresa_id.is.null'),
    ]).then(([{ data: b }, { data: a }, { data: fm }, { data: fer }]) => {
      if (cancelled) return
      setBonos(b || [])
      setAdelantos(a || [])

      const feriadosSet = new Set((fer || []).map(f => f.fecha))
      let diasHabilesMes = 0
      for (let d = 1; d <= ultimoDia; d++) {
        const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay()
        if (dow !== 0 && dow !== 6) {
          const fStr = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`
          if (!feriadosSet.has(fStr)) diasHabilesMes++
        }
      }
      const valorDia = diasHabilesMes > 0 ? Math.round((liq.sueldoBase || 0) / diasHabilesMes) : 0
      const CHILE_MS = 4 * 60 * 60 * 1000
      const faltasList = (fm || []).map(f => {
        const chileMs = new Date(f.fecha_hora_servidor).getTime() - CHILE_MS
        const d = new Date(chileMs)
        const fecha = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
        return { fecha, observacion: f.asistencia_observacion }
      })
      setFaltasInfo({ faltas: faltasList, valorDia })
    })

    return () => { cancelled = true }
  }, [liq?.trabajadorId, liq?.periodo])

  if (!liq) return null

  const L = ({ label, value, bold, neg, color }) => (
    <div className={`flex justify-between items-center py-0.5 ${bold ? 'font-semibold' : ''}`}>
      <span className={`text-xs ${bold ? 'text-slate-800' : 'text-slate-600'}`}>{label}</span>
      <span className={`text-xs ${color ?? (neg ? 'text-red-600' : bold ? 'text-slate-900' : 'text-slate-700')}`}>
        {neg ? '- ' : ''}{fmtCLP(value)}
      </span>
    </div>
  )
  const Div = () => <div className="border-t border-slate-200 my-1.5" />

  const handleComprobanteChange = (file) => {
    if (!file) { setComprobanteEmail(null); return }
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1]
      setComprobanteEmail({ nombre: file.name, base64, tipo: file.type })
    }
    reader.readAsDataURL(file)
  }

  const handleEnviarEmail = async () => {
    if (!printRef.current) return
    setLoadingEmail(true)
    try {
      // Ocultar botones antes de capturar el PDF
      const noPrintEls = printRef.current.querySelectorAll('.no-print')
      noPrintEls.forEach(el => { el.style.display = 'none' })
      const pdfBlob = await generatePDFBlob(printRef.current)
      noPrintEls.forEach(el => { el.style.display = '' })

      const pdfBase64 = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result.split(',')[1])
        reader.readAsDataURL(pdfBlob)
      })
      await apiClient.post(`/remuneraciones/liquidaciones/${liq.id}/enviar-email`, {
        mensaje: mensajeEmail,
        pdfBase64,
        ...(comprobanteEmail ? { comprobante: comprobanteEmail } : {}),
      })
      setModalEmail(false)
      setComprobanteEmail(null)
      setLocalToast({ type: 'success', message: 'Liquidación enviada por correo correctamente' })
    } catch {
      setLocalToast({ type: 'error', message: 'Error al enviar el correo. Intenta de nuevo.' })
    } finally {
      setLoadingEmail(false)
    }
  }

  const handlePrint = () => {
    const content = printRef.current
    if (!content) return
    const clone = content.cloneNode(true)
    clone.querySelectorAll('.no-print').forEach(el => el.remove())
    const styles = Array.from(document.styleSheets).map(ss => {
      try {
        return `<style>${Array.from(ss.cssRules).map(r => r.cssText).join('\n')}</style>`
      } catch {
        return ss.href ? `<link rel="stylesheet" href="${ss.href}">` : ''
      }
    }).join('')
    const win = window.open('', '_blank', 'width=850,height=700')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Liquidación — ${liq.trabajadorNombre} — ${liq.periodo}</title>${styles}<style>@page{margin:0.5cm;size:A4 portrait;}body{background:white;padding:16px;zoom:0.8;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-family:Inter,system-ui,sans-serif;}</style></head><body>${clone.outerHTML}</body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 500)
  }

  // Cálculos
  const heMontoFinal   = parseInt(montoAjustado) || 0
  const totalBonos     = bonos.reduce((a, b) => a + (b.monto || 0), 0)
  const totalAdelantos = adelantos.reduce((a, b) => a + (b.monto || 0), 0)

  // Total imponible (base + HH.EE) — bonos del período son NO imponibles
  const totalImponible = (liq.sueldoBase || 0) + (liq.gratificacion || 0) + (liq.bonoFijo || 0)
                       + (liq.comision || 0) + heMontoFinal

  // Descuentos legales (calculados por el backend sobre la base sin HH.EE ni bonos)
  const totalDescLegales = (liq.descuentoAfp || 0) + (liq.descuentoSalud || 0) + (liq.descuentoCesantiaTrab || 0)

  // Bono Herramienta: complemento no imponible al líquido pactado
  const bonoHerramienta = Math.max(0,
    (liq.sueldoLiquidoPactado || 0) - (liq.sueldoBase || 0)
  )

  // Haberes no imponibles (incluye bonos del período — no tienen descuentos legales)
  const totalNoImponible = (liq.colacion || 0) + (liq.movilizacion || 0) + (liq.otrosHaberes || 0) + bonoHerramienta + totalBonos

  const totalFaltasDescuento = faltasInfo.faltas.length * faltasInfo.valorDia
  const totalOtrosDesc = totalAdelantos
  const totalDesc      = totalDescLegales + totalOtrosDesc

  // Líquido final = pactado + HH.EE + bonos período − adelantos − otros descuentos − faltas
  const liquidoFinal = (liq.sueldoLiquidoPactado || 0) + heMontoFinal + totalBonos - totalAdelantos - (liq.otrosDescuentos || 0) - totalFaltasDescuento

  // Costo empresa: imponible + no imponibles + SIS (1.71%) + cesantía emp + mutual
  const sisEmpleador = Math.round((liq.baseImponible || 0) * 1.71 / 100)
  const costoFinal   = sisEmpleador + (liq.cesantiaEmpleador || 0) + (liq.mutualEmpleador || 0)

  return (
    <>
    <Modal open onClose={onClose} title="Liquidación de Remuneraciones" size="lg">
      <div ref={printRef} style={{fontFamily: "'Arial', sans-serif", fontSize: '10px', lineHeight: '1.4', color: '#111', background: '#fff', padding: '20px 24px'}}>

        {/* 1. HEADER */}
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #111', paddingBottom: '8px', marginBottom: '10px'}}>
          <div>
            <div style={{fontWeight: '900', fontSize: '18px', letterSpacing: '-0.5px', color: '#111'}}>MAMKAM</div>
            <div style={{fontSize: '9px', color: '#666', marginTop: '2px'}}>Sistema de Gestión Empresarial</div>
          </div>
          <div style={{textAlign: 'right'}}>
            <div style={{fontWeight: '800', fontSize: '13px', letterSpacing: '0.5px', color: '#111', textTransform: 'uppercase'}}>Liquidación de Sueldo</div>
            <div style={{fontSize: '10px', color: '#444', marginTop: '2px'}}>{periodoLabel(liq.periodo)}</div>
          </div>
        </div>

        {/* 2. DATOS DEL TRABAJADOR */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', background: '#f4f4f4', border: '1px solid #ddd', padding: '7px 10px', marginBottom: '10px'}}>
          <div>
            <div style={{fontSize: '8px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px'}}>Trabajador</div>
            <div style={{fontWeight: '700', fontSize: '10px'}}>{liq.trabajadorNombre}</div>
          </div>
          <div>
            <div style={{fontSize: '8px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px'}}>RUT</div>
            <div style={{fontWeight: '600', fontSize: '10px', fontFamily: 'monospace'}}>{liq.trabajadorRut}</div>
          </div>
          <div>
            <div style={{fontSize: '8px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px'}}>Cargo</div>
            <div style={{fontWeight: '600', fontSize: '10px'}}>{liq.cargo || '—'}</div>
          </div>
          <div>
            <div style={{fontSize: '8px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px'}}>Período</div>
            <div style={{fontWeight: '600', fontSize: '10px'}}>{periodoLabel(liq.periodo)}</div>
          </div>
        </div>

        {/* DOS COLUMNAS */}
        <div className="grid grid-cols-2 gap-2">

          {/* COLUMNA IZQUIERDA — HABERES */}
          <div className="space-y-1.5">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Haberes Imponibles</p>
              <L label="Sueldo base imponible" value={liq.sueldoBase} />
              <L label="Gratificación legal (25%)" value={liq.gratificacion} />
              {(liq.bonoFijo || 0) > 0 && <L label="Bono fijo" value={liq.bonoFijo} />}
              {(liq.comision || 0) > 0 && <L label="Comisión" value={liq.comision} />}
              {heLoading ? (
                <div className="flex items-center gap-1 py-0.5 text-xs text-slate-400">
                  <RefreshCw className="w-3 h-3 animate-spin" />Calculando HH.EE...
                </div>
              ) : heData?.total_minutos_extra > 0 ? (
                <div className="flex justify-between items-center py-0.5 gap-2">
                  <span className="text-xs text-slate-600">HH.EE ({heData.total_horas_extra} hrs) ×1.5</span>
                  <input type="number" value={montoAjustado} onChange={e => setMontoAjustado(e.target.value)}
                    className="input-base text-right w-20 py-0 text-xs" title={`Calculado: ${fmtCLP(heData.monto_horas_extra)}`} />
                </div>
              ) : null}
              <Div />
              <L label="Total imponible" value={totalImponible} bold />
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Haberes No Imponibles</p>
              {(liq.colacion || 0) > 0 && <L label="Colación" value={liq.colacion} />}
              {(liq.movilizacion || 0) > 0 && <L label="Movilización" value={liq.movilizacion} />}
              {(liq.otrosHaberes || 0) > 0 && <L label="Otros haberes" value={liq.otrosHaberes} />}
              {bonos.map(b => (
                <L key={b.id}
                  label={b.tipo === 'asistencia_perfecta' ? 'Bono asistencia perfecta' : `Bono desempeño${b.descripcion ? ` (${b.descripcion})` : ''}`}
                  value={b.monto} />
              ))}
              <L label="Bono Herramienta" value={bonoHerramienta} />
              <Div />
              <L label="Total no imponible" value={totalNoImponible} bold />
            </div>

            <div className="rounded-lg bg-slate-100 border border-slate-200 px-2 py-1.5 flex justify-between items-center">
              <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Sueldo Bruto</span>
              <span className="text-[12px] font-bold text-slate-900">{fmtCLP(totalImponible + totalNoImponible)}</span>
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-1.5 flex justify-between items-center">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Total descuentos</span>
              <span className="text-[12px] font-bold text-red-600">- {fmtCLP(totalDesc)}</span>
            </div>
          </div>

          {/* COLUMNA DERECHA — DESCUENTOS */}
          <div className="space-y-1.5">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Descuentos Legales</p>
              <L label={`AFP ${liq.afp} (${liq.porcentajeAfp}%)`} value={liq.descuentoAfp} neg />
              <L label={liq.previsionSalud === 'Isapre' ? 'Isapre (monto fijo)' : `Fonasa (${liq.porcentajeSalud}%)`}
                value={liq.descuentoSalud} neg />
              {(liq.descuentoCesantiaTrab || 0) > 0 &&
                <L label="Seg. cesantía trab. (0.6%)" value={liq.descuentoCesantiaTrab} neg />}
              <Div />
              <L label="Total descuentos legales" value={totalDescLegales} neg bold />
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Otros Descuentos</p>
              {adelantos.length === 0 && (liq.otrosDescuentos || 0) === 0 ? (
                <p className="text-xs text-slate-400 italic">Sin otros descuentos</p>
              ) : (
                <>
                  {adelantos.map(a => (
                    <L key={a.id}
                      label={`Adelanto ${a.tipo === 'quincena' ? 'quincena' : 'adicional'}${a.descripcion ? ` (${a.descripcion})` : ''}`}
                      value={a.monto} neg />
                  ))}
                  {(liq.otrosDescuentos || 0) > 0 && <L label="Otros descuentos" value={liq.otrosDescuentos} neg />}
                  {totalOtrosDesc > 0 && <><Div /><L label="Total otros descuentos" value={totalOtrosDesc} neg bold /></>}
                </>
              )}
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Faltas del período</p>
              {faltasInfo.faltas.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Sin faltas registradas</p>
              ) : (
                <>
                  {faltasInfo.faltas.map((f, i) => (
                    <div key={i} className="flex justify-between items-start py-0.5">
                      <span className="text-xs text-slate-600 max-w-[60%]">
                        {f.fecha}{f.observacion ? ` (${f.observacion})` : ''}
                      </span>
                      <span className="text-xs text-red-600 shrink-0">- {fmtCLP(faltasInfo.valorDia)}</span>
                    </div>
                  ))}
                  <Div />
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-700">Total faltas</span>
                    <span className="text-[12px] font-bold text-red-600">- {fmtCLP(totalFaltasDescuento)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Aportes Empleador</p>
              <L label="SIS (1.71%)" value={sisEmpleador} />
              <L label={`Cesantía emp. (${liq.tipoContrato === 'plazo_fijo' ? '3.0' : '2.4'}%)`}
                value={liq.cesantiaEmpleador} />
              <L label="Mutual de seguridad (0.93%)" value={liq.mutualEmpleador} />
              <Div />
              <L label="Costo total empresa" value={costoFinal} bold />
            </div>
          </div>
        </div>

        {/* SUELDO LÍQUIDO */}
        <div className="rounded-lg bg-slate-800 px-3 py-2.5 mt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300 mb-1 text-center">Sueldo Líquido</p>
          <div className="space-y-0.5 mb-2">
            {liq.sueldoLiquidoPactado > 0 && (
              <div className="flex justify-between text-xs text-slate-400">
                <span>Líquido pactado</span>
                <span>{fmtCLP(liq.sueldoLiquidoPactado)}</span>
              </div>
            )}
            {heMontoFinal > 0 && (
              <div className="flex justify-between text-xs text-slate-400">
                <span>HH.EE ({heData?.total_horas_extra ?? '?'} hrs)</span>
                <span className="text-slate-300">+{fmtCLP(heMontoFinal)}</span>
              </div>
            )}
            {bonos.map(b => (
              <div key={b.id} className="flex justify-between text-xs text-slate-400">
                <span>{b.tipo === 'asistencia_perfecta' ? 'Bono asistencia perfecta' : `Bono desempeño${b.descripcion ? ` (${b.descripcion})` : ''}`}</span>
                <span className="text-slate-300">+{fmtCLP(b.monto)}</span>
              </div>
            ))}
            {(adelantos.length > 0 || (liq.otrosDescuentos || 0) > 0 || totalFaltasDescuento > 0) && (
              <div className="border-t border-slate-600 my-1" />
            )}
            {adelantos.map(a => (
              <div key={a.id} className="flex justify-between text-xs text-slate-400">
                <span>{`Adelanto ${a.tipo === 'quincena' ? 'quincena' : 'adicional'}${a.descripcion ? ` (${a.descripcion})` : ''}`}</span>
                <span className="text-red-400">-{fmtCLP(a.monto)}</span>
              </div>
            ))}
            {(liq.otrosDescuentos || 0) > 0 && (
              <div className="flex justify-between text-xs text-slate-400">
                <span>Otros descuentos</span>
                <span className="text-red-400">-{fmtCLP(liq.otrosDescuentos)}</span>
              </div>
            )}
            {totalFaltasDescuento > 0 && (
              <div className="flex justify-between text-xs text-slate-400">
                <span>Descuento faltas ({faltasInfo.faltas.length} día{faltasInfo.faltas.length !== 1 ? 's' : ''})</span>
                <span className="text-red-400">-{fmtCLP(totalFaltasDescuento)}</span>
              </div>
            )}
          </div>
          <div className="border-t-2 border-slate-600 pt-1.5 flex justify-between items-center">
            <span className="text-[13px] font-bold text-white uppercase tracking-wide">Total Líquido</span>
            <span className="text-[22px] font-bold text-white">{fmtCLP(liquidoFinal)}</span>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid #dde', fontSize: '8px', color: '#aaa', marginTop: '6px'}}>
          <span>Documento generado por MAMKAM</span>
          <span>{new Date().toLocaleDateString('es-CL')}</span>
        </div>

        {/* Historial de envíos */}
        {liq.emailEnviado && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 mt-2 no-print">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mb-2">Envíos realizados</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Mail className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>
                  Email enviado el {liq.emailFecha
                    ? new Date(liq.emailFecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {liq.pdfUrl && (
                  <a href={liq.pdfUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline">
                    <Download className="w-3 h-3" />Ver PDF
                  </a>
                )}
                {liq.comprobanteUrl && (
                  <a href={liq.comprobanteUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800 hover:underline">
                    <Paperclip className="w-3 h-3" />Ver comprobante
                  </a>
                )}
                <button
                  onClick={() => {
                    setMensajeEmail(`Estimado/a ${liq.trabajadorNombre?.split(' ')[0] || 'trabajador/a'}, adjunto encontrará su liquidación de sueldo correspondiente al período ${periodoLabel(liq.periodo)}. Quedamos atentos a cualquier consulta.\n\nSaludos,\nEquipo MAMKAM`)
                    setComprobanteEmail(null)
                    setModalEmail(true)
                  }}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                >
                  <RefreshCw className="w-3 h-3" />Reenviar
                </button>
              </div>
              {liq.emailMensaje && (
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer hover:text-slate-700 select-none">Ver mensaje enviado</summary>
                  <p className="mt-1 pl-2 border-l-2 border-slate-200 whitespace-pre-wrap text-slate-600">{liq.emailMensaje}</p>
                </details>
              )}
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-between items-center pt-1 no-print">
          <div className="flex gap-2">
            <button onClick={handlePrint} className="btn-secondary">
              <Download className="w-4 h-4" />Imprimir / PDF
            </button>
            <button
              onClick={() => {
                setMensajeEmail(`Estimado/a ${liq.trabajadorNombre?.split(' ')[0] || 'trabajador/a'}, adjunto encontrará su liquidación de sueldo correspondiente al período ${periodoLabel(liq.periodo)}. Quedamos atentos a cualquier consulta.\n\nSaludos,\nEquipo MAMKAM`)
                setComprobanteEmail(null)
                setModalEmail(true)
              }}
              className="btn-secondary text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <Mail className="w-4 h-4" />Enviar por email
            </button>
          </div>
          <button onClick={onClose} className="btn-primary">Cerrar</button>
        </div>
      </div>
    </Modal>

    {/* Modal envío de email */}
    {modalEmail && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => !loadingEmail && setModalEmail(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <div className="px-6 py-5 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">
              Enviar liquidación — {liq.trabajadorNombre} {periodoLabel(liq.periodo)}
            </h3>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Destinatario</label>
              <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">
                {liq.trabajadorEmail || <span className="text-slate-400 italic">Sin email registrado</span>}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Mensaje <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <textarea
                value={mensajeEmail}
                onChange={(e) => setMensajeEmail(e.target.value)}
                rows={4}
                placeholder={`Estimado/a ${liq.trabajadorNombre?.split(' ')[0] || 'trabajador/a'}, adjunto encontrará su liquidación de sueldo correspondiente al período ${periodoLabel(liq.periodo)}. Quedamos atentos a cualquier consulta.`}
                className="input-base resize-none text-sm"
                disabled={loadingEmail}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Adjuntar comprobante de pago <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              {comprobanteEmail ? (
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg">
                  <Paperclip className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-700 truncate flex-1">{comprobanteEmail.nombre}</span>
                  <button onClick={() => { setComprobanteEmail(null); if (comprobanteRef.current) comprobanteRef.current.value = '' }} className="text-slate-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => comprobanteRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
                >
                  Hacer clic para adjuntar imagen o PDF
                </button>
              )}
              <input
                ref={comprobanteRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => handleComprobanteChange(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 pb-5">
            <button onClick={() => setModalEmail(false)} disabled={loadingEmail} className="btn-secondary disabled:opacity-50">
              Cancelar
            </button>
            <button
              onClick={handleEnviarEmail}
              disabled={loadingEmail || !liq.trabajadorEmail}
              className="btn-primary disabled:opacity-50"
            >
              {loadingEmail
                ? <><Loader2 className="w-4 h-4 animate-spin" />Generando PDF…</>
                : <><Mail className="w-4 h-4" />Enviar liquidación</>
              }
            </button>
          </div>
        </div>
      </div>
    )}

    <Toast toast={localToast} onClose={() => setLocalToast(null)} />
  </>
  )
}


/* ── TAB: Liquidaciones ─────────────────────────────────────────────── */
function TabLiquidaciones({ periodo, onToast }) {
  const [filas,        setFilas]        = useState([])   // Array<{ trabajador, liquidacion }>
  const [loading,      setLoading]      = useState(false)
  const [loadingRows,  setLoadingRows]  = useState({})   // { [trabajador_id]: boolean }
  const [detalle,      setDetalle]      = useState(null)
  const [adelantosMes, setAdelantosMes] = useState([])
  const [heMap,        setHeMap]        = useState({})   // { [trabajador_id]: { total_horas_extra, monto_horas_extra } }

  const cargar = useCallback(async () => {
    if (!periodo) return
    setLoading(true)
    try {
      const data = await apiClient.get(`/remuneraciones/trabajadores-activos?periodo=${periodo}`)
      const rows = Array.isArray(data) ? data : []
      setFilas(rows)
      const trabIds = rows.map(f => f.trabajador?.id).filter(Boolean)
      if (trabIds.length > 0) {
        const { data: ad } = await supabase
          .from('adelantos')
          .select('trabajador_id, monto, tipo, descontado')
          .eq('periodo', periodo)
          .in('trabajador_id', trabIds)
        setAdelantosMes(ad ?? [])
      } else {
        setAdelantosMes([])
      }

      // Cargar horas extras en paralelo para trabajadores con liquidación
      const liqRows = rows.filter(f => f.liquidacion)
      if (liqRows.length > 0) {
        const heResults = await Promise.all(
          liqRows.map(f =>
            apiClient.get(`/remuneraciones/horas-extras/${f.trabajador.id}/${periodo}`)
              .then(d => ({ id: f.trabajador.id, data: d }))
              .catch(() => ({ id: f.trabajador.id, data: null }))
          )
        )
        const map = {}
        for (const r of heResults) {
          if (r.data) map[r.id] = r.data
        }
        setHeMap(map)
      } else {
        setHeMap({})
      }
    } catch (err) {
      onToast({ message: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [periodo])

  useEffect(() => { cargar() }, [cargar])

  const setRowLoading = (trabId, val) =>
    setLoadingRows(prev => ({ ...prev, [trabId]: val }))

  const _generar = async (trabId) => {
    const liq = await apiClient.post('/remuneraciones/calcular', { trabajador_id: trabId, periodo })
    const saved = await apiClient.post('/remuneraciones/liquidaciones', liq)
    return saved ?? liq
  }

  const handleGenerarIndividual = async (trabId, nombre) => {
    setRowLoading(trabId, true)
    try {
      await _generar(trabId)
      onToast({ message: `Liquidación generada para ${nombre}`, type: 'success' })
      cargar()
    } catch (err) {
      onToast({ message: err.message, type: 'error' })
    } finally {
      setRowLoading(trabId, false)
    }
  }

  const handleRecalcularIndividual = async (trabId, liqId, nombre) => {
    if (!confirm(`¿Recalcular liquidación de ${nombre}? Se perderán ajustes manuales.`)) return
    setRowLoading(trabId, true)
    try {
      await apiClient.delete(`/remuneraciones/liquidaciones/${liqId}`)
      const nuevaLiq = await _generar(trabId)
      setFilas(prev => prev.map(f =>
        f.trabajador.id === trabId ? { ...f, liquidacion: nuevaLiq } : f
      ))
      onToast({ message: `Liquidación recalculada para ${nombre}`, type: 'success' })
    } catch (err) {
      onToast({ message: err.message, type: 'error' })
    } finally {
      setRowLoading(trabId, false)
    }
  }

  const handleEstado = async (liqId, trabId, estado) => {
    setRowLoading(trabId, true)
    try {
      await apiClient.patch(`/remuneraciones/liquidaciones/${liqId}`, { estado })
      if (estado === 'aprobada') {
        await supabase.from('adelantos')
          .update({ descontado: true })
          .eq('trabajador_id', trabId)
          .eq('periodo', periodo)
          .eq('descontado', false)
      }
      onToast({ message: `Liquidación ${estado}`, type: 'success' })
      cargar()
    } catch (err) {
      onToast({ message: err.message, type: 'error' })
    } finally {
      setRowLoading(trabId, false)
    }
  }

  const conLiq = filas.filter(f => f.liquidacion)
  const totales = conLiq.reduce(
    (a, { trabajador: t, liquidacion: l }) => {
      const adelantosTrab = adelantosMes
        .filter(ad => ad.trabajador_id === t.id)
        .reduce((sum, ad) => sum + (ad.monto || 0), 0)
      const heMonto = heMap[t.id]?.monto_horas_extra || 0
      return {
        desc:    a.desc    + l.totalDescuentos + adelantosTrab,
        liquido: a.liquido + l.sueldoLiquido   + heMonto - adelantosTrab,
        costo:   a.costo   + l.costoEmpresa,
      }
    },
    { desc: 0, liquido: 0, costo: 0 },
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <p className="text-sm text-slate-500">
          {conLiq.length} de {filas.length} liquidaciones generadas · {periodoLabel(periodo)}
        </p>
        <p className="text-xs text-slate-400 italic">
          Genera la liquidación de cada trabajador individualmente desde la tabla.
        </p>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-5 h-5 animate-spin text-slate-300" />
          </div>
        ) : filas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <Calculator className="w-8 h-8 text-slate-200" />
            <p className="text-sm text-slate-400">Sin trabajadores activos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="table-th">Trabajador</th>
                  <th className="table-th">Cargo</th>
                  <th className="table-th text-right">Sueldo Líquido</th>
                  <th className="table-th text-right">Horas Extras</th>
                  <th className="table-th text-right">Descuentos</th>
                  <th className="table-th text-right">Total a Pagar</th>
                  <th className="table-th">Estado</th>
                  <th className="table-th text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.map(({ trabajador: t, liquidacion: l }) => {
                  const rowLoading = !!loadingRows[t.id]
                  const initials   = t.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                  const adelantosTrab = l
                    ? adelantosMes
                        .filter(ad => ad.trabajador_id === t.id)
                        .reduce((sum, ad) => sum + (ad.monto || 0), 0)
                    : 0
                  const heData          = l ? (heMap[t.id] ?? null) : null
                  const heHoras         = heData?.total_horas_extra || 0
                  const heMonto         = heData?.monto_horas_extra || 0
                  const totalDescuentosReal = l ? l.totalDescuentos + adelantosTrab : 0
                  const totalAPagarReal     = l ? l.sueldoLiquido + heMonto - adelantosTrab : 0
                  const hayAdelantos        = adelantosTrab > 0
                  if (l) console.log('[Liquidacion]', t.nombre, {
                    sueldoLiquido: l?.sueldoLiquido,
                    totalDescuentos: l?.totalDescuentos,
                    sueldo: t.sueldo,
                    raw: l
                  })
                  return (
                    <tr key={t.id} className={`transition-colors ${l ? 'hover:bg-slate-50/80' : 'bg-slate-50/30 hover:bg-slate-50/60'}`}>
                      {/* Trabajador */}
                      <td className="table-td">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                            <span className="text-indigo-600 font-bold text-xs">{initials}</span>
                          </div>
                          <div>
                            <div className="font-medium text-slate-800 text-sm">{t.nombre}</div>
                            <div className="text-xs text-slate-400 font-mono">{t.rut}</div>
                          </div>
                        </div>
                      </td>
                      {/* Cargo */}
                      <td className="table-td text-sm text-slate-600">{t.cargo}</td>
                      {/* Sueldo Líquido */}
                      <td className="table-td text-right text-slate-700">
                        {fmtCLP(l ? l.sueldoLiquidoPactado : t.sueldo)}
                      </td>
                      {/* Horas Extras */}
                      <td className="table-td text-right text-xs">
                        {l && heHoras > 0
                          ? <span className="text-emerald-600 font-medium">+{heHoras}h / +{fmtCLP(heMonto)}</span>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      {/* Descuentos */}
                      <td className="table-td text-right">
                        {l
                          ? <span className="text-red-600">- {fmtCLP(totalDescuentosReal)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      {/* Total a Pagar */}
                      <td className="table-td text-right">
                        {l
                          ? <span className={`font-semibold ${hayAdelantos ? 'text-orange-500' : 'text-indigo-600'}`}>
                              {fmtCLP(totalAPagarReal)}
                            </span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      {/* Estado */}
                      <td className="table-td">
                        {l
                          ? <EstadoBadge estado={l.estado} />
                          : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-slate-50 text-slate-400 border-slate-200">
                              Sin liquidación
                            </span>}
                      </td>
                      {/* Acciones */}
                      <td className="table-td text-right">
                        {rowLoading ? (
                          <div className="flex justify-end pr-1">
                            <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                          </div>
                        ) : !l ? (
                          <button
                            onClick={() => handleGenerarIndividual(t.id, t.nombre)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                          >
                            <Plus className="w-3 h-3" />Generar
                          </button>
                        ) : l.estado === 'borrador' ? (
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setDetalle({ ...l, trabajadorEmail: t.email || '' })} title="Ver detalle"
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRecalcularIndividual(t.id, l.id, t.nombre)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                              <RefreshCw className="w-3 h-3" />Recalcular
                            </button>
                            <button
                              onClick={() => handleEstado(l.id, t.id, 'aprobada')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                            >
                              <CheckCircle2 className="w-3 h-3" />Aprobar
                            </button>
                          </div>
                        ) : l.estado === 'aprobada' ? (
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setDetalle({ ...l, trabajadorEmail: t.email || '' })}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                              <Eye className="w-3 h-3" />Ver detalle
                            </button>
                            {l.emailEnviado && (
                              <span
                                title={`Email enviado el ${l.emailFecha ? new Date(l.emailFecha).toLocaleDateString('es-CL') : ''}`}
                                className="p-1.5 text-emerald-500"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </span>
                            )}
                            <button
                              onClick={() => handleEstado(l.id, t.id, 'pagada')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-900 text-white hover:bg-indigo-800 transition-colors"
                            >
                              <DollarSign className="w-3 h-3" />Marcar pagada
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setDetalle({ ...l, trabajadorEmail: t.email || '' })}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                              <Eye className="w-3 h-3" />Ver detalle
                            </button>
                            {l.emailEnviado && (
                              <span
                                title={`Email enviado el ${l.emailFecha ? new Date(l.emailFecha).toLocaleDateString('es-CL') : ''}`}
                                className="p-1.5 text-emerald-500"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {conLiq.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                    <td colSpan={4} className="table-td text-sm text-slate-500">
                      Totales · {conLiq.length} liquidación{conLiq.length !== 1 ? 'es' : ''}
                    </td>
                    <td className="table-td text-right text-red-600">- {fmtCLP(totales.desc)}</td>
                    <td className="table-td text-right text-indigo-600">{fmtCLP(totales.liquido)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {detalle && <DetalleModal liq={detalle} onClose={() => setDetalle(null)} />}
    </div>
  )
}


/* ── TAB: Resumen Previred ──────────────────────────────────────────── */
function TabPrevired({ periodo, onToast }) {
  const [resumen,  setResumen]  = useState(null)
  const [loading,  setLoading]  = useState(false)

  const cargar = useCallback(async () => {
    if (!periodo) return
    setLoading(true)
    try {
      const data = await apiClient.get(`/remuneraciones/resumen/${periodo}`)
      setResumen(data)
    } catch (err) {
      onToast({ message: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [periodo])

  useEffect(() => { cargar() }, [cargar])

  const exportarCSV = () => {
    if (!resumen?.liquidaciones?.length) return
    const headers = ['RUT','Nombre','AFP','% AFP','Desc. AFP','Salud','Desc. Salud','Ces. Trab.','Ces. Emp.','Mutual','Total Previred']
    const rows = resumen.liquidaciones.map(l => [
      l.trabajadorRut ?? '',
      l.trabajadorNombre ?? '',
      l.afp ?? '',
      l.porcentajeAfp ?? 0,
      l.descuentoAfp ?? 0,
      l.previsionSalud ?? '',
      l.descuentoSalud ?? 0,
      l.descuentoCesantiaTrab ?? 0,
      l.cesantiaEmpleador ?? 0,
      l.mutualEmpleador ?? 0,
      (l.descuentoAfp + l.descuentoSalud + l.descuentoCesantiaTrab + l.cesantiaEmpleador + l.mutualEmpleador),
    ])
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `previred_${periodo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const liqs = resumen?.liquidaciones ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{periodoLabel(periodo)}</p>
          {resumen && (
            <p className="text-sm font-semibold text-slate-700 mt-0.5">
              Total a pagar a Previred: <span className="text-indigo-600">{fmtCLP(resumen.totalPrevired)}</span>
            </p>
          )}
        </div>
        <button onClick={exportarCSV} disabled={!liqs.length} className="btn-secondary disabled:opacity-40">
          <Download className="w-4 h-4" />
          Exportar para Previred
        </button>
      </div>

      {resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'AFP',            value: resumen.totalDescuentosAfp  },
            { label: 'Salud',          value: resumen.totalDescuentosSalud },
            { label: 'Ces. Trab.',     value: resumen.totalCesantiaTrab   },
            { label: 'Ces. Emp.',      value: resumen.totalCesantiaEmp    },
            { label: 'Mutual',         value: resumen.totalMutual         },
            { label: 'Total Previred', value: resumen.totalPrevired, highlight: true },
          ].map(c => (
            <div key={c.label} className={`card p-3 ${c.highlight ? 'border-indigo-300 bg-indigo-50' : ''}`}>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{c.label}</p>
              <p className={`text-base font-bold ${c.highlight ? 'text-indigo-700' : 'text-slate-800'}`}>{fmtCLP(c.value)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-5 h-5 animate-spin text-slate-300" />
          </div>
        ) : liqs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <FileSpreadsheet className="w-8 h-8 text-slate-200" />
            <p className="text-sm text-slate-400">Sin liquidaciones para exportar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="table-th">Trabajador</th>
                  <th className="table-th">RUT</th>
                  <th className="table-th">AFP</th>
                  <th className="table-th text-right">Desc. AFP</th>
                  <th className="table-th">Salud</th>
                  <th className="table-th text-right">Desc. Salud</th>
                  <th className="table-th text-right">Ces. Trab.</th>
                  <th className="table-th text-right">Ces. Emp.</th>
                  <th className="table-th text-right">Mutual</th>
                  <th className="table-th text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {liqs.map(l => {
                  const total = l.descuentoAfp + l.descuentoSalud + l.descuentoCesantiaTrab + l.cesantiaEmpleador + l.mutualEmpleador
                  return (
                    <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="table-td font-medium text-slate-800">{l.trabajadorNombre}</td>
                      <td className="table-td font-mono text-xs text-slate-500">{l.trabajadorRut}</td>
                      <td className="table-td">
                        <div className="text-slate-700">{l.afp}</div>
                        <div className="text-xs text-slate-400">{l.porcentajeAfp}%</div>
                      </td>
                      <td className="table-td text-right">{fmtCLP(l.descuentoAfp)}</td>
                      <td className="table-td text-slate-600">{l.previsionSalud}</td>
                      <td className="table-td text-right">{fmtCLP(l.descuentoSalud)}</td>
                      <td className="table-td text-right">{fmtCLP(l.descuentoCesantiaTrab)}</td>
                      <td className="table-td text-right">{fmtCLP(l.cesantiaEmpleador)}</td>
                      <td className="table-td text-right">{fmtCLP(l.mutualEmpleador)}</td>
                      <td className="table-td text-right font-semibold text-indigo-600">{fmtCLP(total)}</td>
                    </tr>
                  )
                })}
              </tbody>
              {liqs.length > 0 && resumen && (
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                    <td colSpan={3} className="table-td text-slate-500">Totales</td>
                    <td className="table-td text-right">{fmtCLP(resumen.totalDescuentosAfp)}</td>
                    <td />
                    <td className="table-td text-right">{fmtCLP(resumen.totalDescuentosSalud)}</td>
                    <td className="table-td text-right">{fmtCLP(resumen.totalCesantiaTrab)}</td>
                    <td className="table-td text-right">{fmtCLP(resumen.totalCesantiaEmp)}</td>
                    <td className="table-td text-right">{fmtCLP(resumen.totalMutual)}</td>
                    <td className="table-td text-right font-bold text-indigo-600">{fmtCLP(resumen.totalPrevired)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Página principal ───────────────────────────────────────────────── */
export default function RemuneracionesPage() {
  const now  = new Date()
  const [activeTab, setActiveTab] = useState('liquidaciones')
  const [mes,       setMes]       = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [anio,      setAnio]      = useState(String(now.getFullYear()))
  const [toast,     setToast]     = useState(null)

  const periodo = `${anio}-${mes}`
  const years   = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i))

  const TABS = [
    { key: 'liquidaciones', label: 'Liquidaciones',    icon: Calculator      },
    { key: 'previred',      label: 'Resumen Previred', icon: FileSpreadsheet },
  ]

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Remuneraciones</h2>
          <p className="text-sm text-slate-500 mt-0.5">Liquidaciones y previsión social</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mes} onChange={e => setMes(e.target.value)} className="input-base py-2 w-auto">
            {MESES.map((m, i) => (
              <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
            ))}
          </select>
          <select value={anio} onChange={e => setAnio(e.target.value)} className="input-base py-2 w-auto">
            {years.map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
              ${activeTab === tab.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {activeTab === 'liquidaciones' && <TabLiquidaciones periodo={periodo} onToast={setToast} />}
      {activeTab === 'previred'      && <TabPrevired       periodo={periodo} onToast={setToast} />}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
