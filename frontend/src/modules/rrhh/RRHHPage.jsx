import { useState, useMemo, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../auth/AuthContext'
import { formatDate } from '../../utils/formatters'
import Modal, { ConfirmModal } from '../../components/Modal'
import Toast from '../../components/Toast'
import { supabase } from '../../services/supabase'
import {
  FolderOpen, Upload, Trash2, FileText, Filter,
  KeyRound, CheckCircle2, XCircle, Clock, Phone,
  Eye, ExternalLink, Download, RefreshCw,
  Building2, Users, ArrowLeft, Settings, Plus, Pencil, Check, X, ChevronRight,
} from 'lucide-react'

/* ── Tipos de documento ─────────────────────────────────────── */

/*
 * Los tipos viven en el estado local del componente y se persisten en
 * localStorage (aún no hay tabla en BD). La config guardada tiene 2 partes:
 *   - overrides: ediciones sobre los tipos base   → { [key]: { label?, scope? } }
 *   - custom:    tipos nuevos creados por el admin → [{ key, label, scope }]
 * Los tipos base no se pueden eliminar, solo editar.
 */

const LS_TIPOS_KEY = 'mamkam_tipos_documento'

const TIPOS_BASE = [
  { key: 'contrato',            label: 'Contrato de trabajo',             scope: 'trabajador' },
  { key: 'anexo',               label: 'Anexo de contrato',               scope: 'trabajador' },
  { key: 'vacaciones_firmadas', label: 'Solicitud de vacaciones firmada', scope: 'trabajador' },
  { key: 'finiquito',           label: 'Finiquito',                       scope: 'trabajador' },
  { key: 'liquidacion',         label: 'Liquidación de sueldo',           scope: 'trabajador' },
  { key: 'otro_trabajador',     label: 'Otro (trabajador)',               scope: 'trabajador' },
  { key: 'constitucion',        label: 'Escritura de constitución',       scope: 'empresa' },
  { key: 'iva_pagado',          label: 'Comprobante IVA pagado',          scope: 'empresa' },
  { key: 'patente',             label: 'Patente comercial',               scope: 'empresa' },
  { key: 'rut_empresa',         label: 'RUT empresa',                     scope: 'empresa' },
  { key: 'reglamento',          label: 'Reglamento interno',              scope: 'empresa' },
  { key: 'otro_empresa',        label: 'Otro (empresa)',                  scope: 'empresa' },
]

const TIPO_COLORS = {
  contrato:             'bg-blue-100 text-blue-700',
  anexo:                'bg-amber-100 text-amber-700',
  vacaciones_firmadas:  'bg-cyan-100 text-cyan-700',
  finiquito:            'bg-red-100 text-red-700',
  liquidacion:          'bg-emerald-100 text-emerald-700',
  reglamento:           'bg-violet-100 text-violet-700',
  otro_trabajador:      'bg-slate-100 text-slate-600',
  constitucion:         'bg-orange-100 text-orange-700',
  iva_pagado:           'bg-green-100 text-green-700',
  patente:              'bg-teal-100 text-teal-700',
  rut_empresa:          'bg-indigo-100 text-indigo-700',
  otro_empresa:         'bg-slate-100 text-slate-600',
}

const COLOR_FALLBACK = 'bg-slate-100 text-slate-600'

const SCOPE_LABELS = { empresa: 'Empresa', trabajador: 'Trabajador' }

const ACENTOS = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n' }

const slugify = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[áéíóúüñ]/g, (c) => ACENTOS[c])
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

function loadTiposConfig() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_TIPOS_KEY) || '{}')
    return {
      overrides: raw.overrides && typeof raw.overrides === 'object' ? raw.overrides : {},
      custom:    Array.isArray(raw.custom) ? raw.custom : [],
    }
  } catch {
    return { overrides: {}, custom: [] }
  }
}

function saveTiposConfig(cfg) {
  try { localStorage.setItem(LS_TIPOS_KEY, JSON.stringify(cfg)) } catch { /* storage lleno o bloqueado */ }
}

