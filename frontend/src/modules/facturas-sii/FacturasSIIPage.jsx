import { useState, useMemo, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { formatCLP, formatDate } from '../../utils/formatters'
import Toast from '../../components/Toast'
import { ConfirmModal } from '../../components/Modal'
import {
  Upload, Plus, Search, Trash2, Pencil, FileText,
  TrendingDown, TrendingUp, Receipt, X, AlertCircle, CheckCircle2,
} from 'lucide-react'

/* ── Tipos de documento SII ──────────────────────────────────────── */
const TIPOS_DOC = [
  'FACTURA',
  'BOLETA',
  'NOTA_DEBITO',
  'NOTA_CREDITO',
  'LIQUIDACION',
  'OTRO',
]

const TIPO_DOC_LABEL = {
  FACTURA:     'Factura',
  BOLETA:      'Boleta',
  NOTA_DEBITO: 'Nota Débito',
  NOTA_CREDITO:'Nota Crédito',
  LIQUIDACION: 'Liquidación',
  OTRO:        'Otro',
}

const ESTADO_COLOR = {
  vigente:   'bg-emerald-100 text-emerald-700',
  anulado:   'bg-red-100 text-red-600',
  reclamado: 'bg-amber-100 text-amber-700',
}

/* ── Parser de archivo SII (CSV/TXT) ─────────────────────────────── */
function parseSIIFile(text, tipoDefault = 'compra') {
  const clean   = text.replace(/^﻿/, '').replace(/\r/g, '')
  const sep     = clean.split('\n')[0].includes(';') ? ';' : ','
  const lines   = clean.split('\n').map(l => l.trim()).filter(Boolean)

  const norm    = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/"/g, '').trim()
  const parseMonto = s => Math.round(parseFloat((s || '0').replace(/"/g, '').replace(/\./g, '').replace(',', '.')) || 0)
  const parseFecha = s => {
    const v = (s || '').replace(/"/g, '').trim()
    const m1 = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
    if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`
    const m2 = v.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})/)
    if (m2) return v.substring(0,10)
    return null
  }

  // Busca la fila de encabezado (la que contiene FOLIO o RUT)
  let headerIdx = lines.findIndex(l => {
    const ln = norm(l)
    return ln.includes('folio') || (ln.includes('rut') && ln.includes('razon'))
  })
  if (headerIdx < 0) headerIdx = 0

  const header = lines[headerIdx].split(sep).map(norm)
  const col    = (...kws) => header.findIndex(h => kws.some(k => h.includes(k)))

  const idxTipoDoc  = col('tipo doc', 'tipo de doc', 'tipo_doc')
  const idxFolio    = col('folio')
  const idxRut      = col('rut emisor', 'rut receptor', 'rut')
  const idxRazon    = col('razon social', 'razon_social', 'nombre')
  const idxFecha    = col('fecha docto', 'fecha doc', 'fecha emision', 'fecha')
  const idxNeto     = col('monto neto', 'neto')
  const idxIva      = col('monto iva', 'iva recuperable', 'iva')
  const idxTotal    = col('monto total', 'total')

  if (idxFolio < 0) throw new Error('No se encontró columna "Folio". Verifica el formato del archivo.')

  const rows = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map(c => c.replace(/"/g, '').trim())
    if (cells.length < 3 || !cells[idxFolio]) continue

    const folio = cells[idxFolio]
    const fecha = idxFecha >= 0 ? parseFecha(cells[idxFecha]) : null
    if (!fecha) continue

    const neto  = idxNeto  >= 0 ? parseMonto(cells[idxNeto])  : 0
    const iva   = idxIva   >= 0 ? parseMonto(cells[idxIva])   : Math.round(neto * 0.19)
    const total = idxTotal >= 0 ? parseMonto(cells[idxTotal]) : neto + iva

    const rawTipoDoc = idxTipoDoc >= 0 ? cells[idxTipoDoc].toUpperCase() : ''
    let tipoDocumento = 'FACTURA'
    if (rawTipoDoc.includes('BOLETA'))          tipoDocumento = 'BOLETA'
    else if (rawTipoDoc.includes('NOTA DE DEB') || rawTipoDoc.includes('NOTA DEB')) tipoDocumento = 'NOTA_DEBITO'
    else if (rawTipoDoc.includes('NOTA DE CRE') || rawTipoDoc.includes('NOTA CRE')) tipoDocumento = 'NOTA_CREDITO'
    else if (rawTipoDoc.includes('LIQUIDACION')) tipoDocumento = 'LIQUIDACION'

    rows.push({
      tipo:         tipoDefault,
      tipoDocumento,
      folio,
      rutEmisor:    idxRut   >= 0 ? cells[idxRut]   : '',
      razonSocial:  idxRazon >= 0 ? cells[idxRazon] : '',
      fecha,
      neto,
      iva,
      total,
      estado: 'vigente',
    })
  }

  if (rows.length === 0) throw new Error('No se encontraron registros válidos en el archivo.')
  return rows
}

/* ── Formulario de factura (modal) ───────────────────────────────── */
const FORM_EMPTY = {
  tipo: 'compra', tipoDocumento: 'FACTURA', folio: '', rutEmisor: '',
  razonSocial: '', fecha: new Date().toISOString().split('T')[0],
  neto: '', iva: '', total: '', estado: 'vigente',
}

function FacturaModal({ open, initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || FORM_EMPTY)
  const [err,  setErr]  = useState({})

  if (!open) return null

  const set = (k, v) => {
    setForm(p => {
      const next = { ...p, [k]: v }
      if (k === 'neto') {
        const n = parseInt(v) || 0
        next.iva   = String(Math.round(n * 0.19))
        next.total = String(n + Math.round(n * 0.19))
      }
      return next
    })
    setErr(e => ({ ...e, [k]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.folio.trim())      e.folio      = 'Requerido'
    if (!form.razonSocial.trim())e.razonSocial = 'Requerido'
    if (!form.fecha)             e.fecha      = 'Requerido'
    if (!form.total)             e.total      = 'Requerido'
    setErr(e)
    return !Object.keys(e).length
  }

  const handleSave = () => {
    if (!validate()) return
    onSave({
      ...form,
      neto:  parseInt(form.neto)  || 0,
      iva:   parseInt(form.iva)   || 0,
      total: parseInt(form.total) || 0,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">
            {initial ? 'Editar Factura' : 'Nueva Factura'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Tipo compra/venta */}
          <div className="flex gap-2">
            {['compra','venta'].map(t => (
              <button
                key={t} type="button"
                onClick={() => set('tipo', t)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                  form.tipo === t
                    ? t === 'compra' ? 'bg-blue-600 text-white border-blue-600' : 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                }`}
              >
                {t === 'compra' ? 'Compra' : 'Venta'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Tipo documento */}
            <div>
              <label className="label-base">Tipo Documento</label>
              <select value={form.tipoDocumento} onChange={e => set('tipoDocumento', e.target.value)} className="input-base">
                {TIPOS_DOC.map(t => <option key={t} value={t}>{TIPO_DOC_LABEL[t]}</option>)}
              </select>
            </div>
            {/* Estado */}
            <div>
              <label className="label-base">Estado</label>
              <select value={form.estado} onChange={e => set('estado', e.target.value)} className="input-base">
                <option value="vigente">Vigente</option>
                <option value="anulado">Anulado</option>
                <option value="reclamado">Reclamado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">Folio *</label>
              <input value={form.folio} onChange={e => set('folio', e.target.value)} className="input-base" placeholder="Nº folio" />
              {err.folio && <p className="text-xs text-red-500 mt-0.5">{err.folio}</p>}
            </div>
            <div>
              <label className="label-base">Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} className="input-base" />
              {err.fecha && <p className="text-xs text-red-500 mt-0.5">{err.fecha}</p>}
            </div>
          </div>

          <div>
            <label className="label-base">RUT {form.tipo === 'compra' ? 'Proveedor' : 'Cliente'}</label>
            <input value={form.rutEmisor} onChange={e => set('rutEmisor', e.target.value)} className="input-base" placeholder="76.123.456-7" />
          </div>

          <div>
            <label className="label-base">Razón Social *</label>
            <input value={form.razonSocial} onChange={e => set('razonSocial', e.target.value)} className="input-base" placeholder="Nombre empresa o persona" />
            {err.razonSocial && <p className="text-xs text-red-500 mt-0.5">{err.razonSocial}</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-base">Neto</label>
              <input type="number" value={form.neto} onChange={e => set('neto', e.target.value)} className="input-base" placeholder="0" />
            </div>
            <div>
              <label className="label-base">IVA</label>
              <input type="number" value={form.iva} onChange={e => set('iva', e.target.value)} className="input-base" placeholder="0" />
            </div>
            <div>
              <label className="label-base">Total *</label>
              <input type="number" value={form.total} onChange={e => set('total', e.target.value)} className="input-base" placeholder="0" />
              {err.total && <p className="text-xs text-red-500 mt-0.5">{err.total}</p>}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSave} className="btn-primary">
            <CheckCircle2 className="w-4 h-4" />
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Modal importar archivo SII ──────────────────────────────────── */
function ImportModal({ open, onImport, onClose }) {
  const fileRef  = useRef(null)
  const [tipo,   setTipo]   = useState('compra')
  const [status, setStatus] = useState(null) // null | 'parsing' | { rows } | { error }

  if (!open) return null

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus('parsing')
    try {
      const text = await file.text()
      const rows = parseSIIFile(text, tipo)
      setStatus({ rows })
    } catch (err) {
      setStatus({ error: err.message })
    }
    e.target.value = ''
  }

  const handleConfirm = () => {
    if (status?.rows) onImport(status.rows)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">Importar desde SII</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-500">
            Sube el archivo CSV exportado desde el <strong>Registro de Compras y Ventas (RCV)</strong> del SII.
          </p>

          {/* Tipo */}
          <div>
            <label className="label-base">¿Qué tipo de facturas contiene el archivo?</label>
            <div className="flex gap-2 mt-1">
              {['compra','venta'].map(t => (
                <button key={t} type="button" onClick={() => setTipo(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                    tipo === t
                      ? t === 'compra' ? 'bg-blue-600 text-white border-blue-600' : 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {t === 'compra' ? 'Compras' : 'Ventas'}
                </button>
              ))}
            </div>
          </div>

          {/* Selector de archivo */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors"
          >
            <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600">Haz clic para seleccionar el archivo</p>
            <p className="text-xs text-slate-400 mt-1">CSV o TXT exportado desde SII</p>
            <input ref={fileRef} type="file" accept=".csv,.txt,.xls,.xlsx" className="hidden" onChange={handleFile} />
          </div>

          {/* Estado del parseo */}
          {status === 'parsing' && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              Leyendo archivo...
            </div>
          )}
          {status?.error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{status.error}</p>
            </div>
          )}
          {status?.rows && (
            <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-700">
                Se encontraron <strong>{status.rows.length}</strong> registros listos para importar.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={!status?.rows}
            className="btn-primary disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            Importar {status?.rows ? `(${status.rows.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Página principal ────────────────────────────────────────────── */
export default function FacturasSIIPage() {
  const { facturasSII, addFacturaSII, updateFacturaSII, deleteFacturaSII, bulkAddFacturasSII } = useApp()

  const [tab,          setTab]          = useState('compra')   // 'compra' | 'venta'
  const [search,       setSearch]       = useState('')
  const [mesFilter,    setMesFilter]    = useState('')
  const [anioFilter,   setAnioFilter]   = useState(String(new Date().getFullYear()))
  const [pagina,       setPagina]       = useState(1)
  const [modalForm,    setModalForm]    = useState(null)       // null | FORM_EMPTY | factura
  const [modalImport,  setModalImport]  = useState(false)
  const [deleteId,     setDeleteId]     = useState(null)
  const [toast,        setToast]        = useState(null)
  const [importing,    setImporting]    = useState(false)

  const POR_PAGINA    = 10
  const MAX_REGISTROS = 50

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000) }

  /* ── Filtrado ── */
  const lista = useMemo(() => {
    return facturasSII.filter(f => {
      if (f.tipo !== tab) return false
      if (anioFilter && !f.fecha?.startsWith(anioFilter)) return false
      if (mesFilter) {
        const mes = f.fecha?.slice(5, 7)
        if (mes !== mesFilter.padStart(2, '0')) return false
      }
      if (search) {
        const q = search.toLowerCase()
        return (
          f.folio?.toLowerCase().includes(q) ||
          f.razonSocial?.toLowerCase().includes(q) ||
          f.rutEmisor?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [facturasSII, tab, anioFilter, mesFilter, search])

  /* ── Paginación ── */
  const listaLimitada = useMemo(() => lista.slice(0, MAX_REGISTROS), [lista])
  const totalPaginas  = Math.max(1, Math.ceil(listaLimitada.length / POR_PAGINA))
  const listaPagina   = useMemo(
    () => listaLimitada.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA),
    [listaLimitada, pagina]
  )

  /* ── Totales (sobre lista completa filtrada, no solo la página) ── */
  const totales = useMemo(() => ({
    cantidad: lista.length,
    neto:  lista.reduce((s, f) => s + (f.neto  || 0), 0),
    iva:   lista.reduce((s, f) => s + (f.iva   || 0), 0),
    total: lista.reduce((s, f) => s + (f.total || 0), 0),
  }), [lista])

  /* ── Años disponibles ── */
  const aniosDisp = useMemo(() => {
    const years = [...new Set(facturasSII.map(f => f.fecha?.slice(0,4)).filter(Boolean))].sort().reverse()
    if (!years.includes(String(new Date().getFullYear()))) years.unshift(String(new Date().getFullYear()))
    return years
  }, [facturasSII])

  /* ── Handlers ── */
  const handleSaveFactura = (data) => {
    if (data.id) {
      updateFacturaSII(data.id, data)
      showToast('success', 'Factura actualizada')
    } else {
      addFacturaSII(data)
      showToast('success', 'Factura agregada')
    }
    setModalForm(null)
  }

  const handleImport = async (rows) => {
    setModalImport(false)
    setImporting(true)
    try {
      await bulkAddFacturasSII(rows)
      showToast('success', `${rows.length} facturas importadas correctamente`)
    } catch (err) {
      showToast('error', 'Error al importar: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Facturas SII</h2>
          <p className="text-sm text-slate-500 mt-0.5">Registro de Compras y Ventas electrónicas</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModalImport(true)}
            disabled={importing}
            className="btn-secondary disabled:opacity-50"
          >
            {importing
              ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              : <Upload className="w-4 h-4" />
            }
            Importar SII
          </button>
          <button
            onClick={() => setModalForm({ ...FORM_EMPTY, tipo: tab })}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Nueva Factura
          </button>
        </div>
      </div>

      {/* Cards totales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Documentos',  value: totales.cantidad, fmt: v => v, Icon: FileText,    color: 'text-slate-600 bg-slate-100' },
          { label: 'Neto',        value: totales.neto,     fmt: formatCLP, Icon: Receipt,  color: 'text-blue-600 bg-blue-100' },
          { label: 'IVA',         value: totales.iva,      fmt: formatCLP, Icon: tab === 'compra' ? TrendingDown : TrendingUp, color: 'text-amber-600 bg-amber-100' },
          { label: 'Total',       value: totales.total,    fmt: formatCLP, Icon: tab === 'compra' ? TrendingDown : TrendingUp, color: tab === 'compra' ? 'text-red-600 bg-red-100' : 'text-emerald-600 bg-emerald-100' },
        ].map(({ label, value, fmt, Icon, color }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-base font-bold text-slate-800">{fmt(value)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Filtros */}
      <div className="card">
        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          {[
            { id: 'compra', label: 'Compras', Icon: TrendingDown, color: 'text-blue-600' },
            { id: 'venta',  label: 'Ventas',  Icon: TrendingUp,   color: 'text-emerald-600' },
          ].map(({ id, label, Icon, color }) => (
            <button
              key={id}
              onClick={() => { setTab(id); setPagina(1) }}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-all ${
                tab === id
                  ? `${color} border-current`
                  : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${tab === id ? 'bg-current/10' : 'bg-slate-100 text-slate-400'}`}>
                {facturasSII.filter(f => f.tipo === id).length}
              </span>
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 p-4 border-b border-slate-100">
          {/* Año */}
          <select
            value={anioFilter}
            onChange={e => { setAnioFilter(e.target.value); setPagina(1) }}
            className="input-base w-28 text-sm"
          >
            <option value="">Todos los años</option>
            {aniosDisp.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          {/* Mes */}
          <select
            value={mesFilter}
            onChange={e => { setMesFilter(e.target.value); setPagina(1) }}
            className="input-base w-36 text-sm"
          >
            <option value="">Todos los meses</option>
            {MESES.map((m, i) => (
              <option key={i+1} value={String(i+1).padStart(2,'0')}>{m}</option>
            ))}
          </select>

          {/* Búsqueda */}
          <div className="flex-1 min-w-48 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPagina(1) }}
              placeholder="Buscar por folio, RUT o razón social…"
              className="input-base pl-9 text-sm w-full"
            />
          </div>

          {(search || mesFilter || anioFilter !== String(new Date().getFullYear())) && (
            <button
              onClick={() => { setSearch(''); setMesFilter(''); setAnioFilter(String(new Date().getFullYear())); setPagina(1) }}
              className="btn-ghost text-xs text-slate-400"
            >
              <X className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
        </div>

        {/* Tabla */}
        {lista.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-slate-400 font-medium">No hay facturas de {tab === 'compra' ? 'compras' : 'ventas'}</p>
            <p className="text-xs text-slate-300 mt-1">
              {search || mesFilter ? 'Prueba con otros filtros' : 'Agrega una factura o importa desde SII'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Tipo Doc</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Folio</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">RUT</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Razón Social</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Fecha</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">Neto</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">IVA</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">Total</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500">Estado</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {listaPagina.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {TIPO_DOC_LABEL[f.tipoDocumento] ?? f.tipoDocumento}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{f.folio}</td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{f.rutEmisor}</td>
                    <td className="px-4 py-2.5 text-slate-700 max-w-[200px] truncate">{f.razonSocial}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{formatDate(f.fecha)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{formatCLP(f.neto)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{formatCLP(f.iva)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{formatCLP(f.total)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[f.estado] ?? 'bg-slate-100 text-slate-500'}`}>
                        {f.estado}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setModalForm(f)}
                          className="btn-ghost p-1.5 text-slate-400 hover:text-indigo-600"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(f.id)}
                          className="btn-ghost p-1.5 text-slate-400 hover:text-red-500"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td colSpan={5} className="px-4 py-2.5 text-xs font-semibold text-slate-500">
                    Total período ({lista.length} docs{lista.length > MAX_REGISTROS ? `, mostrando ${MAX_REGISTROS}` : ''})
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-700">{formatCLP(totales.neto)}</td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-700">{formatCLP(totales.iva)}</td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-slate-900">{formatCLP(totales.total)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Paginación */}
        {listaLimitada.length > POR_PAGINA && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Página {pagina} de {totalPaginas}
              {' · '}
              {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, listaLimitada.length)} de {listaLimitada.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagina(p => p - 1)}
                disabled={pagina === 1}
                className="btn-secondary text-xs disabled:opacity-40"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPagina(p => p + 1)}
                disabled={pagina === totalPaginas}
                className="btn-secondary text-xs disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modales */}
      <FacturaModal
        open={!!modalForm}
        initial={modalForm?.id ? modalForm : null}
        onSave={handleSaveFactura}
        onClose={() => setModalForm(null)}
      />
      <ImportModal
        open={modalImport}
        onImport={handleImport}
        onClose={() => setModalImport(false)}
      />
      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { deleteFacturaSII(deleteId); setDeleteId(null); showToast('success', 'Factura eliminada') }}
        title="Eliminar factura"
        message="¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer."
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
