import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, ShoppingCart, Users, FolderOpen,
  Wallet, Settings, LogOut, Zap, ChevronRight, X, ClipboardList, FolderKanban, Bot, Calculator, Package, CalendarDays, Building2,
} from 'lucide-react'
import { useAuth } from '../modules/auth/AuthContext'

const NAV = [
  {
    label: 'Principal',
    items: [
      { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/cotizaciones', icon: FileText,         label: 'Cotizaciones',      permission: 'puede_cotizar' },
      { to: '/compras',      icon: ShoppingCart,     label: 'Órdenes de Compra', permission: 'puede_oc' },
      { to: '/proveedores',  icon: Building2,        label: 'Proveedores',       permission: 'puede_oc' },
    ],
  },
  {
    label: 'Personas',
    items: [
      { to: '/trabajadores',   icon: Users,      label: 'Trabajadores',   permission: 'puede_rrhh' },
      { to: '/remuneraciones', icon: Calculator, label: 'Remuneraciones', permission: 'puede_remuneraciones' },
      { to: '/rrhh',           icon: FolderOpen, label: 'RRHH',           permission: 'puede_rrhh' },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { to: '/proyectos',     icon: FolderKanban, label: 'Proyectos',     permission: 'puede_proyectos' },
      { to: '/planificacion', icon: CalendarDays, label: 'Planificación', permission: 'puede_planificacion' },
      { to: '/visitas',       icon: ClipboardList, label: 'Visitas',      permission: 'puede_visitas' },
      { to: '/productos',     icon: Package,      label: 'Productos',     permission: 'puede_productos' },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { to: '/finanzas',  icon: Wallet,   label: 'Finanzas',    permission: 'puede_finanzas' },
      { to: '/facturas',  icon: FileText, label: 'Facturas SII', permission: 'puede_facturas' },
      { to: '/asesoria',  icon: Bot,      label: 'Asesoría IA', permission: 'puede_asesoria' },
    ],
  },
]

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleNavClick = () => {
    // Cierra el drawer al navegar en móvil
    onClose()
  }

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 flex flex-col
        sidebar-scroll overflow-y-auto
        transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-white font-bold text-sm leading-tight">MAMKAM ERP</div>
          <div className="text-slate-500 text-xs">v0.1 MVP</div>
        </div>
        {/* Botón cerrar solo en móvil */}
        <button
          onClick={onClose}
          className="lg:hidden text-slate-500 hover:text-slate-300 transition-colors p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-6">
        {NAV.map((section) => {
          const visibleItems = section.items.filter((item) => {
            if (user?.rol === 'admin') return true
            if (item.adminOnly) return false
            if (item.permission) return user?.[item.permission] === true
            return true
          })
          if (!visibleItems.length) return null
          return (
          <div key={section.label}>
            <p className="px-3 mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {visibleItems.map((item) => {
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={handleNavClick}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all group
                        ${isActive
                          ? 'bg-indigo-500/10 text-indigo-400'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-indigo-400' : ''}`} />
                          <span className="flex-1">{item.label}</span>
                          {isActive && <ChevronRight className="w-3 h-3 text-indigo-400 opacity-60" />}
                        </>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
          )
        })}
      </nav>

      {/* Bottom: user + logout */}
      <div className="border-t border-slate-800 p-3 space-y-0.5">
        {user?.rol === 'admin' && (
          <NavLink
            to="/configuracion"
            onClick={handleNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all
              ${isActive ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`
            }
          >
            <Settings className="w-4 h-4" />
            Configuración
          </NavLink>
        )}

        <div className="flex items-center gap-3 px-3 py-2 mt-1">
          <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{user?.initials || 'U'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-slate-300 truncate">{user?.nombre}</div>
            <div className="text-xs text-slate-600 capitalize">{user?.rol}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="text-slate-600 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
