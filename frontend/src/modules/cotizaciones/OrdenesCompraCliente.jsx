import { useState, useRef, forwardRef, useImperativeHandle } from 'react'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../../services/supabase'
import { formatCLP } from '../../utils/formatters'
import { apiClient } from '../../services/apiClient'
import Modal from '../../components/Modal'
import {
  Plus, Eye, Trash2, FileText, Loader2, AlertTriangle, CheckCircle2,
} from 'lucide-react'

/*
 * Gestión de Órdenes de Compra que emite el cliente sobre una cotización.
 * Se guardan en cotizaciones.ordenes_compra_cliente (JSONB array).
 * Cada OC: { id, numero_oc, fecha_oc, monto, empresa_emisora, descripcion,
 *            estado, url, nombre_archivo, created_at }
 * Estados: 'recibida' | 'aprobada' | 'facturada'
 *
 * Props: cot, onUpdate. Solo renderiza el modal (invisible hasta que el padre
 * llama abrir() vía ref). Flujo: idle → subiendo → analizando → confirmando → guardando
 */

const ESTADOS_OC = ['recibida', 'aprobada', 'facturada']

const OrdenesCompraCliente = forwardRef(function OrdenesCompraCliente({ cot, onUpdate }, ref) {
  const { user } = useAuth()

  const fileRef = useRef(null)
  const [modalOpen, setModalOpen]   = useState(false)
  const [estado, setEstado]         = useState('idle') // idle|subiendo|analizando|confirmando|guardando
  const [form, setForm]             = useState(null)
  const [toast, setToast]           = useState('')
  const [confirmElim, setConfirmElim] = useState(null)

  const ordenes = cot.ordenesCompraCliente || []

  /* ── Handle imperativo: el padre abre el modal para agregar una OC ── */

  const abrir = () => { setModalOpen(true); setEstado('idle'); setForm(null) }
  useImperativeHandle(ref, () => ({ abrir }), [])

  /* ── Subida + análisis IA ──────────────────────────────────────── */

  const handleAgregar = async (file) => {
    if (!file) return
    if (fileRef.current) fileRef.current.value = ''

    setEstado('subiendo')
    let url
    try {
      const ts   = Date.now()
      const path = `ordenes-compra-cliente/${cot.id}/${ts}_${file.name}`
      const { error: upErr } = await supabase.storage
        .from('proyectos-documentos')
        .upload(path, file, { upsert: false, contentType: file.type })
      if (upErr) throw upErr
      url = supabase.storage.from('proyectos-documentos').getPublicUrl(path).data.publicUrl
    } catch (err) {
      console.error('Error al subir OC:', err)
      setEstado('idle')
      return
    }

    const esImagen = file.type.startsWith('image/')
    const esPdf    = file.type === 'application/pdf'
    const apiKey   = import.meta.env.VITE_ANTHROPIC_API_KEY
    let datosIA   = null
    let iaSaltada = false

    if (!esImagen && !esPdf) {
      iaSaltada = true
    } else if (apiKey) {
      setEstado('analizando')
      try {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        const contentBlock = esImagen
          ? { type: 'image',    source: { type: 'base64', media_type: file.type,        data: base64 } }
          : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
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
            max_tokens: 500,
            messages: [{
              role: 'user',
              content: [
                contentBlock,
                { type: 'text', text: 'Analiza este documento de Orden de Compra y extrae en JSON: { numero_oc, fecha_oc (YYYY-MM-DD), monto (número sin formato), empresa_emisora, descripcion, condiciones }. Responde SOLO con el JSON, sin texto adicional ni backticks.' },
              ],
            }],
          }),
        })
        if (res.ok) {
          const data  = await res.json()
          const texto = data.content?.[0]?.text ?? ''
          datosIA = JSON.parse(texto.trim())
        }
      } catch (err) {
        console.warn('No se pudo analizar la OC con IA:', err)
      }
    }

    setForm({
      url,
      nombre_archivo:  file.name,
      numero_oc:       datosIA?.numero_oc       ?? '',
      fecha_oc:        datosIA?.fecha_oc         ?? new Date().toISOString().slice(0, 10),
      monto:           datosIA?.monto            ?? '',
      empresa_emisora: datosIA?.empresa_emisora  ?? (cot.cliente || ''),
      descripcion:     datosIA?.descripcion      ?? '',
      condiciones:     datosIA?.condiciones      ?? '',
      estado_oc:       'recibida',
      ia_ok:      datosIA !== null,
      ia_saltada: iaSaltada,
    })
    setEstado('confirmando')
  }

  /* ── Confirmar: agregar la OC al array ─────────────────────────── */

  const handleConfirmar = async () => {
    if (!form) return
    setEstado('guardando')
    try {
      const nuevaOC = {
        id:              crypto.randomUUID(),
        numero_oc:       form.numero_oc || '',
        fecha_oc:        form.fecha_oc,
        monto:           Number(String(form.monto).replace(/\./g, '').replace(/,/g, '')) || 0,
        empresa_emisora: form.empresa_emisora || '',
        descripcion:     form.descripcion || '',
        condiciones:     form.condiciones || '',
        estado:          form.estado_oc || 'recibida',
        url:             form.url,
        nombre_archivo:  form.nombre_archivo,
        created_at:      new Date().toISOString(),
      }
      const nuevas = [...ordenes, nuevaOC]
      await apiClient.patch(`/cotizaciones/${cot.id}`, { ordenes_compra_cliente: nuevas })
      onUpdate?.({ ordenesCompraCliente: nuevas })
      setForm(null)
      setEstado('idle')
      setToast('Orden de compra registrada')
      setTimeout(() => setToast(''), 4000)
    } catch (err) {
      console.error('Error al confirmar OC:', err)
      setEstado('confirmando')
    }
  }

  const handleEliminar = async (id) => {
    try {
      const nuevas = ordenes.filter((o) => o.id !== id)
      await apiClient.patch(`/cotizaciones/${cot.id}`, { ordenes_compra_cliente: nuevas })
      onUpdate?.({ ordenesCompraCliente: nuevas })
      setConfirmElim(null)
    } catch (err) {
      console.error('Error al eliminar OC:', err)
    }
  }

  const badgeEstado = (e) =>
    e === 'facturada' ? 'bg-emerald-100 text-emerald-700'
    : e === 'aprobada' ? 'bg-blue-100 text-blue-700'
    : 'bg-slate-100 text-slate-600'

  /* ── Render: solo el modal ─────────────────────────────────────── */

  if (!modalOpen) return null
  const ocupado = estado !== 'idle'

  return (
    <Modal
      open
      onClose={() => {
        if (ocupado) return
        setModalOpen(false)
        setForm(null)
        setEstado('idle')
      }}
      title="Órdenes de compra del cliente"
      size="md"
    >
      {toast && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          {toast}
        </div>
      )}

      {(estado === 'subiendo' || estado === 'analizando') && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          <p className="text-sm text-slate-500">
            {estado === 'subiendo' ? 'Subiendo archivo…' : 'Analizando orden de compra con IA…'}
          </p>
        </div>
      )}

      {estado === 'confirmando' && form && (
        <div className="space-y-3">
          {form.ia_saltada && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              Formato no compatible con análisis IA, ingresa los datos manualmente
            </div>
          )}
          {!form.ia_ok && !form.ia_saltada && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              No se pudo leer automáticamente, ingresa los datos manualmente
            </div>
          )}
          {form.ia_ok && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-700">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              Datos extraídos automáticamente — verifica y confirma
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Número OC</label>
              <input
                type="text"
                value={form.numero_oc}
                onChange={(e) => setForm((f) => ({ ...f, numero_oc: e.target.value }))}
                className="input-base text-sm w-full"
                placeholder="—"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
              <input
                type="date"
                value={form.fecha_oc}
                onChange={(e) => setForm((f) => ({ ...f, fecha_oc: e.target.value }))}
                className="input-base text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Monto</label>
              <input
                type="number"
                value={form.monto}
                onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
                className="input-base text-sm w-full"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Empresa emisora</label>
              <input
                type="text"
                value={form.empresa_emisora}
                onChange={(e) => setForm((f) => ({ ...f, empresa_emisora: e.target.value }))}
                className="input-base text-sm w-full"
                placeholder="—"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
            <textarea
              rows={2}
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              className="input-base text-sm w-full resize-none"
              placeholder="Descripción del trabajo o servicio"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
            <select
              value={form.estado_oc}
              onChange={(e) => setForm((f) => ({ ...f, estado_oc: e.target.value }))}
              className="input-base text-sm w-full"
            >
              {ESTADOS_OC.map((e) => (
                <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => { setForm(null); setEstado('idle') }}
              className="flex-1 btn-ghost text-xs"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmar}
              disabled={!form.monto || !form.fecha_oc}
              className="flex-1 btn-primary text-xs disabled:opacity-50"
            >
              Confirmar orden de compra
            </button>
          </div>
        </div>
      )}

      {estado === 'guardando' && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          <p className="text-sm text-slate-500">Guardando orden de compra…</p>
        </div>
      )}

      {estado === 'idle' && (
        <div className="space-y-3">
          {ordenes.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Sin órdenes de compra registradas</p>
          ) : (
            <div className="space-y-2">
              {ordenes.map((oc) => {
                const ext   = oc.nombre_archivo?.split('.').pop()?.toLowerCase() ?? ''
                const esPdf = ext === 'pdf'
                return (
                  <div key={oc.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-start gap-3">
                      <FileText className={`w-4 h-4 flex-shrink-0 mt-0.5 ${esPdf ? 'text-red-400' : 'text-indigo-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-semibold text-slate-700">{oc.numero_oc || 'OC sin número'}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${badgeEstado(oc.estado)}`}>
                            {oc.estado}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{oc.empresa_emisora || '—'}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-slate-400">{oc.fecha_oc || ''}</span>
                          <span className="text-xs font-semibold text-slate-700">{formatCLP(oc.monto)}</span>
                        </div>
                        {oc.descripcion && <p className="text-[10px] text-slate-500 truncate mt-0.5">{oc.descripcion}</p>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {oc.url && (
                          <a
                            href={oc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Ver"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {confirmElim === oc.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-red-600">¿Eliminar?</span>
                            <button onClick={() => handleEliminar(oc.id)} className="text-xs px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700">Sí</button>
                            <button onClick={() => setConfirmElim(null)} className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-600 hover:bg-slate-300">No</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmElim(oc.id)}
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
          )}
          <div className="pt-3 border-t border-slate-100">
            <button
              onClick={() => fileRef.current?.click()}
              className="btn-primary text-xs w-full"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar orden de compra
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleAgregar(file)
              }}
            />
          </div>
        </div>
      )}
    </Modal>
  )
})

export default OrdenesCompraCliente
