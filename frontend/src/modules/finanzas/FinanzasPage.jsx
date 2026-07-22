import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../auth/AuthContext'
import { apiClient } from '../../services/apiClient'
import { supabase } from '../../services/supabase'
import { formatCLP, formatDate } from '../../utils/formatters'
import { ConfirmModal } from '../../components/Modal'
import Modal from '../../components/Modal'
import {
  TrendingUp, TrendingDown, Upload, CheckCircle2, Clock,
  Search, FileText, RefreshCw, DollarSign, Receipt,
  ExternalLink, Wallet, AlertCircle, User, X, XCircle,
  Link2, ShoppingCart, Banknote, HelpCircle, FolderKanban,
  Plus, Trash2, Pencil, Calendar, Building2, BarChart2, RotateCcw,
  LayoutDashboard, ArrowUpRight, ArrowDownRight, Landmark, Zap, Tag,
  Paperclip, ChevronLeft, ChevronRight, ChevronDown, CalendarDays, Bell,
} from 'lucide-react'

/* ── Normalización de tipo ───────────────────────────────────────── */
const normalizaTipo = (t) => {
  if (!t) return 'egreso'
  const l = t.toLowerCase()
  if (l === 'abono'  || l === 'ingreso') return 'ingreso'
  if (l === 'cargo'  || l === 'egreso')  return 'egreso'
  return l
}

/* ── Íconos por origen ───────────────────────────────────────────── */
function OrigenBadge({ origen }) {
  const map = {
    cotizacion: { label: 'Venta',    cls: 'bg-emerald-50 text-emerald-700', Icon: TrendingUp    },
    oc:         { label: 'Pago OC',  cls: 'bg-red-50 text-red-700',         Icon: ShoppingCart  },
    gasto:      { label: 'Gasto',    cls: 'bg-orange-50 text-orange-700',    Icon: Receipt       },
    cartola:    { label: 'Cartola',  cls: 'bg-blue-50 text-blue-700',        Icon: Banknote      },
    manual:     { label: 'Manual',   cls: 'bg-slate-100 text-slate-600',     Icon: HelpCircle    },
  }
  const o = map[origen] ?? map.manual
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${o.cls}`}>
      <o.Icon className="w-3 h-3" />
      {o.label}
    </span>
  )
}

function detectOrigen(m) {
  const d = (m.descripcion || '').toLowerCase()
  if (d.startsWith('venta '))    return 'cotizacion'
  if (d.startsWith('pago oc '))  return 'oc'
  if (d.startsWith('gasto '))    return 'gasto'
  if (m._origen)                 return m._origen
  return 'manual'
}

/* ── Procesador unificado de cartola ─────────────────────────────── */
async function procesarCartola(file, onStatus) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('API key de Anthropic no configurada (VITE_ANTHROPIC_API_KEY).')

  // PASO 1 — Leer archivo
  onStatus('Leyendo archivo...')
  let lineas = []
  const ext = file.name.split('.').pop().toLowerCase()

  if (ext === 'xls' || ext === 'xlsx') {
    const buffer = await file.arrayBuffer()
    const XLSX   = await import('xlsx')
    const wb     = XLSX.read(buffer, { type: 'array' })
    const ws     = wb.Sheets[wb.SheetNames[0]]
    const rows   = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    lineas = rows
      .filter(r => r.some(c => String(c).trim() !== ''))
      .map(r => r.map(c => String(c).trim()).join(' | '))
  } else {
    const text = await file.text()
    lineas = text.split('\n').filter(l => l.trim() !== '')
  }

  if (!lineas.length) throw new Error('El archivo está vacío.')

  // PASO 2 — Dividir en chunks de 250 líneas
  const CHUNK  = 250
  const chunks = []
  for (let i = 0; i < lineas.length; i += CHUNK) {
    chunks.push(lineas.slice(i, i + CHUNK).join('\n'))
  }

  // PASO 3 — Llamar a Claude por cada chunk
  const callIA = async (chunkText) => {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: 'Eres un extractor de movimientos bancarios. Responde SOLO con JSON array válido, sin markdown ni texto extra.',
        messages: [{
          role: 'user',
          content:
            'Extrae todos los movimientos bancarios de estos datos.\n' +
            'Ignora encabezados, saldos totales y filas sin fecha.\n' +
            'Formato requerido (responde SOLO el array JSON):\n' +
            '[{"fecha":"YYYY-MM-DD","descripcion":"string","monto":number,"tipo":"ingreso|egreso"}]\n\n' +
            'Reglas:\n' +
            '- ingreso: dinero que entra (Abonos, Traspaso De:, depósitos recibidos)\n' +
            '- egreso: dinero que sale (Cargos, Pago:, Traspaso A:, comisiones)\n' +
            '- monto siempre número positivo sin símbolos\n' +
            '- fecha siempre YYYY-MM-DD\n\n' +
            'Datos:\n' + chunkText,
        }],
      }),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      throw new Error(`Error de API (${resp.status}): ${err.error?.message || resp.statusText}`)
    }
    const data    = await resp.json()
    const content = (data.content?.[0]?.text || '').trim()
    const mdMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = mdMatch ? mdMatch[1].trim() : content
    const parsed  = JSON.parse(jsonStr)
    return Array.isArray(parsed) ? parsed : []
  }

  const allRows = []
  for (let i = 0; i < chunks.length; i++) {
    onStatus(chunks.length > 1 ? `Analizando parte ${i + 1} de ${chunks.length}...` : 'Analizando movimientos...')
    let result = []
    try {
      result = await callIA(chunks[i])
    } catch {
      try { result = await callIA(chunks[i]) } catch { result = [] }
    }
    allRows.push(...result)
  }

  // PASO 4 — Consolidar: deduplicar por fecha+descripcion+monto y ordenar
  const seen   = new Set()
  const unique = allRows.filter(r => {
    const key = `${r.fecha}|${r.descripcion}|${r.monto}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  unique.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))

  if (!unique.length) throw new Error('No se encontraron movimientos en el archivo.')
  return unique
}


