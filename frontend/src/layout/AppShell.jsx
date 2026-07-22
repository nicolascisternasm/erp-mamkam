import { useState, useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Loader2, WifiOff, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../modules/auth/AuthContext'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { loading, syncError, clearSyncError } = useApp()
  const { user, fetchMe } = useAuth()
  const location = useLocation()
  const lastFetch = useRef(0)

  // Re-consulta permisos al navegar entre módulos (máx 1 vez cada 60s)
  useEffect(() => {
    if (!user?.token) return
    const now = Date.now()
    if (now - lastFetch.current < 60_000) return
    lastFetch.current = now
    fetchMe(user.token)
  }, [location.pathname])

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-50 gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center mb-1">
          <span className="text-white font-bold text-lg">M</span>
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <p className="text-sm text-slate-500">Cargando datos…</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Backdrop móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto pt-16">
          {/* Banner de error de sincronización */}
          {syncError && (
            <div className="mx-4 sm:mx-6 mt-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 flex-1">{syncError}</p>
              <button onClick={clearSyncError} className="text-amber-400 hover:text-amber-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="p-4 sm:p-6 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
