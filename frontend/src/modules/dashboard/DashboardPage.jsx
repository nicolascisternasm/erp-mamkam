import { useApp } from '../../context/AppContext'
import { useAuth } from '../auth/AuthContext'
import { formatCLP, formatDate } from '../../utils/formatters'
import Badge from '../../components/Badge'
import {
  FileText, ShoppingCart, Users, TrendingUp,
  ArrowUpRight, ArrowDownRight, CheckCircle, Clock,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function KpiCard({ label, value, sub, icon: Icon, color, trend }) {
  const colors = {
    indigo: 'bg-indigo-500/10 text-indigo-600',
    emerald: 'bg-emerald-500/10 text-emerald-600',
    amber: 'bg-amber-500/10 text-amber-600',
    violet: 'bg-violet-500/10 text-violet-600',
  }
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900 mb-0.5">{value}</div>
      <div className="text-sm font-medium text-slate-600">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const { cotizaciones, compras, trabajadores, movimientos } = useApp()
  const { user } = useAuth()
  const navigate = useNavigate()

  const cotAprobadas = cotizaciones.filter((c) => c.estado === 'aprobada').length
  const cotPendientes = cotizaciones.filter((c) => ['enviada', 'borrador'].includes(c.estado)).length
  const ocPendientes = compras.filter((c) => c.estado === 'creada').length
  const trabActivos = trabajadores.filter((t) => t.estado === 'activo').length
  const totalIngresos = movimientos.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const totalEgresos = movimientos.filter((m) => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0)
  const saldo = totalIngresos - totalEgresos

  const recentCot = [...cotizaciones].slice(0, 5)
  const recentOC = [...compras].slice(0, 4)

  return (
    <div className="space-y-6 w-full">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Buen día, {user?.nombre?.split(' ')[0]} 👋
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Cotizaciones" value={cotizaciones.length} sub={`${cotAprobadas} aprobadas · ${cotPendientes} pendientes`} icon={FileText} color="indigo" trend={12} />
        <KpiCard label="OC Pendientes" value={ocPendientes} sub={`de ${compras.length} órdenes totales`} icon={ShoppingCart} color="amber" />
        <KpiCard label="Trabajadores Activos" value={trabActivos} sub={`de ${trabajadores.length} registrados`} icon={Users} color="violet" />
        {user?.rol === 'admin' && (
          <KpiCard label="Saldo Estimado" value={formatCLP(saldo)} sub={`Ingresos: ${formatCLP(totalIngresos)}`} icon={TrendingUp} color="emerald" trend={8} />
        )}
      </div>

      {/* Progress bar cotizaciones */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">Estado de Cotizaciones</h3>
          <button onClick={() => navigate('/cotizaciones')} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Ver todas →</button>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Aprobadas', count: cotizaciones.filter(c => c.estado === 'aprobada').length, color: 'bg-emerald-500' },
            { label: 'Enviadas', count: cotizaciones.filter(c => c.estado === 'enviada').length, color: 'bg-blue-500' },
            { label: 'Borradores', count: cotizaciones.filter(c => c.estado === 'borrador').length, color: 'bg-slate-300' },
            { label: 'Rechazadas', count: cotizaciones.filter(c => c.estado === 'rechazada').length, color: 'bg-red-400' },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <span className="text-xs text-slate-500 w-20">{s.label}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${s.color} transition-all`}
                  style={{ width: `${cotizaciones.length ? (s.count / cotizaciones.length) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-700 w-4 text-right">{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent cotizaciones */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Cotizaciones Recientes</h3>
            <button onClick={() => navigate('/cotizaciones')} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Ver todas →</button>
          </div>
          <div className="divide-y divide-slate-50">
            {recentCot.map((c) => (
              <div
                key={c.id}
                onClick={() => navigate(`/cotizaciones/${c.id}`)}
                className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">{c.numero}</span>
                    <Badge status={c.estado} />
                  </div>
                  <div className="text-sm font-medium text-slate-700 truncate mt-0.5">{c.cliente}</div>
                </div>
                <div className="text-sm font-semibold text-slate-900">{formatCLP(c.total)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent OC */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Órdenes de Compra</h3>
            <button onClick={() => navigate('/compras')} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Ver todas →</button>
          </div>
          <div className="divide-y divide-slate-50">
            {recentOC.map((oc) => (
              <div key={oc.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">{oc.numero}</span>
                    <Badge status={oc.estado} />
                  </div>
                  <div className="text-sm font-medium text-slate-700 truncate mt-0.5">{oc.proveedor}</div>
                </div>
                <div className="text-sm font-semibold text-slate-900">{formatCLP(oc.monto)}</div>
              </div>
            ))}
            {recentOC.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-slate-400">Sin órdenes de compra</div>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Acciones Rápidas</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Nueva Cotización', icon: FileText, path: '/cotizaciones/nueva', color: 'text-indigo-600 bg-indigo-50' },
            { label: 'Nueva OC', icon: ShoppingCart, path: '/compras/nueva', color: 'text-amber-600 bg-amber-50' },
            { label: 'Nuevo Trabajador', icon: Users, path: '/trabajadores/nuevo', color: 'text-violet-600 bg-violet-50', adminOnly: true },
            { label: 'Ver Finanzas', icon: TrendingUp, path: '/finanzas', color: 'text-emerald-600 bg-emerald-50', adminOnly: true },
          ].map((action) => {
            if (action.adminOnly && user?.rol !== 'admin') return null
            return (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${action.color}`}>
                  <action.icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-slate-600 text-center">{action.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
