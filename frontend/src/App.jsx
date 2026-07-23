import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './modules/auth/AuthContext'
import { AppProvider } from './context/AppContext'
import ProtectedRoute from './router/ProtectedRoute'
import AppShell from './layout/AppShell'
import LoginPage from './modules/auth/LoginPage'
import RegistroPage from './modules/auth/RegistroPage'
import ForgotPasswordPage from './modules/auth/ForgotPasswordPage'
import DashboardPage from './modules/dashboard/DashboardPage'
import CotizacionesPage from './modules/cotizaciones/CotizacionesPage'
import CotizacionForm from './modules/cotizaciones/CotizacionForm'
import CotizacionDetalle from './modules/cotizaciones/CotizacionDetalle'
import ComprasPage from './modules/compras/ComprasPage'
import CompraForm from './modules/compras/CompraForm'
import CompraDetalle from './modules/compras/CompraDetalle'
import TrabajadoresPage from './modules/trabajadores/TrabajadoresPage'
import TrabajadorForm from './modules/trabajadores/TrabajadorForm'
import RRHHPage from './modules/rrhh/RRHHPage'
import PuntosTrabajoPage from './modules/puntos-trabajo/PuntosTrabajoPage'
import FinanzasPage from './modules/finanzas/FinanzasPage'
import AsesoriaPage from './modules/finanzas/AsesoriaPage'
import ProyectosPage from './modules/proyectos/ProyectosPage'
import ProyectoForm from './modules/proyectos/ProyectoForm'
import ProyectoDetalle from './modules/proyectos/ProyectoDetalle'
import PublicCotizacionPage from './modules/cotizaciones/PublicCotizacionPage'
import ConfiguracionPage from './modules/configuracion/ConfiguracionPage'
import FacturasPage from './modules/facturas/FacturasPage'
import RemuneracionesPage from './modules/remuneraciones/RemuneracionesPage'
import VisitasPage from './modules/visitas/VisitasPage'
import ProductosPage from './modules/productos/ProductosPage'
import PlanificacionPage from './modules/proyectos/PlanificacionPage'
import ProveedoresPage from './modules/proveedores/ProveedoresPage'
import CRMPage from './modules/crm/CRMPage'

export default function App() {
  return (
    <BrowserRouter basename="/erp.mamkam">
      <AuthProvider>
        <AppProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/registro" element={<RegistroPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/ver" element={<PublicCotizacionPage />} />

            <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />

              <Route element={<ProtectedRoute permission="puede_cotizar" />}>
                <Route path="/cotizaciones" element={<CotizacionesPage />} />
                <Route path="/cotizaciones/nueva" element={<CotizacionForm />} />
                <Route path="/cotizaciones/:id" element={<CotizacionDetalle />} />
                <Route path="/cotizaciones/:id/editar" element={<CotizacionForm />} />
              </Route>

              <Route element={<ProtectedRoute permission="puede_oc" />}>
                <Route path="/compras" element={<ComprasPage />} />
                <Route path="/compras/nueva" element={<CompraForm />} />
                <Route path="/compras/:id" element={<CompraDetalle />} />
                <Route path="/compras/:id/editar" element={<CompraForm />} />
                <Route path="/proveedores" element={<ProveedoresPage />} />
              </Route>

              <Route
                path="/remuneraciones"
                element={
                  <ProtectedRoute permission="puede_remuneraciones">
                    <RemuneracionesPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/trabajadores"
                element={
                  <ProtectedRoute permission="puede_rrhh">
                    <TrabajadoresPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/trabajadores/nuevo"
                element={
                  <ProtectedRoute permission="puede_rrhh">
                    <TrabajadorForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/trabajadores/:id/editar"
                element={
                  <ProtectedRoute permission="puede_rrhh">
                    <TrabajadorForm />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/rrhh"
                element={
                  <ProtectedRoute permission="puede_rrhh">
                    <RRHHPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/puntos-trabajo"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <PuntosTrabajoPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/visitas"
                element={
                  <ProtectedRoute permission="puede_visitas">
                    <VisitasPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/finanzas"
                element={
                  <ProtectedRoute permission="puede_finanzas">
                    <FinanzasPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/facturas"
                element={
                  <ProtectedRoute permission="puede_facturas">
                    <FacturasPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/asesoria"
                element={
                  <ProtectedRoute permission="puede_asesoria">
                    <AsesoriaPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/productos"
                element={
                  <ProtectedRoute permission="puede_productos">
                    <ProductosPage />
                  </ProtectedRoute>
                }
              />

              <Route element={<ProtectedRoute permission="puede_proyectos" />}>
                <Route path="/proyectos" element={<ProyectosPage />} />
                <Route path="/proyectos/nuevo" element={<ProyectoForm />} />
                <Route path="/proyectos/:id" element={<ProyectoDetalle />} />
                <Route path="/proyectos/:id/editar" element={<ProyectoForm />} />
              </Route>

              <Route
                path="/planificacion"
                element={
                  <ProtectedRoute permission="puede_planificacion">
                    <PlanificacionPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/crm"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <CRMPage />
                  </ProtectedRoute>
                }
              />

              <Route path="/usuarios" element={<Navigate to="/configuracion" replace />} />

              <Route
                path="/configuracion"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <ConfiguracionPage />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
