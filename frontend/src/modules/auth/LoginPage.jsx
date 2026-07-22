import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Zap } from 'lucide-react'
import { useAuth } from './AuthContext'

const Spinner = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
)

const LeftPanel = () => (
  <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-between p-12">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 bg-indigo-500 rounded-lg flex items-center justify-center">
        <Zap className="w-5 h-5 text-white" />
      </div>
      <span className="text-white font-bold text-xl tracking-tight">MAMKAM ERP</span>
    </div>
    <div>
      <h1 className="text-4xl font-bold text-white leading-tight">
        Gestiona tu empresa<br />
        <span className="text-indigo-400">de forma inteligente.</span>
      </h1>
      <p className="text-slate-400 mt-4 text-lg leading-relaxed">
        Cotizaciones, compras, recursos humanos y finanzas en una sola plataforma.
      </p>
      <div className="mt-10 grid grid-cols-2 gap-4">
        {[
          { label: 'Cotizaciones', value: 'Crea y gestiona' },
          { label: 'OC Integradas', value: 'Desde aprobadas' },
          { label: 'RRHH Digital',  value: 'Documentos'     },
          { label: 'Finanzas',      value: 'Conciliación'   },
        ].map(f => (
          <div key={f.label} className="bg-slate-800 rounded-xl p-4">
            <div className="text-slate-400 text-xs font-medium mb-1">{f.label}</div>
            <div className="text-white text-sm font-semibold">{f.value}</div>
          </div>
        ))}
      </div>
    </div>
    <div className="text-slate-600 text-sm">© {new Date().getFullYear()} MAMKAM · ERP Empresarial</div>
  </div>
)

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPwd,    setShowPwd]    = useState(false)
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) { setError('Email y contraseña requeridos'); return }
    setLoading(true); setError('')
    try {
      await login(email, password, rememberMe)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Credenciales inválidas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      <LeftPanel />

      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg">MAMKAM ERP</span>
          </div>

          <div className="card p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Iniciar sesión</h2>
              <p className="text-slate-500 text-sm mt-1">Ingresa a tu cuenta de empresa</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label-base">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  placeholder="tu@empresa.com"
                  className="input-base"
                  autoFocus
                  autoComplete="email"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label-base mb-0">Contraseña</label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    placeholder="••••••••"
                    className="input-base pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer">
                  Recordarme por 30 días
                </label>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-2.5 disabled:opacity-60"
              >
                {loading ? <><Spinner /> Ingresando...</> : 'Ingresar'}
              </button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-5">
              ¿Aún no tienes cuenta?{' '}
              <Link
                to="/registro"
                className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
              >
                Registrar mi empresa
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
