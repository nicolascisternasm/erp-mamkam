import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../../services/supabase'
import { formatCLP } from '../../utils/formatters'
import Modal, { ConfirmModal } from '../../components/Modal'
import {
  Plus, Pencil, Trash2, RefreshCw, Package,
  ToggleLeft, ToggleRight, Search, Calculator,
} from 'lucide-react'

const CATEGORIAS = ['Instalación', 'Materiales', 'Servicio', 'Otro']
const UNIDADES   = ['unidad', 'm2', 'ml', 'kg', 'hora', 'otro']
const FORM_EMPTY = { nombre: '', descripcion: '', categoria: 'Instalación', unidad_medida: 'unidad', precio_referencia: '', activo: true }

/* ── Calculadora de Caucho Continuo ─────────────────────────────── */

function CalculadoraCaucho({ onRefresh }) {
  const { user } = useAuth()

  // Inputs venta
  const [cliente,     setCliente]     = useState('')
  const [proyecto,    setProyecto]    = useState('')
  const [m2,          setM2]          = useState(0)
  const [ubicacion,   setUbicacion]   = useState('')
  const [alturaBase,  setAlturaBase]  = useState(2)
  const [alturaColor, setAlturaColor] = useState(1)
  const [valorM2,     setValorM2]     = useState(0)

  // Precios KG editables
  const [precioG3,       setPrecioG3]       = useState(335)
  const [precioResNegro, setPrecioResNegro] = useState(4350)
  const [precioResColor, setPrecioResColor] = useState(4800)
  const [precioEpdm,     setPrecioEpdm]     = useState(2000)

  // Porcentajes resina editables
  const [pctResNegro, setPctResNegro] = useState(10)
  const [pctResColor, setPctResColor] = useState(15)

  // Datos proyecto extra
  const [comuna,      setComuna]      = useState('')
  const [kmTalagante, setKmTalagante] = useState(0)
  const [precioKm,    setPrecioKm]    = useState(2000)

  // Costos operativos
  const [dias,               setDias]               = useState(0)
  const [ayudantes,          setAyudantes]          = useState(0)
  const [contratados,        setContratados]        = useState(0)
  const [costoDiaBencina,    setCostoDiaBencina]    = useState(30000)
  const [montoViaticos,      setMontoViaticos]      = useState(50000)
  const [viaje,              setViaje]              = useState(0)
  const [viajeDes,           setViajeDes]           = useState('')

  // Cotizaciones
  const [cotizaciones,     setCotizaciones]     = useState([])
  const [cotizacionSearch, setCotizacionSearch] = useState('')
  const [cotizacionSelec,  setCotizacionSelec]  = useState(null)
  const [showCots,         setShowCots]         = useState(false)

  // Auto-save
  const [calcId,      setCalcId]      = useState(null)
  const [saveStatus,  setSaveStatus]  = useState('idle') // 'idle' | 'saving' | 'saved'
  const saveTimerRef    = useRef(null)
  const autoGuardarRef  = useRef(null)

  // ── Cálculos materiales ──────────────────────────────────────────
  const kgG3       = m2 * alturaBase * 7
  const kgResNegro = m2 * alturaBase * 7 * (pctResNegro / 100)
  const kgResColor = m2 * alturaColor * 9.5 * (pctResColor / 100)
  const kgEpdm     = m2 * alturaColor * 9.5
  const kgTotal    = kgG3 + kgResNegro + kgResColor + kgEpdm

  const netoG3       = kgG3 * precioG3
  const netoResNegro = kgResNegro * precioResNegro
  const netoResColor = kgResColor * precioResColor
  const netoEpdm     = kgEpdm * precioEpdm

  const totalNetoMat  = netoG3 + netoResNegro + netoResColor + netoEpdm
  const ivaMat        = totalNetoMat * 0.19
  const totalBrutoMat = totalNetoMat + ivaMat

  // ── Cálculos venta ──────────────────────────────────────────────
  const totalAltura  = alturaBase + alturaColor
  const netoVenta    = m2 * valorM2
  const ivaVenta     = netoVenta * 0.19
  const totalVenta   = netoVenta + ivaVenta

  // ── Costos operativos ───────────────────────────────────────────
  const costoAyudantes   = ayudantes * dias * 28000
  const costoContratados = contratados * dias * 40000
  const costoBencina     = costoDiaBencina * dias
  const costoViaticos    = montoViaticos * contratados * dias
  const costoFlete       = kmTalagante * precioKm
  const costoViaje       = viaje
  const totalCostosOp    = costoAyudantes + costoContratados + costoBencina + costoViaticos + costoFlete + costoViaje

  // ── Costos vs utilidad ──────────────────────────────────────────
  const ivaNeto          = ivaVenta - ivaMat
  const totalCostos      = (totalNetoMat * 1.19) + totalCostosOp
  const utilidadBruta    = netoVenta - totalCostos
  const pctUtilidadBruta = netoVenta > 0 ? (utilidadBruta / netoVenta) * 100 : 0
  const colorUtilBruta   = pctUtilidadBruta > 20 ? 'text-emerald-400' : pctUtilidadBruta >= 10 ? 'text-yellow-400' : 'text-red-400'
  const utilidadNeta     = utilidadBruta - ivaNeto
  const pctUtilidadNeta  = netoVenta > 0 ? (utilidadNeta / netoVenta) * 100 : 0
  const colorUtil        = pctUtilidadNeta > 20 ? 'text-emerald-400' : pctUtilidadNeta >= 10 ? 'text-yellow-400' : 'text-red-400'

  const clp = (n) => formatCLP(Math.round(n))

  const materialesRows = [
    { label: 'CAUCHO G3 (7 kg/m²/cm)',              kg: kgG3,       price: precioG3,       setPrice: setPrecioG3,       neto: netoG3 },
    { label: `RESINA NEGRO (${pctResNegro}%)`,       kg: kgResNegro, price: precioResNegro, setPrice: setPrecioResNegro, neto: netoResNegro, pct: pctResNegro, setPct: setPctResNegro },
    { label: `RESINA COLOR (${pctResColor}%)`,       kg: kgResColor, price: precioResColor, setPrice: setPrecioResColor, neto: netoResColor, pct: pctResColor, setPct: setPctResColor },
    { label: 'EPDM (9.5 kg/m²/cm)',                 kg: kgEpdm,     price: precioEpdm,     setPrice: setPrecioEpdm,     neto: netoEpdm },
  ]

  useEffect(() => {
    if (!supabase || !user?.empresa_id) return
    supabase
      .from('cotizaciones')
      .select('id, numero, cliente, direccion, comuna, total')
      .eq('empresa_id', user.empresa_id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setCotizaciones(data || []))
  }, [user?.empresa_id])

  // Cargar cálculo guardado al seleccionar cotización
  useEffect(() => {
    if (!supabase || !cotizacionSelec) { setCalcId(null); return }
    supabase
      .from('calculadora_proyectos')
      .select('*')
      .eq('cotizacion_id', cotizacionSelec.id)
      .eq('tipo_producto', 'caucho')
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setCalcId(null); return }
        setCalcId(data.id)
        const d = data.datos || {}
        if (d.metros2       != null) setM2(d.metros2)
        if (d.altura_base   != null) setAlturaBase(d.altura_base)
        if (d.altura_color  != null) setAlturaColor(d.altura_color)
        if (d.valor_m2      != null) setValorM2(d.valor_m2)
        if (d.precio_caucho_g3    != null) setPrecioG3(d.precio_caucho_g3)
        if (d.precio_resina_negro != null) setPrecioResNegro(d.precio_resina_negro)
        if (d.precio_resina_color != null) setPrecioResColor(d.precio_resina_color)
        if (d.precio_epdm         != null) setPrecioEpdm(d.precio_epdm)
        if (d.pct_resina_negro    != null) setPctResNegro(d.pct_resina_negro)
        if (d.pct_resina_color    != null) setPctResColor(d.pct_resina_color)
        if (d.dias_trabajo  != null) setDias(d.dias_trabajo)
        if (d.ayudantes     != null) setAyudantes(d.ayudantes)
        if (d.contratados   != null) setContratados(d.contratados)
        if (d.bencina_dia   != null) setCostoDiaBencina(d.bencina_dia)
        if (d.viaticos_dia  != null) setMontoViaticos(d.viaticos_dia)
        if (d.km_flete      != null) setKmTalagante(d.km_flete)
        if (d.precio_km     != null) setPrecioKm(d.precio_km)
        if (d.viaje_otros   != null) setViaje(d.viaje_otros)
        if (d.descripcion_viaje != null) setViajeDes(d.descripcion_viaje)
        if (d.cliente   != null) setCliente(d.cliente)
        if (d.proyecto  != null) setProyecto(d.proyecto)
        if (d.ubicacion != null) setUbicacion(d.ubicacion)
        if (d.comuna    != null) setComuna(d.comuna)
      })
  }, [cotizacionSelec])


  const cotFiltradas = cotizaciones.filter(c =>
    !cotizacionSearch ||
    String(c.numero || '').toLowerCase().includes(cotizacionSearch.toLowerCase()) ||
    (c.cliente || '').toLowerCase().includes(cotizacionSearch.toLowerCase())
  )

  const seleccionarCot = (c) => {
    setCotizacionSelec(c)
    setCliente(c.cliente || '')
    setProyecto(c.numero ? String(c.numero) : '')
    setUbicacion(c.direccion || '')
    setComuna(c.comuna || '')
    setShowCots(false)
    setCotizacionSearch('')
  }

  const limpiarCot = () => {
    setCotizacionSelec(null)
    setCliente(''); setProyecto(''); setUbicacion(''); setComuna('')
  }

  const [saveToast, setSaveToast] = useState('')

  const guardarPrecioReal = async () => {
    if (!supabase || !user?.empresa_id || !valorM2) return
    const { error } = await supabase
      .from('productos')
      .update({ precio_real: valorM2 })
      .eq('empresa_id', user.empresa_id)
      .ilike('nombre', 'CAUCHO CONTINUO')
    if (!error) {
      setSaveToast(`Valor real guardado: ${clp(valorM2)}/m²`)
      setTimeout(() => setSaveToast(''), 3500)
      onRefresh?.()
    }
  }

  const opRows = [
    { label: 'Ayudantes',     val: costoAyudantes },
    { label: 'Contratados',   val: costoContratados },
    { label: 'Bencina',       val: costoBencina },
    { label: 'Viáticos',      val: costoViaticos },
    { label: 'Flete',         val: costoFlete },
    { label: 'Viaje y otros', val: costoViaje },
  ]

  // Always-current auto-save callback (avoids stale closures)
  autoGuardarRef.current = async () => {
    if (!supabase || !cotizacionSelec || !user?.empresa_id) return
    setSaveStatus('saving')
    const datos = {
      metros2: m2, altura_base: alturaBase, altura_color: alturaColor, valor_m2: valorM2,
      precio_caucho_g3: precioG3, precio_resina_negro: precioResNegro,
      precio_resina_color: precioResColor, precio_epdm: precioEpdm,
      pct_resina_negro: pctResNegro, pct_resina_color: pctResColor,
      dias_trabajo: dias, ayudantes, contratados, bencina_dia: costoDiaBencina,
      viaticos_dia: montoViaticos, km_flete: kmTalagante, precio_km: precioKm,
      viaje_otros: viaje, descripcion_viaje: viajeDes,
      cliente, proyecto, ubicacion, comuna,
    }
    const resultados = {
      kg_caucho: kgG3, kg_resina_negro: kgResNegro, kg_resina_color: kgResColor, kg_epdm: kgEpdm,
      total_neto_materiales: totalNetoMat, iva_materiales: ivaMat, total_bruto_materiales: totalBrutoMat,
      total_operativo: totalCostosOp,
      ayudantes_total: costoAyudantes, contratados_total: costoContratados,
      bencina_total: costoBencina, viaticos_total: costoViaticos,
      flete_total: costoFlete, viaje_total: costoViaje,
      neto_venta: netoVenta, iva_venta: ivaVenta, total_bruto_venta: totalVenta,
      utilidad_bruta: utilidadBruta, pct_utilidad_bruta: pctUtilidadBruta,
      iva_neto_sii: ivaNeto, utilidad_neta: utilidadNeta, pct_utilidad_neta: pctUtilidadNeta,
    }

    let error
    if (calcId) {
      ;({ error } = await supabase
        .from('calculadora_proyectos')
        .update({ datos, resultados, updated_at: new Date().toISOString() })
        .eq('id', calcId))
    } else {
      const payload = {
        empresa_id: user.empresa_id,
        cotizacion_id: cotizacionSelec.id,
        cotizacion_numero: cotizacionSelec.numero,
        tipo_producto: 'caucho',
        nombre_calculo: `${cliente || cotizacionSelec.cliente} - ${proyecto || cotizacionSelec.numero}`,
        datos, resultados,
      }
      const { data: inserted, error: err } = await supabase
        .from('calculadora_proyectos').insert(payload).select('id').single()
      error = err
      if (!error && inserted) setCalcId(inserted.id)
    }
    setSaveStatus(error ? 'idle' : 'saved')
    if (!error) setTimeout(() => setSaveStatus('idle'), 2500)
  }

  // Debounced auto-save on any input change
  useEffect(() => {
    if (!cotizacionSelec) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { autoGuardarRef.current?.() }, 600)
    return () => clearTimeout(saveTimerRef.current)
  }, [
    cotizacionSelec,
    m2, alturaBase, alturaColor, valorM2,
    precioG3, precioResNegro, precioResColor, precioEpdm,
    pctResNegro, pctResColor,
    dias, ayudantes, contratados, costoDiaBencina,
    montoViaticos, kmTalagante, precioKm, viaje, viajeDes,
    cliente, proyecto, ubicacion, comuna,
  ])

  const exportarPDF = async () => {
    const { default: jsPDF } = await import('jspdf')
    const { default: html2canvas } = await import('html2canvas')

    const fechaHoy = new Date().toLocaleDateString('es-CL')
    const cotNum   = cotizacionSelec?.numero ? `COT-${cotizacionSelec.numero}` : 'SIN-COT'
    const clpFmt   = (n) => formatCLP(Math.round(n))

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:12px;color:#1e293b;padding:32px;width:800px;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:2px solid #4f46e5;padding-bottom:14px;">
          <div>
            <div style="font-size:22px;font-weight:900;color:#4f46e5;letter-spacing:2px;">MAMKAM</div>
            <div style="font-size:16px;font-weight:700;margin-top:4px;">ANÁLISIS DE COSTOS — CAUCHO CONTINUO</div>
          </div>
          <div style="text-align:right;font-size:11px;color:#64748b;">
            <div>N° ${cotNum}</div>
            <div>Fecha: ${fechaHoy}</div>
          </div>
        </div>

        <div style="background:#f8fafc;border-radius:8px;padding:14px;margin-bottom:16px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#4f46e5;letter-spacing:1px;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">Datos del Proyecto</div>
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <tr>
              <td style="width:15%;color:#64748b;padding:3px 0;">Cliente:</td><td style="width:35%;font-weight:600;">${cliente || '—'}</td>
              <td style="width:15%;color:#64748b;padding:3px 0;">Proyecto:</td><td style="width:35%;font-weight:600;">${proyecto || '—'}</td>
            </tr>
            <tr>
              <td style="color:#64748b;padding:3px 0;">Ubicación:</td><td>${ubicacion || '—'}</td>
              <td style="color:#64748b;padding:3px 0;">Comuna:</td><td>${comuna || '—'}</td>
            </tr>
            <tr>
              <td style="color:#64748b;padding:3px 0;">M²:</td><td><strong>${m2}</strong></td>
              <td style="color:#64748b;padding:3px 0;">Altura base / color:</td><td><strong>${alturaBase} cm / ${alturaColor} cm (total ${totalAltura} cm)</strong></td>
            </tr>
          </table>
        </div>

        <div style="margin-bottom:16px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#4f46e5;letter-spacing:1px;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">Costos de Materiales</div>
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="text-align:left;padding:7px 10px;color:#64748b;font-weight:600;">Producto</th>
                <th style="text-align:right;padding:7px 10px;color:#64748b;font-weight:600;">$/KG</th>
                <th style="text-align:right;padding:7px 10px;color:#64748b;font-weight:600;">KG</th>
                <th style="text-align:right;padding:7px 10px;color:#64748b;font-weight:600;">Total Neto</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:7px 10px;">CAUCHO G3</td>
                <td style="padding:7px 10px;text-align:right;">${clpFmt(precioG3)}</td>
                <td style="padding:7px 10px;text-align:right;">${kgG3.toFixed(1)}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:600;">${clpFmt(netoG3)}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:7px 10px;">RESINA NEGRO (${pctResNegro}%)</td>
                <td style="padding:7px 10px;text-align:right;">${clpFmt(precioResNegro)}</td>
                <td style="padding:7px 10px;text-align:right;">${kgResNegro.toFixed(1)}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:600;">${clpFmt(netoResNegro)}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:7px 10px;">RESINA COLOR (${pctResColor}%)</td>
                <td style="padding:7px 10px;text-align:right;">${clpFmt(precioResColor)}</td>
                <td style="padding:7px 10px;text-align:right;">${kgResColor.toFixed(1)}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:600;">${clpFmt(netoResColor)}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:7px 10px;">EPDM</td>
                <td style="padding:7px 10px;text-align:right;">${clpFmt(precioEpdm)}</td>
                <td style="padding:7px 10px;text-align:right;">${kgEpdm.toFixed(1)}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:600;">${clpFmt(netoEpdm)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr style="border-top:2px solid #cbd5e1;">
                <td colspan="3" style="padding:8px 10px;font-weight:700;">TOTAL NETO materiales</td>
                <td style="padding:8px 10px;text-align:right;font-weight:700;">${clpFmt(totalNetoMat)}</td>
              </tr>
              <tr>
                <td colspan="3" style="padding:5px 10px;color:#64748b;">IVA (19%)</td>
                <td style="padding:5px 10px;text-align:right;color:#64748b;">${clpFmt(ivaMat)}</td>
              </tr>
              <tr style="background:#f1f5f9;">
                <td colspan="3" style="padding:8px 10px;font-weight:700;">TOTAL BRUTO</td>
                <td style="padding:8px 10px;text-align:right;font-weight:700;">${clpFmt(totalBrutoMat)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style="margin-bottom:16px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#4f46e5;letter-spacing:1px;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">Costos Operativos</div>
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="text-align:left;padding:7px 10px;color:#64748b;font-weight:600;">Concepto</th>
                <th style="text-align:left;padding:7px 10px;color:#64748b;font-weight:600;">Detalle</th>
                <th style="text-align:right;padding:7px 10px;color:#64748b;font-weight:600;">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:7px 10px;">Ayudantes</td><td style="padding:7px 10px;color:#64748b;">${ayudantes} × ${dias} días × $28.000</td><td style="padding:7px 10px;text-align:right;font-weight:600;">${clpFmt(costoAyudantes)}</td></tr>
              <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:7px 10px;">Contratados</td><td style="padding:7px 10px;color:#64748b;">${contratados} × ${dias} días × $40.000</td><td style="padding:7px 10px;text-align:right;font-weight:600;">${clpFmt(costoContratados)}</td></tr>
              <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:7px 10px;">Bencina</td><td style="padding:7px 10px;color:#64748b;">${dias} días × ${clpFmt(costoDiaBencina)}</td><td style="padding:7px 10px;text-align:right;font-weight:600;">${clpFmt(costoBencina)}</td></tr>
              <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:7px 10px;">Viáticos</td><td style="padding:7px 10px;color:#64748b;">${contratados} pers × ${dias} días × ${clpFmt(montoViaticos)}</td><td style="padding:7px 10px;text-align:right;font-weight:600;">${clpFmt(costoViaticos)}</td></tr>
              <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:7px 10px;">Flete</td><td style="padding:7px 10px;color:#64748b;">${kmTalagante} km × ${clpFmt(precioKm)}</td><td style="padding:7px 10px;text-align:right;font-weight:600;">${clpFmt(costoFlete)}</td></tr>
              <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:7px 10px;">Viaje y otros</td><td style="padding:7px 10px;color:#64748b;">${viajeDes || '—'}</td><td style="padding:7px 10px;text-align:right;font-weight:600;">${clpFmt(costoViaje)}</td></tr>
            </tbody>
            <tfoot>
              <tr style="border-top:2px solid #cbd5e1;">
                <td colspan="2" style="padding:8px 10px;font-weight:700;">TOTAL OPERATIVO</td>
                <td style="padding:8px 10px;text-align:right;font-weight:700;">${clpFmt(totalCostosOp)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style="background:#f8fafc;border-radius:8px;padding:14px;margin-bottom:20px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#4f46e5;letter-spacing:1px;margin-bottom:10px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">Resumen Financiero</div>
          <table style="width:50%;border-collapse:collapse;font-size:11px;">
            <tr><td style="padding:4px 0;color:#64748b;">Neto venta</td><td style="text-align:right;font-weight:600;">${clpFmt(netoVenta)}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">Costos materiales</td><td style="text-align:right;color:#ef4444;">-${clpFmt(totalNetoMat)}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">Costos operativos</td><td style="text-align:right;color:#ef4444;">-${clpFmt(totalCostosOp)}</td></tr>
            <tr style="border-top:1px solid #e2e8f0;"><td style="padding:4px 0;color:#64748b;">Total costos</td><td style="text-align:right;color:#ef4444;font-weight:600;">-${clpFmt(totalCostos)}</td></tr>
            <tr style="border-top:1px solid #e2e8f0;"><td style="padding:4px 0;font-weight:700;">Utilidad bruta</td><td style="text-align:right;font-weight:700;color:${pctUtilidadBruta > 20 ? '#059669' : pctUtilidadBruta >= 10 ? '#ca8a04' : '#ef4444'};">${clpFmt(utilidadBruta)} (${pctUtilidadBruta.toFixed(1)}%)</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">IVA neto SII</td><td style="text-align:right;color:#f97316;">-${clpFmt(ivaNeto)}</td></tr>
            <tr style="border-top:2px solid #cbd5e1;"><td style="padding:6px 0;font-weight:700;font-size:13px;">Utilidad neta</td><td style="text-align:right;font-weight:700;font-size:13px;color:${pctUtilidadNeta > 20 ? '#059669' : pctUtilidadNeta >= 10 ? '#ca8a04' : '#ef4444'};">${clpFmt(utilidadNeta)} (${pctUtilidadNeta.toFixed(1)}%)</td></tr>
          </table>
        </div>

        <div style="border-top:1px solid #e2e8f0;padding-top:10px;text-align:center;color:#94a3b8;font-size:10px;">
          Documento generado por ERP MAMKAM · ${new Date().toLocaleString('es-CL')}
        </div>
      </div>
    `

    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-9999px'
    container.style.top = '0'
    container.innerHTML = html
    document.body.appendChild(container)

    try {
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = (canvas.height * pdfW) / canvas.width
      let y = 0
      const pageH = pdf.internal.pageSize.getHeight()
      while (y < pdfH) {
        pdf.addImage(imgData, 'PNG', 0, -y, pdfW, pdfH)
        y += pageH
        if (y < pdfH) pdf.addPage()
      }
      const fecha = new Date().toLocaleDateString('es-CL').replace(/\//g, '-')
      pdf.save(`Calculo_Caucho_${cotNum}_${fecha}.pdf`)
    } finally {
      document.body.removeChild(container)
    }
  }

  return (
    <div className="space-y-5">

      {/* ── SECCIÓN 1: DATOS DEL PROYECTO ─────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700">
            Datos del Proyecto
          </h3>
          {saveStatus === 'saving' && (
            <span className="text-xs text-slate-400 font-medium">Guardando...</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-emerald-600 font-medium">&#128190; Guardado</span>
          )}
        </div>

        {/* Selector cotización */}
        <div className="relative">
          {cotizacionSelec ? (
            <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <span className="text-xs font-semibold text-indigo-700">#{cotizacionSelec.numero}</span>
                <span className="text-xs text-indigo-500 ml-2 truncate">{cotizacionSelec.cliente}</span>
              </div>
              <button onClick={limpiarCot} className="text-indigo-400 hover:text-indigo-600 ml-2 text-sm font-bold shrink-0">✕</button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={cotizacionSearch}
                onChange={e => { setCotizacionSearch(e.target.value); setShowCots(true) }}
                onFocus={() => setShowCots(true)}
                className="input-base pl-8"
                placeholder="Buscar cotización por número o cliente..."
              />
            </div>
          )}
          {showCots && !cotizacionSelec && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {cotFiltradas.length === 0
                ? <p className="text-xs text-slate-400 px-3 py-2">Sin cotizaciones</p>
                : cotFiltradas.slice(0, 20).map(c => (
                  <button key={c.id} onClick={() => seleccionarCot(c)}
                    className="w-full flex justify-between items-center px-3 py-2 text-xs hover:bg-indigo-50 transition-colors text-left gap-2">
                    <span className="font-medium text-slate-700 truncate">#{c.numero} — {c.cliente}</span>
                    <span className="text-slate-400 shrink-0">{c.total ? clp(c.total) : '—'}</span>
                  </button>
                ))
              }
              <button onClick={() => setShowCots(false)}
                className="w-full text-center text-xs text-slate-400 py-1.5 hover:bg-slate-50 border-t border-slate-100">
                Cerrar
              </button>
            </div>
          )}
        </div>

        {/* Fila 1: Cliente | Proyecto | Ubicación | Comuna */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="label-base">Cliente</label>
            <input value={cliente} onChange={e => setCliente(e.target.value)}
              className="input-base" placeholder="Nombre cliente" />
          </div>
          <div>
            <label className="label-base">Proyecto</label>
            <input value={proyecto} onChange={e => setProyecto(e.target.value)}
              className="input-base" placeholder="Nombre proyecto" />
          </div>
          <div>
            <label className="label-base">Ubicación obra</label>
            <input value={ubicacion} onChange={e => setUbicacion(e.target.value)}
              className="input-base" placeholder="Dirección" />
          </div>
          <div>
            <label className="label-base">Comuna</label>
            <input value={comuna} onChange={e => setComuna(e.target.value)}
              className="input-base" placeholder="Comuna" />
          </div>
        </div>

        {/* Fila 2: M² | Altura base | Altura color | Valor M² */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="label-base">M²</label>
            <input type="number" min="0" value={m2 || ''}
              onChange={e => setM2(Number(e.target.value))}
              className="input-base" placeholder="0" />
          </div>
          <div>
            <label className="label-base">Altura base (cm)</label>
            <input type="number" min="0" step="0.1" value={alturaBase || ''}
              onChange={e => setAlturaBase(Number(e.target.value))}
              className="input-base" />
          </div>
          <div>
            <label className="label-base">Altura color (cm)</label>
            <input type="number" min="0" step="0.1" value={alturaColor || ''}
              onChange={e => setAlturaColor(Number(e.target.value))}
              className="input-base" />
          </div>
          <div>
            <label className="label-base">Valor M² (neto venta)</label>
            <input type="number" min="0" value={valorM2 || ''}
              onChange={e => setValorM2(Number(e.target.value))}
              className="input-base" placeholder="0" />
          </div>
        </div>

        {/* Resultados en línea horizontal compacta */}
        <div className="bg-slate-50 rounded-xl px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs items-center">
          <span className="text-slate-500">Total altura: <span className="font-semibold text-slate-700">{totalAltura} cm</span></span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">Valor M²: <span className="font-semibold text-slate-700">{clp(valorM2)}</span></span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">NETO: <span className="font-semibold text-slate-700">{clp(netoVenta)}</span></span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">IVA: <span className="font-semibold text-slate-700">{clp(ivaVenta)}</span></span>
          <span className="text-slate-300">|</span>
          <span className="font-bold text-slate-800">TOTAL BRUTO: {clp(totalVenta)}</span>
        </div>
      </div>

      {/* ── SECCIÓN 2: DOS COLUMNAS ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Columna izquierda: COSTOS MATERIALES */}
        <div className="card p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 border-b border-slate-100 pb-2 mb-4">
            Costos Caucho — Materiales
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 rounded-lg">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Producto</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">$/KG</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">KG</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Total Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {materialesRows.map(row => (
                  <tr key={row.label}>
                    <td className="px-3 py-2.5 text-slate-700 font-medium text-xs leading-tight">
                      <div>{row.label}</div>
                      {row.pct !== undefined && (
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            type="number" min="1" max="100" step="1"
                            value={row.pct}
                            onChange={e => row.setPct(Number(e.target.value))}
                            className="w-12 text-center border border-slate-200 rounded px-1 py-0 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                          <span className="text-xs text-slate-400">%</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="number" min="0"
                        value={row.price}
                        onChange={e => row.setPrice(Number(e.target.value))}
                        className="w-20 text-right border border-slate-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-500 text-xs">{row.kg.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{clp(row.neto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td colSpan={3} className="px-3 py-2 text-sm font-semibold text-slate-700">TOTAL NETO materiales</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800">{clp(totalNetoMat)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-3 py-1.5 text-sm text-slate-500">IVA (19%)</td>
                  <td className="px-3 py-1.5 text-right text-slate-600">{clp(ivaMat)}</td>
                </tr>
                <tr className="bg-slate-50">
                  <td colSpan={3} className="px-3 py-2 text-sm font-bold text-slate-800">TOTAL BRUTO</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800">{clp(totalBrutoMat)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Columna derecha: COSTOS OPERATIVOS */}
        <div className="card p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 border-b border-slate-100 pb-2">
            Costos Operativos
          </h3>

          {/* Fila 1: Días | Ayudantes | Contratados | Bencina */}
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Días trabajo</label>
              <input type="number" min="0" value={dias || ''}
                onChange={e => setDias(Number(e.target.value))}
                className="input-base text-sm py-1" placeholder="0" />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500">Ayudantes</label>
              <input type="number" min="0" value={ayudantes || ''}
                onChange={e => setAyudantes(Number(e.target.value))}
                className="input-base text-sm py-1" placeholder="0" />
              <p className="text-xs text-slate-400">{clp(costoAyudantes)}</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500">Contratados</label>
              <input type="number" min="0" value={contratados || ''}
                onChange={e => setContratados(Number(e.target.value))}
                className="input-base text-sm py-1" placeholder="0" />
              <p className="text-xs text-slate-400">$40.000/día · {clp(costoContratados)}</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500">Bencina $/día</label>
              <input type="number" min="0" value={costoDiaBencina || ''}
                onChange={e => setCostoDiaBencina(Number(e.target.value))}
                className="input-base text-sm py-1" placeholder="30000" />
              <p className="text-xs text-slate-400">{clp(costoBencina)}</p>
            </div>
          </div>

          {/* Fila 2: Viáticos | KM Flete | Precio KM | Viaje */}
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Viáticos $/pers/día</label>
              <input type="number" min="0" value={montoViaticos || ''}
                onChange={e => setMontoViaticos(Number(e.target.value))}
                className="input-base text-sm py-1" placeholder="50000" />
              <p className="text-xs text-slate-400">{clp(costoViaticos)}</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500">KM Flete</label>
              <input type="number" min="0" value={kmTalagante || ''}
                onChange={e => setKmTalagante(Number(e.target.value))}
                className="input-base text-sm py-1" placeholder="0" />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500">Precio KM</label>
              <input type="number" min="0" value={precioKm || ''}
                onChange={e => setPrecioKm(Number(e.target.value))}
                className="input-base text-sm py-1" placeholder="2000" />
              <p className="text-xs text-slate-400">{clp(costoFlete)}</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500">Viaje y otros $</label>
              <input type="number" min="0" value={viaje || ''}
                onChange={e => setViaje(Number(e.target.value))}
                className="input-base text-sm py-1" placeholder="0" />
              <p className="text-xs text-slate-400">{clp(costoViaje)}</p>
            </div>
          </div>

          {/* Resumen horizontal */}
          <div className="bg-slate-50 rounded-xl p-3 flex flex-wrap gap-x-3 gap-y-1 text-xs items-center">
            <span className="text-slate-500">Ayudantes <span className="text-slate-700 font-medium">{clp(costoAyudantes)}</span></span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">Contratados <span className="text-slate-700 font-medium">{clp(costoContratados)}</span></span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">Bencina <span className="text-slate-700 font-medium">{clp(costoBencina)}</span></span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">Viáticos <span className="text-slate-700 font-medium">{clp(costoViaticos)}</span></span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">Flete <span className="text-slate-700 font-medium">{clp(costoFlete)}</span></span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">Viaje <span className="text-slate-700 font-medium">{clp(costoViaje)}</span></span>
            <span className="text-slate-300">|</span>
            <span className="font-bold text-slate-800">TOTAL OPERATIVO: {clp(totalCostosOp)}</span>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 3: COSTOS VS UTILIDAD ──────────────────────────── */}
      <div className="card p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 border-b border-slate-100 pb-3 mb-4">
          Costos vs Utilidad
        </h3>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Bloque INGRESOS */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1.5">Ingresos</p>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Neto venta</span>
              <span className="font-semibold text-slate-800">{clp(netoVenta)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">IVA cobrado</span>
              <span className="text-slate-600">{clp(ivaVenta)}</span>
            </div>
          </div>

          {/* Bloque COSTOS */}
          <div className="bg-red-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-red-400 border-b border-red-100 pb-1.5">Costos</p>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Materiales (bruto c/IVA)</span>
              <span className="text-red-500 font-medium">-{clp(totalNetoMat * 1.19)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Operativos</span>
              <span className="text-red-500 font-medium">-{clp(totalCostosOp)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-red-100 pt-1.5">
              <span className="text-slate-600">Total costos</span>
              <span className="text-red-600">-{clp(totalCostos)}</span>
            </div>
          </div>

          {/* Bloque UTILIDAD BRUTA */}
          <div className={`rounded-xl p-4 space-y-2 ${pctUtilidadBruta > 20 ? 'bg-emerald-50' : pctUtilidadBruta >= 10 ? 'bg-yellow-50' : 'bg-red-50'}`}>
            <p className={`text-xs font-bold uppercase tracking-wider border-b pb-1.5 ${pctUtilidadBruta > 20 ? 'text-emerald-600 border-emerald-100' : pctUtilidadBruta >= 10 ? 'text-yellow-600 border-yellow-100' : 'text-red-400 border-red-100'}`}>Util. Bruta</p>
            <div className="flex justify-between text-sm font-bold">
              <span className="text-slate-600">Utilidad</span>
              <span className={colorUtilBruta}>{clp(utilidadBruta)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">% Utilidad</span>
              <span className={`font-semibold ${colorUtilBruta}`}>{pctUtilidadBruta.toFixed(1)}%</span>
            </div>
            <p className="text-xs text-slate-400 pt-0.5">Neto venta − (Mat. bruto + Operativos)</p>
          </div>

          {/* Bloque UTILIDAD NETA */}
          <div className={`rounded-xl p-4 space-y-1.5 ${pctUtilidadNeta > 20 ? 'bg-emerald-50' : pctUtilidadNeta >= 10 ? 'bg-yellow-50' : 'bg-red-50'}`}>
            <p className={`text-xs font-bold uppercase tracking-wider border-b pb-1.5 ${pctUtilidadNeta > 20 ? 'text-emerald-600 border-emerald-100' : pctUtilidadNeta >= 10 ? 'text-yellow-600 border-yellow-100' : 'text-red-400 border-red-100'}`}>Util. Neta</p>
            <div className="flex justify-between text-xs text-slate-500">
              <span>IVA cobrado</span>
              <span>{clp(ivaVenta)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>IVA crédito fiscal</span>
              <span>-{clp(ivaMat)}</span>
            </div>
            <div className="flex justify-between text-xs font-semibold text-orange-500 border-b border-orange-100 pb-1.5">
              <span>IVA neto SII</span>
              <span>-{clp(ivaNeto)}</span>
            </div>
            <div className="flex justify-between font-bold pt-0.5">
              <span className="text-sm text-slate-600">Utilidad neta</span>
              <span className={`text-base ${colorUtil}`}>{clp(utilidadNeta)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">% Utilidad</span>
              <span className={`font-semibold ${colorUtil}`}>{pctUtilidadNeta.toFixed(1)}%</span>
            </div>
          </div>

        </div>

        {/* Guardar precio real + Exportar PDF */}
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={guardarPrecioReal}
              disabled={!valorM2}
              className="flex-1 py-2 px-4 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Guardar valor real en producto
            </button>
            <button
              onClick={exportarPDF}
              className="py-2 px-4 rounded-lg text-sm font-semibold bg-slate-700 text-white hover:bg-slate-600 transition-colors whitespace-nowrap"
            >
              &#128196; Exportar PDF
            </button>
          </div>
          {saveToast && (
            <p className="text-xs text-center text-emerald-600 font-medium">{saveToast}</p>
          )}
        </div>
      </div>

    </div>
  )
}

/* ── Calculadora de Toldos Vela ──────────────────────────────────── */

function CalculadoraToldos({ onRefresh }) {
  const { user } = useAuth()
  const clp = (n) => formatCLP(Math.round(n))

  const [cliente,    setCliente]    = useState('')
  const [proyecto,   setProyecto]   = useState('')
  const [ubicacion,  setUbicacion]  = useState('')
  const [comuna,     setComuna]     = useState('')
  const [m2Tela,     setM2Tela]     = useState(0)
  const [confeccion, setConfeccion] = useState(0)
  const [valorM2,    setValorM2]    = useState(0)

  const [puntasTotales, setPuntasTotales] = useState(0)
  const [puntasMuro,    setPuntasMuro]    = useState(0)
  const [puntasPoste,   setPuntasPoste]   = useState(0)
  const [usaHormigon,   setUsaHormigon]   = useState(false)
  const [usaArriendo,   setUsaArriendo]   = useState(false)
  const [diasArriendo,  setDiasArriendo]  = useState(1)
  const [precioArriendo, setPrecioArriendo] = useState(50000)

  const [precioTela,     setPrecioTela]     = useState(3000)
  const [precioAnclajes, setPrecioAnclajes] = useState(30000)
  const [precioPlacas,   setPrecioPlacas]   = useState(20000)
  const [precioPostes,   setPrecioPostes]   = useState(150000)
  const [precioHormigon, setPrecioHormigon] = useState(80000)

  const [dias,            setDias]            = useState(0)
  const [ayudantes,       setAyudantes]       = useState(0)
  const [contratados,     setContratados]     = useState(0)
  const [costoDiaBencina, setCostoDiaBencina] = useState(30000)
  const [montoViaticos,   setMontoViaticos]   = useState(50000)
  const [kmFlete,         setKmFlete]         = useState(0)
  const [precioKm,        setPrecioKm]        = useState(2000)
  const [viaje,           setViaje]           = useState(0)
  const [viajeDes,        setViajeDes]        = useState('')

  const [cotizaciones,     setCotizaciones]     = useState([])
  const [cotizacionSearch, setCotizacionSearch] = useState('')
  const [cotizacionSelec,  setCotizacionSelec]  = useState(null)
  const [showCots,         setShowCots]         = useState(false)
  const [calcId,           setCalcId]           = useState(null)
  const [saveStatus,       setSaveStatus]       = useState('idle')
  const [saveToast,        setSaveToast]        = useState('')
  const saveTimerRef   = useRef(null)
  const autoGuardarRef = useRef(null)

  // ── Cálculos materiales ─────────────────────────────────────────
  const netoTela     = m2Tela * precioTela
  const netoConfec   = confeccion
  const netoAnclajes = puntasTotales * precioAnclajes
  const netoPlacas   = puntasMuro * precioPlacas
  const netoPostes   = puntasPoste * precioPostes
  const netoArriendo = (usaArriendo && puntasPoste > 0) ? diasArriendo * precioArriendo : 0
  const netoHormigon = usaHormigon ? puntasPoste * precioHormigon : 0
  const totalNetoMat  = netoTela + netoConfec + netoAnclajes + netoPlacas + netoPostes + netoArriendo + netoHormigon
  const ivaMat        = totalNetoMat * 0.19
  const totalBrutoMat = totalNetoMat + ivaMat

  const netoVenta  = m2Tela * valorM2
  const ivaVenta   = netoVenta * 0.19
  const totalVenta = netoVenta + ivaVenta

  const costoAyudantes   = ayudantes * dias * 28000
  const costoContratados = contratados * dias * 40000
  const costoBencina     = costoDiaBencina * dias
  const costoViaticos    = montoViaticos * contratados * dias
  const costoFlete       = kmFlete * precioKm
  const costoViaje       = viaje
  const totalCostosOp    = costoAyudantes + costoContratados + costoBencina + costoViaticos + costoFlete + costoViaje

  const ivaNeto          = ivaVenta - ivaMat
  const totalCostos      = totalNetoMat + totalCostosOp
  const utilidadBruta    = netoVenta - totalCostos
  const pctUtilidadBruta = netoVenta > 0 ? (utilidadBruta / netoVenta) * 100 : 0
  const colorUtilBruta   = pctUtilidadBruta > 20 ? 'text-emerald-400' : pctUtilidadBruta >= 10 ? 'text-yellow-400' : 'text-red-400'
  const utilidadNeta     = utilidadBruta - ivaNeto
  const pctUtilidadNeta  = netoVenta > 0 ? (utilidadNeta / netoVenta) * 100 : 0
  const colorUtil        = pctUtilidadNeta > 20 ? 'text-emerald-400' : pctUtilidadNeta >= 10 ? 'text-yellow-400' : 'text-red-400'

  const puntasNoCoinciden = puntasTotales > 0 && (puntasMuro + puntasPoste) !== puntasTotales

  useEffect(() => {
    if (!supabase || !user?.empresa_id) return
    supabase.from('cotizaciones').select('id, numero, cliente, direccion, comuna, total')
      .eq('empresa_id', user.empresa_id).order('created_at', { ascending: false })
      .then(({ data }) => setCotizaciones(data || []))
  }, [user?.empresa_id])

  useEffect(() => {
    if (!supabase || !cotizacionSelec) { setCalcId(null); return }
    supabase.from('calculadora_proyectos').select('*')
      .eq('cotizacion_id', cotizacionSelec.id).eq('tipo_producto', 'toldos')
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setCalcId(null); return }
        setCalcId(data.id)
        const d = data.datos || {}
        if (d.m2_tela        != null) setM2Tela(d.m2_tela)
        if (d.confeccion     != null) setConfeccion(d.confeccion)
        if (d.valor_m2       != null) setValorM2(d.valor_m2)
        if (d.puntas_totales != null) setPuntasTotales(d.puntas_totales)
        if (d.puntas_muro    != null) setPuntasMuro(d.puntas_muro)
        if (d.puntas_poste   != null) setPuntasPoste(d.puntas_poste)
        if (d.usa_hormigon    != null) setUsaHormigon(d.usa_hormigon)
        if (d.usa_arriendo    != null) setUsaArriendo(d.usa_arriendo)
        if (d.dias_arriendo   != null) setDiasArriendo(d.dias_arriendo)
        if (d.precio_arriendo != null) setPrecioArriendo(d.precio_arriendo)
        if (d.precio_tela      != null) setPrecioTela(d.precio_tela)
        if (d.precio_anclajes  != null) setPrecioAnclajes(d.precio_anclajes)
        if (d.precio_placas    != null) setPrecioPlacas(d.precio_placas)
        if (d.precio_postes    != null) setPrecioPostes(d.precio_postes)
        if (d.precio_hormigon  != null) setPrecioHormigon(d.precio_hormigon)
        if (d.dias_trabajo     != null) setDias(d.dias_trabajo)
        if (d.ayudantes        != null) setAyudantes(d.ayudantes)
        if (d.contratados      != null) setContratados(d.contratados)
        if (d.bencina_dia      != null) setCostoDiaBencina(d.bencina_dia)
        if (d.viaticos_dia     != null) setMontoViaticos(d.viaticos_dia)
        if (d.km_flete         != null) setKmFlete(d.km_flete)
        if (d.precio_km        != null) setPrecioKm(d.precio_km)
        if (d.viaje_otros      != null) setViaje(d.viaje_otros)
        if (d.descripcion_viaje != null) setViajeDes(d.descripcion_viaje)
        if (d.cliente   != null) setCliente(d.cliente)
        if (d.proyecto  != null) setProyecto(d.proyecto)
        if (d.ubicacion != null) setUbicacion(d.ubicacion)
        if (d.comuna    != null) setComuna(d.comuna)
      })
  }, [cotizacionSelec])

  autoGuardarRef.current = async () => {
    if (!supabase || !cotizacionSelec || !user?.empresa_id) return
    setSaveStatus('saving')
    const datos = {
      m2_tela: m2Tela, confeccion, valor_m2: valorM2,
      puntas_totales: puntasTotales, puntas_muro: puntasMuro, puntas_poste: puntasPoste,
      usa_hormigon: usaHormigon,
      usa_arriendo: usaArriendo, dias_arriendo: diasArriendo, precio_arriendo: precioArriendo,
      precio_tela: precioTela, precio_anclajes: precioAnclajes,
      precio_placas: precioPlacas, precio_postes: precioPostes, precio_hormigon: precioHormigon,
      dias_trabajo: dias, ayudantes, contratados, bencina_dia: costoDiaBencina,
      viaticos_dia: montoViaticos, km_flete: kmFlete, precio_km: precioKm,
      viaje_otros: viaje, descripcion_viaje: viajeDes,
      cliente, proyecto, ubicacion, comuna,
    }
    const resultados = {
      neto_tela: netoTela, neto_confeccion: netoConfec, neto_anclajes: netoAnclajes,
      neto_placas: netoPlacas, neto_postes: netoPostes, neto_arriendo: netoArriendo, neto_hormigon: netoHormigon,
      total_neto_materiales: totalNetoMat, iva_materiales: ivaMat, total_bruto_materiales: totalBrutoMat,
      total_operativo: totalCostosOp,
      ayudantes_total: costoAyudantes, contratados_total: costoContratados,
      bencina_total: costoBencina, viaticos_total: costoViaticos,
      flete_total: costoFlete, viaje_total: costoViaje,
      neto_venta: netoVenta, iva_venta: ivaVenta, total_bruto_venta: totalVenta,
      utilidad_bruta: utilidadBruta, pct_utilidad_bruta: pctUtilidadBruta,
      iva_neto_sii: ivaNeto, utilidad_neta: utilidadNeta, pct_utilidad_neta: pctUtilidadNeta,
    }
    let error
    if (calcId) {
      ;({ error } = await supabase.from('calculadora_proyectos')
        .update({ datos, resultados, updated_at: new Date().toISOString() }).eq('id', calcId))
    } else {
      const { data: ins, error: err } = await supabase.from('calculadora_proyectos')
        .insert({
          empresa_id: user.empresa_id, cotizacion_id: cotizacionSelec.id,
          cotizacion_numero: cotizacionSelec.numero, tipo_producto: 'toldos',
          nombre_calculo: `${cliente || cotizacionSelec.cliente} - ${proyecto || cotizacionSelec.numero}`,
          datos, resultados,
        }).select('id').single()
      error = err
      if (!error && ins) setCalcId(ins.id)
    }
    setSaveStatus(error ? 'idle' : 'saved')
    if (!error) setTimeout(() => setSaveStatus('idle'), 2500)
  }

  useEffect(() => {
    if (!cotizacionSelec) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { autoGuardarRef.current?.() }, 600)
    return () => clearTimeout(saveTimerRef.current)
  }, [
    cotizacionSelec, m2Tela, confeccion, valorM2,
    puntasTotales, puntasMuro, puntasPoste, usaHormigon, usaArriendo, diasArriendo, precioArriendo,
    precioTela, precioAnclajes, precioPlacas, precioPostes, precioHormigon,
    dias, ayudantes, contratados, costoDiaBencina,
    montoViaticos, kmFlete, precioKm, viaje, viajeDes,
    cliente, proyecto, ubicacion, comuna,
  ])

  const cotFiltradas = cotizaciones.filter(c =>
    !cotizacionSearch ||
    String(c.numero || '').toLowerCase().includes(cotizacionSearch.toLowerCase()) ||
    (c.cliente || '').toLowerCase().includes(cotizacionSearch.toLowerCase())
  )
  const seleccionarCot = (c) => {
    setCotizacionSelec(c); setCliente(c.cliente || '')
    setProyecto(c.numero ? String(c.numero) : '')
    setUbicacion(c.direccion || ''); setComuna(c.comuna || '')
    setShowCots(false); setCotizacionSearch('')
  }
  const limpiarCot = () => {
    setCotizacionSelec(null)
    setCliente(''); setProyecto(''); setUbicacion(''); setComuna('')
  }

  const guardarPrecioReal = async () => {
    if (!supabase || !user?.empresa_id || !valorM2) return
    const { error } = await supabase.from('productos')
      .update({ precio_real: valorM2 }).eq('empresa_id', user.empresa_id).ilike('nombre', 'TOLDOS VELA')
    if (!error) {
      setSaveToast(`Valor real guardado: ${clp(valorM2)}/m²`)
      setTimeout(() => setSaveToast(''), 3500)
      onRefresh?.()
    }
  }

  const exportarPDF = async () => {
    const { default: jsPDF }       = await import('jspdf')
    const { default: html2canvas } = await import('html2canvas')
    const fechaHoy = new Date().toLocaleDateString('es-CL')
    const cotNum   = cotizacionSelec?.numero ? `COT-${cotizacionSelec.numero}` : 'SIN-COT'
    const f        = (n) => formatCLP(Math.round(n))
    const matRows  = [
      { label: 'Tela HDPE',           cant: `${m2Tela} m²`,   precio: `${f(precioTela)}/m²`, total: f(netoTela) },
      { label: 'Confección tela',      cant: '—',              precio: '—',                    total: f(netoConfec) },
      { label: 'Kit anclajes',         cant: puntasTotales,    precio: f(precioAnclajes),      total: f(netoAnclajes) },
      { label: 'Placas anclaje muro',  cant: puntasMuro,       precio: f(precioPlacas),        total: f(netoPlacas) },
      { label: 'Postes (c/soldadura)', cant: puntasPoste,      precio: f(precioPostes),        total: f(netoPostes) },
      ...(usaArriendo && puntasPoste > 0 ? [{ label: 'Arriendo máquina (postes)', cant: `${diasArriendo} días`, precio: `${f(precioArriendo)}/día`, total: f(netoArriendo) }] : []),
      ...(usaHormigon ? [{ label: 'Hormigón', cant: puntasPoste, precio: `${f(precioHormigon)}/m³`, total: f(netoHormigon) }] : []),
    ]
    const html = `<div style="font-family:Arial,sans-serif;font-size:12px;color:#1e293b;padding:32px;width:800px;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:2px solid #4f46e5;padding-bottom:14px;">
        <div><div style="font-size:22px;font-weight:900;color:#4f46e5;letter-spacing:2px;">MAMKAM</div><div style="font-size:16px;font-weight:700;margin-top:4px;">ANÁLISIS DE COSTOS — TOLDOS VELA</div></div>
        <div style="text-align:right;font-size:11px;color:#64748b;"><div>N° ${cotNum}</div><div>Fecha: ${fechaHoy}</div></div>
      </div>
      <div style="background:#f8fafc;border-radius:8px;padding:14px;margin-bottom:16px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#4f46e5;letter-spacing:1px;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">Datos del Proyecto</div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <tr><td style="width:15%;color:#64748b;padding:3px 0;">Cliente:</td><td style="width:35%;font-weight:600;">${cliente||'—'}</td><td style="width:15%;color:#64748b;">Proyecto:</td><td style="width:35%;font-weight:600;">${proyecto||'—'}</td></tr>
          <tr><td style="color:#64748b;padding:3px 0;">Ubicación:</td><td>${ubicacion||'—'}</td><td style="color:#64748b;">Comuna:</td><td>${comuna||'—'}</td></tr>
          <tr><td style="color:#64748b;padding:3px 0;">M² tela:</td><td><strong>${m2Tela}</strong></td><td style="color:#64748b;">Puntas:</td><td><strong>${puntasTotales} total (${puntasMuro} muro / ${puntasPoste} poste)</strong></td></tr>
        </table>
      </div>
      <div style="margin-bottom:16px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#4f46e5;letter-spacing:1px;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">Costos de Materiales</div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead><tr style="background:#f1f5f9;"><th style="text-align:left;padding:7px 10px;color:#64748b;font-weight:600;">Material</th><th style="text-align:right;padding:7px 10px;color:#64748b;font-weight:600;">Cantidad</th><th style="text-align:right;padding:7px 10px;color:#64748b;font-weight:600;">Precio unit.</th><th style="text-align:right;padding:7px 10px;color:#64748b;font-weight:600;">Total</th></tr></thead>
          <tbody>${matRows.map(r => `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:7px 10px;">${r.label}</td><td style="padding:7px 10px;text-align:right;">${r.cant}</td><td style="padding:7px 10px;text-align:right;">${r.precio}</td><td style="padding:7px 10px;text-align:right;font-weight:600;">${r.total}</td></tr>`).join('')}</tbody>
          <tfoot>
            <tr style="border-top:2px solid #cbd5e1;"><td colspan="3" style="padding:8px 10px;font-weight:700;">TOTAL NETO materiales</td><td style="padding:8px 10px;text-align:right;font-weight:700;">${f(totalNetoMat)}</td></tr>
            <tr><td colspan="3" style="padding:5px 10px;color:#64748b;">IVA (19%)</td><td style="padding:5px 10px;text-align:right;color:#64748b;">${f(ivaMat)}</td></tr>
            <tr style="background:#f1f5f9;"><td colspan="3" style="padding:8px 10px;font-weight:700;">TOTAL BRUTO</td><td style="padding:8px 10px;text-align:right;font-weight:700;">${f(totalBrutoMat)}</td></tr>
          </tfoot>
        </table>
      </div>
      <div style="margin-bottom:16px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#4f46e5;letter-spacing:1px;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">Costos Operativos</div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead><tr style="background:#f1f5f9;"><th style="text-align:left;padding:7px 10px;color:#64748b;font-weight:600;">Concepto</th><th style="text-align:left;padding:7px 10px;color:#64748b;font-weight:600;">Detalle</th><th style="text-align:right;padding:7px 10px;color:#64748b;font-weight:600;">Total</th></tr></thead>
          <tbody>
            <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:7px 10px;">Ayudantes</td><td style="padding:7px 10px;color:#64748b;">${ayudantes} × ${dias} días × $28.000</td><td style="padding:7px 10px;text-align:right;font-weight:600;">${f(costoAyudantes)}</td></tr>
            <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:7px 10px;">Contratados</td><td style="padding:7px 10px;color:#64748b;">${contratados} × ${dias} días × $40.000</td><td style="padding:7px 10px;text-align:right;font-weight:600;">${f(costoContratados)}</td></tr>
            <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:7px 10px;">Bencina</td><td style="padding:7px 10px;color:#64748b;">${dias} días × ${f(costoDiaBencina)}</td><td style="padding:7px 10px;text-align:right;font-weight:600;">${f(costoBencina)}</td></tr>
            <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:7px 10px;">Viáticos</td><td style="padding:7px 10px;color:#64748b;">${contratados} pers × ${dias} días × ${f(montoViaticos)}</td><td style="padding:7px 10px;text-align:right;font-weight:600;">${f(costoViaticos)}</td></tr>
            <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:7px 10px;">Flete</td><td style="padding:7px 10px;color:#64748b;">${kmFlete} km × ${f(precioKm)}</td><td style="padding:7px 10px;text-align:right;font-weight:600;">${f(costoFlete)}</td></tr>
            <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:7px 10px;">Viaje y otros</td><td style="padding:7px 10px;color:#64748b;">${viajeDes||'—'}</td><td style="padding:7px 10px;text-align:right;font-weight:600;">${f(costoViaje)}</td></tr>
          </tbody>
          <tfoot><tr style="border-top:2px solid #cbd5e1;"><td colspan="2" style="padding:8px 10px;font-weight:700;">TOTAL OPERATIVO</td><td style="padding:8px 10px;text-align:right;font-weight:700;">${f(totalCostosOp)}</td></tr></tfoot>
        </table>
      </div>
      <div style="background:#f8fafc;border-radius:8px;padding:14px;margin-bottom:20px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#4f46e5;letter-spacing:1px;margin-bottom:10px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">Resumen Financiero</div>
        <table style="width:50%;border-collapse:collapse;font-size:11px;">
          <tr><td style="padding:4px 0;color:#64748b;">Neto venta</td><td style="text-align:right;font-weight:600;">${f(netoVenta)}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;">Costos materiales</td><td style="text-align:right;color:#ef4444;">-${f(totalNetoMat)}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;">Costos operativos</td><td style="text-align:right;color:#ef4444;">-${f(totalCostosOp)}</td></tr>
          <tr style="border-top:1px solid #e2e8f0;"><td style="padding:4px 0;color:#64748b;">Total costos</td><td style="text-align:right;color:#ef4444;font-weight:600;">-${f(totalCostos)}</td></tr>
          <tr style="border-top:1px solid #e2e8f0;"><td style="padding:4px 0;font-weight:700;">Utilidad bruta</td><td style="text-align:right;font-weight:700;color:${pctUtilidadBruta>20?'#059669':pctUtilidadBruta>=10?'#ca8a04':'#ef4444'};">${f(utilidadBruta)} (${pctUtilidadBruta.toFixed(1)}%)</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;">IVA neto SII</td><td style="text-align:right;color:#f97316;">-${f(ivaNeto)}</td></tr>
          <tr style="border-top:2px solid #cbd5e1;"><td style="padding:6px 0;font-weight:700;font-size:13px;">Utilidad neta</td><td style="text-align:right;font-weight:700;font-size:13px;color:${pctUtilidadNeta>20?'#059669':pctUtilidadNeta>=10?'#ca8a04':'#ef4444'};">${f(utilidadNeta)} (${pctUtilidadNeta.toFixed(1)}%)</td></tr>
        </table>
      </div>
      <div style="border-top:1px solid #e2e8f0;padding-top:10px;text-align:center;color:#94a3b8;font-size:10px;">Documento generado por ERP MAMKAM · ${new Date().toLocaleString('es-CL')}</div>
    </div>`
    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;left:-9999px;top:0;'
    container.innerHTML = html
    document.body.appendChild(container)
    try {
      const canvas  = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png')
      const pdf     = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
      const pdfW    = pdf.internal.pageSize.getWidth()
      const pdfH    = (canvas.height * pdfW) / canvas.width
      let y = 0; const pageH = pdf.internal.pageSize.getHeight()
      while (y < pdfH) { pdf.addImage(imgData, 'PNG', 0, -y, pdfW, pdfH); y += pageH; if (y < pdfH) pdf.addPage() }
      pdf.save(`Calculo_Toldos_${cotNum}_${new Date().toLocaleDateString('es-CL').replace(/\//g,'-')}.pdf`)
    } finally { document.body.removeChild(container) }
  }

  return (
    <div className="space-y-5">

      {/* ── SECCIÓN 1: DATOS ───────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700">Datos del Proyecto</h3>
          {saveStatus === 'saving' && <span className="text-xs text-slate-400 font-medium">Guardando...</span>}
          {saveStatus === 'saved'  && <span className="text-xs text-emerald-600 font-medium">&#128190; Guardado</span>}
        </div>

        {/* Selector cotización */}
        <div className="relative">
          {cotizacionSelec ? (
            <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <span className="text-xs font-semibold text-indigo-700">#{cotizacionSelec.numero}</span>
                <span className="text-xs text-indigo-500 ml-2">{cotizacionSelec.cliente}</span>
              </div>
              <button onClick={limpiarCot} className="text-indigo-400 hover:text-indigo-600 ml-2 text-sm font-bold shrink-0">✕</button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input value={cotizacionSearch}
                onChange={e => { setCotizacionSearch(e.target.value); setShowCots(true) }}
                onFocus={() => setShowCots(true)}
                className="input-base pl-8" placeholder="Buscar cotización por número o cliente..." />
            </div>
          )}
          {showCots && !cotizacionSelec && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {cotFiltradas.length === 0
                ? <p className="text-xs text-slate-400 px-3 py-2">Sin cotizaciones</p>
                : cotFiltradas.slice(0, 20).map(c => (
                  <button key={c.id} onClick={() => seleccionarCot(c)}
                    className="w-full flex justify-between items-center px-3 py-2 text-xs hover:bg-indigo-50 transition-colors text-left gap-2">
                    <span className="font-medium text-slate-700 truncate">#{c.numero} — {c.cliente}</span>
                    <span className="text-slate-400 shrink-0">{c.total ? clp(c.total) : '—'}</span>
                  </button>
                ))
              }
              <button onClick={() => setShowCots(false)}
                className="w-full text-center text-xs text-slate-400 py-1.5 hover:bg-slate-50 border-t border-slate-100">Cerrar</button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><label className="label-base">Cliente</label><input value={cliente} onChange={e => setCliente(e.target.value)} className="input-base" placeholder="Nombre cliente" /></div>
          <div><label className="label-base">Proyecto</label><input value={proyecto} onChange={e => setProyecto(e.target.value)} className="input-base" placeholder="Nombre proyecto" /></div>
          <div><label className="label-base">Ubicación obra</label><input value={ubicacion} onChange={e => setUbicacion(e.target.value)} className="input-base" placeholder="Dirección" /></div>
          <div><label className="label-base">Comuna</label><input value={comuna} onChange={e => setComuna(e.target.value)} className="input-base" placeholder="Comuna" /></div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div><label className="label-base">M² tela</label><input type="number" min="0" value={m2Tela||''} onChange={e => setM2Tela(Number(e.target.value))} className="input-base" placeholder="0" /></div>
          <div><label className="label-base">Confección tela ($)</label><input type="number" min="0" value={confeccion||''} onChange={e => setConfeccion(Number(e.target.value))} className="input-base" placeholder="0" /></div>
          <div><label className="label-base">Valor M² venta (neto)</label><input type="number" min="0" value={valorM2||''} onChange={e => setValorM2(Number(e.target.value))} className="input-base" placeholder="0" /></div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div><label className="label-base">Puntas totales</label><input type="number" min="0" value={puntasTotales||''} onChange={e => setPuntasTotales(Number(e.target.value))} className="input-base" placeholder="0" /></div>
          <div><label className="label-base">Puntas a muro</label><input type="number" min="0" value={puntasMuro||''} onChange={e => setPuntasMuro(Number(e.target.value))} className="input-base" placeholder="0" /></div>
          <div><label className="label-base">Puntas a poste</label><input type="number" min="0" value={puntasPoste||''} onChange={e => setPuntasPoste(Number(e.target.value))} className="input-base" placeholder="0" /></div>
        </div>
        {puntasNoCoinciden && (
          <div className="text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            ⚠️ Las puntas no cuadran: {puntasMuro} muro + {puntasPoste} poste = {puntasMuro + puntasPoste} (deben sumar {puntasTotales})
          </div>
        )}

        <div className="bg-slate-50 rounded-xl px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs items-center">
          <span className="text-slate-500">M² tela: <span className="font-semibold text-slate-700">{m2Tela}</span></span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">Valor M²: <span className="font-semibold text-slate-700">{clp(valorM2)}</span></span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">NETO: <span className="font-semibold text-slate-700">{clp(netoVenta)}</span></span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">IVA: <span className="font-semibold text-slate-700">{clp(ivaVenta)}</span></span>
          <span className="text-slate-300">|</span>
          <span className="font-bold text-slate-800">TOTAL BRUTO: {clp(totalVenta)}</span>
        </div>
      </div>

      {/* ── SECCIÓN 2: DOS COLUMNAS ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Materiales */}
        <div className="card p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 border-b border-slate-100 pb-2 mb-4">Costos Toldos — Materiales</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Material</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Cant.</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Precio unit.</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Total Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <tr>
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-700">Tela HDPE</td>
                  <td className="px-3 py-2.5 text-right text-xs text-slate-500">{m2Tela} m²</td>
                  <td className="px-3 py-2.5 text-right"><input type="number" min="0" value={precioTela} onChange={e => setPrecioTela(Number(e.target.value))} className="w-20 text-right border border-slate-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" /></td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-800 text-xs">{clp(netoTela)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-700">Confección tela</td>
                  <td className="px-3 py-2.5 text-right text-xs text-slate-400">—</td>
                  <td className="px-3 py-2.5 text-right text-xs text-slate-400">—</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-800 text-xs">{clp(netoConfec)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-700">Kit anclajes</td>
                  <td className="px-3 py-2.5 text-right text-xs text-slate-500">{puntasTotales}</td>
                  <td className="px-3 py-2.5 text-right"><input type="number" min="0" value={precioAnclajes} onChange={e => setPrecioAnclajes(Number(e.target.value))} className="w-20 text-right border border-slate-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" /></td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-800 text-xs">{clp(netoAnclajes)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-700">Placas anclaje muro</td>
                  <td className="px-3 py-2.5 text-right text-xs text-slate-500">{puntasMuro}</td>
                  <td className="px-3 py-2.5 text-right"><input type="number" min="0" value={precioPlacas} onChange={e => setPrecioPlacas(Number(e.target.value))} className="w-20 text-right border border-slate-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" /></td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-800 text-xs">{clp(netoPlacas)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-700 leading-tight"><div>Postes</div><div className="text-slate-400 font-normal text-xs">(incl. soldadura $50.000)</div></td>
                  <td className="px-3 py-2.5 text-right text-xs text-slate-500">{puntasPoste}</td>
                  <td className="px-3 py-2.5 text-right"><input type="number" min="0" value={precioPostes} onChange={e => setPrecioPostes(Number(e.target.value))} className="w-20 text-right border border-slate-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" /></td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-800 text-xs">{clp(netoPostes)}</td>
                </tr>
                {puntasPoste > 0 && (
                <tr className={usaArriendo ? '' : 'opacity-50'}>
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-700">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setUsaArriendo(v => !v)}
                        className={`w-8 h-4 rounded-full transition-colors relative flex-shrink-0 ${usaArriendo ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                        <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${usaArriendo ? 'left-4' : 'left-0.5'}`} />
                      </button>
                      Arriendo máquina (postes)
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {usaArriendo
                      ? <input type="number" min="1" value={diasArriendo} onChange={e => setDiasArriendo(Number(e.target.value))}
                          className="w-16 text-right border border-slate-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          placeholder="días" />
                      : <span className="text-xs text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {usaArriendo
                      ? <input type="number" min="0" value={precioArriendo} onChange={e => setPrecioArriendo(Number(e.target.value))}
                          className="w-20 text-right border border-slate-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                      : <span className="text-xs text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-800 text-xs">{usaArriendo ? clp(netoArriendo) : '—'}</td>
                </tr>
                )}
                <tr className={usaHormigon ? '' : 'opacity-50'}>
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-700">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setUsaHormigon(v => !v)}
                        className={`w-8 h-4 rounded-full transition-colors relative flex-shrink-0 ${usaHormigon ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                        <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${usaHormigon ? 'left-4' : 'left-0.5'}`} />
                      </button>
                      Hormigón
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-slate-500">{usaHormigon ? puntasPoste : '—'}</td>
                  <td className="px-3 py-2.5 text-right">
                    {usaHormigon
                      ? <input type="number" min="0" value={precioHormigon} onChange={e => setPrecioHormigon(Number(e.target.value))} className="w-20 text-right border border-slate-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                      : <span className="text-xs text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-800 text-xs">{usaHormigon ? clp(netoHormigon) : '—'}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200"><td colSpan={3} className="px-3 py-2 text-sm font-semibold text-slate-700">TOTAL NETO materiales</td><td className="px-3 py-2 text-right font-bold text-slate-800">{clp(totalNetoMat)}</td></tr>
                <tr><td colSpan={3} className="px-3 py-1.5 text-sm text-slate-500">IVA (19%)</td><td className="px-3 py-1.5 text-right text-slate-600">{clp(ivaMat)}</td></tr>
                <tr className="bg-slate-50"><td colSpan={3} className="px-3 py-2 text-sm font-bold text-slate-800">TOTAL BRUTO</td><td className="px-3 py-2 text-right font-bold text-slate-800">{clp(totalBrutoMat)}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Operativos */}
        <div className="card p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 border-b border-slate-100 pb-2">Costos Operativos</h3>
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1"><label className="text-xs text-slate-500">Días trabajo</label><input type="number" min="0" value={dias||''} onChange={e => setDias(Number(e.target.value))} className="input-base text-sm py-1" placeholder="0" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-500">Ayudantes</label><input type="number" min="0" value={ayudantes||''} onChange={e => setAyudantes(Number(e.target.value))} className="input-base text-sm py-1" placeholder="0" /><p className="text-xs text-slate-400">{clp(costoAyudantes)}</p></div>
            <div className="space-y-1"><label className="text-xs text-slate-500">Contratados</label><input type="number" min="0" value={contratados||''} onChange={e => setContratados(Number(e.target.value))} className="input-base text-sm py-1" placeholder="0" /><p className="text-xs text-slate-400">$40.000/día · {clp(costoContratados)}</p></div>
            <div className="space-y-1"><label className="text-xs text-slate-500">Bencina $/día</label><input type="number" min="0" value={costoDiaBencina||''} onChange={e => setCostoDiaBencina(Number(e.target.value))} className="input-base text-sm py-1" placeholder="30000" /><p className="text-xs text-slate-400">{clp(costoBencina)}</p></div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1"><label className="text-xs text-slate-500">Viáticos $/pers/día</label><input type="number" min="0" value={montoViaticos||''} onChange={e => setMontoViaticos(Number(e.target.value))} className="input-base text-sm py-1" placeholder="50000" /><p className="text-xs text-slate-400">{clp(costoViaticos)}</p></div>
            <div className="space-y-1"><label className="text-xs text-slate-500">KM Flete</label><input type="number" min="0" value={kmFlete||''} onChange={e => setKmFlete(Number(e.target.value))} className="input-base text-sm py-1" placeholder="0" /></div>
            <div className="space-y-1"><label className="text-xs text-slate-500">Precio KM</label><input type="number" min="0" value={precioKm||''} onChange={e => setPrecioKm(Number(e.target.value))} className="input-base text-sm py-1" placeholder="2000" /><p className="text-xs text-slate-400">{clp(costoFlete)}</p></div>
            <div className="space-y-1"><label className="text-xs text-slate-500">Viaje y otros $</label><input type="number" min="0" value={viaje||''} onChange={e => setViaje(Number(e.target.value))} className="input-base text-sm py-1" placeholder="0" /><p className="text-xs text-slate-400">{clp(costoViaje)}</p></div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 flex flex-wrap gap-x-3 gap-y-1 text-xs items-center">
            <span className="text-slate-500">Ayudantes <span className="text-slate-700 font-medium">{clp(costoAyudantes)}</span></span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">Contratados <span className="text-slate-700 font-medium">{clp(costoContratados)}</span></span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">Bencina <span className="text-slate-700 font-medium">{clp(costoBencina)}</span></span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">Viáticos <span className="text-slate-700 font-medium">{clp(costoViaticos)}</span></span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">Flete <span className="text-slate-700 font-medium">{clp(costoFlete)}</span></span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">Viaje <span className="text-slate-700 font-medium">{clp(costoViaje)}</span></span>
            <span className="text-slate-300">|</span>
            <span className="font-bold text-slate-800">TOTAL: {clp(totalCostosOp)}</span>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 3: COSTOS VS UTILIDAD ──────────────────────────── */}
      <div className="card p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 border-b border-slate-100 pb-3 mb-4">Costos vs Utilidad</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1.5">Ingresos</p>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Neto venta</span><span className="font-semibold text-slate-800">{clp(netoVenta)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">IVA cobrado</span><span className="text-slate-600">{clp(ivaVenta)}</span></div>
          </div>
          <div className="bg-red-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-red-400 border-b border-red-100 pb-1.5">Costos</p>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Materiales</span><span className="text-red-500 font-medium">-{clp(totalNetoMat)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Operativos</span><span className="text-red-500 font-medium">-{clp(totalCostosOp)}</span></div>
            <div className="flex justify-between text-sm font-bold border-t border-red-100 pt-1.5"><span className="text-slate-600">Total costos</span><span className="text-red-600">-{clp(totalCostos)}</span></div>
          </div>
          <div className={`rounded-xl p-4 space-y-2 ${pctUtilidadBruta>20?'bg-emerald-50':pctUtilidadBruta>=10?'bg-yellow-50':'bg-red-50'}`}>
            <p className={`text-xs font-bold uppercase tracking-wider border-b pb-1.5 ${pctUtilidadBruta>20?'text-emerald-600 border-emerald-100':pctUtilidadBruta>=10?'text-yellow-600 border-yellow-100':'text-red-400 border-red-100'}`}>Util. Bruta</p>
            <div className="flex justify-between text-sm font-bold"><span className="text-slate-600">Utilidad</span><span className={colorUtilBruta}>{clp(utilidadBruta)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">% Utilidad</span><span className={`font-semibold ${colorUtilBruta}`}>{pctUtilidadBruta.toFixed(1)}%</span></div>
          </div>
          <div className={`rounded-xl p-4 space-y-1.5 ${pctUtilidadNeta>20?'bg-emerald-50':pctUtilidadNeta>=10?'bg-yellow-50':'bg-red-50'}`}>
            <p className={`text-xs font-bold uppercase tracking-wider border-b pb-1.5 ${pctUtilidadNeta>20?'text-emerald-600 border-emerald-100':pctUtilidadNeta>=10?'text-yellow-600 border-yellow-100':'text-red-400 border-red-100'}`}>Util. Neta</p>
            <div className="flex justify-between text-xs text-slate-500"><span>IVA cobrado</span><span>{clp(ivaVenta)}</span></div>
            <div className="flex justify-between text-xs text-slate-500"><span>IVA crédito fiscal</span><span>-{clp(ivaMat)}</span></div>
            <div className="flex justify-between text-xs font-semibold text-orange-500 border-b border-orange-100 pb-1.5"><span>IVA neto SII</span><span>-{clp(ivaNeto)}</span></div>
            <div className="flex justify-between font-bold pt-0.5"><span className="text-sm text-slate-600">Utilidad neta</span><span className={`text-base ${colorUtil}`}>{clp(utilidadNeta)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">% Utilidad</span><span className={`font-semibold ${colorUtil}`}>{pctUtilidadNeta.toFixed(1)}%</span></div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
          <div className="flex gap-2">
            <button onClick={guardarPrecioReal} disabled={!valorM2}
              className="flex-1 py-2 px-4 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Guardar valor real en producto
            </button>
            <button onClick={exportarPDF}
              className="py-2 px-4 rounded-lg text-sm font-semibold bg-slate-700 text-white hover:bg-slate-600 transition-colors whitespace-nowrap">
              &#128196; Exportar PDF
            </button>
          </div>
          {saveToast && <p className="text-xs text-center text-emerald-600 font-medium">{saveToast}</p>}
        </div>
      </div>

    </div>
  )
}

/* ── Página principal ────────────────────────────────────────────── */

export default function ProductosPage() {
  const { user } = useAuth()
  const empresaId = user?.empresa_id

  const [activeTab,        setActiveTab]        = useState('productos')
  const [productos,        setProductos]        = useState([])
  const [loading,          setLoading]          = useState(true)
  const [search,           setSearch]           = useState('')
  const [showForm,         setShowForm]         = useState(false)
  const [editingProducto,  setEditingProducto]  = useState(null)
  const [form,             setForm]             = useState(FORM_EMPTY)
  const [saving,           setSaving]           = useState(false)
  const [confirmDeleteId,  setConfirmDeleteId]  = useState(null)
  const [precioRefEdits,   setPrecioRefEdits]   = useState({})
  const [precioRefSaved,   setPrecioRefSaved]   = useState(null)

  const cargar = useCallback(async () => {
    if (!supabase || !empresaId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('productos').select('*').eq('empresa_id', empresaId).order('nombre')
      if (error) throw error
      setProductos(data || [])
    } finally { setLoading(false) }
  }, [empresaId])

  useEffect(() => { cargar() }, [cargar])

  const openNew = () => { setEditingProducto(null); setForm(FORM_EMPTY); setShowForm(true) }
  const openEdit = (p) => {
    setEditingProducto(p)
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      categoria: p.categoria || 'Instalación',
      unidad_medida: p.unidad_medida || 'unidad',
      precio_referencia: p.precio_referencia != null ? String(p.precio_referencia) : '',
      activo: p.activo ?? true,
    })
    setShowForm(true)
  }

  const handleGuardar = async () => {
    if (!form.nombre.trim() || !supabase) return
    setSaving(true)
    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      categoria: form.categoria,
      unidad_medida: form.unidad_medida,
      precio_referencia: form.precio_referencia ? parseInt(form.precio_referencia) : null,
      activo: form.activo,
      empresa_id: empresaId,
    }
    try {
      if (editingProducto) {
        await supabase.from('productos').update(payload).eq('id', editingProducto.id)
      } else {
        await supabase.from('productos').insert(payload)
      }
      setShowForm(false); setEditingProducto(null); setForm(FORM_EMPTY); cargar()
    } finally { setSaving(false) }
  }

  const guardarPrecioRefBlur = async (id, valor) => {
    if (!supabase || precioRefEdits[id] === undefined) return
    await supabase.from('productos').update({ precio_referencia: parseInt(valor) || null }).eq('id', id)
    setPrecioRefEdits(prev => { const n = { ...prev }; delete n[id]; return n })
    setPrecioRefSaved(id)
    setTimeout(() => setPrecioRefSaved(s => s === id ? null : s), 2000)
    cargar()
  }

  const handleToggle = async (p) => {
    if (!supabase) return
    await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id)
    cargar()
  }

  const handleDelete = async (id) => {
    if (!supabase) return
    const prodNombre = productos.find(p => p.id === id)?.nombre
    if (prodNombre) {
      const { data } = await supabase
        .from('cotizaciones').select('id').contains('productos_asociados', [prodNombre]).limit(1)
      if (data?.length) {
        alert('No se puede eliminar: este producto está asociado a cotizaciones.')
        setConfirmDeleteId(null); return
      }
    }
    await supabase.from('productos').delete().eq('id', id)
    setConfirmDeleteId(null); cargar()
  }

  const filtered = productos.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (p.categoria || '').toLowerCase().includes(search.toLowerCase())
  )

  const [calcTab, setCalcTab] = useState('caucho')

  const TABS = [
    { id: 'productos',    label: 'Productos',    icon: Package },
    { id: 'calculadora',  label: 'Calculadora',  icon: Calculator },
  ]

  const CALC_TABS = [
    { id: 'caucho', label: 'Caucho Continuo' },
    { id: 'toldos', label: 'Toldos Vela' },
    { id: 'pasto',  label: 'Pasto Sintético' },
  ]

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Productos</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {productos.length} producto{productos.length !== 1 ? 's' : ''} registrado{productos.length !== 1 ? 's' : ''}
          </p>
        </div>
        {activeTab === 'productos' && (
          <button onClick={openNew} className="btn-primary">
            <Plus className="w-4 h-4" />Agregar producto
          </button>
        )}
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {activeTab === 'productos' && (
        <>
          <div className="card p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o categoría..." className="input-base pl-9" />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin mr-2" />
              <span className="text-sm text-slate-500">Cargando...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <Package className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">
                {search ? 'Sin resultados para tu búsqueda' : 'Sin productos registrados'}
              </p>
              {!search && (
                <>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Agrega los productos y servicios que ofrece tu empresa para usarlos en cotizaciones y visitas.
                  </p>
                  <button onClick={openNew} className="btn-primary mt-4">
                    <Plus className="w-4 h-4" />Agregar producto
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="table-th">Nombre</th>
                    <th className="table-th hidden md:table-cell">Categoría</th>
                    <th className="table-th hidden md:table-cell">Unidad</th>
                    <th className="table-th hidden sm:table-cell">Precios</th>
                    <th className="table-th text-center">Estado</th>
                    <th className="table-th text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(p => (
                    <tr key={p.id} className={`hover:bg-slate-50/80 transition-colors ${!p.activo ? 'opacity-50' : ''}`}>
                      <td className="table-td">
                        <div className="font-medium text-slate-800">{p.nombre}</div>
                        {p.descripcion && <div className="text-xs text-slate-400 truncate max-w-[220px]">{p.descripcion}</div>}
                      </td>
                      <td className="table-td hidden md:table-cell">
                        {p.categoria
                          ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">{p.categoria}</span>
                          : '—'}
                      </td>
                      <td className="table-td hidden md:table-cell text-xs text-slate-500">{p.unidad_medida || '—'}</td>
                      <td className="table-td hidden sm:table-cell">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <input
                              type="number" min="0"
                              value={precioRefEdits[p.id] ?? (p.precio_referencia ?? '')}
                              onChange={e => setPrecioRefEdits(prev => ({ ...prev, [p.id]: e.target.value }))}
                              onBlur={e => guardarPrecioRefBlur(p.id, e.target.value)}
                              placeholder="$0"
                              className="w-24 text-right border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-400"
                            />
                            {precioRefSaved === p.id && (
                              <span className="text-emerald-500 text-xs font-bold">✓</span>
                            )}
                          </div>
                          <div className="text-xs pl-0.5">
                            {p.precio_real ? <span className="text-indigo-500">{formatCLP(p.precio_real)}</span> : <span className="text-slate-300">Sin cálculo aún</span>}
                          </div>
                        </div>
                      </td>
                      <td className="table-td text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>{p.activo ? 'Activo' : 'Inactivo'}</span>
                      </td>
                      <td className="table-td text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(p)} title="Editar"
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleToggle(p)} title={p.activo ? 'Desactivar' : 'Activar'}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                            {p.activo
                              ? <ToggleRight className="w-4 h-4 text-emerald-500" />
                              : <ToggleLeft  className="w-4 h-4 text-slate-400" />}
                          </button>
                          <button onClick={() => setConfirmDeleteId(p.id)} title="Eliminar"
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'calculadora' && (
        <div className="space-y-5">
          <div className="flex gap-1 border-b border-slate-200">
            {CALC_TABS.map(t => (
              <button key={t.id} onClick={() => setCalcTab(t.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  calcTab === t.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          {calcTab === 'caucho' && <CalculadoraCaucho onRefresh={cargar} />}
          {calcTab === 'toldos' && <CalculadoraToldos onRefresh={cargar} />}
          {calcTab === 'pasto'  && (
            <div className="card p-12 flex flex-col items-center justify-center text-center">
              <Calculator className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-400">Calculadora Pasto Sintético</p>
              <p className="text-xs text-slate-300 mt-1">Próximamente</p>
            </div>
          )}
        </div>
      )}

      {/* Modal producto */}
      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingProducto(null) }}
        title={editingProducto ? 'Editar producto' : 'Nuevo producto'}
      >
        <div className="space-y-4">
          <div>
            <label className="label-base">Nombre *</label>
            <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Instalación caucho continuo" className="input-base" />
          </div>
          <div>
            <label className="label-base">Descripción</label>
            <textarea value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
              rows={2} placeholder="Descripción opcional" className="input-base resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">Categoría</label>
              <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} className="input-base">
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label-base">Unidad de medida</label>
              <select value={form.unidad_medida} onChange={e => setForm(p => ({ ...p, unidad_medida: e.target.value }))} className="input-base">
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">Precio de referencia ($)</label>
              <input type="number" min="0" value={form.precio_referencia}
                onChange={e => setForm(p => ({ ...p, precio_referencia: e.target.value }))}
                placeholder="Opcional" className="input-base" />
            </div>
            <div>
              <label className="label-base">Precio real (calculado)</label>
              <div className="input-base bg-slate-50 text-slate-500 cursor-default select-none">
                {editingProducto?.precio_real ? formatCLP(editingProducto.precio_real) : 'Sin cálculo aún'}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Se actualiza desde la Calculadora</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="prod-activo" checked={form.activo}
              onChange={e => setForm(p => ({ ...p, activo: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <label htmlFor="prod-activo" className="text-sm font-medium text-slate-600">Activo</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setShowForm(false); setEditingProducto(null) }} className="btn-secondary">Cancelar</button>
            <button onClick={handleGuardar} disabled={!form.nombre.trim() || saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Guardando...' : editingProducto ? 'Guardar cambios' : 'Agregar producto'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => handleDelete(confirmDeleteId)}
        title="Eliminar producto"
        message="¿Estás seguro que deseas eliminar este producto? Esta acción no se puede deshacer."
      />
    </div>
  )
}
