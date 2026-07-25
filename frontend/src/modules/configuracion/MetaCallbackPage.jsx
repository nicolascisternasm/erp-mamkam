import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiClient } from '../../services/apiClient'
import { RefreshCw } from 'lucide-react'

/* Página a la que Meta redirige tras el consentimiento OAuth.
 * Toma el `code` de la URL, lo canjea en el backend y vuelve a Integraciones. */
export default function MetaCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return          // evita doble ejecución (StrictMode)
    ranRef.current = true

    const code  = searchParams.get('code')
    const error = searchParams.get('error')

    if (error || !code) {
      navigate('/configuracion/integraciones?status=error', { replace: true })
      return
    }

    apiClient.get(`/integraciones/meta/callback?code=${encodeURIComponent(code)}`)
      .then(() => navigate('/configuracion/integraciones?status=success', { replace: true }))
      .catch(() => navigate('/configuracion/integraciones?status=error', { replace: true }))
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      <p className="text-sm font-medium text-slate-600">Conectando con Meta...</p>
      <p className="text-xs text-slate-400">No cierres esta ventana.</p>
    </div>
  )
}