function buildTipos(cfg) {
  const base   = TIPOS_BASE.map((t) => ({ ...t, ...(cfg.overrides[t.key] || {}), base: true }))
  const custom = cfg.custom.map((t) => ({ ...t, base: false }))
  return [...base, ...custom]
}

function useTiposDocumento() {
  const [cfg, setCfg] = useState(loadTiposConfig)
  const tipos = useMemo(() => buildTipos(cfg), [cfg])
  const updateCfg = (next) => { setCfg(next); saveTiposConfig(next) }
  return { tipos, cfg, updateCfg }
}

/* ── Passwords tab ──────────────────────────────────────────── */

const PWD_TABS = [
  { key: 'pendiente', label: 'Pendientes', estado: 'pendiente' },
  { key: 'resuelta',  label: 'Resueltas',  estado: 'resuelta'  },
  { key: 'rechazada', label: 'Rechazadas', estado: 'rechazada' },
]

function PasswordsTab() {
  const { solicitudesPassword, trabajadores, resolverSolicitudPassword } = useApp()
  const { user } = useAuth()
  const [subTab, setSubTab] = useState('pendiente')
  const [confirm, setConfirm] = useState(null)

  const visibles = useMemo(
    () => solicitudesPassword.filter((s) => s.estado === subTab),
    [solicitudesPassword, subTab],
  )

  const getTrabajadorNombre = (s) =>
    s.trabajadorNombre || trabajadores.find((t) => t.id === s.trabajadorId)?.nombre || '—'

  const handleAccion = () => {
    if (!confirm) return
    resolverSolicitudPassword(confirm.id, confirm.accion, user?.nombre ?? null)
    setConfirm(null)
  }

  const sol = confirm && solicitudesPassword.find((s) => s.id === confirm.id)

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200">
        {PWD_TABS.map((t) => {
          const count = solicitudesPassword.filter((s) => s.estado === t.estado).length
          const active = subTab === t.estado
          return (
            <button
              key={t.key}
              onClick={() => setSubTab(t.estado)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
                active ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="card overflow-hidden">
        {visibles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <KeyRound className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">Sin solicitudes</p>
            <p className="text-xs text-slate-400 mt-1">
              {subTab === 'pendiente'
                ? 'Cuando un trabajador solicite cambio de contraseña desde la app, aparecerá aquí.'
                : `Aún no hay solicitudes ${subTab === 'resuelta' ? 'resueltas' : 'rechazadas'}.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="table-th">Trabajador</th>
                  <th className="table-th">RUT</th>
                  <th className="table-th">Teléfono</th>
                  <th className="table-th">Fecha solicitud</th>
                  {subTab !== 'pendiente' && <th className="table-th">Resuelta por</th>}
                  {subTab !== 'pendiente' && <th className="table-th">Fecha resolución</th>}
                  {subTab === 'pendiente' && <th className="table-th text-center">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visibles.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="table-td">
                      <div className="text-sm font-medium text-slate-800">{getTrabajadorNombre(s)}</div>
                    </td>
                    <td className="table-td text-xs font-mono text-slate-500">{s.rut}</td>
                    <td className="table-td text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {s.telefono || '—'}
                      </div>
                    </td>
                    <td className="table-td text-xs text-slate-500">{formatDate(s.fechaSolicitud)}</td>
                    {subTab !== 'pendiente' && (
                      <td className="table-td text-xs text-slate-500">{s.resueltoPor || '—'}</td>
                    )}
                    {subTab !== 'pendiente' && (
                      <td className="table-td text-xs text-slate-500">{s.fechaResolucion ? formatDate(s.fechaResolucion) : '—'}</td>
                    )}
                    {subTab === 'pendiente' && (
                      <td className="table-td">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setConfirm({ id: s.id, accion: 'resuelta' })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Resolver
                          </button>
                          <button
                            onClick={() => setConfirm({ id: s.id, accion: 'rechazada' })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Rechazar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleAccion}
        title={confirm?.accion === 'resuelta' ? 'Resolver solicitud' : 'Rechazar solicitud'}
        message={
          confirm?.accion === 'resuelta'
            ? `¿Marcar como resuelta la solicitud de "${sol ? (sol.trabajadorNombre || sol.rut) : ''}"? Se registrará tu nombre y la fecha actual.`
            : `¿Rechazar la solicitud de "${sol ? (sol.trabajadorNombre || sol.rut) : ''}"? Se registrará tu nombre y la fecha actual.`
        }
      />
    </div>
  )
}

/* ── Gestión de tipos (solo admin) ──────────────────────────── */

function TiposModal({ open, onClose, tipos, cfg, updateCfg }) {
  const [editKey, setEditKey]     = useState(null)
  const [draft, setDraft]         = useState({ label: '', scope: 'trabajador' })
  const [nuevo, setNuevo]         = useState(null)   // null | { label, scope }
  const [deleteKey, setDeleteKey] = useState(null)
  const [error, setError]         = useState('')

  const cerrar = () => {
    setEditKey(null); setNuevo(null); setError('')
    onClose()
  }

  const startEdit = (t) => {
    setNuevo(null); setError('')
    setEditKey(t.key)
    setDraft({ label: t.label, scope: t.scope })
  }

  const guardarEdit = () => {
    const label = draft.label.trim()
    if (!label) { setError('El nombre no puede quedar vacío.'); return }
    const tipo = tipos.find((t) => t.key === editKey)
    if (!tipo) { setEditKey(null); return }

    if (tipo.base) {
      updateCfg({ ...cfg, overrides: { ...cfg.overrides, [editKey]: { label, scope: draft.scope } } })
    } else {
      updateCfg({
        ...cfg,
        custom: cfg.custom.map((t) => (t.key === editKey ? { ...t, label, scope: draft.scope } : t)),
      })
    }
    setEditKey(null); setError('')
  }

  const agregar = () => {
    const label = (nuevo?.label || '').trim()
    if (!label) { setError('Escribe un nombre para el tipo.'); return }
    const key = slugify(label)
    if (!key) { setError('El nombre debe contener al menos una letra o número.'); return }
    if (tipos.some((t) => t.key === key)) { setError('Ya existe un tipo con ese nombre.'); return }

    updateCfg({ ...cfg, custom: [...cfg.custom, { key, label, scope: nuevo.scope }] })
    setNuevo(null); setError('')
  }

  const eliminar = () => {
    updateCfg({ ...cfg, custom: cfg.custom.filter((t) => t.key !== deleteKey) })
    setDeleteKey(null)
  }

  const toDelete = tipos.find((t) => t.key === deleteKey)

  return (
    <>
      <Modal open={open} onClose={cerrar} title="Gestionar tipos de documento" size="lg">
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Los tipos base no se pueden eliminar, solo editar. Los tipos que agregues se guardan
            en este navegador.
          </p>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="table-th">Nombre</th>
                  <th className="table-th w-40">Aplica a</th>
                  <th className="table-th w-32 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tipos.map((t) => {
                  const editando = editKey === t.key
                  return (
                    <tr key={t.key} className="hover:bg-slate-50/80 transition-colors">
                      <td className="table-td">
                        {editando ? (
                          <input
                            autoFocus
                            value={draft.label}
                            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') guardarEdit(); if (e.key === 'Escape') setEditKey(null) }}
                            className="input-base text-sm"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TIPO_COLORS[t.key] || COLOR_FALLBACK}`}>
                              {t.label}
                            </span>
                            {!t.base && (
                              <span className="text-xs text-slate-400">personalizado</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="table-td">
                        {editando ? (
                          <select
                            value={draft.scope}
                            onChange={(e) => setDraft((d) => ({ ...d, scope: e.target.value }))}
                            className="input-base text-sm"
                          >
                            <option value="trabajador">Trabajador</option>
                            <option value="empresa">Empresa</option>
                          </select>
                        ) : (
                          <span className="text-sm text-slate-600">{SCOPE_LABELS[t.scope]}</span>
                        )}
                      </td>
                      <td className="table-td">
                        <div className="flex items-center justify-center gap-1">
                          {editando ? (
                            <>
                              <button onClick={guardarEdit} className="btn-ghost p-1.5 text-emerald-500 hover:text-emerald-700" title="Guardar">
                                <Check className="w-4 h-4" />
                              </button>
                              <button onClick={() => { setEditKey(null); setError('') }} className="btn-ghost p-1.5 text-slate-400 hover:text-slate-600" title="Cancelar">
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(t)} className="btn-ghost p-1.5 text-slate-400 hover:text-slate-700" title="Editar">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteKey(t.key)}
                                disabled={t.base}
                                className={`btn-ghost p-1.5 ${t.base ? 'text-slate-200 cursor-not-allowed' : 'text-red-400 hover:text-red-600'}`}
                                title={t.base ? 'Los tipos base no se pueden eliminar' : 'Eliminar'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {nuevo && (
                  <tr className="bg-indigo-50/40">
                    <td className="table-td">
                      <input
                        autoFocus
                        value={nuevo.label}
                        onChange={(e) => setNuevo((n) => ({ ...n, label: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') agregar(); if (e.key === 'Escape') { setNuevo(null); setError('') } }}
                        placeholder="Nombre del tipo"
                        className="input-base text-sm"
                      />
                    </td>
                    <td className="table-td">
                      <select
                        value={nuevo.scope}
                        onChange={(e) => setNuevo((n) => ({ ...n, scope: e.target.value }))}
                        className="input-base text-sm"
                      >
                        <option value="trabajador">Trabajador</option>
                        <option value="empresa">Empresa</option>
                      </select>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={agregar} className="btn-ghost p-1.5 text-emerald-500 hover:text-emerald-700" title="Agregar">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setNuevo(null); setError('') }} className="btn-ghost p-1.5 text-slate-400 hover:text-slate-600" title="Cancelar">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-between items-center">
            <button
              onClick={() => { setEditKey(null); setError(''); setNuevo({ label: '', scope: 'trabajador' }) }}
              disabled={!!nuevo}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Agregar tipo
            </button>
            <button onClick={cerrar} className="btn-primary text-sm">Listo</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteKey}
        onClose={() => setDeleteKey(null)}
        onConfirm={eliminar}
        title="Eliminar tipo"
        message={`¿Eliminar el tipo "${toDelete?.label}"? Los documentos ya subidos con este tipo se mantienen.`}
      />
    </>
  )
}

/* ── Vista de documentos (empresa o trabajadores) ───────────── */

function DocumentosVista({
  scope, docs, tiposScope, tipoLabels, trabajadores,
  addDocumento, deleteDocumento, onBack, isAdmin, onGestionarTipos,
}) {
  const esEmpresa = scope === 'empresa'

  const fileRef = useRef(null)
  const [filtroTipo, setFiltroTipo]             = useState('todos')
  const [filtroTrabajador, setFiltroTrabajador] = useState('todos')
  const [tipoUpload, setTipoUpload]             = useState('')
  const [uploadWorker, setUploadWorker]         = useState('')
  const [deleteId, setDeleteId]                 = useState(null)
  const [uploading, setUploading]               = useState(false)
  const [modoUpload, setModoUpload]             = useState('archivo')
  const [urlExterna, setUrlExterna]             = useState('')
  const [toast, setToast]                       = useState(null)

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  /* El admin puede renombrar, eliminar o cambiar de ámbito un tipo mientras
     esta vista está abierta: caemos al primer tipo válido si eso pasa. */
  const tipoActual  = tiposScope.some((t) => t.key === tipoUpload) ? tipoUpload : (tiposScope[0]?.key ?? '')
  const filtroValido = filtroTipo === 'todos' || tiposScope.some((t) => t.key === filtroTipo)
    ? filtroTipo
    : 'todos'

  const filtered = docs.filter((d) => {
    const matchTipo = filtroValido === 'todos' || d.tipo === filtroValido
    const matchTrab = esEmpresa || filtroTrabajador === 'todos' || d.trabajadorId === filtroTrabajador
    return matchTipo && matchTrab
  })

  const stats = useMemo(() => {
    const porTipo = tiposScope
      .map((t) => ({ label: t.label, count: docs.filter((d) => d.tipo === t.key).length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
    return [...porTipo, { label: 'Total', count: docs.length }]
  }, [tiposScope, docs])

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (!tipoActual) {
      showToast('error', 'No hay tipos disponibles para esta sección')
      return
    }
    if (!esEmpresa && !uploadWorker) {
      showToast('error', 'Selecciona un trabajador antes de subir el documento')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('error', 'El archivo supera el límite de 10MB')
      return
    }
    setUploading(true)
    try {
      const workerId     = esEmpresa ? 'empresa' : uploadWorker
      const storagePath  = `${workerId}/${Date.now()}_${file.name.replace(/\s/g, '_')}`
      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(storagePath, file, { upsert: false, contentType: file.type })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(storagePath)
      addDocumento({
        trabajadorId: esEmpresa ? null : uploadWorker,
        tipo:         tipoActual,
        nombre:       file.name,
        fecha:        new Date().toISOString().split('T')[0],
        tamaño:       `${(file.size / 1024).toFixed(0)} KB`,
        url:          publicUrl,
        urlExterna:   null,
      })
      showToast('success', 'Documento subido correctamente')
    } catch (err) {
      showToast('error', `Error al subir: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleLinkExterno = () => {
    if (!urlExterna.trim()) return
    if (!tipoActual) {
      showToast('error', 'No hay tipos disponibles para esta sección')
      return
    }
    if (!esEmpresa && !uploadWorker) {
      showToast('error', 'Selecciona un trabajador antes de guardar el link')
      return
    }
    addDocumento({
      trabajadorId: esEmpresa ? null : uploadWorker,
      tipo:         tipoActual,
      nombre:       urlExterna.replace(/^https?:\/\//, '').slice(0, 80),
      fecha:        new Date().toISOString().split('T')[0],
      tamaño:       null,
      url:          null,
      urlExterna:   urlExterna,
    })
    setUrlExterna('')
    showToast('success', 'Link externo guardado correctamente')
  }

  const getTrabajadorNombre = (id) =>
    id ? trabajadores.find((t) => t.id === id)?.nombre || 'Desconocido' : '—'

  const toDelete = docs.find((d) => d.id === deleteId)
  const faltaTrabajador = !esEmpresa && !uploadWorker

  const renderDoc = (doc) => (
    <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${doc.urlExterna ? 'bg-blue-50' : 'bg-red-50'}`}>
        {doc.urlExterna
          ? <ExternalLink className="w-4 h-4 text-blue-400" />
          : <FileText className="w-4 h-4 text-red-400" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800 truncate">{doc.nombre}</div>
        <div className="flex flex-wrap items-center gap-2 mt-0.5">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TIPO_COLORS[doc.tipo] || COLOR_FALLBACK}`}>
            {tipoLabels[doc.tipo] || doc.tipo}
          </span>
          {doc.trabajadorId && (
            <span className="text-xs text-slate-400">{getTrabajadorNombre(doc.trabajadorId)}</span>
          )}
          <span className="text-xs text-slate-400">{formatDate(doc.fecha)}</span>
          {doc.tamaño && <span className="text-xs text-slate-300">{doc.tamaño}</span>}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {(doc.url || doc.urlExterna) ? (
          <button
            onClick={() => window.open(doc.url || doc.urlExterna, '_blank')}
            className="btn-ghost p-1.5 text-blue-400 hover:text-blue-600"
            title={doc.urlExterna ? 'Abrir link externo' : 'Ver documento'}
          >
            {doc.urlExterna ? <ExternalLink className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <button disabled className="p-1.5 text-slate-200 cursor-not-allowed" title="Sin archivo adjunto">
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
        {doc.url && (
          <a
            href={doc.url}
            download={doc.nombre}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost p-1.5 text-slate-400 hover:text-slate-700"
            title="Descargar"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        )}
        <button
          onClick={() => setDeleteId(doc.id)}
          className="btn-ghost p-1.5 text-red-400 hover:text-red-600"
          title="Eliminar"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Cabecera de la sección */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="btn-secondary text-sm">
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
          <div className="flex items-center gap-2">
            {esEmpresa
              ? <Building2 className="w-5 h-5 text-indigo-500" />
              : <Users className="w-5 h-5 text-emerald-500" />
            }
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {esEmpresa ? 'Documentos de Empresa' : 'Documentos de Trabajadores'}
              </h3>
              <p className="text-xs text-slate-500">{docs.length} documento{docs.length === 1 ? '' : 's'}</p>
            </div>
          </div>
        </div>

        {isAdmin && (
          <button onClick={onGestionarTipos} className="btn-secondary text-sm">
            <Settings className="w-4 h-4" />
            Gestionar tipos
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(({ label, count }) => (
          <div key={label} className="card p-4">
            <div className="text-lg font-bold text-slate-900">{count}</div>
            <div className="text-xs text-slate-500 truncate" title={label}>{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Panel izquierdo */}
        <div className="lg:col-span-1 space-y-3">
          {/* Upload */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Upload className="w-4 h-4" /> Subir Documento
            </h3>

            {/* Toggle archivo / link externo */}
            <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
              <button
                onClick={() => setModoUpload('archivo')}
                className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  modoUpload === 'archivo' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Subir archivo
              </button>
              <button
                onClick={() => setModoUpload('link')}
                className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  modoUpload === 'link' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Link externo
              </button>
            </div>

            {/* Tipo de documento — solo los del ámbito actual */}
            <div>
              <label className="label-base">Tipo</label>
              <select
                value={tipoActual}
                onChange={(e) => setTipoUpload(e.target.value)}
                disabled={tiposScope.length === 0}
                className="input-base text-sm disabled:opacity-50"
              >
                {tiposScope.map(({ key, label }) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Trabajador — obligatorio en la sección de trabajadores */}
            {!esEmpresa && (
              <div>
                <label className="label-base">Trabajador</label>
                <select
                  value={uploadWorker}
                  onChange={(e) => setUploadWorker(e.target.value)}
                  className="input-base text-sm"
                >
                  <option value="">— Selecciona —</option>
                  {trabajadores.filter((t) => t.estado === 'activo').map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Input según modo */}
            {modoUpload === 'archivo' ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || faltaTrabajador || !tipoActual}
                  className="btn-secondary w-full justify-center py-3 border-dashed disabled:opacity-50"
                >
                  {uploading
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /><span>Subiendo...</span></>
                    : <><Upload className="w-4 h-4" /><span>Seleccionar archivo</span></>
                  }
                </button>
                <p className="text-xs text-slate-400 text-center">
                  {faltaTrabajador ? 'Selecciona un trabajador para continuar' : 'PDF, JPG, PNG, DOC, DOCX · Máx 10MB'}
                </p>
              </>
            ) : (
              <>
                <input
                  type="url"
                  value={urlExterna}
                  onChange={(e) => setUrlExterna(e.target.value)}
                  placeholder="https://..."
                  className="input-base text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleLinkExterno()}
                />
                <button
                  type="button"
                  onClick={handleLinkExterno}
                  disabled={!urlExterna.trim() || faltaTrabajador || !tipoActual}
                  className="btn-primary w-full justify-center disabled:opacity-50"
                >
                  Guardar link
                </button>
                {faltaTrabajador && (
                  <p className="text-xs text-slate-400 text-center">Selecciona un trabajador para continuar</p>
                )}
              </>
            )}
          </div>

          {/* Filtros */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filtros
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => setFiltroTipo('todos')}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filtroValido === 'todos' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Todos los tipos
              </button>
              {tiposScope.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFiltroTipo(key)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filtroValido === key ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {!esEmpresa && (
              <>
                <label className="label-base mt-3 block pt-2">Trabajador</label>
                <select
                  value={filtroTrabajador}
                  onChange={(e) => setFiltroTrabajador(e.target.value)}
                  className="input-base text-xs mt-1"
                >
                  <option value="todos">Todos</option>
                  {trabajadores.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        {/* Lista de documentos */}
        <div className="lg:col-span-3">
          <div className="card overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FolderOpen className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">No hay documentos con los filtros seleccionados.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">{filtered.map(renderDoc)}</div>
            )}
          </div>
        </div>
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteDocumento(deleteId)}
        title="Eliminar documento"
        message={`¿Eliminar "${toDelete?.nombre}"? Esta acción no se puede deshacer.`}
      />
    </div>
  )
}

/* ── Documentos tab ─────────────────────────────────────────── */

function DocumentosTab() {
  const { documentos, trabajadores, addDocumento, deleteDocumento } = useApp()
  const { user } = useAuth()
  const isAdmin = user?.rol === 'admin'

  const { tipos, cfg, updateCfg } = useTiposDocumento()
  const [vista, setVista]         = useState('inicio')   // 'inicio' | 'empresa' | 'trabajador'
  const [tiposOpen, setTiposOpen] = useState(false)

  const tipoLabels = useMemo(
    () => Object.fromEntries(tipos.map((t) => [t.key, t.label])),
    [tipos],
  )

  const docsEmpresa    = useMemo(() => documentos.filter((d) => !d.trabajadorId), [documentos])
  const docsTrabajador = useMemo(() => documentos.filter((d) => !!d.trabajadorId), [documentos])

  const tiposEmpresa    = useMemo(() => tipos.filter((t) => t.scope === 'empresa'), [tipos])
  const tiposTrabajador = useMemo(() => tipos.filter((t) => t.scope === 'trabajador'), [tipos])

  const modalTipos = (
    <TiposModal
      open={tiposOpen}
      onClose={() => setTiposOpen(false)}
      tipos={tipos}
      cfg={cfg}
      updateCfg={updateCfg}
    />
  )

  if (vista === 'inicio') {
    const CARDS = [
      {
        key:   'empresa',
        icon:  Building2,
        title: 'Documentos de Empresa',
        desc:  'Constitución, patentes, reglamento interno y más',
        count: docsEmpresa.length,
        tone:  'text-indigo-500 bg-indigo-50',
      },
      {
        key:   'trabajador',
        icon:  Users,
        title: 'Documentos de Trabajadores',
        desc:  'Contratos, anexos, liquidaciones y finiquitos',
        count: docsTrabajador.length,
        tone:  'text-emerald-500 bg-emerald-50',
      },
    ]

    return (
      <div className="space-y-5">
        {isAdmin && (
          <div className="flex justify-end">
            <button onClick={() => setTiposOpen(true)} className="btn-secondary text-sm">
              <Settings className="w-4 h-4" />
              Gestionar tipos
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CARDS.map(({ key, icon: Icon, title, desc, count, tone }) => (
            <button
              key={key}
              onClick={() => setVista(key)}
              className="card p-6 text-left hover:shadow-md hover:border-slate-300 transition-all group"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${tone}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-xs text-slate-500 mt-1">{desc}</p>
              <p className="text-2xl font-bold text-slate-900 mt-4">
                {count}
                <span className="text-sm font-medium text-slate-400 ml-1.5">
                  documento{count === 1 ? '' : 's'}
                </span>
              </p>
            </button>
          ))}
        </div>

        {modalTipos}
      </div>
    )
  }

  const esEmpresa = vista === 'empresa'

  return (
    <>
      <DocumentosVista
        scope={vista}
        docs={esEmpresa ? docsEmpresa : docsTrabajador}
        tiposScope={esEmpresa ? tiposEmpresa : tiposTrabajador}
        tipoLabels={tipoLabels}
        trabajadores={trabajadores}
        addDocumento={addDocumento}
        deleteDocumento={deleteDocumento}
        onBack={() => setVista('inicio')}
        isAdmin={isAdmin}
        onGestionarTipos={() => setTiposOpen(true)}
      />
      {modalTipos}
    </>
  )
}

/* ── Página principal ───────────────────────────────────────── */

export default function RRHHPage() {
  const { documentos, solicitudesPassword } = useApp()
  const [tab, setTab] = useState('documentos')

  const pendientes = solicitudesPassword.filter((s) => s.estado === 'pendiente').length

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Recursos Humanos</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {tab === 'documentos'
              ? `${documentos.length} documentos en total`
              : `${pendientes} solicitud${pendientes === 1 ? '' : 'es'} pendiente${pendientes === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('documentos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'documentos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          Documentos
        </button>
        <button
          onClick={() => setTab('passwords')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
            tab === 'passwords' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          Contraseñas
          {pendientes > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold">
              {pendientes}
            </span>
          )}
        </button>
      </div>

      {tab === 'documentos' && <DocumentosTab />}
      {tab === 'passwords'  && <PasswordsTab />}
    </div>
  )
}
