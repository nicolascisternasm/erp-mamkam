import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../auth/AuthContext'
import { apiClient } from '../../services/apiClient'
import Modal, { ConfirmModal } from '../../components/Modal'
import {
  Plus, RefreshCw, Search, UserCog, Pencil, KeyRound,
  ToggleLeft, ToggleRight, Trash2, Copy, CheckCircle2,
  Eye, EyeOff, Shield, Users,
} from 'lucide-react'

/* ── Constantes ──────────────────────────────────────────────────── */

const ROLES = [
  { id: 'admin',     label: 'Administrador' },
  { id: 'vendedor',  label: 'Vendedor'      },
  { id: 'gerente',   label: 'Gerente'       },
  { id: 'contador',  label: 'Contador'      },
  { id: 'rrhh',      label: 'RRHH'          },
  { id: 'compras',   label: 'Compras'       },
  { id: 'tesoreria', label: 'Tesorería'     },
]

const rolLabel = (rol) => ROLES.find(r => r.id === rol)?.label ?? rol

function formatRut(raw) {
  if (!raw) return '—'
  const clean = raw.replace(/[.\-]/g, '')
  if (clean.length < 2) return raw
  const body = clean.slice(0, -1)
  const dv   = clean.slice(-1)
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`
}

function formatRutInput(raw) {
  const clean = raw.replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length < 2) return clean
  const body = clean.slice(0, -1)
  const dv   = clean.slice(-1)
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`
}

function formatUltimoAcceso(ts) {
  if (!ts) return 'Nunca'
  const d = new Date(ts)
  return d.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
}

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

/* ── Badge activo/inactivo ───────────────────────────────────────── */
function EstadoBadge({ activo }) {
  return activo ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-emerald-100 text-emerald-700 border-emerald-200">
      <CheckCircle2 className="w-3 h-3" /> Activo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-slate-100 text-slate-500 border-slate-200">
      <UserCog className="w-3 h-3" /> Inactivo
    </span>
  )
}

