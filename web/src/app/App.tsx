import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { RegistroPage } from '../features/auth/RegistroPage';
import { OlvidePasswordPage } from '../features/auth/OlvidePasswordPage';
import { RestablecerPasswordPage } from '../features/auth/RestablecerPasswordPage';
import { VerificarEmailPage } from '../features/auth/VerificarEmailPage';
import { ExamenLoginPage } from '../features/examen/ExamenLoginPage';
import { RendirExamenPage } from '../features/examen/RendirExamenPage';
import { MisMateriasPage } from '../features/mi-espacio/MisMateriasPage';
import { MateriaDetallePage } from '../features/mi-espacio/MateriaDetallePage';
import { EvaluacionesMateriaPage } from '../features/mi-espacio/EvaluacionesMateriaPage';
import { PasarListaPage } from '../features/mi-espacio/PasarListaPage';
import { ConsolidadoAsistenciaPage } from '../features/mi-espacio/ConsolidadoAsistenciaPage';
import { EvaluacionesClasePage } from '../features/mi-espacio/EvaluacionesClasePage';
import { EvaluacionEditorPage } from '../features/mi-espacio/EvaluacionEditorPage';
import { MonitoreoPage } from '../features/mi-espacio/MonitoreoPage';
import { ResultadosPage } from '../features/mi-espacio/ResultadosPage';
import { CentralizadorPage } from '../features/mi-espacio/CentralizadorPage';
import { MiSuscripcionPage } from '../features/suscripcion/MiSuscripcionPage';
import { PlanesPage } from '../features/suscripcion/PlanesPage';
import { SolicitudesAdminPage } from '../features/admin/SolicitudesAdminPage';
import { PlanesAdminPage } from '../features/admin/PlanesAdminPage';
import { PanelPage } from '../features/admin/PanelPage';
import { Layout } from './Layout';
import { ProtegerRuta } from './ProtegerRuta';
import { RaizPublica } from './RaizPublica';
import { useAuth } from '../core/auth/AuthContext';

function Inicio() {
  const { sesion } = useAuth();
  if (sesion?.contexto === 'admin') return <Navigate to="/admin/solicitudes" replace />;
  return <MisMateriasPage />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegistroPage />} />
        <Route path="/password/olvide" element={<OlvidePasswordPage />} />
        <Route path="/restablecer-password" element={<RestablecerPasswordPage />} />
        <Route path="/verificar-email" element={<VerificarEmailPage />} />

        {/* "Rendir examen" — estudiantes sin app móvil (p. ej. solo iPhone).
            Fuera de <Layout />: sin sidebar/topbar de docente. */}
        <Route path="/examen/login" element={<ExamenLoginPage />} />
        <Route
          path="/examen"
          element={
            <ProtegerRuta contexto="estudiante" redirigirA="/examen/login">
              <RendirExamenPage />
            </ProtegerRuta>
          }
        />

        <Route
          path="/"
          element={
            <RaizPublica>
              <Layout />
            </RaizPublica>
          }
        >
          <Route index element={<Inicio />} />

          {/* Todo lo de abajo es exclusivo de docente — sin este guard, un
              admin logueado podía entrar tecleando estas URLs (el backend
              rechaza las llamadas a la API, pero la pantalla igual se
              mostraba). Mismo patrón que ProtegerRuta contexto="estudiante"
              en /examen. */}
          <Route
            element={
              <ProtegerRuta contexto="docente">
                <Outlet />
              </ProtegerRuta>
            }
          >
            {/* Docente: suscripción SaaS por cuenta (17/07) */}
            <Route path="suscripcion" element={<MiSuscripcionPage />} />
            <Route path="suscripcion/planes" element={<PlanesPage />} />

            {/* Docente (E3) */}
            <Route path="materias/:id" element={<MateriaDetallePage />} />
            <Route path="materias/:id/evaluaciones" element={<EvaluacionesMateriaPage />} />

            {/* Docente (E5) */}
            <Route
              path="materias/:id/clases/:claseId/asistencia"
              element={<PasarListaPage />}
            />
            <Route path="materias/:id/asistencia" element={<ConsolidadoAsistenciaPage />} />

            {/* Docente (E6) */}
            <Route
              path="materias/:id/clases/:claseId/evaluaciones"
              element={<EvaluacionesClasePage />}
            />
            <Route path="materias/:id/evaluaciones/:evalId" element={<EvaluacionEditorPage />} />

            {/* Docente (E7) */}
            <Route
              path="materias/:id/evaluaciones/:evalId/monitoreo"
              element={<MonitoreoPage />}
            />

            {/* Docente (E8) */}
            <Route
              path="materias/:id/evaluaciones/:evalId/resultados"
              element={<ResultadosPage />}
            />
            <Route path="materias/:id/centralizador" element={<CentralizadorPage />} />
          </Route>

          {/* Admin (E2) */}
          <Route
            path="admin/solicitudes"
            element={
              <ProtegerRuta contexto="admin">
                <SolicitudesAdminPage />
              </ProtegerRuta>
            }
          />
          <Route
            path="admin/planes"
            element={
              <ProtegerRuta contexto="admin">
                <PlanesAdminPage />
              </ProtegerRuta>
            }
          />
          <Route
            path="admin/panel"
            element={
              <ProtegerRuta contexto="admin">
                <PanelPage />
              </ProtegerRuta>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
