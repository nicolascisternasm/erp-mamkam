import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { apiClient } from '../../services/apiClient'
import { supabase } from '../../services/supabase'
import {
  Save, User, Lock, CheckCircle2, AlertCircle,
  Building2, RefreshCw, Eye, EyeOff, ImagePlus,
  Plus, Pencil, Trash2, X, Tag, FileText,
  ChevronDown, Loader2,
} from 'lucide-react'
import DiasNoLaborablesPage from '../empresa/DiasNoLaborablesPage'
import UsuariosPage from '../usuarios/UsuariosPage'

function Msg({ msg }) {
  if (!msg) return null
  return (
    <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
      msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
    }`}>
      {msg.ok
        ? <CheckCircle2 className="w-4 h-4 shrink-0" />
        : <AlertCircle  className="w-4 h-4 shrink-0" />
      }
      {msg.text}
    </div>
  )
}

/* ── Tab Mi Perfil ───────────────────────────────────────────────── */
function TabPerfil({ user, updateUser }) {
  const [form, setForm] = useState({
    nombre:    user?.nombre    ?? '',
    apellidos: user?.apellidos ?? '',
    email:     user?.email     ?? '',
    telefono:  user?.telefono  ?? '',
  })
  const [msg,     setMsg]     = useState(null)
  const [saving,  setSaving]  = useState(false)

  const set = (k) => (e) => { setForm(p => ({ ...p, [k]: e.target.value })); setMsg(null) }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setMsg({ ok: false, text: 'El nombre es requerido.' }); return }
    setSaving(true); setMsg(null)
    try {
      const updated = await apiClient.patch('/auth/me', {
        nombre:    form.nombre.trim(),
        apellidos: form.apellidos.trim() || null,
        email:     form.email.trim(),
        telefono:  form.telefono.trim() || null,
      })
      updateUser(updated)
      setMsg({ ok: true, text: 'Datos actualizados correctamente.' })
    } catch (err) {
      setMsg({ ok: false, text: err.message || 'Error al guardar.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Tarjeta de identidad */}
      <div className="card p-4 flex items-center gap-3 bg-indigo-50 border border-indigo-100">
        <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">{user?.initials || 'U'}</span>
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-800">{user?.nombre}</div>
          <div className="text-xs text-slate-500 capitalize">{user?.rol} · {user?.email}</div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700">Datos Personales</h3>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">Nombre *</label>
              <input value={form.nombre} onChange={set('nombre')} className="input-base" placeholder="Juan" />
            </div>
            <div>
              <label className="label-base">Apellidos</label>
              <input value={form.apellidos} onChange={set('apellidos')} className="input-base" placeholder="Pérez" />
            </div>
          </div>
          <div>
            <label className="label-base">Correo electrónico</label>
            <input type="email" value={form.email} onChange={set('email')} className="input-base" placeholder="tu@empresa.com" />
          </div>
          <div>
            <label className="label-base">Teléfono</label>
            <input value={form.telefono} onChange={set('telefono')} className="input-base" placeholder="+56 9 1234 5678" />
          </div>
          <Msg msg={msg} />
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar Datos'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Tab Contraseña ──────────────────────────────────────────────── */
function TabContrasena() {
  const [form, setForm] = useState({ actual: '', nueva: '', confirmar: '' })
  const [showActual, setShowActual] = useState(false)
  const [showNueva,  setShowNueva]  = useState(false)
  const [msg,     setMsg]     = useState(null)
  const [saving,  setSaving]  = useState(false)

  const set = (k) => (e) => { setForm(p => ({ ...p, [k]: e.target.value })); setMsg(null) }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.actual || !form.nueva || !form.confirmar) {
      setMsg({ ok: false, text: 'Completa todos los campos.' }); return
    }
    if (form.nueva !== form.confirmar) {
      setMsg({ ok: false, text: 'La nueva contraseña no coincide.' }); return
    }
    if (form.nueva.length < 8) {
      setMsg({ ok: false, text: 'Mínimo 8 caracteres.' }); return
    }
    setSaving(true); setMsg(null)
    try {
      await apiClient.patch('/auth/me/password', { actual: form.actual, nueva: form.nueva })
      setForm({ actual: '', nueva: '', confirmar: '' })
      setMsg({ ok: true, text: 'Contraseña actualizada correctamente.' })
    } catch (err) {
      setMsg({ ok: false, text: err.message || 'Error al cambiar la contraseña.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Lock className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-700">Cambiar Contraseña</h3>
      </div>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="label-base">Contraseña actual</label>
          <div className="relative">
            <input
              type={showActual ? 'text' : 'password'}
              value={form.actual}
              onChange={set('actual')}
              className="input-base pr-10"
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShowActual(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showActual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="label-base">Nueva contraseña</label>
          <div className="relative">
            <input
              type={showNueva ? 'text' : 'password'}
              value={form.nueva}
              onChange={set('nueva')}
              className="input-base pr-10"
              placeholder="Mínimo 8 caracteres"
            />
            <button type="button" onClick={() => setShowNueva(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showNueva ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="label-base">Confirmar nueva contraseña</label>
          <input
            type="password"
            value={form.confirmar}
            onChange={set('confirmar')}
            className="input-base"
            placeholder="Repite la contraseña"
          />
        </div>
        <Msg msg={msg} />
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Cambiar Contraseña'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ── Tab Mi Empresa ──────────────────────────────────────────────── */
const EMPTY_BANCO = { banco: '', tipo_cuenta: '', numero_cuenta: '', rut_titular: '', nombre_titular: '', email_transferencia: '' }
const EMPTY_FORM  = {
  razon_social: '', nombre_fantasia: '', giro: '', representante_legal: '',
  email_contacto: '', telefono: '', sitio_web: '',
  direccion: '', comuna: '', ciudad: '', region: '', pais: '', codigo_postal: '',
}

function InfoRow({ label, value }) {
  if (!value) return null
  return <div><span className="text-slate-400">{label}: </span>{value}</div>
}

function SectionHeader({ icon: Icon, title, onEdit, editing }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </div>
      <button onClick={onEdit} className="btn-secondary text-xs py-1.5">
        {editing ? 'Cancelar' : 'Editar'}
      </button>
    </div>
  )
}

function TabEmpresa() {
  const [empresa,       setEmpresa]       = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [editing,       setEditing]       = useState(false)
  const [form,          setForm]          = useState({ ...EMPTY_FORM })
  const [banco,         setBanco]         = useState({ ...EMPTY_BANCO })
  const [editBanco,     setEditBanco]     = useState(false)
  const [msg,           setMsg]           = useState(null)
  const [msgBanco,      setMsgBanco]      = useState(null)
  const [saving,        setSaving]        = useState(false)
  const [savingBanco,   setSavingBanco]   = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [msgLogo,       setMsgLogo]       = useState(null)

  function applyEmpresa(e) {
    setEmpresa(e)
    setForm({
      razon_social:        e.razon_social        ?? '',
      nombre_fantasia:     e.nombre_fantasia     ?? '',
      giro:                e.giro                ?? '',
      representante_legal: e.representante_legal ?? '',
      email_contacto:      e.email_contacto      ?? e.email    ?? '',
      telefono:            e.telefono            ?? '',
      sitio_web:           e.sitio_web           ?? '',
      direccion:           e.direccion           ?? '',
      comuna:              e.comuna              ?? '',
      ciudad:              e.ciudad              ?? '',
      region:              e.region              ?? '',
      pais:                e.pais                ?? '',
      codigo_postal:       e.codigo_postal       ?? '',
    })
    setBanco({ ...EMPTY_BANCO, ...(e.datos_bancarios ?? {}) })
  }

  useEffect(() => {
    setLoading(true); setError(null)
    apiClient.get('/auth/empresa')
      .then(applyEmpresa)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const set = (k) => (e) => { setForm(p => ({ ...p, [k]: e.target.value })); setMsg(null) }
  const setBancoField = (k) => (e) => { setBanco(p => ({ ...p, [k]: e.target.value })); setMsgBanco(null) }

  const handleLogo = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true); setMsgLogo(null)
    try {
      const formData = new FormData()
      formData.append('logo', file)
      const token = JSON.parse(localStorage.getItem('mamkam_auth') || '{}').token
      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
      const res = await fetch(`${BASE}/auth/empresa/logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const text = await res.text()
      let json
      try { json = JSON.parse(text) } catch { throw new Error(`Error del servidor (${res.status}): ${text.slice(0, 120)}`) }
      if (!res.ok) throw new Error(json.error?.message || 'Error al subir logo')
      setEmpresa(prev => ({ ...prev, logo_url: json.data.logo_url }))
      setMsgLogo({ ok: true, text: 'Logo actualizado.' })
    } catch (err) {
      setMsgLogo({ ok: false, text: err.message })
    } finally {
      setUploadingLogo(false)
      e.target.value = ''
    }
  }

  const handleSave = async (ev) => {
    ev.preventDefault()
    setSaving(true); setMsg(null)
    try {
      const updated = await apiClient.patch('/auth/empresa', {
        razon_social:        form.razon_social        || undefined,
        nombre_fantasia:     form.nombre_fantasia     || null,
        giro:                form.giro                || null,
        representante_legal: form.representante_legal || null,
        email_contacto:      form.email_contacto      || undefined,
        telefono:            form.telefono            || null,
        sitio_web:           form.sitio_web           || null,
        direccion:           form.direccion           || null,
        comuna:              form.comuna              || null,
        ciudad:              form.ciudad              || null,
        region:              form.region              || null,
        pais:                form.pais                || null,
        codigo_postal:       form.codigo_postal       || null,
      })
      applyEmpresa(updated)
      setEditing(false)
      setMsg({ ok: true, text: 'Datos actualizados correctamente.' })
    } catch (err) {
      setMsg({ ok: false, text: err.message || 'Error al guardar.' })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveBanco = async (ev) => {
    ev.preventDefault()
    setSavingBanco(true); setMsgBanco(null)
    try {
      const updated = await apiClient.patch('/auth/empresa', { datos_bancarios: banco })
      applyEmpresa(updated)
      setEditBanco(false)
      setMsgBanco({ ok: true, text: 'Datos bancarios guardados.' })
    } catch (err) {
      setMsgBanco({ ok: false, text: err.message || 'Error al guardar.' })
    } finally {
      setSavingBanco(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-24"><RefreshCw className="w-5 h-5 animate-spin text-slate-300" /></div>
  if (!empresa) return <div className="card p-6 text-center text-sm text-slate-400">{error || 'No tienes una empresa asociada.'}</div>

  const emailContacto = empresa.email_contacto ?? empresa.email

  return (
    <div className="space-y-4">

      {/* ── Encabezado con logo ── */}
      <div className="card overflow-hidden">
        <div className="flex items-start gap-4 p-4 border-b border-slate-100">
          {/* Logo */}
          <div className="w-20 h-20 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
            {empresa.logo_url
              ? <img src={empresa.logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
              : <Building2 className="w-8 h-8 text-slate-300" />}
          </div>
          {/* Nombre + logo actions */}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-800">{empresa.razon_social ?? empresa.nombre}</div>
            {empresa.nombre_fantasia && <div className="text-xs text-slate-500 mt-0.5">{empresa.nombre_fantasia}</div>}
            <div className="text-xs text-slate-400 mt-0.5">RUT {empresa.rut}</div>
            {empresa.giro && <div className="text-xs text-slate-400 mt-0.5 italic">{empresa.giro}</div>}
            <label className={`mt-2 btn-secondary text-xs py-1 cursor-pointer inline-flex items-center gap-1.5 ${uploadingLogo ? 'opacity-60 pointer-events-none' : ''}`}>
              <ImagePlus className="w-3.5 h-3.5" />
              {uploadingLogo ? 'Subiendo...' : empresa.logo_url ? 'Cambiar logo' : 'Subir logo'}
              <input type="file" accept="image/*" className="hidden" onChange={handleLogo} disabled={uploadingLogo} />
            </label>
            {msgLogo && <span className={`block mt-1 text-xs ${msgLogo.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msgLogo.text}</span>}
          </div>
        </div>
      </div>

      {/* ── Información general ── */}
      <div className="card overflow-hidden">
        <SectionHeader icon={Building2} title="Información general" editing={editing} onEdit={() => { setEditing(v => !v); setMsg(null) }} />

        {!editing ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 p-4 text-xs text-slate-600">
            <InfoRow label="Razón social"       value={empresa.razon_social ?? empresa.nombre} />
            <InfoRow label="Nombre de fantasía" value={empresa.nombre_fantasia} />
            <InfoRow label="Giro"               value={empresa.giro} />
            <InfoRow label="Representante legal" value={empresa.representante_legal} />
            <InfoRow label="Email"              value={emailContacto} />
            <InfoRow label="Teléfono"           value={empresa.telefono} />
            <InfoRow label="Sitio web"          value={empresa.sitio_web} />
        <InfoRow label="País"               value={empresa.pais} />
            <InfoRow label="Dirección"          value={empresa.direccion} />
            <InfoRow label="Comuna"             value={empresa.comuna} />
            <InfoRow label="Ciudad"             value={empresa.ciudad} />
            <InfoRow label="Región"             value={empresa.region} />
            <InfoRow label="Código postal"      value={empresa.codigo_postal} />
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Identificación</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label-base">Razón social *</label>
                  <input value={form.razon_social} onChange={set('razon_social')} className="input-base" required />
                </div>
                <div>
                  <label className="label-base">Nombre de fantasía</label>
                  <input value={form.nombre_fantasia} onChange={set('nombre_fantasia')} className="input-base" placeholder="Nombre comercial" />
                </div>
                <div>
                  <label className="label-base">Giro</label>
                  <input value={form.giro} onChange={set('giro')} className="input-base" placeholder="Ej: Servicios de construcción" />
                </div>
                <div className="col-span-2">
                  <label className="label-base">Representante legal</label>
                  <input value={form.representante_legal} onChange={set('representante_legal')} className="input-base" placeholder="Nombre completo" />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Contacto</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">Email de contacto *</label>
                  <input type="email" value={form.email_contacto} onChange={set('email_contacto')} className="input-base" required />
                </div>
                <div>
                  <label className="label-base">Teléfono</label>
                  <input value={form.telefono} onChange={set('telefono')} className="input-base" placeholder="+56 2 1234 5678" />
                </div>
                <div className="col-span-2">
                  <label className="label-base">Sitio web</label>
                  <input value={form.sitio_web} onChange={set('sitio_web')} className="input-base" placeholder="https://www.empresa.cl" />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Dirección</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label-base">Dirección</label>
                  <input value={form.direccion} onChange={set('direccion')} className="input-base" placeholder="Av. Ejemplo 123, Of. 45" />
                </div>
                <div>
                  <label className="label-base">Comuna</label>
                  <input value={form.comuna} onChange={set('comuna')} className="input-base" placeholder="Santiago" />
                </div>
                <div>
                  <label className="label-base">Ciudad</label>
                  <input value={form.ciudad} onChange={set('ciudad')} className="input-base" placeholder="Santiago" />
                </div>
                <div>
                  <label className="label-base">Región</label>
                  <input value={form.region} onChange={set('region')} className="input-base" placeholder="Región Metropolitana" />
                </div>
                <div>
                  <label className="label-base">País</label>
                  <input value={form.pais} onChange={set('pais')} className="input-base" placeholder="Chile" />
                </div>
                <div>
                  <label className="label-base">Código postal</label>
                  <input value={form.codigo_postal} onChange={set('codigo_postal')} className="input-base" placeholder="8320000" />
                </div>
              </div>
            </div>

            <Msg msg={msg} />
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        )}
        {msg && !editing && <div className="px-4 pb-4"><Msg msg={msg} /></div>}
      </div>

      {/* ── Datos bancarios ── */}
      <div className="card overflow-hidden">
        <SectionHeader icon={Building2} title="Datos bancarios" editing={editBanco} onEdit={() => { setEditBanco(v => !v); setMsgBanco(null) }} />

        {!editBanco ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 p-4 text-xs text-slate-600">
            <InfoRow label="Banco"              value={banco.banco} />
            <InfoRow label="Tipo de cuenta"     value={banco.tipo_cuenta} />
            <InfoRow label="N° cuenta"          value={banco.numero_cuenta} />
            <InfoRow label="RUT titular"        value={banco.rut_titular} />
            <InfoRow label="Titular"            value={banco.nombre_titular} />
            <InfoRow label="Email transferencia" value={banco.email_transferencia} />
            {!banco.banco && <div className="col-span-2 text-slate-400 italic">Sin datos bancarios configurados.</div>}
          </div>
        ) : (
          <form onSubmit={handleSaveBanco} className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-base">Banco</label>
                <input value={banco.banco} onChange={setBancoField('banco')} className="input-base" placeholder="Banco Estado, BCI..." />
              </div>
              <div>
                <label className="label-base">Tipo de cuenta</label>
                <select value={banco.tipo_cuenta} onChange={setBancoField('tipo_cuenta')} className="input-base">
                  <option value="">— Seleccionar —</option>
                  <option>Cuenta Corriente</option>
                  <option>Cuenta Vista</option>
                  <option>Cuenta de Ahorro</option>
                  <option>Cuenta RUT</option>
                </select>
              </div>
              <div>
                <label className="label-base">N° de cuenta</label>
                <input value={banco.numero_cuenta} onChange={setBancoField('numero_cuenta')} className="input-base" placeholder="00000000" />
              </div>
              <div>
                <label className="label-base">RUT titular</label>
                <input value={banco.rut_titular} onChange={setBancoField('rut_titular')} className="input-base" placeholder="12.345.678-9" />
              </div>
              <div>
                <label className="label-base">Nombre titular</label>
                <input value={banco.nombre_titular} onChange={setBancoField('nombre_titular')} className="input-base" placeholder="Empresa SpA" />
              </div>
              <div>
                <label className="label-base">Email para transferencia</label>
                <input type="email" value={banco.email_transferencia} onChange={setBancoField('email_transferencia')} className="input-base" placeholder="pagos@empresa.cl" />
              </div>
            </div>
            <Msg msg={msgBanco} />
            <div className="flex justify-end">
              <button type="submit" disabled={savingBanco} className="btn-primary disabled:opacity-60">
                <Save className="w-4 h-4" />
                {savingBanco ? 'Guardando...' : 'Guardar datos bancarios'}
              </button>
            </div>
          </form>
        )}
        {msgBanco && !editBanco && <div className="px-4 pb-4"><Msg msg={msgBanco} /></div>}
      </div>

    </div>
  )
}

/* ── Tab Cuentas Contables ───────────────────────────────────────── */
const CTA_FORM_EMPTY = { codigo: '', nombre: '', tipo: 'ambos', activa: true }
function TabCuentasContables() {
  const [cuentas,  setCuentas]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [modal,    setModal]    = useState(null)  // null | 'nueva' | cuenta-object
  const [form,     setForm]     = useState(CTA_FORM_EMPTY)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [msg,      setMsg]      = useState(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const data = await apiClient.get('/finanzas/cuentas-contables?all=true')
      setCuentas(Array.isArray(data) ? data : [])
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const abrirNueva = () => { setForm(CTA_FORM_EMPTY); setMsg(null); setModal('nueva') }
  const abrirEditar = (c) => { setForm({ codigo: c.codigo || '', nombre: c.nombre, tipo: c.tipo, activa: c.activa }); setMsg(null); setModal(c) }
  const cerrar = () => { setModal(null); setMsg(null) }

  const handleGuardar = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setMsg({ ok: false, text: 'El nombre es requerido.' }); return }
    setSaving(true); setMsg(null)
    try {
      if (modal === 'nueva') {
        await apiClient.post('/finanzas/cuentas-contables', form)
      } else {
        await apiClient.put(`/finanzas/cuentas-contables/${modal.id}`, form)
      }
      await cargar()
      cerrar()
    } catch (err) {
      setMsg({ ok: false, text: err.message || 'Error al guardar.' })
    } finally { setSaving(false) }
  }

  const handleEliminar = async (id) => {
    setDeleting(id)
    try {
      await apiClient.delete(`/finanzas/cuentas-contables/${id}`)
      setCuentas(p => p.filter(c => c.id !== id))
    } catch (err) {
      alert(err.message || 'No se pudo eliminar.')
    } finally { setDeleting(null) }
  }

  const TIPO_LABELS = { ingreso: 'Ingreso', egreso: 'Egreso', ambos: 'Ambos' }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Categorías contables para clasificar movimientos bancarios.</p>
        <button onClick={abrirNueva} className="btn-primary text-sm flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Nueva cuenta
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-slate-400">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Cargando...
        </div>
      ) : cuentas.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">No hay cuentas contables configuradas.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Código</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nombre</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cuentas.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{c.codigo || '—'}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{c.nombre}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      c.tipo === 'ingreso' ? 'bg-emerald-100 text-emerald-700'
                      : c.tipo === 'egreso' ? 'bg-red-100 text-red-700'
                      : 'bg-slate-100 text-slate-600'
                    }`}>{TIPO_LABELS[c.tipo] || c.tipo}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${c.activa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {c.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => abrirEditar(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleEliminar(c.id)}
                        disabled={deleting === c.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
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

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={cerrar}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-500" />
                <p className="font-semibold text-slate-900 text-sm">{modal === 'nueva' ? 'Nueva cuenta contable' : 'Editar cuenta'}</p>
              </div>
              <button onClick={cerrar} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleGuardar} className="p-5 space-y-4">
              <div>
                <label className="label-base">Código</label>
                <input value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} className="input-base" placeholder="Ej: 1.1, GAS-001" />
              </div>
              <div>
                <label className="label-base">Nombre *</label>
                <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} className="input-base" placeholder="Ej: Gastos de oficina" />
              </div>
              <div>
                <label className="label-base">Tipo</label>
                <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} className="input-base">
                  <option value="ambos">Ambos (ingreso y egreso)</option>
                  <option value="ingreso">Solo ingresos</option>
                  <option value="egreso">Solo egresos</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-700">Activa</label>
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, activa: !p.activa }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.activa ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.activa ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              <Msg msg={msg} />
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={cerrar} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Tab Tipos de Documento ──────────────────────────────────────── */
const TDOC_FORM_EMPTY = { nombre: '', activo: true }
function TabTiposDocumento() {
  const [tipos,    setTipos]    = useState([])
  const [loading,  setLoading]  = useState(false)
  const [modal,    setModal]    = useState(null)
  const [form,     setForm]     = useState(TDOC_FORM_EMPTY)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [msg,      setMsg]      = useState(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const data = await apiClient.get('/finanzas/tipos-documento?all=true')
      setTipos(Array.isArray(data) ? data : [])
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const abrirNuevo = () => { setForm(TDOC_FORM_EMPTY); setMsg(null); setModal('nuevo') }
  const abrirEditar = (t) => { setForm({ nombre: t.nombre, activo: t.activo }); setMsg(null); setModal(t) }
  const cerrar = () => { setModal(null); setMsg(null) }

  const handleGuardar = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setMsg({ ok: false, text: 'El nombre es requerido.' }); return }
    setSaving(true); setMsg(null)
    try {
      if (modal === 'nuevo') {
        await apiClient.post('/finanzas/tipos-documento', form)
      } else {
        await apiClient.put(`/finanzas/tipos-documento/${modal.id}`, form)
      }
      await cargar()
      cerrar()
    } catch (err) {
      setMsg({ ok: false, text: err.message || 'Error al guardar.' })
    } finally { setSaving(false) }
  }

  const handleEliminar = async (id) => {
    setDeleting(id)
    try {
      await apiClient.delete(`/finanzas/tipos-documento/${id}`)
      setTipos(p => p.filter(t => t.id !== id))
    } catch (err) {
      alert(err.message || 'No se pudo eliminar.')
    } finally { setDeleting(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Tipos de documento disponibles para conciliación sin respaldo.</p>
        <button onClick={abrirNuevo} className="btn-primary text-sm flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Nuevo tipo
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-slate-400">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Cargando...
        </div>
      ) : tipos.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">No hay tipos de documento configurados.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nombre</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tipos.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{t.nombre}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${t.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {t.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => abrirEditar(t)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleEliminar(t.id)}
                        disabled={deleting === t.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
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

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={cerrar}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                <p className="font-semibold text-slate-900 text-sm">{modal === 'nuevo' ? 'Nuevo tipo de documento' : 'Editar tipo'}</p>
              </div>
              <button onClick={cerrar} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleGuardar} className="p-5 space-y-4">
              <div>
                <label className="label-base">Nombre *</label>
                <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} className="input-base" placeholder="Ej: Boleta electrónica" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-700">Activo</label>
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, activo: !p.activo }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.activo ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.activo ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              <Msg msg={msg} />
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={cerrar} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Tab Accesos ─────────────────────────────────────────────────── */
function WorkerToggle({ trabajadorId, campo, value, label, description, saving, saved, onToggle }) {
  const key = `${trabajadorId}_${campo}`
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {saving[key]            && <Loader2     className="w-3 h-3 animate-spin text-slate-400" />}
        {saved[key] && !saving[key] && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
        <button
          type="button"
          onClick={() => onToggle(trabajadorId, campo, !value)}
          disabled={!!saving[key]}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${value ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <span style={{
            display: 'inline-block', height: '16px', width: '16px',
            borderRadius: '50%', backgroundColor: 'white',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
            transition: 'transform 0.2s',
            transform: value ? 'translateX(24px)' : 'translateX(4px)',
          }} />
        </button>
      </div>
    </div>
  )
}

function TabAccesos() {
  const { user } = useAuth()
  const [trabajadores, setTrabajadores] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [expanded,     setExpanded]     = useState(null)
  const [saving,       setSaving]       = useState({})
  const [saved,        setSaved]        = useState({})

  useEffect(() => {
    const empresaId = user?.empresa_id ?? user?.empresa?.id
    console.log('[Accesos] empresa_id del usuario:', empresaId, '| user:', user)

    let query = supabase
      .from('trabajadores')
      .select(`id, nombre, cargo, rol,
        app_activa, puede_visitas, puede_visitas_app,
        puede_cotizar, puede_oc, puede_rrhh, puede_finanzas,
        puede_proyectos, puede_planificacion, puede_asesoria,
        puede_remuneraciones, puede_facturas, puede_productos,
        puede_vacaciones,
        puede_gastos, puede_marcaciones`)
      .order('nombre')

    if (empresaId) {
      query = query.eq('empresa_id', empresaId)
    }

    query.then(({ data, error }) => {
      console.log('[Accesos] trabajadores raw:', data, error)
      if (!error) setTrabajadores(data ?? [])
      setLoading(false)
    })
  }, [user])

  const handleToggle = async (trabajadorId, campo, valor) => {
    const key = `${trabajadorId}_${campo}`
    setSaving(s => ({ ...s, [key]: true }))
    setTrabajadores(prev =>
      prev.map(t => t.id === trabajadorId ? { ...t, [campo]: valor } : t)
    )
    const { error } = await supabase
      .from('trabajadores')
      .update({ [campo]: valor })
      .eq('id', trabajadorId)
    setSaving(s => { const n = { ...s }; delete n[key]; return n })
    if (!error) {
      setSaved(s => ({ ...s, [key]: true }))
      setTimeout(() => setSaved(s => { const n = { ...s }; delete n[key]; return n }), 2000)
    }
  }

  const renderGrupos = (t) => (
    <div className="pt-4 mt-2 border-t border-slate-100 space-y-3">
      <div style={{ backgroundColor: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '8px', padding: '4px 12px' }}>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 mt-2">Apps Móviles</p>
        <WorkerToggle trabajadorId={t.id} campo="app_activa"        value={t.app_activa        ?? false} label="App Control Asistencia" description="Permite iniciar sesión en la app móvil de asistencia"    saving={saving} saved={saved} onToggle={handleToggle} />
        <WorkerToggle trabajadorId={t.id} campo="puede_visitas_app"  value={t.puede_visitas_app  ?? false} label="App Visitas"            description="Puede acceder a la app móvil de visitas técnicas"        saving={saving} saved={saved} onToggle={handleToggle} />
      </div>
      <div style={{ borderRadius: '8px', border: '1px solid #f1f5f9', padding: '4px 12px' }}>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 mt-2">Personas</p>
<WorkerToggle trabajadorId={t.id} campo="puede_rrhh"          value={t.puede_rrhh          ?? false} label="RRHH / Documentos"  description="Puede ver documentos y datos del área de RRHH"        saving={saving} saved={saved} onToggle={handleToggle} />
        <WorkerToggle trabajadorId={t.id} campo="puede_remuneraciones" value={t.puede_remuneraciones ?? false} label="Remuneraciones"  description="Puede ver y gestionar liquidaciones y remuneraciones"  saving={saving} saved={saved} onToggle={handleToggle} />
      </div>
      <div style={{ borderRadius: '8px', border: '1px solid #f1f5f9', padding: '4px 12px' }}>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 mt-2">Gestión</p>
        <WorkerToggle trabajadorId={t.id} campo="puede_proyectos"    value={t.puede_proyectos    ?? false} label="Proyectos"      description="Puede ver y gestionar proyectos de la empresa"        saving={saving} saved={saved} onToggle={handleToggle} />
        <WorkerToggle trabajadorId={t.id} campo="puede_planificacion" value={t.puede_planificacion ?? false} label="Planificación"  description="Puede ver y gestionar la planificación del equipo"    saving={saving} saved={saved} onToggle={handleToggle} />
        <WorkerToggle trabajadorId={t.id} campo="puede_visitas"      value={t.puede_visitas      ?? false} label="Visitas ERP"    description="Puede acceder al módulo de visitas en el ERP web"    saving={saving} saved={saved} onToggle={handleToggle} />
        <WorkerToggle trabajadorId={t.id} campo="puede_productos"    value={t.puede_productos    ?? false} label="Productos"      description="Puede ver y gestionar el catálogo de productos"      saving={saving} saved={saved} onToggle={handleToggle} />
      </div>
      <div style={{ borderRadius: '8px', border: '1px solid #f1f5f9', padding: '4px 12px' }}>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 mt-2">Comercial</p>
        <WorkerToggle trabajadorId={t.id} campo="puede_cotizar" value={t.puede_cotizar ?? false} label="Cotizaciones"       description="Puede crear y gestionar cotizaciones"          saving={saving} saved={saved} onToggle={handleToggle} />
        <WorkerToggle trabajadorId={t.id} campo="puede_oc"      value={t.puede_oc      ?? false} label="Órdenes de Compra"  description="Puede crear y gestionar órdenes de compra"     saving={saving} saved={saved} onToggle={handleToggle} />
      </div>
      <div style={{ borderRadius: '8px', border: '1px solid #f1f5f9', padding: '4px 12px' }}>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 mt-2">Finanzas</p>
        <WorkerToggle trabajadorId={t.id} campo="puede_finanzas" value={t.puede_finanzas ?? false} label="Finanzas"      description="Puede ver movimientos y gastos de la empresa"      saving={saving} saved={saved} onToggle={handleToggle} />
        <WorkerToggle trabajadorId={t.id} campo="puede_facturas" value={t.puede_facturas ?? false} label="Facturas SII"  description="Puede ver facturas de compra y venta del SII"     saving={saving} saved={saved} onToggle={handleToggle} />
      </div>
      <div style={{ borderRadius: '8px', border: '1px solid #f1f5f9', padding: '4px 12px' }}>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 mt-2">IA</p>
        <WorkerToggle trabajadorId={t.id} campo="puede_asesoria" value={t.puede_asesoria ?? false} label="Asesoría IA" description="Puede acceder al asistente de inteligencia artificial ARIA" saving={saving} saved={saved} onToggle={handleToggle} />
      </div>
    </div>
  )

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  )

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">Gestiona los permisos de acceso de cada trabajador. Los cambios se guardan automáticamente al activar o desactivar cada permiso.</p>
      {trabajadores.length === 0 && (
        <div className="card p-8 text-center text-sm text-slate-400">No hay trabajadores registrados.</div>
      )}
      {trabajadores.map(t => (
        <div key={t.id} className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm shrink-0">
                {(t.nombre ?? '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{t.nombre}</p>
                <p className="text-xs text-slate-400 truncate">{t.cargo}</p>
              </div>
              {t.rol && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">{t.rol}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setExpanded(expanded === t.id ? null : t.id)}
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1 shrink-0 ml-3"
            >
              {expanded === t.id ? 'Cerrar' : 'Gestionar accesos'}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded === t.id ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {expanded === t.id && renderGrupos(t)}
        </div>
      ))}
    </div>
  )
}

/* ── Página principal ────────────────────────────────────────────── */
export default function ConfiguracionPage() {
  const { user, updateUser } = useAuth()
  const [tab, setTab] = useState('perfil')

  const TABS = [
    { key: 'perfil',   label: 'Mi Perfil'           },
    { key: 'password', label: 'Contraseña'           },
    ...(user?.rol === 'admin' ? [
      { key: 'empresa',   label: 'Mi Empresa'          },
      { key: 'feriados',  label: 'Días no laborables'  },
      { key: 'accesos',   label: 'Gestión de Accesos'  },
      { key: 'usuarios',  label: 'Usuarios'             },
      { key: 'cuentas',   label: 'Cuentas Contables'   },
      { key: 'tipos-doc', label: 'Tipos de Documento'  },
    ] : []),
  ]

  return (
    <div className="space-y-5 w-full">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Configuración</h2>
        <p className="text-sm text-slate-500 mt-0.5">Administra tu perfil y los datos de tu empresa.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'perfil'    && <TabPerfil user={user} updateUser={updateUser} />}
      {tab === 'password'  && <TabContrasena />}
      {tab === 'empresa'   && <TabEmpresa />}
      {tab === 'feriados'  && <DiasNoLaborablesPage />}
      {tab === 'accesos'   && <TabAccesos />}
      {tab === 'usuarios'  && <UsuariosPage />}
      {tab === 'cuentas'   && <TabCuentasContables />}
      {tab === 'tipos-doc' && <TabTiposDocumento />}
    </div>
  )
}