/* ── Modal crear / editar usuario ────────────────────────────────── */
function UsuarioModal({ open, onClose, usuario, onGuardado }) {
  const esEdicion = Boolean(usuario)

  const initForm = useCallback(() => ({
    nombre:    usuario?.nombre    ?? '',
    apellidos: usuario?.apellidos ?? '',
    email:     usuario?.email     ?? '',
    rut:       usuario?.rut       ? formatRut(usuario.rut) : '',
    telefono:  usuario?.telefono  ?? '',
    rol:       usuario?.rol       ?? 'vendedor',
    password:  '',
  }), [usuario])

  const [form,    setForm]    = useState(initForm)
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => { if (open) { setForm(initForm()); setError(''); setShowPwd(false) } }, [open, initForm])

  const set = (k) => (e) => { setForm(p => ({ ...p, [k]: e.target.value })); setError('') }
  const setVal = (k, v) => { setForm(p => ({ ...p, [k]: v })); setError('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    if (!form.email.trim())  { setError('El email es requerido'); return }
    if (!esEdicion && form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }

    setLoading(true); setError('')
    try {
      const payload = {
        nombre:    form.nombre.trim(),
        apellidos: form.apellidos.trim() || undefined,
        email:     form.email.trim(),
        rut:       form.rut.trim()      || undefined,
        telefono:  form.telefono.trim() || undefined,
        rol:       form.rol,
      }
      if (!esEdicion) payload.password = form.password

      await onGuardado(payload)
      onClose()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={esEdicion ? 'Editar usuario' : 'Nuevo usuario'} size="sm">
      <form onSubmit={handleSubmit} className="space-y-3">

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-base">Nombre *</label>
            <input value={form.nombre} onChange={set('nombre')} placeholder="Juan" className="input-base" autoFocus />
          </div>
          <div>
            <label className="label-base">Apellidos</label>
            <input value={form.apellidos} onChange={set('apellidos')} placeholder="Pérez" className="input-base" />
          </div>
        </div>

        <div>
          <label className="label-base">Email *</label>
          <input type="email" value={form.email} onChange={set('email')} placeholder="usuario@empresa.com" className="input-base" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-base">RUT</label>
            <input
              value={form.rut}
              onChange={e => setVal('rut', formatRutInput(e.target.value))}
              placeholder="12.345.678-9"
              className="input-base"
              maxLength={12}
            />
          </div>
          <div>
            <label className="label-base">Teléfono</label>
            <input value={form.telefono} onChange={set('telefono')} placeholder="+56 9 1234 5678" className="input-base" />
          </div>
        </div>

        <div>
          <label className="label-base">Rol *</label>
          <select value={form.rol} onChange={set('rol')} className="input-base">
            {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>

        {!esEdicion && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label-base mb-0">Contraseña temporal *</label>
              <button
                type="button"
                onClick={() => setVal('password', randomPassword())}
                className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Generar automáticamente
              </button>
            </div>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                placeholder="Mínimo 8 caracteres"
                className="input-base pr-8"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary disabled:opacity-60">
            {loading ? (esEdicion ? 'Guardando...' : 'Creando...') : (esEdicion ? 'Guardar cambios' : 'Crear usuario')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ── Modal contraseña reseteada ──────────────────────────────────── */
function TempPasswordModal({ open, onClose, usuario, tempPassword }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => { if (!open) setCopied(false) }, [open])

  const handleCopy = () => {
    navigator.clipboard.writeText(tempPassword).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Contraseña reseteada" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          La contraseña de <strong>{usuario?.nombre}</strong> fue reseteada. Cópiala y compártela con el usuario.
        </p>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
          <p className="text-xs text-slate-400 mb-1.5">Contraseña temporal</p>
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold text-slate-800 tracking-widest flex-1">
              {tempPassword}
            </span>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                copied
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          Esta contraseña solo se muestra una vez. No podrás verla de nuevo.
        </p>
        <div className="flex justify-end">
          <button onClick={onClose} className="btn-primary">Entendido</button>
        </div>
      </div>
    </Modal>
  )
}

/* ── Página principal ────────────────────────────────────────────── */
export default function UsuariosPage() {
  const { user: currentUser } = useAuth()

  const [usuarios,    setUsuarios]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [buscar,      setBuscar]      = useState('')
  const [filtroRol,   setFiltroRol]   = useState('')
  const [filtroActivo, setFiltroActivo] = useState('')
  const [actionLoad,  setActionLoad]  = useState(null)

  // Modales
  const [modalCrear,     setModalCrear]     = useState(false)
  const [modalEditar,    setModalEditar]    = useState(null)
  const [modalReset,     setModalReset]     = useState(null)  // { usuario, tempPassword }
  const [confirmToggle,  setConfirmToggle]  = useState(null)  // usuario
  const [confirmDelete,  setConfirmDelete]  = useState(null)  // usuario

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (buscar)      params.set('buscar', buscar)
      if (filtroRol)   params.set('rol', filtroRol)
      if (filtroActivo !== '') params.set('activo', filtroActivo)
      const data = await apiClient.get(`/usuarios?${params}`)
      setUsuarios(data)
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [buscar, filtroRol, filtroActivo])

  useEffect(() => { cargar() }, [cargar])

  /* ── Crear ── */
  const handleCrear = async (payload) => {
    await apiClient.post('/usuarios', payload)
    await cargar()
  }

  /* ── Editar ── */
  const handleEditar = async (payload) => {
    await apiClient.patch(`/usuarios/${modalEditar.id}`, payload)
    await cargar()
  }

  /* ── Reset contraseña ── */
  const handleResetPassword = async (usuario) => {
    setActionLoad(usuario.id)
    try {
      const { tempPassword } = await apiClient.post(`/usuarios/${usuario.id}/reset-password`)
      setModalReset({ usuario, tempPassword })
    } catch (err) {
      alert(err.message || 'Error al resetear contraseña')
    } finally {
      setActionLoad(null)
    }
  }

  /* ── Toggle activo ── */
  const handleToggleActivo = async (usuario) => {
    setActionLoad(usuario.id)
    try {
      await apiClient.patch(`/usuarios/${usuario.id}/toggle-activo`)
      await cargar()
    } catch (err) {
      alert(err.message || 'Error al cambiar estado')
    } finally {
      setActionLoad(null)
    }
  }

  /* ── Eliminar ── */
  const handleDelete = async (usuario) => {
    setActionLoad(usuario.id)
    try {
      await apiClient.delete(`/usuarios/${usuario.id}`)
      await cargar()
    } catch (err) {
      alert(err.message || 'Error al eliminar usuario')
    } finally {
      setActionLoad(null)
    }
  }

  const activeCount   = usuarios.filter(u => u.activo).length
  const inactiveCount = usuarios.filter(u => !u.activo).length

  return (
    <div className="space-y-5 w-full">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Usuarios</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeCount} activo{activeCount !== 1 ? 's' : ''} · {inactiveCount} inactivo{inactiveCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} className="btn-secondary" title="Actualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setModalCrear(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo usuario</span>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="input-base pl-9 py-2"
          />
        </div>
        <select
          value={filtroRol}
          onChange={e => setFiltroRol(e.target.value)}
          className="input-base py-2 w-auto"
        >
          <option value="">Todos los roles</option>
          {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <select
          value={filtroActivo}
          onChange={e => setFiltroActivo(e.target.value)}
          className="input-base py-2 w-auto"
        >
          <option value="">Todos los estados</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-5 h-5 animate-spin text-slate-300" />
          </div>
        ) : usuarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <Users className="w-8 h-8 text-slate-200" />
            <p className="text-sm text-slate-400">No se encontraron usuarios</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="table-th">Usuario</th>
                  <th className="table-th">Rol</th>
                  <th className="table-th hidden md:table-cell">Último acceso</th>
                  <th className="table-th">Estado</th>
                  <th className="table-th text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {usuarios.map(u => {
                  const esMismo = u.id === currentUser?.id
                  const isLoading = actionLoad === u.id

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="table-td">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            {u.rol === 'admin'
                              ? <Shield className="w-4 h-4 text-indigo-600" />
                              : <span className="text-indigo-600 text-xs font-bold">
                                  {(u.nombre || '?').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                                </span>
                            }
                          </div>
                          <div>
                            <div className="font-medium text-slate-800 flex items-center gap-1.5">
                              {u.nombre} {u.apellidos || ''}
                              {esMismo && (
                                <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-medium">Tú</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">{u.email}</div>
                            {u.rut && <div className="text-xs text-slate-300 font-mono">{formatRut(u.rut)}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="table-td">
                        <span className="text-sm text-slate-600">{rolLabel(u.rol)}</span>
                      </td>
                      <td className="table-td hidden md:table-cell text-sm text-slate-400">
                        {formatUltimoAcceso(u.ultimo_acceso)}
                      </td>
                      <td className="table-td">
                        <EstadoBadge activo={u.activo} />
                      </td>
                      <td className="table-td text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Editar */}
                          <button
                            onClick={() => setModalEditar(u)}
                            disabled={isLoading}
                            title="Editar"
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-40"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset contraseña */}
                          <button
                            onClick={() => handleResetPassword(u)}
                            disabled={isLoading}
                            title="Resetear contraseña"
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors disabled:opacity-40"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle activo */}
                          {!esMismo && (
                            <button
                              onClick={() => setConfirmToggle(u)}
                              disabled={isLoading}
                              title={u.activo ? 'Desactivar' : 'Activar'}
                              className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                                u.activo
                                  ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                                  : 'text-emerald-500 hover:bg-emerald-50 hover:text-emerald-700'
                              }`}
                            >
                              {u.activo
                                ? <ToggleRight className="w-3.5 h-3.5" />
                                : <ToggleLeft  className="w-3.5 h-3.5" />
                              }
                            </button>
                          )}

                          {/* Eliminar */}
                          {!esMismo && (
                            <button
                              onClick={() => setConfirmDelete(u)}
                              disabled={isLoading}
                              title="Eliminar"
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isLoading && (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-300 ml-1" />
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
      </div>

      {/* ── Modales ── */}
      <UsuarioModal
        open={modalCrear}
        onClose={() => setModalCrear(false)}
        onGuardado={handleCrear}
      />

      <UsuarioModal
        open={Boolean(modalEditar)}
        onClose={() => setModalEditar(null)}
        usuario={modalEditar}
        onGuardado={handleEditar}
      />

      <TempPasswordModal
        open={Boolean(modalReset)}
        onClose={() => setModalReset(null)}
        usuario={modalReset?.usuario}
        tempPassword={modalReset?.tempPassword ?? ''}
      />

      <ConfirmModal
        open={Boolean(confirmToggle)}
        onClose={() => setConfirmToggle(null)}
        title={confirmToggle?.activo ? 'Desactivar usuario' : 'Activar usuario'}
        message={
          confirmToggle?.activo
            ? `¿Desactivar a ${confirmToggle?.nombre}? No podrá iniciar sesión hasta que se reactive.`
            : `¿Activar a ${confirmToggle?.nombre}? Podrá iniciar sesión nuevamente.`
        }
        danger={confirmToggle?.activo}
        onConfirm={() => handleToggleActivo(confirmToggle)}
      />

      <ConfirmModal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Eliminar usuario"
        message={`¿Eliminar a ${confirmDelete?.nombre}? Esta acción no se puede deshacer.`}
        danger
        warningNote="Solo se puede eliminar si el usuario no tiene cotizaciones asociadas."
        onConfirm={() => handleDelete(confirmDelete)}
      />
    </div>
  )
}
