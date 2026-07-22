import { useState, useEffect, useCallback, useRef } from 'react'
import { FileText, Upload, Plus, Trash2, Search, X, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'
import { apiClient } from '../../services/apiClient'
import Modal from '../../components/Modal'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const TIPOS_DOC = ['FACTURA','BOLETA','NOTA DE DÉBITO','NOTA DE CRÉDITO','LIQUIDACION','BOLETA EXENTA']
const ESTADOS   = ['vigente','anulado','reclamado']

const fmtCLP = (n) => `$${new Intl.NumberFormat('es-CL').format(n ?? 0)}`

/* ── Parser CSV del SII (RCV) ──────────────────────────────────────── */
function parseSIICSV(text, tipoDefault) {
  const lines = text.split(/\r?\n/)
  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (/folio/i.test(lines[i])) { headerIdx = i; break }
  }
  if (headerIdx === -1) throw new Error('No se encontró la fila de encabezados. Verifica que el archivo sea el RCV del SII.')

  const sep = lines[headerIdx].includes(';') ? ';' : ','
  const headers = lines[headerIdx].split(sep).map((h) => h.replace(/["\r]/g, '').trim().toLowerCase())

  const col = (...kws) => {
    for (const kw of kws) {
      const i = headers.findIndex((h) => h.includes(kw.toLowerCase()))
      if (i !== -1) return i
    }
    return -1
  }

  const C = {
    nro:    col('nro'),
    tDoc:   col('tipo doc'),
    tOp:    col('tipo de transacción', 'tipo de operación', 'tipo venta', 'tipo compra', 'tipo de trans'),
    rut:    col('rut contraparte', 'rut proveedor', 'rut cliente'),
    rs:     col('razón social', 'razon social'),
    folio:  col('folio'),
    fecha:  col('fecha docto'),
    frecep: col('fecha recep'),
    exento: col('exento'),
    neto:   col('monto neto', 'neto'),
    iva:    col('iva recuperable', 'monto iva', 'iva'),
    ivanr:  col('iva no recuperable'),
    total:  col('monto total', 'total'),
  }

  const num = (v) => {
    if (v == null || v === '') return 0
    return parseInt(String(v).replace(/["\r]/g, '').replace(/\./g, '').replace(',', '.').trim()) || 0
  }
  const dt = (v) => {
    if (!v) return null
    const s = String(v).replace(/["\r]/g, '').trim()
    const [fechaParte, horaParte] = s.split(' ')
    const p = fechaParte.split('/')
    if (p.length === 3) {
      const [d, m, y] = p
      return horaParte
        ? `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')} ${horaParte}`
        : `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
    }
    return s
  }
  const get = (cells, i) => (i !== -1 ? cells[i] ?? '' : '')

  const rows = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cells = line.split(sep).map((c) => c.replace(/["\r]/g, '').trim())
    const folio = get(cells, C.folio)
    if (!folio || isNaN(Number(folio.replace(/\D/g, '') || '0'))) continue
    rows.push({
      tipo:            tipoDefault,
      numeroInterno:   get(cells, C.nro),
      tipoDoc:         get(cells, C.tDoc) || 'FACTURA',
      tipoCompraVenta: get(cells, C.tOp),
      rutContraparte:  get(cells, C.rut),
      razonSocial:     get(cells, C.rs),
      folio,
      fecha:           dt(get(cells, C.fecha)),
      fechaRecepcion:  dt(get(cells, C.frecep)),
      montoExento:     num(get(cells, C.exento)),
      neto:            num(get(cells, C.neto)),
      iva:             num(get(cells, C.iva)),
      ivaNR:           num(get(cells, C.ivanr)),
      total:           num(get(cells, C.total)),
      estado:          'vigente',
    })
  }
  if (!rows.length) throw new Error('No se encontraron filas de datos válidas en el archivo.')
  return rows
}

/* ── Toast ─────────────────────────────────────────────────────────── */
function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [toast, onClose])

  if (!toast) return null
  const isError = toast.type === 'error'
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border
      ${isError
        ? 'bg-red-50 border-red-200 text-red-700'
        : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
      {isError
        ? <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
        : <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
      {toast.message}
      <button onClick={onClose} className="ml-1 text-current opacity-50 hover:opacity-80">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

/* ── Tarjetas de resumen ────────────────────────────────────────────── */
function ResumenCards({ resumen, loading }) {
  const r = resumen || {}
  const ivaAPagar = r.ivaAPagar ?? 0

  const cards = [
    { label: 'Ventas Neto',   value: r.ventasNeto,  color: 'text-indigo-600' },
    { label: 'IVA Débito',    value: r.ventasIVA,   color: 'text-indigo-600' },
    { label: 'Compras Neto',  value: r.comprasNeto, color: 'text-slate-700'  },
    { label: 'IVA Crédito',   value: r.comprasIVA,  color: 'text-slate-700'  },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
      {cards.map((c) => (
        <div key={c.label} className="card p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{c.label}</p>
          <p className={`text-lg font-bold ${c.color}`}>
            {loading ? <span className="text-slate-300">—</span> : fmtCLP(c.value)}
          </p>
        </div>
      ))}
      <div className={`card p-4 col-span-2 lg:col-span-1 border-2
        ${ivaAPagar > 0 ? 'border-red-300 bg-red-50'
          : ivaAPagar < 0 ? 'border-emerald-300 bg-emerald-50'
          : 'border-slate-200'}`}>
        {loading ? (
          <>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">IVA</p>
            <p className="text-lg font-bold text-slate-300">—</p>
          </>
        ) : ivaAPagar > 0 ? (
          <>
            <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">IVA A PAGAR</p>
            <p className="text-lg font-bold text-red-600">{fmtCLP(ivaAPagar)}</p>
          </>
        ) : ivaAPagar < 0 ? (
          <>
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Remanente</p>
            <p className="text-base font-bold text-emerald-600">
              Tienes un remanente de {fmtCLP(Math.abs(ivaAPagar))}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">IVA</p>
            <p className="text-lg font-bold text-slate-700">$0</p>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Modal Importar CSV ─────────────────────────────────────────────── */
function ImportModal({ tipo, onClose, onSuccess, onToast }) {
  const [preview,    setPreview]    = useState(null)
  const [rows,       setRows]       = useState([])
  const [importing,  setImporting]  = useState(false)
  const fileRef = useRef()
  const tipoLabel = tipo === 'venta' ? 'Ventas' : 'Compras'

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = parseSIICSV(ev.target.result, tipo)
        setRows(parsed)
        setPreview(parsed.slice(0, 5))
      } catch (err) {
        onToast({ message: err.message, type: 'error' })
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  const handleImport = async () => {
    if (!rows.length) return
    setImporting(true)
    try {
      const result = await apiClient.post('/facturas/importar', { filas: rows, tipo })
      onSuccess(result.importados ?? rows.length)
    } catch (err) {
      onToast({ message: err.message, type: 'error' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Importar ${tipoLabel} desde SII`} size="lg">
      <div className="space-y-4">
        {/* Instrucciones */}
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600 space-y-1">
          <p className="font-medium text-slate-700 mb-2">Instrucciones:</p>
          <p>1. Ingresa a <span className="text-indigo-600 font-medium">sii.cl</span> → Servicios Online → Factura Electrónica</p>
          <p>2. Ve a <span className="font-medium text-slate-800">Registro de Compras y Ventas</span></p>
          <p>3. Selecciona el período y tipo ({tipoLabel})</p>
          <p>4. Haz clic en <span className="font-medium text-slate-800">Exportar CSV</span> y guarda el archivo</p>
        </div>

        {/* Input archivo */}
        <div>
          <label className="label-base">Archivo CSV del SII</label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFile}
            className="block w-full text-sm text-slate-600
              file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0
              file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-600
              hover:file:bg-indigo-100 cursor-pointer"
          />
        </div>

        {/* Preview */}
        {preview && (
          <div>
            <p className="text-xs text-slate-500 mb-2">
              Vista previa — primeras 5 de{' '}
              <span className="font-semibold text-slate-700">{rows.length}</span> filas
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Folio','Tipo Doc','RUT','Razón Social','Fecha','Neto','IVA','Total'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-slate-500 font-semibold uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.map((r, i) => (
                    <tr key={i} className="text-slate-700">
                      <td className="px-3 py-1.5 font-mono">{r.folio}</td>
                      <td className="px-3 py-1.5">{r.tipoDoc}</td>
                      <td className="px-3 py-1.5 font-mono">{r.rutContraparte}</td>
                      <td className="px-3 py-1.5 max-w-[140px] truncate">{r.razonSocial}</td>
                      <td className="px-3 py-1.5">{r.fecha}</td>
                      <td className="px-3 py-1.5 text-right">{fmtCLP(r.neto)}</td>
                      <td className="px-3 py-1.5 text-right">{fmtCLP(r.iva)}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{fmtCLP(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={handleImport}
            disabled={!rows.length || importing}
            className="btn-primary disabled:opacity-50"
          >
            {importing
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Importando...</>
              : <><Upload className="w-3.5 h-3.5" />Confirmar ({rows.length})</>}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ── Modal Nueva / Editar factura ───────────────────────────────────── */
function FacturaModal({ tipo, factura, onClose, onSave, onToast }) {
  const isEdit = !!factura
  const [form, setForm] = useState({
    tipoDoc:        factura?.tipoDoc        ?? 'FACTURA',
    folio:          factura?.folio          ?? '',
    rutContraparte: factura?.rutContraparte ?? '',
    razonSocial:    factura?.razonSocial    ?? '',
    fecha:          factura?.fecha          ?? new Date().toISOString().split('T')[0],
    neto:           String(factura?.neto    ?? ''),
    iva:            String(factura?.iva     ?? ''),
    total:          String(factura?.total   ?? ''),
    estado:         factura?.estado         ?? 'vigente',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set = (k, v) => { setForm((p) => ({ ...p, [k]: v })); setError('') }

  const handleNetoChange = (v) => {
    const n = parseInt(v) || 0
    set('neto',  v)
    set('iva',   String(Math.round(n * 0.19)))
    set('total', String(n + Math.round(n * 0.19)))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.folio.trim()) { setError('El folio es obligatorio'); return }
    if (!form.fecha)        { setError('La fecha es obligatoria'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        tipo,
        neto:  parseInt(form.neto)  || 0,
        iva:   parseInt(form.iva)   || 0,
        total: parseInt(form.total) || 0,
      }
      const saved = isEdit
        ? await apiClient.patch(`/facturas/${factura.id}`, payload)
        : await apiClient.post('/facturas', payload)
      onSave(saved, isEdit)
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const tipoLabel = tipo === 'venta' ? 'Venta' : 'Compra'

  return (
    <Modal open onClose={onClose} title={`${isEdit ? 'Editar' : 'Nueva'} Factura de ${tipoLabel}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-base">Tipo Documento</label>
            <select value={form.tipoDoc} onChange={(e) => set('tipoDoc', e.target.value)} className="input-base">
              {TIPOS_DOC.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label-base">Folio *</label>
            <input value={form.folio} onChange={(e) => set('folio', e.target.value)} placeholder="12345" className="input-base" required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-base">RUT</label>
            <input value={form.rutContraparte} onChange={(e) => set('rutContraparte', e.target.value)} placeholder="76.123.456-7" className="input-base" />
          </div>
          <div>
            <label className="label-base">Fecha *</label>
            <input type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} className="input-base" required />
          </div>
        </div>

        <div>
          <label className="label-base">Razón Social</label>
          <input value={form.razonSocial} onChange={(e) => set('razonSocial', e.target.value)} placeholder="Empresa S.A." className="input-base" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label-base">Neto</label>
            <input type="number" value={form.neto} onChange={(e) => handleNetoChange(e.target.value)} placeholder="0" className="input-base" />
          </div>
          <div>
            <label className="label-base">IVA</label>
            <input type="number" value={form.iva} onChange={(e) => set('iva', e.target.value)} placeholder="0" className="input-base" />
          </div>
          <div>
            <label className="label-base">Total</label>
            <input type="number" value={form.total} onChange={(e) => set('total', e.target.value)} placeholder="0" className="input-base" />
          </div>
        </div>

        <div>
          <label className="label-base">Estado</label>
          <select value={form.estado} onChange={(e) => set('estado', e.target.value)} className="input-base">
            {ESTADOS.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
            {isEdit ? 'Guardar cambios' : 'Crear factura'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ── Badge estado ───────────────────────────────────────────────────── */
function EstadoBadge({ estado }) {
  const cfg = {
    vigente:   'bg-emerald-100 text-emerald-700 border-emerald-200',
    anulado:   'bg-red-100 text-red-700 border-red-200',
    reclamado: 'bg-amber-100 text-amber-700 border-amber-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border
      ${cfg[estado] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {estado}
    </span>
  )
}

/* ── Página principal ───────────────────────────────────────────────── */
export default function FacturasPage() {
  const now = new Date()
  const [activeTab,  setActiveTab]  = useState('venta')
  const [facturas,   setFacturas]   = useState([])
  const [resumen,    setResumen]    = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [mes,        setMes]        = useState(String(now.getMonth() + 1))
  const [anio,       setAnio]       = useState(String(now.getFullYear()))
  const [search,     setSearch]     = useState('')
  const [showImport, setShowImport] = useState(false)
  const [showNueva,  setShowNueva]  = useState(false)
  const [toast,      setToast]      = useState(null)

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i))

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [facs, res] = await Promise.all([
        apiClient.get(`/facturas?tipo=${activeTab}&mes=${mes}&anio=${anio}`),
        apiClient.get(`/facturas/resumen?mes=${mes}&anio=${anio}`),
      ])
      setFacturas(Array.isArray(facs) ? facs : [])
      setResumen(res)
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [activeTab, mes, anio])

  useEffect(() => { loadData() }, [loadData])

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta factura? Esta acción no se puede deshacer.')) return
    try {
      await apiClient.delete(`/facturas/${id}`)
      setFacturas((prev) => prev.filter((f) => f.id !== id))
      setToast({ message: 'Factura eliminada', type: 'success' })
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    }
  }

  const handleImportSuccess = (count) => {
    setShowImport(false)
    setToast({ message: `${count} facturas importadas correctamente`, type: 'success' })
    loadData()
  }

  const handleSaveFactura = (saved, isEdit) => {
    if (isEdit) {
      setFacturas((prev) => prev.map((f) => (f.id === saved.id ? saved : f)))
    } else {
      setFacturas((prev) => [saved, ...prev])
    }
    setShowNueva(false)
    setToast({ message: isEdit ? 'Factura actualizada' : 'Factura creada', type: 'success' })
  }

  const filtradas = facturas.filter((f) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      f.folio?.toLowerCase().includes(q) ||
      f.rutContraparte?.toLowerCase().includes(q) ||
      f.razonSocial?.toLowerCase().includes(q)
    )
  })

  const totales = filtradas.reduce(
    (acc, f) => ({ neto: acc.neto + f.neto, iva: acc.iva + f.iva, total: acc.total + f.total }),
    { neto: 0, iva: 0, total: 0 }
  )

  const tipoLabel = activeTab === 'venta' ? 'Ventas' : 'Compras'

  return (
    <div className="space-y-5 w-full">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Facturas SII</h2>
          <p className="text-sm text-slate-500 mt-0.5">Registro de Compras y Ventas electrónicas</p>
        </div>

        {/* Filtro período */}
        <div className="flex items-center gap-2">
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="input-base py-2 w-auto"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={String(i + 1)}>{m}</option>
            ))}
          </select>
          <select
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
            className="input-base py-2 w-auto"
          >
            {years.map((y) => <option key={y}>{y}</option>)}
          </select>
          <button onClick={loadData} className="btn-secondary" title="Actualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Resumen */}
      <ResumenCards resumen={resumen} loading={loading} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: 'venta',  label: 'Facturas de Venta'  },
          { key: 'compra', label: 'Facturas de Compra' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSearch('') }}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
              ${activeTab === tab.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Barra de acciones */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por folio, RUT o razón social..."
            className="input-base pl-9"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => setShowImport(true)} className="btn-secondary">
            <Upload className="w-4 h-4" />
            Importar CSV
          </button>
          <button onClick={() => setShowNueva(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Nueva factura
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-5 h-5 animate-spin text-slate-300" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <FileText className="w-8 h-8 text-slate-200" />
            <p className="text-sm text-slate-400">
              {search
                ? 'Sin resultados para la búsqueda'
                : `No hay facturas de ${tipoLabel.toLowerCase()} en este período`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="table-th">Folio</th>
                  <th className="table-th">Tipo Doc</th>
                  <th className="table-th">RUT</th>
                  <th className="table-th">Razón Social</th>
                  <th className="table-th">Fecha</th>
                  <th className="table-th text-right">Neto</th>
                  <th className="table-th text-right">IVA</th>
                  <th className="table-th text-right">Total</th>
                  <th className="table-th">Estado</th>
                  <th className="table-th text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtradas.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="table-td font-mono text-xs">{f.folio}</td>
                    <td className="table-td text-slate-500 text-xs">{f.tipoDoc}</td>
                    <td className="table-td font-mono text-xs text-slate-500">{f.rutContraparte}</td>
                    <td className="table-td max-w-[180px] truncate">{f.razonSocial}</td>
                    <td className="table-td text-slate-500 whitespace-nowrap">{f.fecha}</td>
                    <td className="table-td text-right whitespace-nowrap">{fmtCLP(f.neto)}</td>
                    <td className="table-td text-right whitespace-nowrap text-slate-500">{fmtCLP(f.iva)}</td>
                    <td className="table-td text-right whitespace-nowrap font-semibold">{fmtCLP(f.total)}</td>
                    <td className="table-td"><EstadoBadge estado={f.estado} /></td>
                    <td className="table-td text-right">
                      <button
                        onClick={() => handleDelete(f.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200 font-medium">
                  <td colSpan={5} className="table-td text-slate-500">
                    {filtradas.length} documento{filtradas.length !== 1 ? 's' : ''}
                  </td>
                  <td className="table-td text-right whitespace-nowrap text-slate-700">{fmtCLP(totales.neto)}</td>
                  <td className="table-td text-right whitespace-nowrap text-slate-500">{fmtCLP(totales.iva)}</td>
                  <td className="table-td text-right whitespace-nowrap font-bold text-slate-900">{fmtCLP(totales.total)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Modales */}
      {showImport && (
        <ImportModal
          tipo={activeTab}
          onClose={() => setShowImport(false)}
          onSuccess={handleImportSuccess}
          onToast={setToast}
        />
      )}
      {showNueva && (
        <FacturaModal
          tipo={activeTab}
          onClose={() => setShowNueva(false)}
          onSave={handleSaveFactura}
          onToast={setToast}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
