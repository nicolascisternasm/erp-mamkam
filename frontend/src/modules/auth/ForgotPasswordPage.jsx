import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import emailjs from '@emailjs/browser'
import { ArrowLeft, Mail, KeyRound, ShieldCheck, CheckCircle2, Zap, Eye, EyeOff } from 'lucide-react'
import { apiClient } from '../../services/apiClient'

const Spinner = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
)

const TIMER_SECONDS  = 600
const RESEND_SECONDS = 60

export default function ForgotPasswordPage() {
  const navigate = useNavigate()

  const [step,            setStep]            = useState('email')
  const [email,           setEmail]           = useState('')
  const [emailMasked,     setEmailMasked]     = useState('')
  const [codigo,          setCodigo]          = useState('')
  const [nuevaPassword,   setNuevaPassword]   = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwd,         setShowPwd]         = useState(false)
  const [error,           setError]           = useState('')
  const [loading,         setLoading]         = useState(false)

  const [timeLeft,        setTimeLeft]        = useState(TIMER_SECONDS)
  const [resendCooldown,  setResendCooldown]  = useState(0)

  const timerRef  = useRef(null)
  const resendRef = useRef(null)

  useEffect(() => () => {
    clearInterval(timerRef.current)
    clearInterval(resendRef.current)
  }, [])

  const startTimers = () => {
    setTimeLeft(TIMER_SECONDS)
    setResendCooldown(RESEND_SECONDS)
    clearInterval(timerRef.current)
    clearInterval(resendRef.current)
    timerRef.current  = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000)
    resendRef.current = setInterval(() => setResendCooldown(t => {
      if (t <= 1) { clearInterval(resendRef.current); return 0 }
      return t - 1
    }), 1000)
  }

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const sendCode = async (targetEmail) => {
    setLoading(true); setError('')
    try {
      const data = await apiClient.post('/auth/forgot-password', { email: targetEmail })
      // Si el email existe, el backend retorna el token para que el frontend lo envíe por EmailJS
      if (data.reset_token) {
        await emailjs.send(
          import.meta.env.VITE_EMAILJS_SERVICE_ID,
          import.meta.env.VITE_EMAILJS_RESET_TEMPLATE_ID,
          { to_email: targetEmail, reset_code: data.reset_token },
          import.meta.env.VITE_EMAILJS_PUBLIC_KEY
        )
      }
      setEmailMasked(data.email_masked)
      setStep('codigo')
      startTimers()
    } catch (err) {
      setError(err.message || 'Error al enviar el código')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    if (!email) { setError('Ingresa tu email'); return }
    await sendCode(email)
  }

  const handleResetSubmit = async (e) => {
    e.preventDefault()
    if (codigo.length !== 6)       { setError('El código tiene 6 dígitos'); return }
    if (nuevaPassword.length < 8)  { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (nuevaPassword !== confirmPassword) { setError('Las contraseñas no coinciden'); return }
    if (timeLeft === 0)            { setError('El código ha expirado. Solicita uno nuevo.'); return }
    setLoading(true); setError('')
    try {
      await apiClient.post('/auth/reset-password', {
        email,
        token:          codigo,
        nueva_password: nuevaPassword,
      })
      clearInterval(timerRef.current)
      clearInterval(resendRef.current)
      setStep('ok')
    } catch (err) {
      setError(err.message || 'Error al cambiar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">

        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-lg">MAMKAM ERP</span>
        </div>

        {/* ── Paso 1: Email ───────────────────────────────────────── */}
        {step === 'email' && (
          <div className="card p-8">
            <Link
              to="/login"
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-sm mb-6 -mt-1 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Volver al login
            </Link>
            <div className="mb-6">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center mb-4">
                <Mail className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Recuperar contraseña</h2>
              <p className="text-slate-500 text-sm mt-1">
                Te enviaremos un código de 6 dígitos a tu correo.
              </p>
            </div>
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="label-base">Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  placeholder="tu@empresa.com"
                  className="input-base"
                  autoFocus
                />
              </div>
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || !email}
                className="btn-primary w-full justify-center py-2.5 disabled:opacity-60"
              >
                {loading ? <><Spinner /> Enviando...</> : <><Mail className="w-4 h-4" /> Enviar código</>}
              </button>
            </form>
          </div>
        )}

        {/* ── Paso 2: Código + nueva contraseña ───────────────────── */}
        {step === 'codigo' && (
          <div className="card p-8">
            <button
              onClick={() => { setStep('email'); setError('') }}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-sm mb-6 -mt-1 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            <div className="mb-6">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center mb-4">
                <KeyRound className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Ingresa el código</h2>
              <p className="text-slate-500 text-sm mt-1">
                Enviamos un código a{' '}
                <span className="font-medium text-slate-700">{emailMasked}</span>.
              </p>
            </div>

            {/* Timer */}
            <div className={`flex items-center justify-between text-sm mb-4 ${timeLeft < 60 ? 'text-red-500' : 'text-slate-500'}`}>
              <span>Expira en</span>
              <span className="font-mono font-semibold">{formatTime(timeLeft)}</span>
            </div>

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="label-base">Código de verificación</label>
                <input
                  value={codigo}
                  onChange={e => { setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
                  placeholder="123456"
                  className="input-base text-center text-2xl font-mono tracking-widest"
                  maxLength={6}
                  autoFocus
                />
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="label-base mb-0">Nueva contraseña</label>
                </div>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={nuevaPassword}
                    onChange={e => { setNuevaPassword(e.target.value); setError('') }}
                    placeholder="Mínimo 8 caracteres"
                    className="input-base pr-10"
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

              <div>
                <label className="label-base">Confirmar contraseña</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                  placeholder="Repite la contraseña"
                  className="input-base"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || timeLeft === 0}
                className="btn-primary w-full justify-center py-2.5 disabled:opacity-60"
              >
                {loading
                  ? <><Spinner /> Guardando...</>
                  : <><ShieldCheck className="w-4 h-4" /> Cambiar contraseña</>
                }
              </button>
            </form>

            <div className="text-center mt-4">
              <button
                onClick={() => { setCodigo(''); sendCode(email) }}
                disabled={resendCooldown > 0 || loading}
                className="text-xs text-slate-400 hover:text-indigo-600 disabled:cursor-not-allowed transition-colors"
              >
                {resendCooldown > 0
                  ? `Reenviar en ${resendCooldown}s`
                  : 'Reenviar código'
                }
              </button>
            </div>
          </div>
        )}

        {/* ── Éxito ────────────────────────────────────────────────── */}
        {step === 'ok' && (
          <div className="card p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Contraseña actualizada</h2>
            <p className="text-slate-500 text-sm">
              Tu contraseña fue cambiada exitosamente. Ya puedes ingresar.
            </p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="mt-6 btn-primary w-full justify-center"
            >
              Ir al inicio de sesión
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
