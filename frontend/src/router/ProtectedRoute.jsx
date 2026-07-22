import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../modules/auth/AuthContext'

function AccessDenied() {
  return (
    <div className="flex items-center justify-center h-full bg-slate-50">
      <div className="text-center p-8">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🔒</span>
        </div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Acceso restringido</h2>
        <p className="text-sm text-slate-500">No tienes permisos para acceder a esta sección.</p>
      </div>
    </div>
  )
}

function AuthLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        <p className="text-sm text-slate-400">Cargando sesión...</p>
      </div>
    </div>
  )
}

export default function ProtectedRoute({ children, roles, permission }) {
  const { user, authReady } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  // Espera a que /auth/me complete antes de renderizar.
  // Evita que el Sidebar muestre items incorrectos con datos del localStorage viejo.
  if (!authReady) return <AuthLoading />

  const isAdmin = user.rol === 'admin'

  // Verificación por rol (ej. solo admin)
  if (roles && !roles.includes(user.rol)) {
    return <AccessDenied />
  }

  // Verificación por permiso de módulo: admin siempre pasa, otros necesitan el permiso
  if (permission && !isAdmin && !user[permission]) {
    return <Navigate to="/dashboard" replace />
  }

  // Soporta uso como layout route (<Route element={<ProtectedRoute ... />}>) o como wrapper
  return children ?? <Outlet />
}
