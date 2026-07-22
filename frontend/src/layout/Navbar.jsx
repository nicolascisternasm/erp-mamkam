import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, Menu, Building2, ChevronDown, Check } from 'lucide-react'
import { useAuth } from '../modules/auth/AuthContext'
import { SupabaseAPI } from '../services/supabase'

const PAGE_TITLES = {
  '/dashboard':    'Dashboard',
  '/cotizaciones': 'Cotizaciones',
  '/compras':      'Órdenes de Compra',
  '/trabajadores': 'Trabajadores',
  '/rrhh':         'Recursos Humanos',
  '/finanzas':     'Finanzas',
  '/configuracion': 'Configuración',
}

export default function Navbar({ onMenuClick }) {
  const { pathname } = useLocation()
  const { user, selectEmpresa } = useAuth()

  const [showSwitch,     setShowSwitch]     = useState(false)
  const [empresas,       setEmpresas]       = useState([])
  const [loadingSwitch,  setLoadingSwitch]  = useState(false)
  const dropdownRef = useRef(null)

  const canSwitch = user?.rol === 'admin' && Array.isArray(user?.empresa_ids) && user.empresa_ids.length > 1

  const title = Object.entries(PAGE_TITLES).find(([path]) =>
    pathname.startsWith(path)
  )?.[1] || 'ERP MAMKAM'

  /* Cierra el dropdown al hacer clic afuera */
  useEffect(() => {
    if (!showSwitch) return
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowSwitch(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSwitch])

  const handleOpenSwitch = async () => {
    if (!showSwitch && empresas.length === 0) {
      setLoadingSwitch(true)
      try {
        const list = await SupabaseAPI.getEmpresas(user.empresa_ids)
        setEmpresas(list)
      } finally {
        setLoadingSwitch(false)
      }
    }
    setShowSwitch((v) => !v)
  }

  const handleSelectEmpresa = (empresa) => {
    selectEmpresa(user, empresa)
    setShowSwitch(false)
  }

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-64 z-10 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold text-slate-900">{title}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button className="relative p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full border-2 border-white" />
        </button>

        <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-200">
          {/* Botón cambiar empresa */}
          {canSwitch && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={handleOpenSwitch}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                title="Cambiar empresa"
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                <span className="hidden sm:inline max-w-[100px] truncate">{user?.empresa?.nombre}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showSwitch ? 'rotate-180' : ''}`} />
              </button>

              {showSwitch && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden z-50">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-xs text-slate-400 font-medium">Cambiar empresa</p>
                  </div>
                  {loadingSwitch ? (
                    <div className="px-3 py-3 text-xs text-slate-400">Cargando...</div>
                  ) : (
                    <div className="py-1">
                      {empresas.map((emp) => (
                        <button
                          key={emp.id}
                          onClick={() => handleSelectEmpresa(emp)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-slate-50 transition-colors text-left"
                        >
                          <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-800 truncate">{emp.nombre}</div>
                            <div className="text-xs text-slate-400">{emp.rut}</div>
                          </div>
                          {emp.id === user?.empresa?.id && (
                            <Check className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Avatar + nombre */}
          <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{user?.initials || 'U'}</span>
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-medium text-slate-700">{user?.nombre}</div>
            <div className="text-xs text-slate-400">{user?.empresa?.nombre ?? user?.rol}</div>
          </div>
        </div>
      </div>
    </header>
  )
}
