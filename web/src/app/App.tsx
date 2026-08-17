import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { RegistroPage } from '../features/auth/RegistroPage';
import { OlvidePasswordPage } from '../features/auth/OlvidePasswordPage';
import { RestablecerPasswordPage } from '../features/auth/RestablecerPasswordPage';
import { VerificarEmailPage } from '../features/auth/VerificarEmailPage';
import { InicioPage } from '../features/mi-espacio/InicioPage';
import { MateriaDetallePage } from '../features/mi-espacio/MateriaDetallePage';
import { MateriaInscritaDetallePage } from '../features/mi-espacio/MateriaInscritaDetallePage';
import { EvaluacionesMateriaPage } from '../features/mi-espacio/EvaluacionesMateriaPage';
import { PasarListaPage } from '../features/mi-espacio/PasarListaPage';
import { ConsolidadoAsistenciaPage } from '../features/mi-espacio/ConsolidadoAsistenciaPage';
import { EvaluacionesClasePage } from '../features/mi-espacio/EvaluacionesClasePage';
import { GuiasClasePage } from '../features/mi-espacio/GuiasClasePage';
import { TomarGuiaPage } from '../features/mi-espacio/TomarGuiaPage';
import { GuiaMonitoreoPage } from '../features/mi-espacio/GuiaMonitoreoPage';
import { GuiaResultadosPage } from '../features/mi-espacio/GuiaResultadosPage';
import { RevisarGuiaPage } from '../features/mi-espacio/RevisarGuiaPage';
import { EvaluacionEditorPage } from '../features/mi-espacio/EvaluacionEditorPage';
import { MonitoreoPage } from '../features/mi-espacio/MonitoreoPage';
import { ResultadosPage } from '../features/mi-espacio/ResultadosPage';
import { CentralizadorPage } from '../features/mi-espacio/CentralizadorPage';
import { MiSuscripcionPage } from '../features/suscripcion/MiSuscripcionPage';
import { PlanesPage } from '../features/suscripcion/PlanesPage';
import { SolicitudesAdminPage } from '../features/admin/SolicitudesAdminPage';
import { PlanesAdminPage } from '../features/admin/PlanesAdminPage';
import { PromocionesAdminPage } from '../features/admin/PromocionesAdminPage';
import { PanelPage } from '../features/admin/PanelPage';
import { Layout } from './Layout';
import { ProtegerRuta } from './ProtegerRuta';
import { RaizPublica } from './RaizPublica';
import { useAuth } from '../core/auth/AuthContext';

// Inicio (08/08): las materias (dictadas + inscritas) ya viven en el
// sidebar, así que acá ya no se repiten como directorio — el cuerpo es un
// resumen de actividad por materia (ver InicioPage). Acá solo el guard de
// admin (a esa cuenta no le corresponde este home).
function Inicio() {
  const { sesion } = useAuth();
  if (sesion?.contexto === 'admin') return <Navigate to="/admin/solicitudes" replace />;
  return <InicioPage />;
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

            {/* Docente: guías de pre-clase (fusión con PaginaGuias, 05/08;
                guías nativas 16/08 — lanzamiento/resultados/revisión). */}
            <Route path="materias/:id/clases/:claseId/guias" element={<GuiasClasePage />} />
            <Route path="materias/:id/guias/:guiaId/tomar" element={<TomarGuiaPage />} />
            <Route
              path="materias/:id/guias/:guiaId/monitoreo"
              element={<GuiaMonitoreoPage />}
            />
            <Route
              path="materias/:id/guias/:guiaId/resultados"
              element={<GuiaResultadosPage />}
            />
            <Route path="materias/:id/guias/:guiaId/revision" element={<RevisarGuiaPage />} />

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

            {/* Rol dual (HU-03), unificación de identidad en web (05/08):
                la misma cuenta también puede estar inscrita como estudiante
                en otra materia — reemplaza los silos /examen y /guias. La
                lista de "Materias inscritas" vive en el home (Inicio),
                arriba de "Materias que dicto"; acá solo el detalle. */}
            <Route path="inscrito/:id" element={<MateriaInscritaDetallePage />} />
            <Route path="inscrito/:id/guias/:guiaId/tomar" element={<TomarGuiaPage />} />
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
            path="admin/promociones"
            element={
              <ProtegerRuta contexto="admin">
                <PromocionesAdminPage />
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
