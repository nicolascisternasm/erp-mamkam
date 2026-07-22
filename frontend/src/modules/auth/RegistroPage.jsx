import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Zap, Building2 } from 'lucide-react'
import { useAuth } from './AuthContext'

function formatRut(raw) {
  const clean = raw.replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length < 2) return clean
  const body = clean.slice(0, -1)
  const dv   = clean.slice(-1)
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`
}

function isValidRutFormat(rut) {
  return /^[0-9]{1,3}(\.[0-9]{3}){1,2}-[0-9kK]$/.test(rut)
}

const Spinner = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
)

const FieldError = ({ msg }) => msg
  ? <p className="text-red-500 text-xs mt-1">{msg}</p>
  : null

export default function RegistroPage() {
  const { registerEmpresa } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    rut_empresa: '',
    razon_social: '',
    nombre_fantasia: '',
    email_contacto: '',
    telefono_empresa: '',
    nombre: '',
    apellidos: '',
    rut_usuario: '',
    email: '',
    password: '',
    confirm_password: '',
  })
  const [showPwd,      setShowPwd]      = useState(false)
  const [errors,       setErrors]       = useState({})
  const [serverError,  setServerError]  = useState('')
  const [loading,      setLoading]      = useState(false)

  const set = (field) => (e) => {
    const value = (field === 'rut_empresa' || field === 'rut_usuario') ? formatRut(e.target.value) : e.target.value
    setForm(p => ({ ...p, [field]: value }))
    setErrors(p => ({ ...p, [field]: '' }))
    setServerError('')
  }

  const validate = () => {
    const errs = {}
    if (!form.rut_empresa)                                    errs.rut_empresa     = 'Requerido'
    else if (!isValidRutFormat(form.rut_empresa))             errs.rut_empresa     = 'Formato inválido (ej: 76.123.456-7)'
    if (!form.razon_social.trim())                            errs.razon_social    = 'Requerido'
    if (!form.email_contacto.trim())                          errs.email_contacto  = 'Requerido'
    else if (!/\S+@\S+\.\S+/.test(form.email_contacto))      errs.email_contacto  = 'Email inválido'
    if (!form.nombre.trim())                                  errs.nombre          = 'Requerido'
    if (!form.rut_usuario)                                    errs.rut_usuario     = 'Requerido'
    else if (!isValidRutFormat(form.rut_usuario))             errs.rut_usuario     = 'Formato inválido (ej: 12.345.678-9)'
    if (!form.email.trim())                                   errs.email           = 'Requerido'
    else if (!/\S+@\S+\.\S+/.test(form.email))               errs.email           = 'Email inválido'
    if (!form.password)                                       errs.password        = 'Requerido'
    else if (form.password.length < 8)                        errs.password        = 'Mínimo 8 caracteres'
    if (form.password !== form.confirm_password)              errs.confirm_password = 'Las contraseñas no coinciden'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setLoading(true); setServerError('')
    try {
      await registerEmpresa({
        rut_empresa:      form.rut_empresa,
        razon_social:     form.razon_social.trim(),
        nombre_fantasia:  form.nombre_fantasia.trim() || undefined,
        email_contacto:   form.email_contacto.trim(),
        telefono_empresa: form.telefono_empresa.trim() || undefined,
        nombre:           form.nombre.trim(),
        apellidos:        form.apellidos.trim() || undefined,
        rut_usuario:      form.rut_usuario,
        email:            form.email.trim(),
        password:         form.password,
      })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setServerError(err.message || 'Error al registrar. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = (field) =>
    `input-base ${errors[field] ? 'border-red-400 focus:ring-red-300' : ''}`

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 bg-slate-900 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-500 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">MAMKAM ERP</span>
        </div>
        <div>
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center mb-6">
            <Building2 className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight">
            Registra tu empresa<br />
            <span className="text-indigo-400">y comienza hoy.</span>
          </h1>
          <p className="text-slate-400 mt-4 text-lg leading-relaxed">
            Configura tu empresa en minutos y accede a todas las herramientas del ERP.
          </p>
        </div>
        <div className="text-slate-600 text-sm">© {new Date().getFullYear()} MAMKAM · ERP Empresarial</div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 overflow-y-auto">
        <div className="w-full max-w-lg py-8">
          <div className="flex items-center gap-2 mb-6 lg:hidden">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg">MAMKAM ERP</span>
          </div>

          <div className="card p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Registrar empresa</h2>
              <p className="text-slate-500 text-sm mt-1">Crea tu cuenta y empieza a gestionar tu empresa</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">

              {/* ── Datos empresa ────────────────────────────────── */}
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 pt-1">
                Datos de la Empresa
              </h3>

              <div>
                <label className="label-base">RUT empresa *</label>
                <input
                  value={form.rut_empresa}
                  onChange={set('rut_empresa')}
                  placeholder="76.123.456-7"
                  className={inputCls('rut_empresa')}
                  maxLength={12}
                  autoFocus
                />
                <FieldError msg={errors.rut_empresa} />
              </div>

              <div>
                <label className="label-base">Razón social *</label>
                <input
                  value={form.razon_social}
                  onChange={set('razon_social')}
                  placeholder="Mi Empresa SpA"
                  className={inputCls('razon_social')}
                />
                <FieldError msg={errors.razon_social} />
              </div>

              <div>
                <label className="label-base">
                  Nombre de fantasía <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  value={form.nombre_fantasia}
                  onChange={set('nombre_fantasia')}
                  placeholder="Mi Empresa"
                  className="input-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">Email de contacto *</label>
                  <input
                    type="email"
                    value={form.email_contacto}
                    onChange={set('email_contacto')}
                    placeholder="contacto@empresa.com"
                    className={inputCls('email_contacto')}
                  />
                  <FieldError msg={errors.email_contacto} />
                </div>
                <div>
                  <label className="label-base">
                    Teléfono <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    value={form.telefono_empresa}
                    onChange={set('telefono_empresa')}
                    placeholder="+56 9 1234 5678"
                    className="input-base"
                  />
                </div>
              </div>

              {/* ── Datos administrador ──────────────────────────── */}
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 pt-3 border-t border-slate-200">
                Datos del Administrador
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">Nombre *</label>
                  <input
                    value={form.nombre}
                    onChange={set('nombre')}
                    placeholder="Juan"
                    className={inputCls('nombre')}
                  />
                  <FieldError msg={errors.nombre} />
                </div>
                <div>
                  <label className="label-base">
                    Apellidos <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    value={form.apellidos}
                    onChange={set('apellidos')}
                    placeholder="Pérez"
                    className="input-base"
                  />
                </div>
              </div>

              <div>
                <label className="label-base">RUT del administrador *</label>
                <input
                  value={form.rut_usuario}
                  onChange={set('rut_usuario')}
                  placeholder="12.345.678-9"
                  className={inputCls('rut_usuario')}
                  maxLength={12}
                />
                <FieldError msg={errors.rut_usuario} />
              </div>

              <div>
                <label className="label-base">Email del administrador *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="admin@empresa.com"
                  className={inputCls('email')}
                />
                <FieldError msg={errors.email} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">Contraseña *</label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={form.password}
                      onChange={set('password')}
                      placeholder="Mínimo 8 caracteres"
                      className={`${inputCls('password')} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <FieldError msg={errors.password} />
                </div>
                <div>
                  <label className="label-base">Confirmar *</label>
                  <input
                    type="password"
                    value={form.confirm_password}
                    onChange={set('confirm_password')}
                    placeholder="Repite la contraseña"
                    className={inputCls('confirm_password')}
                  />
                  <FieldError msg={errors.confirm_password} />
                </div>
              </div>

              {serverError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                  {serverError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-2.5 disabled:opacity-60 mt-2"
              >
                {loading ? <><Spinner /> Registrando...</> : 'Crear empresa y acceder'}
              </button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-5">
              ¿Ya tienes cuenta?{' '}
              <Link
                to="/login"
                className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
              >
                Iniciar sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