/* ── Modal: Importar Cartola ─────────────────────────────────────── */
function CartolaPicker({ open, onClose, pendientes, onImportar }) {
  const [archivo,   setArchivo]   = useState(null)
  const [rows,      setRows]      = useState([])
  const [error,     setError]     = useState(null)
  const [selected,  setSelected]  = useState(new Set())
  const [matches,   setMatches]   = useState({})
  const [analyzing, setAnalyzing] = useState(false)

  const handleFile = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    setArchivo(f)
    setError(null)
    setRows([])
    setSelected(new Set())
    setAnalyzing('Leyendo archivo...')
    try {
      const parsed = await procesarCartola(f, setAnalyzing)

      // Auto-matching: busca movimiento pendiente con mismo tipo y monto (±2%)
      const matchMap = {}
      const usados   = new Set()
      parsed.forEach((row, idx) => {
        const match = pendientes.find(p =>
          !usados.has(p.id) &&
          normalizaTipo(p.tipo) === row.tipo &&
          Math.abs(p.monto - row.monto) / Math.max(p.monto, 1) < 0.02
        )
        if (match) { matchMap[idx] = match; usados.add(match.id) }
      })

      setRows(parsed)
      setMatches(matchMap)
      setSelected(new Set(parsed.map((_, i) => i)))
    } catch (err) {
      setError(err.message)
    } finally {
      setAnalyzing(null)
    }
  }

  const toggle = (idx) => setSelected(p => {
    const n = new Set(p)
    n.has(idx) ? n.delete(idx) : n.add(idx)
    return n
  })
  const toggleAll = () => setSelected(selected.size === rows.length ? new Set() : new Set(rows.map((_,i)=>i)))

  const handleConfirmar = () => {
    const toImport = [...selected].map(i => ({ row: rows[i], match: matches[i] || null }))
    onImportar(toImport)
    setArchivo(null); setRows([]); setSelected(new Set()); setMatches({})
  }

  const handleClose = () => {
    setArchivo(null); setRows([]); setError(null); setSelected(new Set()); setMatches({}); setAnalyzing(false)
    onClose()
  }

  const conciliados = [...selected].filter(i => matches[i]).length
  const nuevos      = selected.size - conciliados

  return (
    <Modal open={open} onClose={handleClose} title="Subir cartola bancaria" size="lg">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-200 p-3">
          <Banknote className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Sube el archivo de tu banco en cualquier formato. La IA extraerá los movimientos automáticamente
            y los comparará con los pendientes de conciliar.
          </p>
        </div>

        <label className={`flex items-center gap-3 cursor-pointer rounded-xl border-2 border-dashed px-5 py-4 transition-colors ${
          archivo ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50'
        }`}>
          <Upload className={`w-5 h-5 flex-shrink-0 ${archivo ? 'text-indigo-500' : 'text-slate-400'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${archivo ? 'text-indigo-700' : 'text-slate-600'}`}>
              {archivo ? archivo.name : 'Seleccionar archivo de cartola'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Compatible con CSV, TXT (posicional), XLS y XLSX — cualquier banco</p>
          </div>
          <input type="file" accept=".csv,.txt,.xls,.xlsx" className="hidden" onChange={handleFile} />
        </label>

        {analyzing && (
          <div className="flex items-center gap-3 rounded-lg bg-indigo-50 border border-indigo-200 p-4">
            <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin flex-shrink-0" />
            <p className="text-sm text-indigo-700 font-medium">{analyzing}</p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>{rows.length} transacciones detectadas</span>
                {conciliados > 0 && (
                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                    <Link2 className="w-3 h-3" />{conciliados} concilian con pendientes
                  </span>
                )}
                {nuevos > 0 && <span className="text-blue-600 font-medium">{nuevos} nuevos</span>}
              </div>
              <button onClick={toggleAll} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                {selected.size === rows.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">Fecha</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">Descripción</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-500">Monto</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-500">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row, idx) => {
                    const isSelected = selected.has(idx)
                    const match = matches[idx]
                    return (
                      <tr
                        key={idx}
                        onClick={() => toggle(idx)}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={isSelected} onChange={() => toggle(idx)} className="accent-indigo-600" />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatDate(row.fecha)}</td>
                        <td className="px-3 py-2 text-slate-700 max-w-[200px] truncate">{row.descripcion}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${row.tipo === 'ingreso' ? 'text-emerald-700' : 'text-red-700'}`}>
                          {row.tipo === 'ingreso' ? '+' : '-'}{formatCLP(row.monto)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {match ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium whitespace-nowrap">
                              <Link2 className="w-3 h-3" />
                              Concilia
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                              Nuevo
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button className="btn-secondary" onClick={handleClose}>Cancelar</button>
              <button
                disabled={selected.size === 0}
                onClick={handleConfirmar}
                className="btn-primary disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                Importar {selected.size} movimiento{selected.size !== 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}

        {!rows.length && !error && (
          <div className="flex justify-end">
            <button className="btn-secondary" onClick={handleClose}>Cerrar</button>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ── Roles de cuenta bancaria ────────────────────────────────────── */
const ROL_BANCO = {
  central:    { label: 'Banco Central',   cls: 'bg-indigo-900 text-white'         },
  impuestos:  { label: 'Banco Impuestos', cls: 'bg-orange-500 text-white'          },
  caja_chica: { label: 'Caja Chica',      cls: 'bg-emerald-100 text-emerald-700'  },
}

/* ── Página principal ────────────────────────────────────────────── */
const ESTADO_GASTO = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700'     },
  aprobado:  { label: 'Aprobado',  cls: 'bg-emerald-100 text-emerald-700' },
  aprobada:  { label: 'Aprobado',  cls: 'bg-emerald-100 text-emerald-700' },
  rechazado: { label: 'Rechazado', cls: 'bg-red-100 text-red-700'         },
  rechazada: { label: 'Rechazado', cls: 'bg-red-100 text-red-700'         },
}

export default function FinanzasPage() {
  const { movimientos, toggleConciliado, addMovimiento, gastos, updateGastoEstado, recargarGastos, trabajadores, cuentas, addCuenta, updateCuenta, deleteCuenta, pagarCuenta, proyectos, pagosCuentas, addPagoCuenta, updatePagoCuenta } = useApp()
  const { user } = useAuth()
  const navigate  = useNavigate()
  const isAdmin  = user?.rol === 'admin'
  const empresaId = user?.empresa_id
  const FECHA_CORTE_LIBRO = '2026-07-01'
  const [activeTab, setActiveTab] = useState('gastos')

  /* ── filtros movimientos ── */
  const [search,           setSearch]           = useState('')
  const [filtroTipo,       setFiltroTipo]       = useState('todos')
  const [filtroConciliado, setFiltroConciliado] = useState('todos')
  const [confirmId,        setConfirmId]        = useState(null) // { id, tipo }
  const [showCartola,      setShowCartola]      = useState(false)
  const [dashData,         setDashData]         = useState(null)
  const [dashLoading,      setDashLoading]      = useState(false)
  const [dashIvaData,      setDashIvaData]      = useState(null)

  /* ── cuentas bancarias ── */
  const [cuentasBancarias,  setCuentasBancarias]  = useState([])
  const [subTabBanco,       setSubTabBanco]       = useState('mis-cuentas')
  const [cbLoading,         setCbLoading]         = useState(false)
  const CB_FORM_EMPTY = { nombre: '', banco: 'BancoEstado', tipo_cuenta: 'corriente', numero_cuenta: '', rol: 'central', descripcion: '' }
  const [showFormBanco,     setShowFormBanco]     = useState(false)
  const [formBanco,         setFormBanco]         = useState(CB_FORM_EMPTY)
  const [editCbModal,       setEditCbModal]       = useState(null)
  const [formEditBanco,     setFormEditBanco]     = useState({})
  const [editCbSaving,      setEditCbSaving]      = useState(false)
  const [confirmDelCb,      setConfirmDelCb]      = useState(null)
  const [delCbLoading,      setDelCbLoading]      = useState(false)

  const [movsBancarios,     setMovsBancarios]     = useState([])
  const [movsBLoading,      setMovsBLoading]      = useState(false)
  const [filtroCbId,        setFiltroCbId]        = useState('todas')
  const [filtroTipoBanco,   setFiltroTipoBanco]   = useState('todos')
  const [filtroRolBanco,         setFiltroRolBanco]         = useState('todos')
  const [filtroConciliadoBanco,  setFiltroConciliadoBanco]  = useState('todos')
  const [filtroCtaContableBanco, setFiltroCtaContableBanco] = useState('todas')
  const [searchBanco,            setSearchBanco]            = useState('')
  const [filtroBFechaDesde, setFiltroBFechaDesde] = useState('')
  const [filtroBFechaHasta, setFiltroBFechaHasta] = useState('')

  const [showImportBanco,     setShowImportBanco]     = useState(false)
  const [importBancoPaso,     setImportBancoPaso]     = useState(1)
  const [importBancoCuentaId, setImportBancoCuentaId] = useState('')
  const [importBancoArchivo,   setImportBancoArchivo]   = useState(null)
  const [importBancoRows,      setImportBancoRows]      = useState([])
  const [importBancoSelected,  setImportBancoSelected]  = useState(new Set())
  const [importBancoError,     setImportBancoError]     = useState(null)
  const [importBancoLoading,   setImportBancoLoading]   = useState(false)
  const [importBancoAnalyzing, setImportBancoAnalyzing] = useState(false)
  const [importBancoInsertErr, setImportBancoInsertErr] = useState(null)
  const [importBancoDuplicados, setImportBancoDuplicados] = useState(new Set())
  const [importBancoToast,     setImportBancoToast]     = useState(null)
  const [importBancoStatus,    setImportBancoStatus]    = useState('')

  const [candidatosMap,        setCandidatosMap]        = useState({})
  const [conciliarModal,       setConciliarModal]       = useState(null)
  const [conciliandoId,        setConciliandoId]        = useState(null)
  const [desconciliarConfirm,  setDesconciliarConfirm]  = useState(null)

  /* documento (gasto/factura asociada) */
  const [gastosDisponibles,    setGastosDisponibles]    = useState([])
  const [facturasDisponibles,  setFacturasDisponibles]  = useState([])
  const [gastoModal,           setGastoModal]           = useState(null) // movimiento que se está editando
  const [gastoModalVista,      setGastoModalVista]      = useState('detalle') // 'detalle' | 'buscar'
  const [gastoSearch,          setGastoSearch]          = useState('')

  /* conciliar — modal simple */
  const [conciliarCtaId,   setConciliarCtaId]   = useState('')
  const [conciliarTipoDoc, setConciliarTipoDoc] = useState('')
  const [conciliarDesc,    setConciliarDesc]    = useState('')

  const [tiposDocumento,       setTiposDocumento]       = useState([])
  const [cuentasContables,     setCuentasContables]     = useState([])
  const [reclasModal,          setReclasModal]          = useState(null)
  const [reclasCtaId,          setReclasCtaId]          = useState('')
  const [reclasLoading,        setReclasLoading]        = useState(false)

  const [showMovManual, setShowMovManual] = useState(false)
  const MOV_FORM_EMPTY = { cuenta_bancaria_id: '', fecha: new Date().toISOString().split('T')[0], glosa: '', tipo: 'ingreso', monto: '' }
  const [formMovManual, setFormMovManual] = useState(MOV_FORM_EMPTY)

  /* ── filtros gastos ── */
  const [searchGastos,       setSearchGastos]       = useState('')
  const [filtroFechaGasto,   setFiltroFechaGasto]   = useState('todos')
  const [filtroTrabajador,   setFiltroTrabajador]   = useState('todos')
  const [filtroEstadoGasto,  setFiltroEstadoGasto]  = useState('aprobado')
  const [filtroCuentaId,     setFiltroCuentaId]     = useState(null)
  const [boletaModal,        setBoletaModal]        = useState(null)
  const [modalAprobarGasto,  setModalAprobarGasto]  = useState(null)
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState('')
  const [modalCuentasContables, setModalCuentasContables] = useState([])
  const [modalCuentasBancarias, setModalCuentasBancarias] = useState([])
  const [modalCuentaContableId, setModalCuentaContableId] = useState('')
  const [modalCuentaBancariaId, setModalCuentaBancariaId] = useState('')
  const [modalCargandoCuentas, setModalCargandoCuentas] = useState(false)
  const [modalErrorCuentas, setModalErrorCuentas] = useState('')
  const [ldPagina,    setLdPagina]    = useState(1)
  const [ldPorPagina, setLdPorPagina] = useState(10)

  const [showResumenGastos, setShowResumenGastos] = useState(true)

  /* ── cuentas empresa ── */
  const CATEGORIAS_CUENTA = [
    { value: 'arriendo',    label: 'Arriendo',          cls: 'bg-purple-100 text-purple-700' },
    { value: 'servicios',   label: 'Servicios básicos',  cls: 'bg-blue-100 text-blue-700'    },
    { value: 'planilla',    label: 'Planilla / Sueldos', cls: 'bg-indigo-100 text-indigo-700' },
    { value: 'prestamo',    label: 'Préstamo / Crédito', cls: 'bg-red-100 text-red-700'      },
    { value: 'impuesto',    label: 'Impuestos / SII',    cls: 'bg-orange-100 text-orange-700' },
    { value: 'suscripcion', label: 'Suscripción',        cls: 'bg-cyan-100 text-cyan-700'    },
    { value: 'otro',        label: 'Otro',               cls: 'bg-slate-100 text-slate-600'  },
  ]
  const catMap = Object.fromEntries(CATEGORIAS_CUENTA.map(c => [c.value, c]))

  const FORM_EMPTY = { nombre: '', monto: '', categoria: 'otro', periodicidad: 'mensual', diaMes: '1', fechaVencimiento: '' }
  const [showFormCuenta, setShowFormCuenta] = useState(false)
  const [editingCuenta,  setEditingCuenta]  = useState(null)
  const [formCuenta,     setFormCuenta]     = useState(FORM_EMPTY)
  const [confirmDelCta,          setConfirmDelCta]          = useState(null)
  const [telefonosRecordatorio,  setTelefonosRecordatorio]  = useState([])
  const [modalComprobanteCuenta, setModalComprobanteCuenta] = useState(null)
  const [cuentaToast,            setCuentaToast]            = useState(null)
  const showToastCuenta = (type, msg) => {
    setCuentaToast({ type, msg })
    setTimeout(() => setCuentaToast(null), 4000)
  }
  const [showDiaMes,     setShowDiaMes]     = useState(false)
  const refDiaMes = useRef(null)
  useEffect(() => {
    const handler = (e) => {
      if (refDiaMes.current && !refDiaMes.current.contains(e.target)) setShowDiaMes(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const [calMes,         setCalMes]         = useState(new Date().getMonth())
  const [calAnio,        setCalAnio]        = useState(new Date().getFullYear())
  const [uploadingPagoId, setUploadingPagoId] = useState(null)


  const pagosPorDia = useMemo(() => {
    const mapa = {}
    pagosCuentas.forEach(p => {
      if (!p.fechaVencimiento) return
      const parts = p.fechaVencimiento.split('-')
      const y = parseInt(parts[0])
      const m = parseInt(parts[1]) - 1
      if (y !== calAnio || m !== calMes) return
      const dia = parseInt(parts[2])
      if (!mapa[dia]) mapa[dia] = []
      mapa[dia].push(p)
    })
    return mapa
  }, [pagosCuentas, calMes, calAnio])

  useEffect(() => {
    if (!empresaId || !cuentas.length) return
    const hoy = new Date()
    const anio = hoy.getFullYear()
    const mes  = hoy.getMonth() + 1
    cuentas.forEach(cuenta => {
      const tienePagos = pagosCuentas.some(p => p.cuentaId === cuenta.id)
      if (tienePagos) return
      let fecha
      if (cuenta.periodicidad === 'mensual') {
        const dia = cuenta.diaMes ?? 1
        fecha = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      } else if (cuenta.periodicidad === 'unica') {
        fecha = cuenta.fechaVencimiento
      }
      if (!fecha) return
      addPagoCuenta({ cuentaId: cuenta.id, empresaId, fechaVencimiento: fecha, estado: 'pendiente', monto: cuenta.monto })
    })
  }, [cuentas, empresaId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePagarCuenta = async (pago, cuenta) => {
    await updatePagoCuenta(pago.id, { estado: 'pagado' })
    if (cuenta.periodicidad === 'mensual') {
      const parts = pago.fechaVencimiento.split('-')
      let anio = parseInt(parts[0])
      let mes  = parseInt(parts[1])
      mes++
      if (mes > 12) { mes = 1; anio++ }
      const dia = cuenta.diaMes ?? 1
      const fecha = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      const yaExiste = pagosCuentas.some(p => p.cuentaId === cuenta.id && p.fechaVencimiento === fecha)
      if (!yaExiste) {
        await addPagoCuenta({ cuentaId: cuenta.id, empresaId, fechaVencimiento: fecha, estado: 'pendiente', monto: cuenta.monto })
      }
    }
  }

  const handleSubirComprobante = async (pagoId, file) => {
    if (!file) return
    setUploadingPagoId(pagoId)
    try {
      const ext = file.name.split('.').pop()
      const path = `${empresaId}/${pagoId}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('comprobantes-cuentas')
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage
        .from('comprobantes-cuentas')
        .getPublicUrl(path)
      await updatePagoCuenta(pagoId, { comprobanteUrl: publicUrl, comprobanteNombre: file.name })
      showToastCuenta('success', 'Comprobante guardado correctamente')
    } catch (err) {
      console.error('[handleSubirComprobante] error completo:', err, err?.message, err?.statusCode, err?.error)
      showToastCuenta('error', 'Error al subir el comprobante')
    } finally {
      setUploadingPagoId(null)
    }
  }

  useEffect(() => {
    if (!empresaId) return
    const saved = localStorage.getItem(`telefonos_recordatorio_${empresaId}`)
    if (saved) {
      try { setTelefonosRecordatorio(JSON.parse(saved)) } catch {}
    }
  }, [empresaId])

  const handleGuardarTelefonos = () => {
    const filtrados = telefonosRecordatorio.filter(t => t?.trim())
    localStorage.setItem(`telefonos_recordatorio_${empresaId}`, JSON.stringify(filtrados))
    showToastCuenta('success', 'Teléfonos guardados')
  }

  const openNewCuenta = () => {
    setEditingCuenta(null)
    setFormCuenta(FORM_EMPTY)
    setShowFormCuenta(true)
  }
  const openEditCuenta = (c) => {
    setEditingCuenta(c)
    setFormCuenta({
      nombre: c.nombre, monto: String(c.monto), categoria: c.categoria,
      periodicidad: c.periodicidad, diaMes: String(c.diaMes ?? 1),
      fechaVencimiento: c.fechaVencimiento ?? '',
    })
    setShowFormCuenta(true)
  }
  const handleGuardarCuenta = () => {
    const monto = parseInt(formCuenta.monto) || 0
    if (!formCuenta.nombre.trim() || monto <= 0) return
    const payload = {
      nombre: formCuenta.nombre.trim(), monto, categoria: formCuenta.categoria,
      periodicidad: formCuenta.periodicidad,
      diaMes: formCuenta.periodicidad === 'mensual' ? (parseInt(formCuenta.diaMes) || 1) : null,
      fechaVencimiento: formCuenta.periodicidad === 'unica' ? (formCuenta.fechaVencimiento || null) : null,
    }
    if (editingCuenta) {
      updateCuenta(editingCuenta.id, payload)
    } else {
      addCuenta(payload)
    }
    setShowFormCuenta(false)
    setEditingCuenta(null)
    setFormCuenta(FORM_EMPTY)
  }

  /* ── proyección 6 meses ── */
  const proyeccion = useMemo(() => {
    const hoy = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
      const yyyyMM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label  = d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })

      const fijas   = cuentas.filter(c => c.periodicidad === 'mensual' && c.activa).reduce((s, c) => s + c.monto, 0)
      const unicas  = cuentas.filter(c => c.periodicidad === 'unica' && !c.pagada && c.fechaVencimiento?.startsWith(yyyyMM)).reduce((s, c) => s + c.monto, 0)
      const cobrado = movimientos.filter(m => normalizaTipo(m.tipo) === 'ingreso' && m.conciliado && m.fecha?.startsWith(yyyyMM)).reduce((s, m) => s + m.monto, 0)
      const porCobrar = i === 0
        ? movimientos.filter(m => normalizaTipo(m.tipo) === 'ingreso' && !m.conciliado).reduce((s, m) => s + m.monto, 0)
        : 0

      const totalOblig  = fijas + unicas
      const totalIngreso = cobrado + porCobrar
      const neto = totalIngreso - totalOblig
      return { label, yyyyMM, fijas, unicas, totalOblig, cobrado, porCobrar, totalIngreso, neto, isCurrentMonth: i === 0 }
    })
  }, [cuentas, movimientos])

  /* ── asignar gasto a proyecto ── */
  const [gastosAsignadosIds, setGastosAsignadosIds] = useState([])
  const [proyectosActivos,   setProyectosActivos]   = useState([])
  const [asignandoGasto,     setAsignandoGasto]     = useState(null)
  const [proyectoSelAsign,   setProyectoSelAsign]   = useState('')

  /* ── asignar cuenta origen a gasto ── */
  const [asignandoCuentaGastoId, setAsignandoCuentaGastoId] = useState(null)
  const [cuentaOrigenPatch,      setCuentaOrigenPatch]      = useState({})

  /* ── editar categorización ── */
  const [editCategorizacionGasto, setEditCategorizacionGasto] = useState(null)
  const [editCat,  setEditCat]  = useState('')
  const [editSub,  setEditSub]  = useState('')
  const [categoriaPatch, setCategoriaPatch] = useState({})

  useEffect(() => {
    Promise.all([
      apiClient.get('/proyectos/gastos-asignados').catch(() => []),
      apiClient.get('/proyectos').catch(() => []),
    ]).then(([ids, projs]) => {
      setGastosAsignadosIds(ids || [])
      setProyectosActivos((projs || []).filter((p) => p.estado === 'activo'))
    })
  }, [])

  useEffect(() => {
    if (activeTab !== 'dashboard') return
    setDashLoading(true)
    const { yyyyMM } = dashKPIs
    Promise.all([
      apiClient.get(`/remuneraciones/liquidaciones?periodo=${yyyyMM}`).catch(() => []),
      apiClient.get('/cotizaciones').catch(() => []),
      apiClient.get('/ordenes-compra').catch(() => []),
    ]).then(([liqs, cots, ocs]) => {
      setDashData({
        liqs: Array.isArray(liqs) ? liqs : [],
        cots: Array.isArray(cots) ? cots : [],
        ocs:  Array.isArray(ocs)  ? ocs  : [],
      })
    }).finally(() => setDashLoading(false))

    // IVA del año actual desde facturas_sii
    if (supabase && empresaId) {
      const anoActual = new Date().getFullYear()
      supabase
        .from('facturas_sii')
        .select('periodo, tipo, iva, total, fecha')
        .eq('empresa_id', empresaId)
        .gte('fecha', `${anoActual}-01-01`)
        .lte('fecha', `${anoActual}-12-31`)
        .then(({ data }) => setDashIvaData(data || []))
    }

    // Cargar movimientos bancarios si no están disponibles aún
    if (movsBancarios.length === 0) {
      cargarCuentasBancarias()
      cargarMovsBancarios()
    }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── carga datos bancarios ── */
  const cargarCuentasBancarias = useCallback(async () => {
    if (!supabase) return
    setCbLoading(true)
    try {
      let q = supabase.from('cuentas_bancarias').select('*').order('nombre')
      if (empresaId) q = q.eq('empresa_id', empresaId)
      const { data } = await q
      if (data) setCuentasBancarias(data)
    } finally { setCbLoading(false) }
  }, [empresaId])

  const cargarCandidatos = useCallback(async (movs) => {
    if (!supabase || !empresaId || !movs?.length) { setCandidatosMap({}); return }

    const conciliadosDocIds = new Set(
      movs.filter(m => m.conciliado && m.conciliado_documento_id)
          .map(m => String(m.conciliado_documento_id))
    )
    const egresos  = movs.filter(m => !m.conciliado && normalizaTipo(m.tipo) === 'egreso')
    const ingresos = movs.filter(m => !m.conciliado && normalizaTipo(m.tipo) === 'ingreso')
    const egresoMontos  = [...new Set(egresos.map(m => m.monto))]
    const ingresoMontos = [...new Set(ingresos.map(m => m.monto))]

    const qGastos = egresoMontos.length
      ? supabase.from('gastos').select('id,monto,fecha_gasto,descripcion,comercio').in('monto', egresoMontos).eq('estado','aprobado').eq('empresa_id', empresaId)
      : Promise.resolve({ data: [] })
    const qCompras = egresoMontos.length
      ? supabase.from('compras').select('id,monto,fecha,numero,proveedor').in('monto', egresoMontos).eq('empresa_id', empresaId)
      : Promise.resolve({ data: [] })
    const qAdelantos = egresoMontos.length
      ? supabase.from('adelantos').select('id,monto,fecha,descripcion,tipo').in('monto', egresoMontos).eq('empresa_id', empresaId)
      : Promise.resolve({ data: [] })
    const qLiquidaciones = egresoMontos.length
      ? supabase.from('liquidaciones').select('id,sueldo_liquido,periodo,trabajador_nombre,trabajador_rut').in('sueldo_liquido', egresoMontos).eq('estado','aprobado').eq('empresa_id', empresaId)
      : Promise.resolve({ data: [] })
    const qCotizaciones = ingresoMontos.length
      ? supabase.from('cotizaciones').select('id,total,fecha,numero,cliente').in('total', ingresoMontos).eq('estado','aprobada').eq('empresa_id', empresaId)
      : Promise.resolve({ data: [] })

    const [gasRes, comRes, adelRes, liquRes, cotRes] = await Promise.all([qGastos, qCompras, qAdelantos, qLiquidaciones, qCotizaciones])

    const noConc   = arr => (arr || []).filter(d => !conciliadosDocIds.has(String(d.id)))
    const gastos        = noConc(gasRes.data)
    const compras       = noConc(comRes.data)
    const adelantos     = noConc(adelRes.data)
    const liquidaciones = noConc(liquRes.data)
    const cotizaciones  = noConc(cotRes.data)

    const addDays = (dateStr, n) => {
      const d = new Date(dateStr + 'T00:00:00')
      d.setDate(d.getDate() + n)
      return d.toISOString().split('T')[0]
    }
    const diffD = (a, b) => b ? Math.round(Math.abs(new Date(a) - new Date(b)) / 86400000) : null

    const newMap = {}
    for (const mov of [...egresos, ...ingresos]) {
      const tipo  = normalizaTipo(mov.tipo)
      const fMin  = addDays(mov.fecha, -3)
      const fMax  = addDays(mov.fecha, +3)
      const cands = []

      if (tipo === 'egreso') {
        gastos.filter(g => g.monto === mov.monto && g.fecha_gasto >= fMin && g.fecha_gasto <= fMax)
          .forEach(g => cands.push({ tipo: 'gasto', id: g.id, numero: g.id.slice(0,8).toUpperCase(), descripcion: g.comercio || g.descripcion || 'Gasto', monto: g.monto, fecha: g.fecha_gasto, diff: diffD(mov.fecha, g.fecha_gasto) }))
        compras.filter(c => c.monto === mov.monto && c.fecha >= fMin && c.fecha <= fMax)
          .forEach(c => cands.push({ tipo: 'compra', id: c.id, numero: c.numero || c.id.slice(0,8).toUpperCase(), descripcion: c.proveedor || 'Compra', monto: c.monto, fecha: c.fecha, diff: diffD(mov.fecha, c.fecha) }))
        adelantos.filter(a => a.monto === mov.monto && a.fecha >= fMin && a.fecha <= fMax)
          .forEach(a => cands.push({ tipo: 'adelanto', id: a.id, numero: a.id.slice(0,8).toUpperCase(), descripcion: a.descripcion || `Adelanto ${a.tipo}`, monto: a.monto, fecha: a.fecha, diff: diffD(mov.fecha, a.fecha) }))
        liquidaciones.filter(l => l.sueldo_liquido === mov.monto)
          .forEach(l => cands.push({ tipo: 'liquidacion', id: l.id, numero: `Liq. ${l.periodo || ''}`, descripcion: `${l.trabajador_nombre || ''} ${l.trabajador_rut || ''}`.trim(), monto: l.sueldo_liquido, fecha: null, diff: null }))
      } else {
        cotizaciones.filter(c => c.total === mov.monto && c.fecha >= fMin && c.fecha <= fMax)
          .forEach(c => cands.push({ tipo: 'cotizacion', id: c.id, numero: c.numero || c.id, descripcion: c.cliente || 'Cotización', monto: c.total, fecha: c.fecha, diff: diffD(mov.fecha, c.fecha) }))
      }

      if (cands.length > 0) newMap[mov.id] = cands
    }
    setCandidatosMap(newMap)
  }, [empresaId])

  const cargarMovsBancarios = useCallback(async () => {
    if (!supabase) return
    setMovsBLoading(true)
    try {
      let q = supabase.from('movimientos')
        .select('*, cuentas_bancarias!cuenta_bancaria_id(nombre, rol)')
        .order('fecha', { ascending: false })
      if (empresaId) q = q.eq('empresa_id', empresaId)
      const { data, error } = await q
      if (error) console.error('[movimientos bancarios] Supabase error:', error)
      if (data) {
        let splitsMap = {}
        if (data.length > 0) {
          const movIds = data.map(m => String(m.id))
          const { data: splitsData } = await supabase
            .from('movimiento_splits').select('movimiento_id, monto').in('movimiento_id', movIds)
          for (const s of (splitsData || [])) {
            splitsMap[s.movimiento_id] = (splitsMap[s.movimiento_id] || 0) + (s.monto || 0)
          }
        }
        const enriched = data.map(m => ({ ...m, _splits_sum: splitsMap[String(m.id)] || 0 }))
        setMovsBancarios(enriched)
        cargarCandidatos(enriched)
      }
    } finally { setMovsBLoading(false) }
  }, [empresaId, cargarCandidatos])




  useEffect(() => {
    apiClient.get('/finanzas/cuentas-contables')
      .then(data => {
        console.log('[cuentas-contables] recibido:', data)
        if (Array.isArray(data)) setCuentasContables(data)
      })
      .catch(err => console.error('[cuentas contables]', err))
    apiClient.get('/finanzas/tipos-documento')
      .then(data => { if (Array.isArray(data)) setTiposDocumento(data) })
      .catch(err => console.error('[tipos-documento]', err))
  }, [])

  /* Cargar gastos aprobados y facturas de venta una vez al montar */
  useEffect(() => {
    if (!supabase || !empresaId) return
    supabase
      .from('gastos')
      .select('id, comercio, descripcion, monto, fecha_gasto, foto_url, trabajador_nombre, estado')
      .eq('empresa_id', empresaId)
      .eq('estado', 'aprobado')
      .order('fecha_gasto', { ascending: false })
      .then(({ data }) => setGastosDisponibles(data || []))
    supabase
      .from('facturas_sii')
      .select('id, folio, razon_social, total, fecha_emision, tipo')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'venta')
      .order('fecha_emision', { ascending: false })
      .then(({ data }) => setFacturasDisponibles(data || []))
  }, [empresaId]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Pre-llenar campos al abrir modal de conciliación */
  useEffect(() => {
    setConciliarCtaId(conciliarModal?.cuenta_contable_id || '')
    setConciliarTipoDoc(conciliarModal?.conciliado_tipo || '')
    setConciliarDesc(conciliarModal?.conciliado_documento_numero || '')
  }, [conciliarModal])

  useEffect(() => {
    if (activeTab !== 'gastos') return
    setFiltroFechaGasto('todos')
    recargarGastos()
  }, [activeTab, recargarGastos])

  useEffect(() => {
    if (activeTab !== 'banco' && activeTab !== 'movimientos' && activeTab !== 'gastos') return
    cargarCuentasBancarias()
  }, [activeTab, cargarCuentasBancarias])


  const handleGuardarCuentaBanco = async () => {
    console.log('[guardarCuentaBanco] ejecutando...', { nombre: formBanco.nombre, rol: formBanco.rol, empresaId })
    if (!formBanco.nombre.trim() || !formBanco.rol) return
    const payload = {
      nombre: formBanco.nombre.trim(),
      banco: formBanco.banco,
      tipo_cuenta: formBanco.tipo_cuenta,
      numero_cuenta: formBanco.numero_cuenta.trim() || null,
      rol: formBanco.rol,
      descripcion: formBanco.descripcion.trim() || null,
      activa: true,
      ...(empresaId ? { empresa_id: empresaId } : {}),
    }
    const { error } = await supabase.from('cuentas_bancarias').insert(payload)
    if (error) {
      console.error('[guardarCuentaBanco] error Supabase:', error)
    } else {
      setShowFormBanco(false)
      setFormBanco(CB_FORM_EMPTY)
      cargarCuentasBancarias()
    }
  }

  const handleToggleCuentaBanco = async (id, activa) => {
    if (!supabase) return
    await supabase.from('cuentas_bancarias').update({ activa: !activa }).eq('id', id)
    cargarCuentasBancarias()
  }

  const handleGuardarEditBanco = async () => {
    if (!editCbModal || !formEditBanco.nombre?.trim() || !supabase) return
    setEditCbSaving(true)
    try {
      const { error } = await supabase.from('cuentas_bancarias').update({
        nombre: formEditBanco.nombre.trim(),
        banco: formEditBanco.banco,
        tipo_cuenta: formEditBanco.tipo_cuenta,
        numero_cuenta: formEditBanco.numero_cuenta?.trim() || null,
        rol: formEditBanco.rol,
        descripcion: formEditBanco.descripcion?.trim() || null,
      }).eq('id', editCbModal.id)
      if (!error) { setEditCbModal(null); cargarCuentasBancarias() }
    } finally {
      setEditCbSaving(false)
    }
  }

  const handleEliminarCuentaBanco = async (cb) => {
    if (!supabase) return
    const { data } = await supabase
      .from('gastos')
      .select('id')
      .or(`cuenta_origen_id.eq.${cb.id},cuenta_destino_id.eq.${cb.id}`)
      .limit(1)
    setConfirmDelCb({ ...cb, bloqueado: !!(data && data.length > 0) })
  }

  const handleConfirmarEliminarCb = async () => {
    if (!confirmDelCb || confirmDelCb.bloqueado || !supabase) return
    setDelCbLoading(true)
    try {
      const { error } = await supabase.from('cuentas_bancarias').delete().eq('id', confirmDelCb.id)
      if (!error) { setConfirmDelCb(null); cargarCuentasBancarias() }
    } finally {
      setDelCbLoading(false)
    }
  }

  const handleImportBancoFile = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    setImportBancoArchivo(f); setImportBancoError(null); setImportBancoRows([]); setImportBancoSelected(new Set())
    setImportBancoAnalyzing(true); setImportBancoStatus('Leyendo archivo...')
    try {
      const parsed = await procesarCartola(f, setImportBancoStatus)

      // Detectar duplicados en BD antes de mostrar paso 3
      const fechasUnicas = [...new Set(parsed.map(r => r.fecha))]
      const { data: existing } = await supabase.from('movimientos')
        .select('fecha, descripcion, monto, tipo')
        .eq('cuenta_bancaria_id', importBancoCuentaId)
        .in('fecha', fechasUnicas)
      const existingKeys = new Set((existing || []).map(e => `${e.fecha}|${e.descripcion}|${e.monto}|${e.tipo}`))
      const dupSet = new Set(parsed.reduce((acc, row, idx) => {
        if (existingKeys.has(`${row.fecha}|${row.descripcion}|${row.monto}|${row.tipo}`)) acc.push(idx)
        return acc
      }, []))
      setImportBancoDuplicados(dupSet)
      setImportBancoRows(parsed)
      setImportBancoSelected(new Set(parsed.map((_, i) => i).filter(i => !dupSet.has(i))))
      setImportBancoPaso(3)
    } catch (err) {
      setImportBancoError(err.message)
    } finally {
      setImportBancoAnalyzing(false); setImportBancoStatus('')
    }
  }

  const handleImportBancoConfirmar = async () => {
    console.log('[importar] cuenta_id:', importBancoCuentaId, 'empresa_id:', empresaId)
    console.log('[importar] seleccionados:', importBancoSelected.size, 'de', importBancoRows.length)
    if (!supabase || !importBancoCuentaId || importBancoSelected.size === 0) {
      console.warn('[importar] guard falló:', { supabase: !!supabase, importBancoCuentaId, size: importBancoSelected.size })
      return
    }
    setImportBancoLoading(true)
    setImportBancoInsertErr(null)
    const toInsert = [...importBancoSelected].map(i => importBancoRows[i]).map(row => ({
      id: crypto.randomUUID(),
      ...(empresaId ? { empresa_id: empresaId } : {}),
      cuenta_bancaria_id: importBancoCuentaId,
      fecha: row.fecha, descripcion: row.descripcion, glosa: row.descripcion,
      tipo: row.tipo, monto: row.monto, conciliado: false,
      archivo_origen: importBancoArchivo?.name || null,
    }))
    console.log('[importar] movimientos a insertar:', toInsert)
    const selectedArr = [...importBancoSelected]
    const dupCount    = selectedArr.filter(idx => importBancoDuplicados.has(idx)).length
    const newCount    = selectedArr.length - dupCount

    const { error } = await supabase.from('movimientos')
      .upsert(toInsert, { onConflict: 'fecha,descripcion,monto,tipo,cuenta_bancaria_id', ignoreDuplicates: true })
    if (error) {
      console.error('[importar] error Supabase:', error)
      setImportBancoInsertErr(error.message)
    } else {
      setShowImportBanco(false); setImportBancoPaso(1); setImportBancoCuentaId('')
      setImportBancoArchivo(null); setImportBancoRows([]); setImportBancoSelected(new Set())
      setImportBancoDuplicados(new Set()); setImportBancoInsertErr(null)
      cargarMovsBancarios()
      const msg = `${newCount} movimiento${newCount !== 1 ? 's' : ''} importado${newCount !== 1 ? 's' : ''}${dupCount > 0 ? `, ${dupCount} duplicado${dupCount !== 1 ? 's' : ''} ignorado${dupCount !== 1 ? 's' : ''}` : ''}`
      setImportBancoToast(msg)
      setTimeout(() => setImportBancoToast(null), 5000)
    }
    setImportBancoLoading(false)
  }

  const handleGuardarMovManual = async () => {
    if (!supabase || !formMovManual.glosa.trim() || !formMovManual.monto || !formMovManual.cuenta_bancaria_id) return
    const { error } = await supabase.from('movimientos').insert({
      id: crypto.randomUUID(),
      ...(empresaId ? { empresa_id: empresaId } : {}),
      cuenta_bancaria_id: formMovManual.cuenta_bancaria_id,
      fecha: formMovManual.fecha, descripcion: formMovManual.glosa.trim(),
      glosa: formMovManual.glosa.trim(), tipo: formMovManual.tipo,
      monto: parseInt(formMovManual.monto) || 0, conciliado: false,
    })
    if (!error) { setShowMovManual(false); setFormMovManual(MOV_FORM_EMPTY); cargarMovsBancarios() }
  }

  const getMovEstado = (m) => {
    if (m.conciliado) return 'conciliado'
    if ((m._splits_sum || 0) > 0) return 'parcial'
    if (m.cuenta_contable_id && !m.conciliado_documento_id) return 'clasificado'
    if (!m.cuenta_contable_id && m.conciliado_documento_id) return 'respaldado'
    return 'sin_identificar'
  }

  const handleConciliarSimple = async () => {
    if (!conciliarModal || !conciliarCtaId || !conciliarTipoDoc || !conciliarDesc.trim()) return
    setConciliandoId(conciliarModal.id)
    const ctaNombre = cuentasContables.find(c => c.id === conciliarCtaId)?.nombre || ''
    await supabase.from('movimientos').update({
      conciliado: true,
      conciliado_tipo: conciliarTipoDoc,
      conciliado_documento_numero: conciliarDesc.trim(),
      cuenta_contable_id: conciliarCtaId,
      cuenta_contable_nombre: ctaNombre,
      conciliado_fecha: new Date().toISOString(),
      conciliado_por: user?.id || null,
    }).eq('id', conciliarModal.id)
    setConciliarModal(null)
    cargarMovsBancarios()
    setImportBancoToast('✓ Movimiento conciliado')
    setTimeout(() => setImportBancoToast(null), 5000)
    setConciliandoId(null)
  }

  const handleReclasificar = async () => {
    if (!reclasCtaId || !reclasModal) return
    setReclasLoading(true)
    const ctaNombre = cuentasContables.find(c => c.id === reclasCtaId)?.nombre || ''
    const { error } = await supabase.from('movimientos').update({
      cuenta_contable_id: reclasCtaId,
      cuenta_contable_nombre: ctaNombre,
    }).eq('id', reclasModal.id)
    if (!error) {
      setReclasModal(null); setReclasCtaId('')
      cargarMovsBancarios()
      setImportBancoToast('Cuenta contable actualizada')
      setTimeout(() => setImportBancoToast(null), 4000)
    }
    setReclasLoading(false)
  }

  const handleExportarContador = () => {
    const filtered = movsBancarios.filter(m => {
      if (filtroCbId !== 'todas' && m.cuenta_bancaria_id !== filtroCbId) return false
      if (filtroTipoBanco !== 'todos' && normalizaTipo(m.tipo) !== filtroTipoBanco) return false
      if (filtroRolBanco !== 'todos' && m.cuentas_bancarias?.rol !== filtroRolBanco) return false
      if (filtroBFechaDesde && (m.fecha || '') < filtroBFechaDesde) return false
      if (filtroBFechaHasta && (m.fecha || '') > filtroBFechaHasta) return false
      if (filtroConciliadoBanco === 'conciliado'    && !m.conciliado) return false
      if (filtroConciliadoBanco === 'sin-conciliar' &&  m.conciliado) return false
      if (filtroCtaContableBanco !== 'todas' && m.cuenta_contable_id !== filtroCtaContableBanco) return false
      if (searchBanco && !(m.glosa || m.descripcion || '').toLowerCase().includes(searchBanco.toLowerCase())) return false
      return true
    })
    const esc    = s => `"${String(s || '').replace(/"/g, '""')}"`
    const header = ['Fecha','Descripción','Tipo','Monto','Cuenta Contable','Documento Asociado','Conciliado']
    const rows   = filtered.map(m => [
      m.fecha || '',
      esc(m.glosa || m.descripcion || ''),
      normalizaTipo(m.tipo),
      m.monto,
      esc(m.cuenta_contable_nombre || ''),
      esc(m.conciliado_documento_numero || ''),
      m.conciliado ? 'Sí' : 'No',
    ])
    const csv  = [header, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    const now  = new Date()
    a.href     = url
    a.download = `movimientos_${String(now.getMonth()+1).padStart(2,'0')}_${now.getFullYear()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleAsociarGastoAMov = async (gasto) => {
    if (!gastoModal) return
    const desc = [gasto.comercio, gasto.descripcion].filter(Boolean).join(': ')
    await supabase.from('movimientos').update({
      gasto_id: String(gasto.id),
      gasto_descripcion: desc,
    }).eq('id', gastoModal.id)
    setGastoModal(null)
    setGastoSearch('')
    cargarMovsBancarios()
    setImportBancoToast(`✓ Gasto asociado — ${gasto.comercio || gasto.descripcion || ''}`)
    setTimeout(() => setImportBancoToast(null), 5000)
  }

  const handleAsociarFacturaAMov = async (factura) => {
    if (!gastoModal) return
    const desc = `Factura Nº${factura.folio} - ${factura.razon_social || ''}`
    await supabase.from('movimientos').update({
      gasto_id: String(factura.id),
      gasto_descripcion: desc,
    }).eq('id', gastoModal.id)
    setGastoModal(null)
    setGastoSearch('')
    cargarMovsBancarios()
    setImportBancoToast(`✓ Factura asociada — ${factura.razon_social || factura.folio}`)
    setTimeout(() => setImportBancoToast(null), 5000)
  }

  const handleDesasociarGasto = async () => {
    if (!gastoModal) return
    await supabase.from('movimientos').update({
      gasto_id: null,
      gasto_descripcion: null,
    }).eq('id', gastoModal.id)
    setGastoModal(null)
    cargarMovsBancarios()
  }

  const handleDesconciliar = async (movId) => {
    const { error } = await supabase.from('movimientos').update({
      conciliado: false,
      conciliado_tipo: null,
      conciliado_documento_id: null,
      conciliado_documento_numero: null,
      conciliado_fecha: null,
      conciliado_por: null,
    }).eq('id', movId)
    if (!error) { setDesconciliarConfirm(null); cargarMovsBancarios() }
  }

  const handleAsignarGasto = async (gastoId) => {
    if (!proyectoSelAsign) return
    try {
      await apiClient.post(`/proyectos/${proyectoSelAsign}/gastos`, { gasto_ids: [gastoId] })
      setGastosAsignadosIds((prev) => [...prev, gastoId])
      setAsignandoGasto(null)
      setProyectoSelAsign('')
    } catch (err) {
      console.error('Error al asignar gasto:', err)
    }
  }

  const handleAsignarCuentaOrigen = async (gastoId, cuentaId) => {
    const { error } = await supabase
      .from('gastos')
      .update({ cuenta_origen_id: cuentaId })
      .eq('id', gastoId)
    if (!error) {
      setCuentaOrigenPatch(prev => ({ ...prev, [gastoId]: cuentaId }))
      setAsignandoCuentaGastoId(null)
    }
  }

  const abrirModalAprobar = async (g) => {
    setModalAprobarGasto(g)
    setProyectoSeleccionado('')
    setModalCuentaContableId('')
    setModalCuentaBancariaId('')
    setModalErrorCuentas('')
    setModalCargandoCuentas(true)
    try {
      const [{ data: cc }, { data: cb }] = await Promise.all([
        supabase
          .from('cuentas_contables')
          .select('id, nombre, tipo')
          .eq('activa', true)
          .eq('empresa_id', empresaId)
          .in('tipo', ['egreso', 'ambos'])
          .order('codigo'),
        supabase
          .from('cuentas_bancarias')
          .select('id, nombre, banco')
          .eq('empresa_id', empresaId),
      ])
      setModalCuentasContables(cc || [])
      setModalCuentasBancarias(cb || [])
    } catch (err) {
      console.error('[abrirModalAprobar]', err)
    } finally {
      setModalCargandoCuentas(false)
    }
  }

  const handleGuardarCategorizacion = async () => {
    if (!editCategorizacionGasto) return
    const { error } = await supabase
      .from('gastos')
      .update({ categoria: editCat, subtipo: editSub || null })
      .eq('id', editCategorizacionGasto.id)
    if (!error) {
      setCategoriaPatch(prev => ({ ...prev, [editCategorizacionGasto.id]: { categoria: editCat, subtipo: editSub || null } }))
      setEditCategorizacionGasto(null)
    }
  }

  /* ── vista unificada movimientos + gastos ── */
  const gastosComoMovimientos = useMemo(() =>
    gastos.map(g => ({
      id:          `gasto-${g.id}`,
      fecha:       g.fecha,
      descripcion: `Gasto ${g.categoria ? g.categoria + ' — ' : ''}${g.comercio || g.descripcion || ''}`.trim(),
      tipo:        'egreso',
      monto:       g.monto ?? 0,
      conciliado:  g.estado === 'aprobado' || g.estado === 'aprobada',
      _origen:     'gasto',
      _readonly:   true,
    }))
  , [gastos])

  const allItems = useMemo(() => {
    const items = [
      ...movimientos.map(m => ({ ...m, _origen: detectOrigen(m) })),
      ...gastosComoMovimientos,
    ]
    return items.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
  }, [movimientos, gastosComoMovimientos])

  /* ── dashboard KPIs (calculados desde datos ya disponibles) ── */
  const dashKPIs = useMemo(() => {
    const now          = new Date()
    const yyyyMM       = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
    const prevDate     = new Date(now.getFullYear(), now.getMonth()-1, 1)
    const prevYYYYMM   = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`
    const hoy          = now.toISOString().split('T')[0]
    const en7d         = new Date(now); en7d.setDate(now.getDate()+7)
    const en7DiasStr   = en7d.toISOString().split('T')[0]
    const h15d         = new Date(now); h15d.setDate(now.getDate()-15)
    const hace15DiasStr = h15d.toISOString().split('T')[0]
    const primerDiaMes = `${yyyyMM}-01`

    const movsConc       = allItems.filter(m => m.conciliado)
    const saldoDisp      = movsConc.filter(m=>normalizaTipo(m.tipo)==='ingreso').reduce((s,m)=>s+m.monto,0)
                         - movsConc.filter(m=>normalizaTipo(m.tipo)==='egreso').reduce((s,m)=>s+m.monto,0)
    const movsMes        = allItems.filter(m => m.fecha?.startsWith(yyyyMM))
    const ingresosMes    = movsMes.filter(m=>normalizaTipo(m.tipo)==='ingreso')
    const egresosMes     = movsMes.filter(m=>normalizaTipo(m.tipo)==='egreso')
    const prevMovsMes    = allItems.filter(m => m.fecha?.startsWith(prevYYYYMM))
    const prevFlujo      = prevMovsMes.filter(m=>normalizaTipo(m.tipo)==='ingreso').reduce((s,m)=>s+m.monto,0)
                         - prevMovsMes.filter(m=>normalizaTipo(m.tipo)==='egreso').reduce((s,m)=>s+m.monto,0)
    const ingresosMesTotal = ingresosMes.reduce((s,m)=>s+m.monto,0)
    const egresosMesTotal  = egresosMes.reduce((s,m)=>s+m.monto,0)
    const cuentasVencidas  = cuentas.filter(c => c.activa && !c.pagada && c.fechaVencimiento && c.fechaVencimiento < hoy)
    const cuentasXVencer   = cuentas.filter(c => c.activa && !c.pagada && c.fechaVencimiento && c.fechaVencimiento >= hoy && c.fechaVencimiento <= en7DiasStr)
    const gastosPend       = gastos.filter(g => g.estado === 'pendiente')
    const gastosOpMes      = gastos.filter(g => (g.estado==='aprobado'||g.estado==='aprobada') && (g.fecha||'') >= primerDiaMes)
    return {
      saldoDisp,
      ingresosMes, ingresosMesTotal,
      egresosMes,  egresosMesTotal,
      flujoNeto: ingresosMesTotal - egresosMesTotal,
      prevFlujo,
      cuentasVencidas, cuentasXVencer,
      gastosPend,
      gastosOpMes, gastosOpTotal: gastosOpMes.reduce((s,g)=>s+(g.monto||0),0),
      hace15DiasStr, yyyyMM,
    }
  }, [allItems, cuentas, gastos])

  const filtered = allItems.filter(m => {
    const tipo = normalizaTipo(m.tipo)
    const matchSearch = (m.descripcion || '').toLowerCase().includes(search.toLowerCase())
    const matchTipo   = filtroTipo === 'todos' || tipo === filtroTipo
    const matchConc   =
      filtroConciliado === 'todos' ||
      (filtroConciliado === 'conciliado' && m.conciliado) ||
      (filtroConciliado === 'pendiente'  && !m.conciliado)
    return matchSearch && matchTipo && matchConc
  })

  /* ── stats ── */
  const totalIngresos = allItems.filter(m => normalizaTipo(m.tipo) === 'ingreso').reduce((s,m) => s + m.monto, 0)
  const totalEgresos  = allItems.filter(m => normalizaTipo(m.tipo) === 'egreso').reduce((s,m)  => s + m.monto, 0)
  const saldo         = totalIngresos - totalEgresos
  const pendientes    = allItems.filter(m => !m.conciliado)
  const conciliados   = allItems.filter(m => m.conciliado).length

  const toConfirm = allItems.find(m => m.id === confirmId?.id)

  /* ── stats por cuenta ── */
  const ingresosPendientes  = allItems.filter(m => normalizaTipo(m.tipo) === 'ingreso' && !m.conciliado)
  const ingresosConfirmados = allItems.filter(m => normalizaTipo(m.tipo) === 'ingreso' && m.conciliado)
  const egresosPendientes   = allItems.filter(m => normalizaTipo(m.tipo) === 'egreso'  && !m.conciliado)
  const egresosConfirmados  = allItems.filter(m => normalizaTipo(m.tipo) === 'egreso'  && m.conciliado)
  const totalPorCobrar  = ingresosPendientes.reduce((s, m)  => s + m.monto, 0)
  const totalCobrado    = ingresosConfirmados.reduce((s, m) => s + m.monto, 0)
  const totalPorPagar   = egresosPendientes.reduce((s, m)   => s + m.monto, 0)
  const totalPagado     = egresosConfirmados.reduce((s, m)  => s + m.monto, 0)
  const saldoReal       = totalCobrado - totalPagado
  const saldoProyectado = (totalCobrado + totalPorCobrar) - (totalPagado + totalPorPagar)

  /* ── totales de la vista filtrada ── */
  const filteredIngresos = filtered.filter(m => normalizaTipo(m.tipo) === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const filteredEgresos  = filtered.filter(m => normalizaTipo(m.tipo) === 'egreso').reduce((s, m)  => s + m.monto, 0)
  const filteredNeto     = filteredIngresos - filteredEgresos

  /* ── filtrado por fecha gastos ── */
  const gastosPorFecha = useMemo(() => {
    const base  = gastos.filter(g => (g.fecha ?? '') >= FECHA_CORTE_LIBRO)
    const now   = new Date()
    const today = now.toISOString().slice(0, 10)
    if (filtroFechaGasto === 'hoy')   return base.filter(g => g.fecha === today)
    if (filtroFechaGasto === 'semana') {
      const dow  = now.getDay()
      const diff = dow === 0 ? -6 : 1 - dow
      const mon  = new Date(now)
      mon.setDate(now.getDate() + diff)
      const monStr = mon.toISOString().slice(0, 10)
      return base.filter(g => g.fecha >= monStr && g.fecha <= today)
    }
    if (filtroFechaGasto === 'mes') {
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      return base.filter(g => g.fecha?.startsWith(ym))
    }
    return base
  }, [gastos, filtroFechaGasto, FECHA_CORTE_LIBRO])

  /* ── stats gastos ── */
  const q              = searchGastos.toLowerCase()
  const filteredGastos = useMemo(() => gastosPorFecha.filter(g => {
    if (filtroTrabajador !== 'todos' && g.trabajadorId !== filtroTrabajador) return false
    if (filtroEstadoGasto !== 'todos' && g.estado !== filtroEstadoGasto) return false
    if (filtroCuentaId !== null && g.cuenta_origen_id !== filtroCuentaId && g.cuenta_destino_id !== filtroCuentaId) return false
    if (!q) return true
    return (
      g.descripcion?.toLowerCase().includes(q) ||
      g.comercio?.toLowerCase().includes(q) ||
      g.rutComercio?.toLowerCase().includes(q) ||
      g.trabajadorNombre?.toLowerCase().includes(q)
    )
  }), [gastosPorFecha, filtroTrabajador, filtroEstadoGasto, filtroCuentaId, q])

  const porCuentaContable = gastosPorFecha.reduce((acc, g) => {
    const cat = g.cuenta_contable_nombre ?? g.subtipo ?? 'Sin cuenta'
    if (!acc[cat]) acc[cat] = { total: 0, cantidad: 0 }
    acc[cat].total += g.monto || 0
    acc[cat].cantidad++
    return acc
  }, {})

  const porTipoDoc = gastosPorFecha.reduce((acc, g) => {
    const tipo = g.tipoDocumento || 'Sin documento'
    if (!acc[tipo]) acc[tipo] = { total: 0, cantidad: 0 }
    acc[tipo].total += g.monto || 0
    acc[tipo].cantidad++
    return acc
  }, {})

  const porSubtipo = gastosPorFecha.reduce((acc, g) => {
    const sub = g.subtipo || 'Sin subcategoría'
    if (!acc[sub]) acc[sub] = { total: 0, cantidad: 0 }
    acc[sub].total += g.monto || 0
    acc[sub].cantidad++
    return acc
  }, {})

  const gastosConSaldo = useMemo(() => {
    const ordenados = [...filteredGastos].sort(
      (a, b) => new Date(a.fecha) - new Date(b.fecha)
    )
    let saldo = 0
    const conSaldo = ordenados.map(g => {
      const esRechazado = g.estado === 'rechazado' || g.estado === 'rechazada'
      if (!esRechazado) {
        if (g.tipo_movimiento === 'ingreso') {
          saldo += g.monto || 0
        } else {
          saldo -= g.monto || 0
        }
      }
      return { ...g, saldo }
    })
    return [...conSaldo].reverse()
  }, [filteredGastos])

  const gastosCorte = gastos.filter(g => (g.fecha ?? '') >= FECHA_CORTE_LIBRO && g.estado === 'aprobado')
  const sumSaldosIniciales = cuentasBancarias
    .filter(c => c.activa)
    .reduce((s, c) => s + (c.saldo_inicial ?? 0), 0)
  const totalDebe = gastosCorte
    .filter(g => ['egreso', 'traspaso'].includes(g.tipo_movimiento))
    .reduce((s, g) => s + (g.monto || 0), 0)
  const totalHaber = sumSaldosIniciales + gastosCorte
    .filter(g => g.tipo_movimiento === 'ingreso')
    .reduce((s, g) => s + (g.monto || 0), 0)
  const saldoNeto  = totalHaber - totalDebe

  const filasUnificadas = useMemo(() => {
    return gastosConSaldo.map(g => ({ ...g, _tipo: 'gasto' }))
  }, [gastosConSaldo])

  const ldTotalPaginas = Math.max(1, Math.ceil(filasUnificadas.length / ldPorPagina))
  const ldMovsPaginados = filasUnificadas.slice(
    (ldPagina - 1) * ldPorPagina,
    ldPagina * ldPorPagina
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLdPagina(1) }, [filteredGastos.length])

  /* ── importar cartola ── */
  const handleImportar = (items) => {
    items.forEach(({ row, match }) => {
      if (match) {
        toggleConciliado(match.id)
      } else {
        addMovimiento({
          fecha:       row.fecha,
          descripcion: row.descripcion,
          tipo:        row.tipo,
          monto:       row.monto,
          conciliado:  true,
          _origen:     'cartola',
        })
      }
    })
    setShowCartola(false)
  }

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Finanzas</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {allItems.length} movimientos · {pendientes.length} pendientes de conciliar
          </p>
        </div>
        {activeTab === 'movimientos' && (
          <button onClick={() => setShowCartola(true)} className="btn-primary">
            <Upload className="w-4 h-4" />
            Subir Cartola
          </button>
        )}
        {activeTab === 'cuentas' && isAdmin && (
          <button onClick={openNewCuenta} className="btn-primary">
            <Plus className="w-4 h-4" />
            Nueva cuenta
          </button>
        )}
        {activeTab === 'banco' && (
          <button onClick={() => setShowFormBanco(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Agregar cuenta
          </button>
        )}
        {activeTab === 'movimientos' && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleExportarContador} className="btn-secondary">
              <FileText className="w-4 h-4" />
              Exportar contador
            </button>
            <button onClick={() => { setShowImportBanco(true); setImportBancoPaso(1) }} className="btn-secondary">
              <Upload className="w-4 h-4" />
              Importar cartola CSV
            </button>
            <button onClick={() => setShowMovManual(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              Movimiento manual
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        {[
          { key: 'dashboard',   label: 'Dashboard',        icon: LayoutDashboard },
          { key: 'banco',       label: 'Cuentas Bancarias', icon: Landmark        },
          { key: 'gastos',      label: 'Libro Diario',      icon: Receipt         },
          { key: 'cuentas',      label: 'Cuentas',           icon: Building2       },
          { key: 'proyeccion',   label: 'Proyección',       icon: BarChart2       },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── TAB DASHBOARD ── */}
      {activeTab === 'dashboard' && (() => {
        const {
          saldoDisp, ingresosMes, ingresosMesTotal, egresosMes, egresosMesTotal,
          flujoNeto, prevFlujo, cuentasVencidas, cuentasXVencer,
          gastosPend, gastosOpMes, gastosOpTotal, hace15DiasStr, yyyyMM,
        } = dashKPIs

        const liqs    = dashData?.liqs || []
        const costoPersonalTotal = liqs.reduce((s,l)=>s+(l.costoEmpresa||l.costo_empresa||0),0)
        const cotsAntiguas = (dashData?.cots||[]).filter(c=>c.estado==='enviada'&&(c.createdAt||c.created_at||'')<hace15DiasStr)
        const ocsMes  = (dashData?.ocs||[]).filter(o=>(o.createdAt||o.created_at||'').startsWith(yyyyMM))
        const ocsTotal = ocsMes.reduce((s,o)=>s+(o.monto||o.total||0),0)

        const alertas = [
          ...(cuentasVencidas.length ? [{ icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', texto: `${cuentasVencidas.length} cuenta${cuentasVencidas.length!==1?'s':''} vencida${cuentasVencidas.length!==1?'s':''} sin pagar`, monto: cuentasVencidas.reduce((s,c)=>s+c.monto,0), tab: 'cuentas' }] : []),
          ...(cuentasXVencer.length  ? [{ icon: Clock,        color: 'text-amber-600',  bg: 'bg-amber-50',  texto: `${cuentasXVencer.length} cuenta${cuentasXVencer.length!==1?'s':''} por vencer en 7 días`,                                          monto: cuentasXVencer.reduce((s,c)=>s+c.monto,0),           tab: 'cuentas' }] : []),
          ...(gastosPend.length      ? [{ icon: Receipt,      color: 'text-orange-600', bg: 'bg-orange-50', texto: `${gastosPend.length} gasto${gastosPend.length!==1?'s':''} pendiente${gastosPend.length!==1?'s':''} de aprobar`,                     monto: gastosPend.reduce((s,g)=>s+(g.monto||0),0),           tab: 'gastos'  }] : []),
          ...(cotsAntiguas.length    ? [{ icon: FileText,     color: 'text-yellow-600', bg: 'bg-yellow-50', texto: `${cotsAntiguas.length} cotización${cotsAntiguas.length!==1?'es':''} sin respuesta hace más de 15 días`,                             monto: null,                                                  tab: null      }] : []),
        ]

        return (
          <div className="space-y-5">
            {dashLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin mr-2" />
                <span className="text-sm text-slate-500">Cargando datos...</span>
              </div>
            ) : (
              <>
                {/* FILA 1 — 4 KPI cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Saldo disponible</span>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${saldoDisp >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                        <Wallet className={`w-4 h-4 ${saldoDisp >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                      </div>
                    </div>
                    <div className={`text-2xl font-bold ${saldoDisp >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCLP(saldoDisp)}</div>
                    <div className="text-xs text-slate-400 mt-1">Movimientos conciliados</div>
                  </div>

                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ingresos del mes</span>
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-emerald-700">{formatCLP(ingresosMesTotal)}</div>
                    <div className="text-xs text-slate-400 mt-1">{ingresosMes.length} movimiento{ingresosMes.length!==1?'s':''}</div>
                  </div>

                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Egresos del mes</span>
                      <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-red-700">{formatCLP(egresosMesTotal)}</div>
                    <div className="text-xs text-slate-400 mt-1">{egresosMes.length} movimiento{egresosMes.length!==1?'s':''}</div>
                  </div>

                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Flujo neto del mes</span>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${flujoNeto >= 0 ? 'bg-indigo-100' : 'bg-red-100'}`}>
                        {flujoNeto >= 0 ? <ArrowUpRight className="w-4 h-4 text-indigo-600" /> : <ArrowDownRight className="w-4 h-4 text-red-600" />}
                      </div>
                    </div>
                    <div className={`text-2xl font-bold ${flujoNeto >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>
                      {flujoNeto >= 0 ? '+' : ''}{formatCLP(flujoNeto)}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`text-xs flex items-center gap-0.5 font-medium ${flujoNeto >= prevFlujo ? 'text-emerald-600' : 'text-red-500'}`}>
                        {flujoNeto >= prevFlujo ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        vs mes anterior
                      </span>
                    </div>
                  </div>
                </div>

                {/* FILA 2 — Alertas */}
                {alertas.length === 0 ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">✅ Todo al día</p>
                      <p className="text-xs text-emerald-600 mt-0.5">Sin alertas pendientes de atención</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-800">⚠️ Requiere atención</span>
                      <span className="ml-auto text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                        {alertas.length} alerta{alertas.length!==1?'s':''}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {alertas.map((a, i) => (
                        <div key={i} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2.5 border border-amber-100">
                          <div className={`w-7 h-7 rounded-lg ${a.bg} flex items-center justify-center flex-shrink-0`}>
                            <a.icon className={`w-4 h-4 ${a.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 font-medium">{a.texto}</p>
                            {a.monto != null && <p className="text-xs text-slate-500">{formatCLP(a.monto)}</p>}
                          </div>
                          {a.tab && (
                            <button onClick={() => setActiveTab(a.tab)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex-shrink-0 whitespace-nowrap">
                              Ver →
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FILA 3 — 6 Widgets por área */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                  {/* W1 — Gastos por categoría */}
                  <div className="card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                          <Receipt className="w-4 h-4 text-orange-600" />
                        </div>
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          Gastos del mes · <span className="capitalize normal-case">{new Date().toLocaleDateString('es-CL', { month: 'long' })}</span>
                        </span>
                      </div>
                      {gastosPend.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                          {gastosPend.length} pendiente{gastosPend.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {gastosOpMes.length === 0 ? (
                      <p className="text-sm text-slate-400">Sin datos este mes</p>
                    ) : (() => {
                      const byCategoria = gastosOpMes.reduce((acc, g) => {
                        const cat = g.cuenta_contable_nombre ?? g.subtipo ?? 'Sin cuenta'
                        acc[cat] = (acc[cat] || 0) + (g.monto || 0)
                        return acc
                      }, {})
                      const sorted = Object.entries(byCategoria).sort((a, b) => b[1] - a[1])
                      const max = sorted[0]?.[1] || 1
                      return (
                        <div className="space-y-2">
                          {sorted.map(([cat, monto]) => (
                            <div key={cat}>
                              <div className="flex justify-between text-xs mb-0.5">
                                <span className="text-slate-600 font-medium truncate max-w-[160px]">{cat}</span>
                                <span className="text-orange-700 font-semibold ml-2 whitespace-nowrap">{formatCLP(monto)}</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5">
                                <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${(monto / max) * 100}%` }} />
                              </div>
                            </div>
                          ))}
                          <div className="flex justify-between pt-2 border-t border-slate-100">
                            <span className="text-xs text-slate-500">Total</span>
                            <span className="text-sm font-bold text-orange-700">{formatCLP(gastosOpTotal)}</span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  {/* W2 — Cuentas bancarias */}
                  <div className="card p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Landmark className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Cuentas bancarias</span>
                    </div>
                    {cuentasBancarias.filter(c => c.activa).length === 0 ? (
                      <p className="text-sm text-slate-400">Sin cuentas configuradas</p>
                    ) : (
                      <div className="space-y-2">
                        {cuentasBancarias.filter(c => c.activa).map(cb => {
                          const movsCb  = movsBancarios.filter(m => m.cuenta_bancaria_id === cb.id)
                          const ingMes  = movsCb.filter(m => m.fecha?.startsWith(yyyyMM) && normalizaTipo(m.tipo)==='ingreso').reduce((s,m)=>s+m.monto,0)
                          const egMes   = movsCb.filter(m => m.fecha?.startsWith(yyyyMM) && normalizaTipo(m.tipo)==='egreso').reduce((s,m)=>s+m.monto,0)
                          const saldoCb = movsCb.filter(m=>normalizaTipo(m.tipo)==='ingreso').reduce((s,m)=>s+m.monto,0)
                                        - movsCb.filter(m=>normalizaTipo(m.tipo)==='egreso').reduce((s,m)=>s+m.monto,0)
                          const pendCb  = movsCb.filter(m=>!m.conciliado).length
                          const rolMap  = { central: { label: 'Banco Central', cls: 'bg-indigo-50 text-indigo-700' }, caja_chica: { label: 'Caja Chica', cls: 'bg-slate-100 text-slate-600' }, impuestos: { label: 'Impuestos', cls: 'bg-purple-50 text-purple-700' } }
                          const rol     = rolMap[cb.rol] || { label: cb.rol || '—', cls: 'bg-slate-100 text-slate-600' }
                          return (
                            <div key={cb.id} className="rounded-lg border border-slate-100 p-3 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-700 flex-1 truncate">{cb.nombre}</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${rol.cls}`}>{rol.label}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-1 text-xs">
                                <div>
                                  <div className="text-slate-400 mb-0.5">Ingresos mes</div>
                                  <div className="text-emerald-600 font-semibold">{ingMes > 0 ? '+'+formatCLP(ingMes) : '—'}</div>
                                </div>
                                <div>
                                  <div className="text-slate-400 mb-0.5">Egresos mes</div>
                                  <div className="text-red-600 font-semibold">{egMes > 0 ? '-'+formatCLP(egMes) : '—'}</div>
                                </div>
                                <div>
                                  <div className="text-slate-400 mb-0.5">Saldo total</div>
                                  <div className={`font-bold ${saldoCb >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatCLP(saldoCb)}</div>
                                </div>
                              </div>
                              {pendCb > 0 && <div className="text-xs text-amber-600 font-medium">{pendCb} movimiento{pendCb!==1?'s':''} por conciliar</div>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* W3 — Órdenes de compra */}
                  <div className="card p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center">
                        <ShoppingCart className="w-4 h-4 text-sky-600" />
                      </div>
                      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Órdenes de compra</span>
                    </div>
                    {!dashData ? (
                      <p className="text-sm text-slate-400">—</p>
                    ) : (() => {
                      const todasOcs   = dashData.ocs || []
                      const ocsMesAll  = todasOcs.filter(o => (o.createdAt||o.created_at||'').startsWith(yyyyMM))
                      const totalOcsMes = ocsMesAll.reduce((s,o)=>s+(o.monto||o.total||0),0)
                      const estadosMap = {
                        creada:   { label: 'Creada',   cls: 'bg-slate-100 text-slate-600',     items: [] },
                        enviada:  { label: 'Enviada',  cls: 'bg-blue-50 text-blue-700',         items: [] },
                        aprobada: { label: 'Aprobada', cls: 'bg-emerald-50 text-emerald-700',   items: [] },
                        pagada:   { label: 'Pagada',   cls: 'bg-green-50 text-green-700',       items: [] },
                      }
                      ocsMesAll.forEach(o => {
                        const est = o.estado?.toLowerCase() || 'creada'
                        if (estadosMap[est]) estadosMap[est].items.push(o)
                        else estadosMap.creada.items.push(o)
                      })
                      return ocsMesAll.length === 0 ? (
                        <p className="text-sm text-slate-400">Sin OC este mes</p>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>Total del mes · {ocsMesAll.length} orden{ocsMesAll.length!==1?'es':''}</span>
                            <span className="font-bold text-sky-700">{formatCLP(totalOcsMes)}</span>
                          </div>
                          {Object.values(estadosMap).filter(v => v.items.length > 0).map(v => (
                            <div key={v.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${v.cls}`}>{v.label}</span>
                                <span className="text-xs text-slate-500">{v.items.length} OC{v.items.length!==1?'s':''}</span>
                              </div>
                              <span className="text-xs font-semibold text-slate-700">{formatCLP(v.items.reduce((s,o)=>s+(o.monto||o.total||0),0))}</span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>

                  {/* W4 — Remuneraciones */}
                  <div className="card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-purple-600" />
                        </div>
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          Remuneraciones · <span className="normal-case capitalize">{new Date().toLocaleDateString('es-CL', { month: 'long' })}</span>
                        </span>
                      </div>
                      <button onClick={() => navigate('/remuneraciones')} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 whitespace-nowrap">
                        Ver Previred →
                      </button>
                    </div>
                    {!dashData ? (
                      <p className="text-sm text-slate-400">—</p>
                    ) : liqs.length === 0 ? (
                      <p className="text-sm text-slate-400">Sin liquidaciones este mes</p>
                    ) : (() => {
                      const sum = (field) => liqs.reduce((s,l) => s + (l[field] || 0), 0)
                      const totalLiquido  = sum('sueldoLiquido')
                      const totalPrevired = sum('descuentoAfp') + sum('descuentoSalud') + sum('descuentoCesantiaTrab') + sum('cesantiaEmpleador') + sum('mutualEmpleador')
                      const aprobadas  = liqs.filter(l => l.estado === 'aprobado' || l.estado === 'aprobada').length
                      const borradores = liqs.filter(l => l.estado === 'borrador').length
                      return (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg bg-purple-50 px-3 py-2.5">
                              <div className="text-xs text-purple-500 mb-0.5">Sueldo líquido</div>
                              <div className="text-lg font-bold text-purple-700">{formatCLP(totalLiquido)}</div>
                            </div>
                            <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                              <div className="text-xs text-slate-500 mb-0.5">Total Previred</div>
                              <div className="text-lg font-bold text-slate-700">{formatCLP(totalPrevired)}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs flex-wrap">
                            <span className="text-slate-500">{liqs.length} trabajador{liqs.length!==1?'es':''}</span>
                            {aprobadas > 0  && <span className="text-emerald-600 font-medium">{aprobadas} aprobada{aprobadas!==1?'s':''}</span>}
                            {borradores > 0 && <span className="text-amber-600 font-medium">{borradores} borrador{borradores!==1?'es':''}</span>}
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  {/* W5 — IVA mensual */}
                  <div className="card p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-indigo-600" />
                      </div>
                      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        IVA — {new Date().getFullYear()}
                      </span>
                    </div>
                    {!dashIvaData ? (
                      <p className="text-sm text-slate-400">—</p>
                    ) : dashIvaData.length === 0 ? (
                      <p className="text-sm text-slate-400">Sin facturas SII este año</p>
                    ) : (() => {
                      const byPeriodo = {}
                      dashIvaData.forEach(f => {
                        const p = f.periodo || f.fecha?.slice(0, 7) || '—'
                        if (!byPeriodo[p]) byPeriodo[p] = { debito: 0, credito: 0 }
                        const tipo = (f.tipo || '').toLowerCase()
                        if (tipo === 'venta' || tipo === 'emitida') byPeriodo[p].debito  += (f.iva || 0)
                        else                                         byPeriodo[p].credito += (f.iva || 0)
                      })
                      const periodos  = Object.entries(byPeriodo).sort(([a],[b]) => a.localeCompare(b))
                      const totDebito  = periodos.reduce((s,[,v])=>s+v.debito, 0)
                      const totCredito = periodos.reduce((s,[,v])=>s+v.credito, 0)
                      const totNeto    = totDebito - totCredito
                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-100">
                                <th className="py-1 text-left text-slate-400 font-medium">Mes</th>
                                <th className="py-1 text-right text-emerald-600 font-medium">Débito</th>
                                <th className="py-1 text-right text-red-500 font-medium">Crédito</th>
                                <th className="py-1 text-right text-slate-600 font-medium">A pagar</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {periodos.map(([periodo, v]) => {
                                const neto = v.debito - v.credito
                                return (
                                  <tr key={periodo}>
                                    <td className="py-1.5 text-slate-600">{periodo}</td>
                                    <td className="py-1.5 text-right text-emerald-600">{v.debito  > 0 ? formatCLP(v.debito)  : '—'}</td>
                                    <td className="py-1.5 text-right text-red-500">{v.credito > 0 ? formatCLP(v.credito) : '—'}</td>
                                    <td className={`py-1.5 text-right font-semibold ${neto > 0 ? 'text-red-600' : neto < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                      {neto !== 0 ? formatCLP(Math.abs(neto)) : '—'}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                            <tfoot className="border-t border-slate-200">
                              <tr>
                                <td className="py-1.5 font-semibold text-slate-600">Total</td>
                                <td className="py-1.5 text-right font-bold text-emerald-700">{formatCLP(totDebito)}</td>
                                <td className="py-1.5 text-right font-bold text-red-600">{formatCLP(totCredito)}</td>
                                <td className={`py-1.5 text-right font-bold ${totNeto > 0 ? 'text-red-700' : totNeto < 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                                  {totNeto !== 0 ? formatCLP(Math.abs(totNeto)) : '—'}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )
                    })()}
                  </div>

                  {/* W6 — Pipeline de ventas */}
                  <div className="card p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Pipeline de ventas</span>
                    </div>
                    {!dashData ? (
                      <p className="text-sm text-slate-400">—</p>
                    ) : (() => {
                      const aprobadas  = (dashData.cots || []).filter(c => c.estado === 'aprobada')
                      const totalCots  = aprobadas.reduce((s,c)=>s+(c.total||0),0)
                      const condiciones = aprobadas.flatMap(c => Array.isArray(c.condiciones_pago) ? c.condiciones_pago : [])
                      const porCobrar  = condiciones.filter(p => p.estado === 'pendiente').reduce((s,p)=>s+(p.monto||0),0)
                      const facturado  = condiciones.filter(p => p.estado === 'facturado').reduce((s,p)=>s+(p.monto||0),0)
                      const top3 = [...aprobadas].sort((a,b)=>(b.total||0)-(a.total||0)).slice(0,3)
                      return aprobadas.length === 0 ? (
                        <p className="text-sm text-slate-400">Sin cotizaciones aprobadas</p>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg bg-emerald-50 px-3 py-2.5">
                              <div className="text-xs text-emerald-500 mb-0.5">Aprobadas ({aprobadas.length})</div>
                              <div className="text-lg font-bold text-emerald-700">{formatCLP(totalCots)}</div>
                            </div>
                            {(porCobrar > 0 || facturado > 0) && (
                              <div className="rounded-lg bg-slate-50 px-3 py-2.5 space-y-1">
                                {porCobrar > 0 && (
                                  <div>
                                    <div className="text-xs text-slate-500">Por cobrar</div>
                                    <div className="text-sm font-bold text-amber-700">{formatCLP(porCobrar)}</div>
                                  </div>
                                )}
                                {facturado > 0 && (
                                  <div>
                                    <div className="text-xs text-slate-500">Facturado pend.</div>
                                    <div className="text-sm font-bold text-blue-700">{formatCLP(facturado)}</div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {top3.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Top 3</p>
                              {top3.map(c => (
                                <div key={c.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                                  <span className="text-xs text-slate-600 truncate max-w-[160px]">{c.cliente || c.razon_social || '—'}</span>
                                  <span className="text-xs font-semibold text-emerald-700 ml-2">{formatCLP(c.total||0)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>

                </div>

                {/* FILA 4 — Mini proyección próximos 3 meses */}
                <div className="card overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Proyección próximos 3 meses</p>
                      <p className="text-xs text-slate-400 mt-0.5">Basada en gastos fijos y costo de personal estimado</p>
                    </div>
                    <button onClick={() => setActiveTab('proyeccion')} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 whitespace-nowrap">
                      Ver proyección completa →
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/50">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Mes</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-red-500">Gastos fijos</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-purple-600">Costo personal est.</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-orange-500">Por cobrar</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">Balance est.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {proyeccion.slice(0, 3).map((mes) => {
                          const balanceEst = mes.totalIngreso - mes.totalOblig - costoPersonalTotal
                          return (
                            <tr key={mes.yyyyMM} className={`transition-colors ${mes.isCurrentMonth ? 'bg-indigo-50/40' : 'hover:bg-slate-50/60'}`}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-semibold capitalize ${mes.isCurrentMonth ? 'text-indigo-700' : 'text-slate-700'}`}>{mes.label}</span>
                                  {mes.isCurrentMonth && <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-600">Actual</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-xs text-red-600 font-medium">{mes.totalOblig > 0 ? formatCLP(mes.totalOblig) : <span className="text-slate-300">—</span>}</td>
                              <td className="px-4 py-3 text-right text-xs text-purple-600 font-medium">{costoPersonalTotal > 0 ? formatCLP(costoPersonalTotal) : <span className="text-slate-300">—</span>}</td>
                              <td className="px-4 py-3 text-right text-xs text-orange-600 font-medium">{mes.porCobrar > 0 ? formatCLP(mes.porCobrar) : <span className="text-slate-300">—</span>}</td>
                              <td className="px-4 py-3 text-right">
                                <span className={`text-sm font-bold ${balanceEst >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                  {balanceEst >= 0 ? '+' : ''}{formatCLP(balanceEst)}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* ── TAB CUENTAS BANCARIAS ── */}
      {activeTab === 'banco' && (() => {
        const rolBadge = (rol) => {
          const r = ROL_BANCO[rol] || { label: rol || '—', cls: 'bg-slate-100 text-slate-600' }
          return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.cls}`}>{r.label}</span>
        }
        return (
          <div className="space-y-4">
            {showFormBanco && (
                  <div className="card p-5 border-2 border-indigo-200 bg-indigo-50/20 space-y-4">
                    <h4 className="text-sm font-semibold text-slate-800">Nueva cuenta bancaria</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Nombre de la cuenta</label>
                        <input value={formBanco.nombre} onChange={e => setFormBanco(p => ({ ...p, nombre: e.target.value }))}
                          placeholder="Ej: Cuenta Principal Empresa" className="input-base" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Banco</label>
                        <select value={formBanco.banco} onChange={e => setFormBanco(p => ({ ...p, banco: e.target.value }))} className="input-base">
                          {['BancoEstado','Banco de Chile','Santander','BCI','Scotiabank','Itaú','BICE','Falabella','Ripley','Otro'].map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de cuenta</label>
                        <select value={formBanco.tipo_cuenta} onChange={e => setFormBanco(p => ({ ...p, tipo_cuenta: e.target.value }))} className="input-base">
                          <option value="corriente">Cuenta corriente</option>
                          <option value="vista">Cuenta vista</option>
                          <option value="ahorro">Cuenta de ahorro</option>
                          <option value="rut">Cuenta RUT</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Número de cuenta</label>
                        <input value={formBanco.numero_cuenta} onChange={e => setFormBanco(p => ({ ...p, numero_cuenta: e.target.value }))}
                          placeholder="Ej: 00012345678" className="input-base" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Rol <span className="text-red-500">*</span></label>
                        <select value={formBanco.rol} onChange={e => setFormBanco(p => ({ ...p, rol: e.target.value }))} className="input-base">
                          <option value="central">Banco Central — ingresos por ventas</option>
                          <option value="impuestos">Banco Impuestos — IVA y PREVIRED</option>
                          <option value="caja_chica">Caja Chica — gastos operacionales</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Descripción (opcional)</label>
                        <input value={formBanco.descripcion} onChange={e => setFormBanco(p => ({ ...p, descripcion: e.target.value }))}
                          placeholder="Notas adicionales..." className="input-base" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setShowFormBanco(false); setFormBanco(CB_FORM_EMPTY) }} className="btn-secondary">Cancelar</button>
                      <button onClick={handleGuardarCuentaBanco} disabled={!formBanco.nombre.trim()} className="btn-primary disabled:opacity-50">
                        Guardar cuenta
                      </button>
                    </div>
                  </div>
                )}

                {cbLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin mr-2" />
                    <span className="text-sm text-slate-500">Cargando...</span>
                  </div>
                ) : cuentasBancarias.length === 0 && !showFormBanco ? (
                  <div className="card flex flex-col items-center justify-center py-16 text-center">
                    <Landmark className="w-10 h-10 text-slate-300 mb-3" />
                    <p className="text-sm font-medium text-slate-500">Sin cuentas bancarias registradas</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">Agrega las cuentas bancarias de la empresa para importar cartolas y registrar movimientos por cuenta.</p>
                    <button onClick={() => setShowFormBanco(true)} className="btn-primary mt-4">
                      <Plus className="w-4 h-4" />Agregar cuenta
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cuentasBancarias.map(cb => {
                      const rol = ROL_BANCO[cb.rol] || { label: cb.rol || '—', cls: 'bg-slate-100 text-slate-600' }
                      const num = cb.numero_cuenta ? `···${String(cb.numero_cuenta).slice(-4)}` : '—'
                      return (
                        <div key={cb.id} className={`card p-4 space-y-3 ${!cb.activa ? 'opacity-60' : ''}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-slate-900 text-sm">{cb.nombre}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{cb.banco}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${rol.cls}`}>{rol.label}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="capitalize">{(cb.tipo_cuenta || '').replace('_', ' ') || '—'}</span>
                            <span className="text-slate-300">·</span>
                            <span className="font-mono">{num}</span>
                          </div>
                          {cb.descripcion && <p className="text-xs text-slate-400">{cb.descripcion}</p>}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            <span className={`text-xs font-medium ${cb.activa ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {cb.activa ? 'Activa' : 'Inactiva'}
                            </span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => { setEditCbModal(cb); setFormEditBanco({ nombre: cb.nombre || '', banco: cb.banco || 'BancoEstado', tipo_cuenta: cb.tipo_cuenta || 'corriente', numero_cuenta: cb.numero_cuenta || '', rol: cb.rol || 'central', descripcion: cb.descripcion || '' }) }}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                              ><Pencil className="w-3 h-3" />Editar</button>
                              <button
                                onClick={() => handleEliminarCuentaBanco(cb)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                              ><Trash2 className="w-3 h-3" />Eliminar</button>
                              <button
                                onClick={() => handleToggleCuentaBanco(cb.id, cb.activa)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                  cb.activa
                                    ? 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                }`}
                              >{cb.activa ? 'Desactivar' : 'Activar'}</button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

          </div>
        )
      })()}


      {/* ── TAB GASTOS ── */}
      {activeTab === 'gastos' && (
        <>
          {/* Tarjetas por cuenta bancaria */}
          {cuentasBancarias.filter(c => c.activa).length > 0 && (() => {
            const statsLd = cuentasBancarias.filter(c => c.activa).map(cb => {
              const totalEgresos = gastos
                .filter(g => g.cuenta_origen_id === cb.id && ['egreso', 'traspaso'].includes(g.tipo_movimiento) && (g.fecha ?? '') >= FECHA_CORTE_LIBRO && g.estado === 'aprobado')
                .reduce((s, g) => s + (g.monto || 0), 0)
              const totalIngresos = gastos
                .filter(g => g.cuenta_destino_id === cb.id && ['ingreso', 'traspaso'].includes(g.tipo_movimiento) && (g.fecha ?? '') >= FECHA_CORTE_LIBRO && g.estado === 'aprobado')
                .reduce((s, g) => s + (g.monto || 0), 0)
              const saldoCb = (cb.saldo_inicial ?? 0) + totalIngresos - totalEgresos
              return { ...cb, totalEgresos, totalIngresos, saldoCb, totalMov: totalEgresos + totalIngresos }
            }).sort((a, b) => b.totalMov - a.totalMov)
            return (
              <div className="grid grid-cols-4 gap-3 mb-4">
                {statsLd.map(cb => {
                  const rol = ROL_BANCO[cb.rol] || { label: cb.rol || '—', cls: 'bg-slate-100 text-slate-600' }
                  const isSelected = filtroCuentaId === cb.id
                  return (
                    <div
                      key={cb.id}
                      onClick={() => setFiltroCuentaId(isSelected ? null : cb.id)}
                      className={`card cursor-pointer transition-all ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-400' : 'hover:border-slate-300'}`}
                      style={{ padding: '10px' }}
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-700 flex-1 truncate">{cb.nombre}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${rol.cls}`}>{rol.label}</span>
                      </div>
                      <div className="pt-1 border-t border-slate-100 space-y-1 mt-1">
                        {(cb.saldo_inicial ?? 0) !== 0 && (
                          <p className="text-slate-400" style={{ fontSize: '11px' }}>Saldo inicial: {formatCLP(cb.saldo_inicial ?? 0)}</p>
                        )}
                        <div className="flex justify-between" style={{ fontSize: '12px' }}>
                          <span className="text-emerald-600 font-medium">+{formatCLP(cb.totalIngresos)}</span>
                          <span className="text-red-600 font-medium">-{formatCLP(cb.totalEgresos)}</span>
                        </div>
                        <p className={`font-medium ${cb.saldoCb >= 0 ? 'text-emerald-700' : 'text-red-700'}`} style={{ fontSize: '14px' }}>
                          {cb.saldoCb >= 0 ? '+' : ''}{formatCLP(cb.saldoCb)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* 2. Tabla de movimientos (sección principal, visible de inmediato) */}
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="card p-4 border-l-4 border-red-400">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Debe</p>
              <p className="text-xl font-bold text-red-700">{formatCLP(totalDebe)}</p>
              <p className="text-xs text-slate-400 mt-0.5">Egresos del período</p>
            </div>
            <div className="card p-4 border-l-4 border-emerald-400">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Haber</p>
              <p className="text-xl font-bold text-emerald-700">{formatCLP(totalHaber)}</p>
              <p className="text-xs text-slate-400 mt-0.5">Ingresos del período</p>
            </div>
            <div className={`card p-4 border-l-4 ${saldoNeto >= 0 ? 'border-emerald-400' : 'border-red-400'}`}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Saldo Neto</p>
              <p className={`text-xl font-bold ${saldoNeto >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCLP(saldoNeto)}</p>
              <p className="text-xs text-slate-400 mt-0.5">Haber − Debe</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="card p-4 space-y-3 mb-4">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
              {[['hoy','Hoy'],['semana','Esta semana'],['mes','Este mes'],['todos','Todos']].map(([v,l]) => (
                <button key={v} onClick={() => setFiltroFechaGasto(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filtroFechaGasto === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>{l}</button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={searchGastos}
                  onChange={e => setSearchGastos(e.target.value)}
                  placeholder="Buscar por comercio, descripción, RUT o trabajador..."
                  className="input-base pl-9"
                />
              </div>
              <select
                value={filtroTrabajador}
                onChange={e => setFiltroTrabajador(e.target.value)}
                className="input-base w-full sm:w-48"
              >
                <option value="todos">Todos los trabajadores</option>
                {trabajadores.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
              <div className="flex gap-1 flex-shrink-0">
                {[['todos','Todos'],['pendiente','Pendiente'],['aprobado','Aprobado'],['rechazado','Rechazado']].map(([v,l]) => (
                  <button key={v} onClick={() => setFiltroEstadoGasto(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      filtroEstadoGasto === v ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Badge filtro cuenta activo */}
          {filtroCuentaId !== null && (() => {
            const cb = cuentasBancarias.find(c => c.id === filtroCuentaId)
            return cb ? (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg w-fit">
                <span className="text-xs font-semibold text-indigo-700">Filtrando por: {cb.nombre}</span>
                <button onClick={() => setFiltroCuentaId(null)} className="text-indigo-400 hover:text-indigo-700 font-bold text-sm leading-none">×</button>
              </div>
            ) : null
          })()}

          {/* Tabla Movimientos */}
          <div className="card overflow-hidden mb-4">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
              <Receipt className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-semibold text-slate-700">Movimientos</h3>
              <span className="text-xs text-slate-400 font-normal ml-1">({filteredGastos.length} registros)</span>
            </div>
            {filteredGastos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Receipt className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-500">Sin gastos registrados</p>
                <p className="text-xs text-slate-400 mt-1">Los gastos ingresados desde la app aparecerán aquí.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="table-th">Fecha</th>
                      <th className="table-th">Trabajador</th>
                      <th className="table-th">Comercio / Descripción</th>
                      <th className="table-th hidden lg:table-cell">Cuenta Contable</th>
                      <th className="table-th hidden lg:table-cell">Documento</th>
                      <th className="table-th text-right">Debe</th>
                      <th className="table-th text-right">Haber</th>
                      <th className="table-th text-right">Saldo</th>
                      <th className="table-th text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {ldMovsPaginados.map(g => {
                      const esContable  = g._tipo === 'movContable'
                      const esRechazado = !esContable && (g.estado === 'rechazado' || g.estado === 'rechazada')
                      return (
                        <tr key={g.id} className={`hover:bg-slate-50/80 transition-colors ${esContable ? 'bg-indigo-50/30' : ''}`}>
                          <td className="table-td text-slate-500 whitespace-nowrap text-xs">{formatDate(g.fecha)}</td>
                          <td className="table-td">
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="text-xs text-slate-700 whitespace-nowrap">{g.trabajadorNombre || '—'}</span>
                            </div>
                          </td>
                          <td className="table-td max-w-[200px]">
                            <div className="font-medium text-slate-800 text-xs truncate">{g.comercio || g.descripcion || '—'}</div>
                            {!esContable && g.comercio && g.descripcion && <div className="text-xs text-slate-400 truncate">{g.descripcion}</div>}
                            {!esContable && g.rutComercio && <div className="text-xs font-mono text-slate-400">{g.rutComercio}</div>}
                            {esContable && g.cuentaOrigen && <div className="text-xs text-slate-400 truncate">{g.cuentaOrigen}{g.cuentaDestino ? ` → ${g.cuentaDestino}` : ''}</div>}
                          </td>
                          <td className="table-td hidden lg:table-cell">
                            {(() => { const sub = g.cuenta_contable_nombre ?? categoriaPatch[g.id]?.subtipo ?? g.subtipo; return sub ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{sub}</span> : <span className="text-slate-300">—</span> })()}
                          </td>
                          <td className="table-td hidden lg:table-cell text-xs text-slate-500">
                            {g.tipoDocumento && <span className="font-medium capitalize">{g.tipoDocumento}</span>}
                            {g.numeroDocumento && <span className="font-mono ml-1 text-slate-400">#{g.numeroDocumento}</span>}
                            {!g.tipoDocumento && !g.numeroDocumento && '—'}
                          </td>
                          <td className="table-td text-right font-semibold text-red-700 whitespace-nowrap text-xs">
                            {esContable
                              ? (g.monto ? formatCLP(g.monto) : <span className="text-slate-300">—</span>)
                              : esRechazado || g.tipo_movimiento === 'ingreso'
                                ? <span className="text-slate-300">—</span>
                                : <>{formatCLP(g.monto)}{g.moneda && g.moneda !== 'CLP' && <span className="text-xs font-normal text-slate-400 ml-1">{g.moneda}</span>}</>
                            }
                          </td>
                          <td className="table-td text-right font-semibold text-emerald-700 whitespace-nowrap text-xs">
                            {esContable && g.montoHaber
                              ? formatCLP(g.montoHaber)
                              : !esContable && g.tipo_movimiento === 'ingreso'
                                ? <>{formatCLP(g.monto)}{g.moneda && g.moneda !== 'CLP' && <span className="text-xs font-normal text-slate-400 ml-1">{g.moneda}</span>}</>
                                : <span className="text-slate-300">—</span>}
                          </td>
                          <td className={`table-td text-right font-semibold whitespace-nowrap text-xs ${!esContable && g.saldo >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {esContable
                              ? <span className="text-slate-300">—</span>
                              : formatCLP(g.saldo)}
                          </td>
                          <td className="table-td text-center">
                            <div className="flex items-center justify-center gap-1">
                              {esContable ? (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                  g.estado === 'confirmado' ? 'bg-emerald-50 text-emerald-700' :
                                  g.estado === 'anulado'    ? 'bg-red-50 text-red-600' :
                                  'bg-amber-50 text-amber-700'
                                }`}>
                                  {g.estado}
                                </span>
                              ) : (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                  g.estado === 'aprobado' || g.estado === 'aprobada' ? 'bg-emerald-50 text-emerald-700' :
                                  g.estado === 'rechazado' || g.estado === 'rechazada' ? 'bg-red-50 text-red-600' :
                                  'bg-amber-50 text-amber-700'
                                }`}>
                                  {g.estado === 'aprobado' || g.estado === 'aprobada' ? 'Aprobado' :
                                   g.estado === 'rechazado' || g.estado === 'rechazada' ? 'Rechazado' : 'Pendiente'}
                                </span>
                              )}
                              {g.fotoUrl && (
                                <a href={g.fotoUrl} target="_blank" rel="noopener noreferrer"
                                   className="p-1 rounded hover:bg-slate-100" title="Ver comprobante">
                                  <Paperclip className="w-3.5 h-3.5 text-emerald-500" />
                                </a>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    const patch = categoriaPatch[g.id]
                                    setEditCat(patch?.categoria ?? g.categoria ?? 'otros')
                                    setEditSub(patch?.subtipo  ?? g.subtipo  ?? '')
                                    setEditCategorizacionGasto(g)
                                  }}
                                  className="p-1 rounded hover:bg-slate-100" title="Editar categoría">
                                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                                </button>
                              )}
                              {!esContable && isAdmin && (
                                <>
                                  {(g.estado === 'pendiente' || g.estado === 'rechazado') && (
                                    <button onClick={() => abrirModalAprobar(g)}
                                      className="p-1 rounded hover:bg-emerald-50" title="Aprobar">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    </button>
                                  )}
                                  {g.estado !== 'rechazado' && g.estado !== 'rechazada' && (
                                    <button onClick={() => updateGastoEstado(g.id, 'rechazado')}
                                      className="p-1 rounded hover:bg-red-50" title="Rechazar">
                                      <XCircle className="w-3.5 h-3.5 text-red-500" />
                                    </button>
                                  )}
                                  {proyectosActivos.length > 0 && (
                                    <button onClick={() => { setAsignandoGasto(g.id); setProyectoSelAsign('') }}
                                      className="p-1 rounded hover:bg-slate-100" title="Reasignar proyecto">
                                      <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {ldTotalPaginas > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span>Mostrar</span>
                  <select
                    value={ldPorPagina}
                    onChange={e => { setLdPorPagina(Number(e.target.value)); setLdPagina(1) }}
                    className="border border-slate-200 rounded px-2 py-1 text-sm">
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>por página · {filteredGastos.length} registros total</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setLdPagina(p => Math.max(1, p - 1))}
                    disabled={ldPagina === 1}
                    className="px-2 py-1 rounded text-sm border border-slate-200 disabled:opacity-40 hover:bg-slate-100">
                    ‹
                  </button>
                  {Array.from({ length: Math.min(5, ldTotalPaginas) }, (_, i) => {
                    let page
                    if (ldTotalPaginas <= 5) page = i + 1
                    else if (ldPagina <= 3) page = i + 1
                    else if (ldPagina >= ldTotalPaginas - 2) page = ldTotalPaginas - 4 + i
                    else page = ldPagina - 2 + i
                    return (
                      <button
                        key={page}
                        onClick={() => setLdPagina(page)}
                        className={`px-3 py-1 rounded text-sm border ${
                          ldPagina === page
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'border-slate-200 hover:bg-slate-100'
                        }`}>
                        {page}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setLdPagina(p => Math.min(ldTotalPaginas, p + 1))}
                    disabled={ldPagina === ldTotalPaginas}
                    className="px-2 py-1 rounded text-sm border border-slate-200 disabled:opacity-40 hover:bg-slate-100">
                    ›
                  </button>
                </div>
                <div className="text-sm text-slate-500">
                  Página {ldPagina} de {ldTotalPaginas}
                </div>
              </div>
            )}
          </div>

          {/* 3. Resúmenes en 3 columnas */}
          <div className="grid grid-cols-3 gap-4">

                  {/* Col 1: Por Cuenta Contable */}
                  <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
                    <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-indigo-500" />
                      Por Cuenta Contable
                    </h4>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-100">
                          <th className="text-left pb-2 font-medium">Cuenta Contable</th>
                          <th className="text-center pb-2 font-medium w-16">Reg.</th>
                          <th className="text-right pb-2 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {Object.entries(porCuentaContable)
                          .sort((a, b) => b[1].total - a[1].total)
                          .map(([cat, datos]) => (
                            <tr key={cat} className="hover:bg-slate-50">
                              <td className="py-1.5 text-slate-700">{cat}</td>
                              <td className="py-1.5 text-center text-slate-500">{datos.cantidad}</td>
                              <td className="py-1.5 text-right font-medium text-red-600">{formatCLP(datos.total)}</td>
                            </tr>
                          ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200 font-semibold">
                          <td className="pt-2 text-slate-700">Total</td>
                          <td className="pt-2 text-center text-slate-600">{gastosPorFecha.length}</td>
                          <td className="pt-2 text-right text-red-700">{formatCLP(gastosPorFecha.reduce((s, g) => s + (g.monto || 0), 0))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Col 2: Por Subcategoría */}
                  <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
                    <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-slate-400" />
                      Por Subcategoría
                    </h4>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-100">
                          <th className="text-left pb-2 font-medium">Subcategoría</th>
                          <th className="text-center pb-2 font-medium w-16">Reg.</th>
                          <th className="text-right pb-2 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {Object.entries(porSubtipo)
                          .sort((a, b) => b[1].total - a[1].total)
                          .map(([sub, datos]) => (
                            <tr key={sub} className="hover:bg-slate-50">
                              <td className="py-1.5 text-slate-700">{sub}</td>
                              <td className="py-1.5 text-center text-slate-500">{datos.cantidad}</td>
                              <td className="py-1.5 text-right font-medium text-red-600">{formatCLP(datos.total)}</td>
                            </tr>
                          ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200 font-semibold">
                          <td className="pt-2 text-slate-700">Total</td>
                          <td className="pt-2 text-center text-slate-600">{gastosPorFecha.length}</td>
                          <td className="pt-2 text-right text-red-700">{formatCLP(gastosPorFecha.reduce((s, g) => s + (g.monto || 0), 0))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Col 3: Por Tipo de Documento */}
                  <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
                    <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-indigo-500" />
                      Por Tipo de Documento
                    </h4>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-100">
                          <th className="text-left pb-2 font-medium">Tipo</th>
                          <th className="text-center pb-2 font-medium w-16">Reg.</th>
                          <th className="text-right pb-2 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {Object.entries(porTipoDoc)
                          .sort((a, b) => b[1].total - a[1].total)
                          .map(([tipo, datos]) => (
                            <tr key={tipo} className="hover:bg-slate-50">
                              <td className="py-1.5 text-slate-700">{tipo}</td>
                              <td className="py-1.5 text-center text-slate-500">{datos.cantidad}</td>
                              <td className="py-1.5 text-right font-medium text-red-600">{formatCLP(datos.total)}</td>
                            </tr>
                          ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200 font-semibold">
                          <td className="pt-2 text-slate-700">Total</td>
                          <td className="pt-2 text-center text-slate-600">{gastosPorFecha.length}</td>
                          <td className="pt-2 text-right text-red-700">{formatCLP(gastosPorFecha.reduce((s, g) => s + (g.monto || 0), 0))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

          </div>
        </>
      )}

      {/* ── TAB CUENTAS ── */}
      {activeTab === 'cuentas' && (
        <>
          {/* Formulario nueva/editar cuenta */}
          {showFormCuenta && (
            <div className="card p-5 border-2 border-indigo-200 bg-indigo-50/20 space-y-4">
              <h4 className="text-sm font-semibold text-slate-800">{editingCuenta ? 'Editar cuenta' : 'Nueva cuenta'}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nombre / Descripción</label>
                  <input
                    value={formCuenta.nombre}
                    onChange={e => setFormCuenta(p => ({ ...p, nombre: e.target.value }))}
                    placeholder="Ej: Arriendo oficina, Netflix, Dividendo banco..."
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Monto ($)</label>
                  <input
                    type="number" min="0" value={formCuenta.monto}
                    onChange={e => setFormCuenta(p => ({ ...p, monto: e.target.value }))}
                    placeholder="0"
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
                  <select value={formCuenta.categoria} onChange={e => setFormCuenta(p => ({ ...p, categoria: e.target.value }))} className="input-base">
                    {CATEGORIAS_CUENTA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Periodicidad</label>
                  <div className="flex gap-2">
                    {[['mensual','Mensual (fija)'],['unica','Pago único']].map(([v, l]) => (
                      <button key={v} type="button"
                        onClick={() => setFormCuenta(p => ({ ...p, periodicidad: v }))}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${formCuenta.periodicidad === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                      >{l}</button>
                    ))}
                  </div>
                </div>
                {formCuenta.periodicidad === 'mensual' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Día del mes (vencimiento)</label>
                    <div className="relative" ref={refDiaMes}>
                      <button
                        type="button"
                        onClick={() => setShowDiaMes(v => !v)}
                        className="input-base w-full text-left flex items-center justify-between"
                      >
                        <span className={formCuenta.diaMes ? 'text-slate-800' : 'text-slate-400'}>
                          {formCuenta.diaMes ? `Día ${formCuenta.diaMes} de cada mes` : 'Seleccionar día'}
                        </span>
                        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      </button>
                      {showDiaMes && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-3 w-64">
                          <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => { setFormCuenta(p => ({ ...p, diaMes: String(d) })); setShowDiaMes(false) }}
                                className={`w-8 h-8 text-xs rounded-lg transition-colors ${
                                  parseInt(formCuenta.diaMes) === d
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-700 hover:bg-indigo-50'
                                }`}
                              >{d}</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de vencimiento</label>
                    <input type="date" value={formCuenta.fechaVencimiento}
                      onChange={e => setFormCuenta(p => ({ ...p, fechaVencimiento: e.target.value }))}
                      className="input-base"
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowFormCuenta(false); setEditingCuenta(null) }} className="btn-secondary">Cancelar</button>
                <button onClick={handleGuardarCuenta} disabled={!formCuenta.nombre.trim() || !formCuenta.monto} className="btn-primary disabled:opacity-50">
                  {editingCuenta ? 'Guardar cambios' : 'Agregar cuenta'}
                </button>
              </div>
            </div>
          )}

          {/* TELÉFONOS DE RECORDATORIO */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-500" />
              Teléfonos para recordatorios de pago
              <span className="text-xs text-slate-400 font-normal">(máx. 3 números)</span>
            </h3>
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-4">{i + 1}.</span>
                  <input
                    type="tel"
                    placeholder="+56 9 XXXX XXXX"
                    value={telefonosRecordatorio[i] || ''}
                    onChange={e => {
                      const nuevo = [...telefonosRecordatorio]
                      nuevo[i] = e.target.value
                      setTelefonosRecordatorio(nuevo)
                    }}
                    className="input-base flex-1 text-sm"
                  />
                </div>
              ))}
            </div>
            <button onClick={handleGuardarTelefonos} className="btn-primary mt-3 text-sm">
              Guardar teléfonos
            </button>
          </div>

          {/* CALENDARIO MENSUAL */}
          <div className="card overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-semibold text-slate-700 capitalize">
                {new Date(calAnio, calMes, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
              </span>
              <div className="ml-auto flex items-center gap-0.5">
                <button
                  onClick={() => { const d = new Date(calAnio, calMes - 1, 1); setCalMes(d.getMonth()); setCalAnio(d.getFullYear()) }}
                  className="p-1 rounded hover:bg-slate-200 transition-colors"
                ><ChevronLeft className="w-3.5 h-3.5 text-slate-500" /></button>
                <button
                  onClick={() => { const d = new Date(calAnio, calMes + 1, 1); setCalMes(d.getMonth()); setCalAnio(d.getFullYear()) }}
                  className="p-1 rounded hover:bg-slate-200 transition-colors"
                ><ChevronRight className="w-3.5 h-3.5 text-slate-500" /></button>
              </div>
            </div>
            <div className="px-2 py-2">
              <div className="grid grid-cols-7">
                {['Lu','Ma','Mi','Ju','Vi','Sa','Do'].map(d => (
                  <div key={d} className="text-center text-[10px] font-medium text-slate-400 pb-1">{d}</div>
                ))}
              </div>
              {(() => {
                const primerDia = new Date(calAnio, calMes, 1)
                let startCol = primerDia.getDay() - 1
                if (startCol < 0) startCol = 6
                const diasEnMes = new Date(calAnio, calMes + 1, 0).getDate()
                const hoyD = new Date()
                const cells = []
                for (let i = 0; i < startCol; i++) cells.push(<div key={`e-${i}`} />)
                for (let dia = 1; dia <= diasEnMes; dia++) {
                  const pagosDelDia = pagosPorDia[dia] || []
                  const hayPagos = pagosDelDia.length > 0
                  const todosPagados = hayPagos && pagosDelDia.every(p => p.estado === 'pagado')
                  const hayPendientes = hayPagos && pagosDelDia.some(p => p.estado === 'pendiente')
                  const esHoy = dia === hoyD.getDate() && calMes === hoyD.getMonth() && calAnio === hoyD.getFullYear()
                  const tooltip = hayPagos
                    ? pagosDelDia.map(p => {
                        const c = cuentas.find(c => c.id === p.cuentaId)
                        return `${c?.nombre ?? '?'} — ${formatCLP(p.monto)} (${p.estado})`
                      }).join('\n') + `\nTotal: ${formatCLP(pagosDelDia.reduce((s, p) => s + p.monto, 0))}`
                    : undefined
                  cells.push(
                    <div
                      key={dia}
                      title={tooltip}
                      className={`relative w-full h-9 flex flex-col items-center justify-start pt-1 rounded text-xs transition-colors
                        ${esHoy ? 'ring-1 ring-indigo-400 bg-indigo-50' : hayPagos ? 'hover:bg-slate-100 cursor-default' : ''}
                      `}
                    >
                      <span className={`text-xs font-medium leading-none ${esHoy ? 'text-indigo-700' : 'text-slate-700'}`}>{dia}</span>
                      {hayPendientes && <span className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-red-400" />}
                      {!hayPendientes && todosPagados && <span className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    </div>
                  )
                }
                return <div className="grid grid-cols-7">{cells}</div>
              })()}
            </div>
          </div>

          {/* LISTADO DE CUENTAS */}
          {cuentas.length > 0 ? (
            <div className="space-y-3">
              {cuentas.map(cuenta => {
                const cat = catMap[cuenta.categoria] ?? catMap.otro
                const pagosDeEstaCuenta = pagosCuentas
                  .filter(p => p.cuentaId === cuenta.id)
                  .sort((a, b) => (b.fechaVencimiento ?? '').localeCompare(a.fechaVencimiento ?? ''))
                return (
                  <div key={cuenta.id} className="card overflow-hidden">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800">{cuenta.nombre}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.cls}`}>{cat.label}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                            {cuenta.periodicidad === 'mensual' ? `Mensual · día ${cuenta.diaMes ?? '?'}` : 'Pago único'}
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-red-700">{formatCLP(cuenta.monto)}</span>
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditCuenta(cuenta)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors" title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setConfirmDelCta(cuenta.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Eliminar">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    {pagosDeEstaCuenta.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-slate-400">Sin pagos registrados aún</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {pagosDeEstaCuenta.map(pago => (
                          <div key={pago.id} className="px-4 py-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0 text-sm text-slate-700">
                              {pago.fechaVencimiento ? formatDate(pago.fechaVencimiento) : '—'}
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                              pago.estado === 'pagado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {pago.estado === 'pagado' ? 'Pagado' : 'Pendiente'}
                            </span>
                            {pago.comprobanteUrl ? (
                              <button
                                onClick={() => setModalComprobanteCuenta(pago)}
                                title="Ver comprobante"
                                className="flex-shrink-0"
                              >
                                <Paperclip className="w-4 h-4 text-emerald-500" />
                              </button>
                            ) : (
                              <label className="cursor-pointer flex-shrink-0" title="Subir comprobante">
                                <input
                                  type="file"
                                  accept="image/*,.pdf"
                                  className="hidden"
                                  onChange={e => { const f = e.target.files?.[0]; if (f) handleSubirComprobante(pago.id, f); e.target.value = '' }}
                                />
                                {uploadingPagoId === pago.id
                                  ? <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                                  : <Paperclip className="w-4 h-4 text-red-400" />
                                }
                              </label>
                            )}
                            {pago.estado === 'pendiente' && (
                              <button
                                onClick={() => handlePagarCuenta(pago, cuenta)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex-shrink-0"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />Pagar
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : !showFormCuenta && (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">Sin cuentas registradas</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">Registra las obligaciones fijas (arriendo, servicios) y pagos únicos de la empresa para generar una proyección financiera real.</p>
              {isAdmin && <button onClick={openNewCuenta} className="btn-primary mt-4"><Plus className="w-4 h-4" />Nueva cuenta</button>}
            </div>
          )}
        </>
      )}

      {/* ── TAB LIBRO DIARIO ── */}

      {/* ── TAB PROYECCIÓN ── */}
      {activeTab === 'proyeccion' && (
        <>
          {/* Banner por cobrar */}
          {(() => {
            const pendIngreso = movimientos.filter(m => normalizaTipo(m.tipo) === 'ingreso' && !m.conciliado)
            const totalPend   = pendIngreso.reduce((s, m) => s + m.monto, 0)
            return totalPend > 0 && (
              <div className="rounded-xl bg-orange-50 border border-orange-200 p-4 flex items-center gap-3">
                <Clock className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-orange-800">Tienes {formatCLP(totalPend)} por cobrar</p>
                  <p className="text-xs text-orange-600 mt-0.5">{pendIngreso.length} ingreso{pendIngreso.length !== 1 ? 's' : ''} facturado{pendIngreso.length !== 1 ? 's' : ''} pendiente{pendIngreso.length !== 1 ? 's' : ''} de cobro — incluidos en el mes actual de la proyección</p>
                </div>
              </div>
            )
          })()}

          {/* Tabla proyección */}
          <div className="card overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Proyección próximos 6 meses</p>
              <p className="text-xs text-slate-400 mt-0.5">Gastos fijos mensuales + obligaciones con fecha + ingresos confirmados por mes</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Mes</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Gastos fijos</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Oblig. únicas</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-red-600">Total a pagar</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-emerald-600">Confirmado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-orange-500">Por cobrar</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {proyeccion.map((mes) => (
                    <tr key={mes.yyyyMM} className={`transition-colors ${mes.isCurrentMonth ? 'bg-indigo-50/40' : 'hover:bg-slate-50/60'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold capitalize ${mes.isCurrentMonth ? 'text-indigo-700' : 'text-slate-700'}`}>{mes.label}</span>
                          {mes.isCurrentMonth && <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-600">Actual</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-red-600 font-medium">{mes.fijas > 0 ? formatCLP(mes.fijas) : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-right text-xs text-red-600 font-medium">{mes.unicas > 0 ? formatCLP(mes.unicas) : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-bold ${mes.totalOblig > 0 ? 'text-red-700' : 'text-slate-300'}`}>{mes.totalOblig > 0 ? formatCLP(mes.totalOblig) : '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-emerald-700 font-medium">{mes.cobrado > 0 ? formatCLP(mes.cobrado) : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-right text-xs text-orange-600 font-medium">{mes.porCobrar > 0 ? formatCLP(mes.porCobrar) : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-bold ${mes.neto >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {mes.neto >= 0 ? '+' : ''}{formatCLP(mes.neto)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="px-4 py-3 text-xs font-semibold text-slate-500">Total 6 meses</td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-red-600">{formatCLP(proyeccion.reduce((s, m) => s + m.fijas, 0))}</td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-red-600">{formatCLP(proyeccion.reduce((s, m) => s + m.unicas, 0))}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-red-700">{formatCLP(proyeccion.reduce((s, m) => s + m.totalOblig, 0))}</td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-emerald-700">{formatCLP(proyeccion.reduce((s, m) => s + m.cobrado, 0))}</td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-orange-600">{formatCLP(proyeccion.reduce((s, m) => s + m.porCobrar, 0))}</td>
                    <td className="px-4 py-3 text-right">
                      {(() => {
                        const netoTotal = proyeccion.reduce((s, m) => s + m.neto, 0)
                        return <span className={`text-sm font-bold ${netoTotal >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{netoTotal >= 0 ? '+' : ''}{formatCLP(netoTotal)}</span>
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {cuentas.filter(c => c.activa || (c.periodicidad === 'unica' && !c.pagada)).length === 0 && (
              <div className="px-4 py-6 text-center border-t border-slate-100">
                <p className="text-xs text-slate-400">Sin cuentas registradas — ve al tab <span className="font-medium text-indigo-500">Cuentas</span> para agregar obligaciones</p>
              </div>
            )}
          </div>

          {/* Leyenda */}
          <div className="flex flex-wrap gap-4 text-xs text-slate-500 px-1">
            <span><span className="font-semibold text-red-600">Gastos fijos</span>: obligaciones mensuales activas (arriendo, sueldos, etc.)</span>
            <span><span className="font-semibold text-red-600">Oblig. únicas</span>: pagos puntuales con fecha en ese mes</span>
            <span><span className="font-semibold text-emerald-600">Confirmado</span>: ingresos ya cobrados (conciliados) en ese mes</span>
            <span><span className="font-semibold text-orange-500">Por cobrar</span>: ingresos facturados pendientes de cobro (mes actual)</span>
          </div>
        </>
      )}

      {/* Modal: editar cuenta bancaria */}
      <Modal open={!!editCbModal} onClose={() => setEditCbModal(null)} title="Editar cuenta bancaria">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre de la cuenta</label>
              <input value={formEditBanco.nombre || ''} onChange={e => setFormEditBanco(p => ({ ...p, nombre: e.target.value }))} className="input-base" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Banco</label>
              <select value={formEditBanco.banco || ''} onChange={e => setFormEditBanco(p => ({ ...p, banco: e.target.value }))} className="input-base">
                {['BancoEstado','Banco de Chile','Santander','BCI','Scotiabank','Itaú','BICE','Falabella','Ripley','Otro'].map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de cuenta</label>
              <select value={formEditBanco.tipo_cuenta || ''} onChange={e => setFormEditBanco(p => ({ ...p, tipo_cuenta: e.target.value }))} className="input-base">
                <option value="corriente">Cuenta corriente</option>
                <option value="vista">Cuenta vista</option>
                <option value="ahorro">Cuenta de ahorro</option>
                <option value="rut">Cuenta RUT</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Número de cuenta</label>
              <input value={formEditBanco.numero_cuenta || ''} onChange={e => setFormEditBanco(p => ({ ...p, numero_cuenta: e.target.value }))} placeholder="Ej: 00012345678" className="input-base" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rol</label>
              <select value={formEditBanco.rol || ''} onChange={e => setFormEditBanco(p => ({ ...p, rol: e.target.value }))} className="input-base">
                <option value="central">Banco Central — ingresos por ventas</option>
                <option value="impuestos">Banco Impuestos — IVA y PREVIRED</option>
                <option value="caja_chica">Caja Chica — gastos operacionales</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Descripción (opcional)</label>
              <input value={formEditBanco.descripcion || ''} onChange={e => setFormEditBanco(p => ({ ...p, descripcion: e.target.value }))} placeholder="Notas adicionales..." className="input-base" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setEditCbModal(null)} className="btn-secondary">Cancelar</button>
            <button onClick={handleGuardarEditBanco} disabled={!formEditBanco.nombre?.trim() || editCbSaving} className="btn-primary disabled:opacity-50">
              {editCbSaving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: confirmar / bloquear eliminar cuenta bancaria */}
      {confirmDelCb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmDelCb(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            {confirmDelCb.bloqueado ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">No se puede eliminar</p>
                    <p className="text-xs text-slate-500 mt-0.5">{confirmDelCb.nombre}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600">Esta cuenta tiene movimientos de gastos asociados. Puedes desactivarla en su lugar.</p>
                <div className="flex justify-end">
                  <button onClick={() => setConfirmDelCb(null)} className="btn-secondary">Cerrar</button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">Eliminar cuenta bancaria</p>
                    <p className="text-xs text-slate-500 mt-0.5">{confirmDelCb.nombre}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600">Esta acción es irreversible. ¿Confirmas que deseas eliminar esta cuenta?</p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setConfirmDelCb(null)} className="btn-secondary">Cancelar</button>
                  <button
                    onClick={handleConfirmarEliminarCb}
                    disabled={delCbLoading}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                  >{delCbLoading ? 'Eliminando...' : 'Sí, eliminar'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirm eliminar cuenta */}
      <ConfirmModal
        open={!!confirmDelCta}
        onClose={() => setConfirmDelCta(null)}
        onConfirm={() => { deleteCuenta(confirmDelCta); setConfirmDelCta(null) }}
        title="Eliminar cuenta"
        message="¿Estás seguro que deseas eliminar esta cuenta? Esta acción no se puede deshacer."
      />

      {/* Modal comprobante gasto */}
      {boletaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setBoletaModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <p className="font-semibold text-slate-900 text-sm">Comprobante</p>
                {boletaModal.descripcion && <p className="text-xs text-slate-500 mt-0.5">{boletaModal.descripcion}</p>}
              </div>
              <div className="flex items-center gap-2">
                <a href={boletaModal.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />Abrir en nueva pestaña
                </a>
                <button onClick={() => setBoletaModal(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-50 flex items-center justify-center min-h-[300px]">
              <img src={boletaModal.url} alt="Comprobante" className="max-w-full max-h-[60vh] object-contain rounded-lg shadow"
                onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
              <div className="hidden flex-col items-center gap-3 text-slate-500">
                <FileText className="w-12 h-12 text-slate-300" />
                <p className="text-sm">No se puede previsualizar este archivo.</p>
                <a href={boletaModal.url} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs">
                  <ExternalLink className="w-3.5 h-3.5" />Descargar archivo
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={!!editCategorizacionGasto}
        onClose={() => setEditCategorizacionGasto(null)}
        title="Editar categorización"
      >
        {editCategorizacionGasto && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              {editCategorizacionGasto.comercio || editCategorizacionGasto.descripcion || '—'}
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
              <select className="input-base w-full" value={editCat} onChange={e => setEditCat(e.target.value)}>
                <option value="combustible">Combustible</option>
                <option value="alimentacion">Alimentación</option>
                <option value="alojamiento">Alojamiento</option>
                <option value="materiales">Materiales</option>
                <option value="transporte">Transporte</option>
                <option value="herramientas">Herramientas</option>
                <option value="viaticos">Viáticos</option>
                <option value="otros">Otros</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Subcategoría</label>
              <select className="input-base w-full" value={editSub} onChange={e => setEditSub(e.target.value)}>
                <option value="">Sin subcategoría</option>
                <optgroup label="Egreso">
                  <option value="caja_chica">Caja chica</option>
                  <option value="adelanto">Adelanto</option>
                  <option value="impuesto">Impuesto</option>
                  <option value="remuneracion">Remuneración</option>
                  <option value="proveedor">Proveedor</option>
                  <option value="gasto_operacional">Gasto operacional</option>
                </optgroup>
                <optgroup label="Ingreso">
                  <option value="cobro_cliente">Cobro cliente</option>
                  <option value="otro_ingreso">Otro ingreso</option>
                </optgroup>
                <optgroup label="Traspaso">
                  <option value="traspaso_interno">Traspaso interno</option>
                </optgroup>
              </select>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setEditCategorizacionGasto(null)} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={handleGuardarCategorizacion} className="btn-primary">
                Guardar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!modalAprobarGasto}
        onClose={() => { setModalAprobarGasto(null); setProyectoSeleccionado(''); setModalErrorCuentas('') }}
        title="Aprobar gasto"
      >
        {modalAprobarGasto && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              {modalAprobarGasto.comercio} · {formatCLP(modalAprobarGasto.monto)}
            </p>

            {/* Cuenta contable */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Cuenta contable <span className="text-red-500">*</span>
              </label>
              {modalCargandoCuentas ? (
                <p className="text-xs text-slate-400">Cargando cuentas...</p>
              ) : (
                <select
                  className="input-base w-full"
                  value={modalCuentaContableId}
                  onChange={e => setModalCuentaContableId(e.target.value)}
                >
                  <option value="">Seleccionar cuenta contable</option>
                  {modalCuentasContables.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Cuenta bancaria origen */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Cuenta bancaria origen <span className="text-red-500">*</span>
              </label>
              {modalCargandoCuentas ? (
                <p className="text-xs text-slate-400">Cargando cuentas...</p>
              ) : (
                <select
                  className="input-base w-full"
                  value={modalCuentaBancariaId}
                  onChange={e => setModalCuentaBancariaId(e.target.value)}
                >
                  <option value="">Seleccionar cuenta bancaria</option>
                  {modalCuentasBancarias.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre} — {c.banco}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Proyecto */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Asociar a proyecto (opcional)
              </label>
              <select
                className="input-base w-full"
                value={proyectoSeleccionado}
                onChange={e => setProyectoSeleccionado(e.target.value)}
              >
                <option value="">Sin proyecto asociado</option>
                {proyectos
                  .filter(p => p.estado === 'ejecucion')
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.codigo} — {p.nombre}
                    </option>
                  ))}
              </select>
            </div>

            {modalErrorCuentas && (
              <p className="text-xs text-red-600">{modalErrorCuentas}</p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => { setModalAprobarGasto(null); setProyectoSeleccionado(''); setModalErrorCuentas('') }}
                className="btn-secondary">
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!modalCuentaContableId) {
                    setModalErrorCuentas('Selecciona una cuenta contable')
                    return
                  }
                  if (!modalCuentaBancariaId) {
                    setModalErrorCuentas('Selecciona una cuenta bancaria origen')
                    return
                  }
                  const gastoId = modalAprobarGasto.id
                  const proyId = proyectoSeleccionado || null
                  const nombreContable = modalCuentasContables.find(c => c.id === modalCuentaContableId)?.nombre ?? ''
                  setModalAprobarGasto(null)
                  setProyectoSeleccionado('')
                  setModalErrorCuentas('')
                  try {
                    await apiClient.patch(`/gastos/${gastoId}/estado`, {
                      estado: 'aprobado',
                      proyecto_id: proyId,
                      cuenta_contable_id: modalCuentaContableId,
                      cuenta_contable_nombre: nombreContable,
                      cuenta_bancaria_id: modalCuentaBancariaId,
                    })
                    recargarGastos()
                  } catch (err) {
                    console.error('[aprobar gasto]', err)
                  }
                }}
                className="btn-primary">
                Aprobar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <CartolaPicker
        open={showCartola}
        onClose={() => setShowCartola(false)}
        pendientes={movimientos.filter(m => !m.conciliado)}
        onImportar={handleImportar}
      />

      <ConfirmModal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => { toggleConciliado(confirmId.id); setConfirmId(null) }}
        title={confirmId?.tipo === 'ingreso' ? 'Confirmar cobro' : 'Conciliar movimiento'}
        message={confirmId?.tipo === 'ingreso'
          ? `¿Confirmar que el cliente realizó el pago de "${toConfirm?.descripcion}"? Podrás deshacer esta acción.`
          : `¿Marcar "${toConfirm?.descripcion}" como conciliado? Podrás deshacer esta acción.`
        }
      />

      {/* Modal de conciliación — simple */}
      {conciliarModal && (() => {
        const tipoMov  = normalizaTipo(conciliarModal.tipo)
        const esIngreso = tipoMov === 'ingreso'
        const candidatos = candidatosMap[conciliarModal.id] || []

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConciliarModal(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200">
                <div className="space-y-1 flex-1 min-w-0 mr-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${esIngreso ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {esIngreso ? 'Ingreso' : 'Egreso'}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(conciliarModal.fecha)}</span>
                  </div>
                  <p className="font-semibold text-slate-900 text-sm truncate">{conciliarModal.glosa || conciliarModal.descripcion}</p>
                  <p className={`text-lg font-bold ${esIngreso ? 'text-emerald-700' : 'text-red-700'}`}>{esIngreso ? '+' : '-'}{formatCLP(conciliarModal.monto)}</p>
                  {conciliarModal.cuentas_bancarias?.nombre && (
                    <p className="text-xs text-slate-400">{conciliarModal.cuentas_bancarias.nombre}</p>
                  )}
                </div>
                <button onClick={() => setConciliarModal(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">

                {/* Sugerencias automáticas */}
                {candidatos.length > 0 && (
                  <details className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
                    <summary className="px-3 py-2 text-xs font-semibold text-amber-700 cursor-pointer select-none flex items-center gap-1.5">
                      <Zap className="w-3 h-3" />
                      {candidatos.length} sugerencia{candidatos.length !== 1 ? 's' : ''} automática{candidatos.length !== 1 ? 's' : ''}
                    </summary>
                    <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                      {candidatos.map((c, i) => (
                        <button
                          key={i}
                          onClick={() => setConciliarDesc(c.numero || c.descripcion || '')}
                          className="px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors"
                        >
                          {c.numero || c.descripcion} · {formatCLP(c.monto)}
                        </button>
                      ))}
                    </div>
                  </details>
                )}

                {/* Cuenta contable */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Cuenta contable <span className="text-red-500">*</span></label>
                  <select
                    value={conciliarCtaId}
                    onChange={e => setConciliarCtaId(e.target.value)}
                    className="input-base"
                  >
                    <option value="">Seleccionar cuenta...</option>
                    {cuentasContables
                      .filter(c => c.tipo === tipoMov || c.tipo === 'ambos')
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.codigo ? `${c.codigo} — ` : ''}{c.nombre}</option>
                      ))
                    }
                  </select>
                </div>

                {/* Tipo de documento */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de documento <span className="text-red-500">*</span></label>
                  <select
                    value={conciliarTipoDoc}
                    onChange={e => setConciliarTipoDoc(e.target.value)}
                    className="input-base"
                  >
                    <option value="">Seleccionar...</option>
                    {tiposDocumento.length > 0
                      ? tiposDocumento.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)
                      : ['Boleta','Boleta electrónica','Factura','Factura electrónica','Sin documento físico'].map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))
                    }
                    <option value="Sin documento físico">Sin documento físico</option>
                  </select>
                </div>

                {/* Descripción del documento */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Descripción del documento <span className="text-red-500">*</span></label>
                  <input
                    value={conciliarDesc}
                    onChange={e => setConciliarDesc(e.target.value)}
                    placeholder="Ej: Boleta Sodimac, Factura Entel, Adelanto trabajador..."
                    className="input-base"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200">
                <div>
                  {conciliarModal.conciliado && isAdmin && (
                    <button
                      onClick={() => { setConciliarModal(null); setDesconciliarConfirm(conciliarModal) }}
                      className="text-xs font-medium text-red-500 hover:text-red-700 underline"
                    >
                      Desconciliar
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setConciliarModal(null)} className="btn-secondary">Cancelar</button>
                  <button
                    disabled={!conciliarCtaId || !conciliarTipoDoc || !conciliarDesc.trim() || !!conciliandoId}
                    onClick={handleConciliarSimple}
                    className="btn-primary disabled:opacity-40"
                  >
                    {conciliandoId ? 'Guardando...' : conciliarModal.conciliado ? 'Actualizar' : 'Conciliar ✓'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal asociar/ver gasto o factura */}
      {gastoModal && (() => {
        const mov = gastoModal
        const esIngreso = normalizaTipo(mov.tipo) === 'ingreso'

        /* ── IDs ya usados en otros movimientos (excluir de candidatos) ── */
        const idsUsados = new Set(
          movsBancarios
            .filter(m => m.gasto_id && m.id !== mov.id)
            .map(m => String(m.gasto_id))
        )

        /* ── INGRESO: facturas de venta ── */
        const facturaActual = esIngreso && mov.gasto_id
          ? facturasDisponibles.find(x => String(x.id) === String(mov.gasto_id))
          : null

        const facturasLibres = facturasDisponibles.filter(f => !idsUsados.has(String(f.id)))

        const candidatosFacturas = [...facturasLibres]
          .sort((a, b) => Math.abs((a.total || 0) - (mov.monto || 0)) - Math.abs((b.total || 0) - (mov.monto || 0)) || (b.fecha_emision || '').localeCompare(a.fecha_emision || ''))
          .slice(0, 5)

        const resultadosFacturas = (() => {
          const q = gastoSearch.toLowerCase()
          return facturasLibres.filter(f =>
            !q ||
            String(f.folio || '').toLowerCase().includes(q) ||
            (f.razon_social || '').toLowerCase().includes(q)
          ).slice(0, 30)
        })()

        const renderFacturaRow = (f, badge) => (
          <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span className="font-mono font-semibold text-slate-700 flex-shrink-0">Nº{f.folio}</span>
                <span className="font-medium text-slate-800 truncate">{f.razon_social || '—'}</span>
                {badge}
              </div>
              <div className="text-slate-400">{formatDate(f.fecha_emision)} · {formatCLP(f.total)}</div>
            </div>
            <button
              onClick={() => handleAsociarFacturaAMov(f)}
              className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
            >
              Asociar
            </button>
          </div>
        )

        /* ── EGRESO: gastos ── */
        const gastoActual = !esIngreso && mov.gasto_id
          ? gastosDisponibles.find(x => String(x.id) === String(mov.gasto_id))
          : null

        const mesRef = (mov.fecha || '').slice(0, 7)

        const candidatosGastos = [...gastosDisponibles]
          .sort((a, b) => Math.abs((a.monto || 0) - (mov.monto || 0)) - Math.abs((b.monto || 0) - (mov.monto || 0)) || (b.fecha_gasto || '').localeCompare(a.fecha_gasto || ''))
          .slice(0, 5)

        const resultadosGastos = (() => {
          const q = gastoSearch.toLowerCase()
          return gastosDisponibles.filter(g => {
            if (q && !(g.comercio || '').toLowerCase().includes(q) && !(g.descripcion || '').toLowerCase().includes(q)) return false
            if (!q && mesRef) {
              const gMes = (g.fecha_gasto || '').slice(0, 7)
              const prev = mesRef.slice(0, 4) + '-' + String(parseInt(mesRef.slice(5, 7)) - 1).padStart(2, '0')
              const next = mesRef.slice(0, 4) + '-' + String(parseInt(mesRef.slice(5, 7)) + 1).padStart(2, '0')
              if (gMes !== mesRef && gMes !== prev && gMes !== next) return false
            }
            return true
          }).slice(0, 30)
        })()

        const renderGastoRow = (g, badge) => (
          <div key={g.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span className="font-medium text-slate-800 truncate">{g.comercio || g.descripcion || '—'}</span>
                {badge}
              </div>
              <div className="text-slate-400">{formatDate(g.fecha_gasto)} · {formatCLP(g.monto)}{g.trabajador_nombre ? ` · ${g.trabajador_nombre}` : ''}</div>
            </div>
            {g.foto_url && (
              <button onClick={() => window.open(g.foto_url, '_blank')} className="text-slate-400 hover:text-indigo-600 flex-shrink-0" title="Ver foto">
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => handleAsociarGastoAMov(g)}
              className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
            >
              Asociar
            </button>
          </div>
        )

        const docActual = esIngreso ? facturaActual : gastoActual
        const tituloModal = esIngreso ? 'Asociar factura de venta' : 'Asociar documento'
        const labelCambiar = esIngreso ? 'Cambiar factura' : 'Cambiar gasto'
        const labelSeccion = esIngreso ? 'Factura asociada' : 'Gasto asociado'

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setGastoModal(null); setGastoSearch('') }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                <div className="space-y-0.5">
                  <p className="font-semibold text-slate-900 text-sm">{tituloModal}</p>
                  <p className="text-xs text-slate-400">{formatDate(mov.fecha)} · {mov.glosa || mov.descripcion} · <span className="font-semibold text-slate-600">{formatCLP(mov.monto)}</span></p>
                </div>
                <button onClick={() => { setGastoModal(null); setGastoSearch('') }} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-5 space-y-4">

                {/* Vista detalle — documento ya asociado */}
                {gastoModalVista === 'detalle' && docActual && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{labelSeccion}</p>
                    <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                      {esIngreso ? (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <p className="text-xs text-slate-400 font-mono">Nº{facturaActual.folio}</p>
                              <p className="font-semibold text-slate-800">{facturaActual.razon_social || '—'}</p>
                              <p className="text-xs text-slate-400">{formatDate(facturaActual.fecha_emision)}</p>
                            </div>
                            <p className="font-bold text-slate-800 flex-shrink-0">{formatCLP(facturaActual.total)}</p>
                          </div>
                          {Math.abs((facturaActual.total || 0) - (mov.monto || 0)) > 0 && (
                            <p className="text-xs text-red-600 font-medium">Diferencia: -{formatCLP(Math.abs((facturaActual.total || 0) - (mov.monto || 0)))}</p>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <p className="font-semibold text-slate-800">{gastoActual.comercio || gastoActual.descripcion || '—'}</p>
                              {gastoActual.descripcion && gastoActual.comercio && (
                                <p className="text-xs text-slate-500">{gastoActual.descripcion}</p>
                              )}
                              <p className="text-xs text-slate-400">{formatDate(gastoActual.fecha_gasto)} · {gastoActual.trabajador_nombre || ''}</p>
                            </div>
                            <p className="font-bold text-slate-800 flex-shrink-0">{formatCLP(gastoActual.monto)}</p>
                          </div>
                          {Math.abs((gastoActual.monto || 0) - (mov.monto || 0)) > 0 && (
                            <p className="text-xs text-red-600 font-medium">Diferencia: -{formatCLP(Math.abs((gastoActual.monto || 0) - (mov.monto || 0)))}</p>
                          )}
                          {gastoActual.foto_url && (
                            <button onClick={() => window.open(gastoActual.foto_url, '_blank')} className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800">
                              <ExternalLink className="w-3 h-3" />Ver foto
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setGastoModalVista('buscar')} className="flex-1 btn-secondary text-sm">{labelCambiar}</button>
                      <button onClick={handleDesasociarGasto} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200">Desasociar</button>
                    </div>
                  </div>
                )}

                {/* Vista búsqueda */}
                {(gastoModalVista === 'buscar' || !docActual) && (
                  <>
                    {esIngreso ? (
                      <>
                        {/* Candidatos facturas */}
                        {!gastoSearch && candidatosFacturas.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Candidatos automáticos</p>
                            {candidatosFacturas.map(f => {
                              const diff = Math.abs((f.total || 0) - (mov.monto || 0))
                              const badge = diff === 0
                                ? <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded-full flex-shrink-0">Coincide exacto</span>
                                : <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-full flex-shrink-0">Diferencia {formatCLP(diff)}</span>
                              return renderFacturaRow(f, badge)
                            })}
                          </div>
                        )}
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Buscar factura</p>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                            <input value={gastoSearch} onChange={e => setGastoSearch(e.target.value)} placeholder="Buscar por folio o razón social..." className="input-base pl-8" />
                          </div>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {resultadosFacturas.length === 0
                              ? <p className="text-xs text-slate-400 text-center py-4">{gastoSearch ? `Sin resultados para "${gastoSearch}"` : 'Sin facturas de venta disponibles'}</p>
                              : resultadosFacturas.map(f => renderFacturaRow(f, null))
                            }
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Candidatos gastos */}
                        {!gastoSearch && candidatosGastos.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Candidatos automáticos</p>
                            {candidatosGastos.map(g => {
                              const diff = Math.abs((g.monto || 0) - (mov.monto || 0))
                              const badge = diff === 0
                                ? <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded-full flex-shrink-0">Coincide exacto</span>
                                : <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-full flex-shrink-0">Diferencia {formatCLP(diff)}</span>
                              return renderGastoRow(g, badge)
                            })}
                          </div>
                        )}
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Buscar gasto</p>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                            <input value={gastoSearch} onChange={e => setGastoSearch(e.target.value)} placeholder="Buscar por comercio o descripción..." className="input-base pl-8" />
                          </div>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {resultadosGastos.length === 0
                              ? <p className="text-xs text-slate-400 text-center py-4">{gastoSearch ? `Sin resultados para "${gastoSearch}"` : 'Sin gastos en este período'}</p>
                              : resultadosGastos.map(g => renderGastoRow(g, null))
                            }
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
                <button onClick={() => { setGastoModal(null); setGastoSearch('') }} className="btn-secondary">Cancelar</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal reclasificar cuenta contable */}
      {reclasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setReclasModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <p className="font-semibold text-slate-900 text-sm">Reclasificar cuenta contable</p>
              <button onClick={() => setReclasModal(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Movimiento</span>
                  <span className="font-medium truncate max-w-[180px]">{reclasModal.glosa || reclasModal.descripcion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Documento</span>
                  <span className="font-medium">{reclasModal.conciliado_documento_numero || '—'}</span>
                </div>
                {reclasModal.cuenta_contable_nombre && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cuenta actual</span>
                    <span className="font-medium text-amber-700">{reclasModal.cuenta_contable_nombre}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Nueva cuenta contable</label>
                <select
                  value={reclasCtaId}
                  onChange={e => setReclasCtaId(e.target.value)}
                  className="input-base"
                >
                  <option value="">Seleccionar...</option>
                  {cuentasContables
                    .filter(c => c.tipo === normalizaTipo(reclasModal.tipo) || c.tipo === 'ambos')
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {String(c.codigo)} — {String(c.nombre)}
                      </option>
                    ))
                  }
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setReclasModal(null)} className="btn-secondary">Cancelar</button>
                <button
                  disabled={!reclasCtaId || reclasLoading}
                  onClick={handleReclasificar}
                  className="btn-primary disabled:opacity-50"
                >
                  {reclasLoading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desconciliar confirm */}
      <ConfirmModal
        open={!!desconciliarConfirm}
        onClose={() => setDesconciliarConfirm(null)}
        onConfirm={() => handleDesconciliar(desconciliarConfirm.id)}
        title="Desconciliar movimiento"
        message={`¿Confirmas que deseas desconciliar este movimiento? Se eliminará la asociación con "${desconciliarConfirm?.conciliado_documento_numero || 'el documento'}".`}
      />

      {importBancoToast && (
        <div className="fixed bottom-4 right-4 z-[60] bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {importBancoToast}
        </div>
      )}

      {cuentaToast && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 ${cuentaToast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {cuentaToast.type === 'error'
            ? <AlertCircle className="w-4 h-4 flex-shrink-0" />
            : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          }
          {cuentaToast.msg}
        </div>
      )}

      {modalComprobanteCuenta && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModalComprobanteCuenta(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Comprobante adjunto</h3>
              <button onClick={() => setModalComprobanteCuenta(null)}>
                <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
              </button>
            </div>
            <div className="space-y-3 mb-5">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <FileText className="w-4 h-4 text-indigo-500" />
                <span className="font-medium">{modalComprobanteCuenta.comprobanteNombre || 'Comprobante'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <CalendarDays className="w-4 h-4 text-indigo-500" />
                <span>Vencimiento: {formatDate(modalComprobanteCuenta.fechaVencimiento)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Estado: Pagado</span>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={modalComprobanteCuenta.comprobanteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex-1 text-center text-sm"
              >
                Ver documento
              </a>
              <label className="btn-secondary flex-1 text-center text-sm cursor-pointer">
                Reemplazar
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) { handleSubirComprobante(modalComprobanteCuenta.id, f); setModalComprobanteCuenta(null) }
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
