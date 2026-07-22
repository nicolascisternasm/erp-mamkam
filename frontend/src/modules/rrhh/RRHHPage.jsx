import { useState, useMemo, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../auth/AuthContext'
import { formatDate } from '../../utils/formatters'
import { ConfirmModal } from '../../components/Modal'
import Toast from '../../components/Toast'
import { supabase } from '../../services/supabase'
import {
  FolderOpen, Upload, Trash2, FileText, Filter,
  KeyRound, CheckCircle2, XCircle, Clock, Phone,
  Eye, ExternalLink, Download, RefreshCw,
} from 'lucide-react'

/* ── Tipos de documento ─────────────────────────────────────── */

const TIPOS_TRABAJADOR = [
  { key: 'contrato',            label: 'Contrato de trabajo' },
  { key: 'anexo',               label: 'Anexo de contrato' },
  { key: 'vacaciones_firmadas', label: 'Solicitud de vacaciones firmada' },
  { key: 'finiquito',           label: 'Finiquito' },
  { key: 'liquidacion',         label: 'Liquidación de sueldo' },
  { key: 'reglamento',          label: 'Reglamento interno' },
  { key: 'otro_trabajador',     label: 'Otro (trabajador)' },
]

const TIPOS_EMPRESA_LIST = [
  { key: 'constitucion', label: 'Escritura de constitución' },
  { key: 'iva_pagado',   label: 'Comprobante IVA pagado' },
  { key: 'patente',      label: 'Patente comercial' },
  { key: 'rut_empresa',  label: 'RUT empresa' },
  { key: 'otro_empresa', label: 'Otro (empresa)' },
]

const TIPOS_EMPRESA = TIPOS_EMPRESA_LIST.map(t => t.key)

const TIPO_LABELS = Object.fromEntries(
  [...TIPOS_TRABAJADOR, ...TIPOS_EMPRESA_LIST].map(({ key, label }) => [key, label])
)

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

/* ── Documentos tab ─────────────────────────────────────────── */

function DocumentosTab() {
  const { documentos, trabajadores, addDocumento, deleteDocumento } = useApp()
  const fileRef = useRef(null)
  const [filtroTipo, setFiltroTipo]           = useState('todos')
  const [filtroTrabajador, setFiltroTrabajador] = useState('todos')
  const [tipoUpload, setTipoUpload]           = useState('contrato')
  const [uploadWorker, setUploadWorker]       = useState('')
  const [deleteId, setDeleteId]               = useState(null)
  const [uploading, setUploading]             = useState(false)
  const [modoUpload, setModoUpload]           = useState('archivo')
  const [urlExterna, setUrlExterna]           = useState('')
  const [toast, setToast]                     = useState(null)

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const esTipoEmpresa = TIPOS_EMPRESA.includes(tipoUpload)

  const filtered = documentos.filter((d) => {
    const matchTipo = filtroTipo === 'todos' || d.tipo === filtroTipo
    const matchTrab =
      filtroTrabajador === 'todos' ||
      d.trabajadorId === filtroTrabajador ||
      (filtroTrabajador === 'general' && !d.trabajadorId)
    return matchTipo && matchTrab
  })

  const docsEmpresa     = filtered.filter(d => !d.trabajadorId)
  const docsTrabajador  = filtered.filter(d => !!d.trabajadorId)

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (file.size > 10 * 1024 * 1024) {
      showToast('error', 'El archivo supera el límite de 10MB')
      return
    }
    setUploading(true)
    try {
      const workerId     = esTipoEmpresa ? 'empresa' : (uploadWorker || 'empresa')
      const storagePath  = `${workerId}/${Date.now()}_${file.name.replace(/\s/g, '_')}`
      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(storagePath, file, { upsert: false, contentType: file.type })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(storagePath)
      addDocumento({
        trabajadorId: esTipoEmpresa ? null : (uploadWorker || null),
        tipo:         tipoUpload,
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
    addDocumento({
      trabajadorId: esTipoEmpresa ? null : (uploadWorker || null),
      tipo:         tipoUpload,
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

  const toDelete = documentos.find((d) => d.id === deleteId)

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
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TIPO_COLORS[doc.tipo] || 'bg-slate-100 text-slate-600'}`}>
            {TIPO_LABELS[doc.tipo] || doc.tipo}
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
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Contratos',     count: documentos.filter(d => d.tipo === 'contrato').length,                       icon: '📋' },
          { label: 'Liquidaciones', count: documentos.filter(d => d.tipo === 'liquidacion').length,                    icon: '💰' },
          { label: 'Empresa',       count: documentos.filter(d => TIPOS_EMPRESA.includes(d.tipo)).length,              icon: '🏢' },
          { label: 'Total',         count: documentos.length,                                                          icon: '📁' },
        ].map(({ label, count, icon }) => (
          <div key={label} className="card p-4">
            <div className="text-2xl mb-1">{icon}</div>
            <div className="text-lg font-bold text-slate-900">{count}</div>
            <div className="text-xs text-slate-500">{label}</div>
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

            {/* Tipo de documento */}
            <div>
              <label className="label-base">Tipo</label>
              <select
                value={tipoUpload}
                onChange={(e) => { setTipoUpload(e.target.value); setUploadWorker('') }}
                className="input-base text-sm"
              >
                <optgroup label="Documentos de trabajador">
                  {TIPOS_TRABAJADOR.map(({ key, label }) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </optgroup>
                <optgroup label="Documentos de empresa">
                  {TIPOS_EMPRESA_LIST.map(({ key, label }) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Trabajador (solo para tipos de trabajador) */}
            {!esTipoEmpresa && (
              <div>
                <label className="label-base">Trabajador</label>
                <select
                  value={uploadWorker}
                  onChange={(e) => setUploadWorker(e.target.value)}
                  className="input-base text-sm"
                >
                  <option value="">— General —</option>
                  {trabajadores.filter(t => t.estado === 'activo').map((t) => (
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
                  disabled={uploading}
                  className="btn-secondary w-full justify-center py-3 border-dashed disabled:opacity-50"
                >
                  {uploading
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /><span>Subiendo...</span></>
                    : <><Upload className="w-4 h-4" /><span>Seleccionar archivo</span></>
                  }
                </button>
                <p className="text-xs text-slate-400 text-center">PDF, JPG, PNG, DOC, DOCX · Máx 10MB</p>
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
                  disabled={!urlExterna.trim()}
                  className="btn-primary w-full justify-center disabled:opacity-50"
                >
                  Guardar link
                </button>
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
                  filtroTipo === 'todos' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Todos los tipos
              </button>
              <p className="text-xs font-semibold text-slate-400 px-2.5 pt-2 pb-0.5">Trabajadores</p>
              {TIPOS_TRABAJADOR.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFiltroTipo(key)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filtroTipo === key ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
              <p className="text-xs font-semibold text-slate-400 px-2.5 pt-2 pb-0.5">Empresa</p>
              {TIPOS_EMPRESA_LIST.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFiltroTipo(key)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filtroTipo === key ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="label-base mt-3 block pt-2">Trabajador</label>
            <select
              value={filtroTrabajador}
              onChange={(e) => setFiltroTrabajador(e.target.value)}
              className="input-base text-xs mt-1"
            >
              <option value="todos">Todos</option>
              <option value="general">Solo empresa</option>
              {trabajadores.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
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
              <div>
                {docsEmpresa.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Empresa</span>
                      <span className="text-xs bg-slate-200 text-slate-600 rounded-full px-1.5">{docsEmpresa.length}</span>
                    </div>
                    <div className="divide-y divide-slate-50">{docsEmpresa.map(renderDoc)}</div>
                  </>
                )}
                {docsTrabajador.length > 0 && (
                  <>
                    <div className={`px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 ${docsEmpresa.length > 0 ? 'border-t border-slate-100' : ''}`}>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Trabajadores</span>
                      <span className="text-xs bg-slate-200 text-slate-600 rounded-full px-1.5">{docsTrabajador.length}</span>
                    </div>
                    <div className="divide-y divide-slate-50">{docsTrabajador.map(renderDoc)}</div>
                  </>
                )}
              </div>
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
