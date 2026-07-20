// Página pública en "/" para quien no tiene sesión — antes esa ruta
// redirigía directo a /login sin explicar qué es Atenza. Ver
// app/App.tsx (RaizPublica) para cómo se decide cuándo se muestra.

import { Link } from 'react-router-dom';
import {
  Activity,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  ListChecks,
  ShieldCheck,
  Smartphone,
  SquareUser,
} from 'lucide-react';
import { Card, CardBody, botonClases } from '../../core/ui/ui';
import { LogoLockup, LogoMark } from '../../core/ui/Logo';

// Apunta siempre al asset del último release en GitHub — no hay que
// actualizar este link cada vez que se publique una versión nueva.
const URL_APK_ANDROID = 'https://github.com/RoyAsaff/atenza/releases/latest/download/app-release.apk';

const CARACTERISTICAS = [
  {
    icono: <ClipboardCheck size={20} />,
    titulo: 'Asistencia por clase',
    descripcion:
      'Pasa lista en segundos (puntual, atraso, licencia, falta) y mira el consolidado y el % de asistencia de todo el curso.',
  },
  {
    icono: <SquareUser size={20} />,
    titulo: 'Inscripción por código',
    descripcion:
      'Comparte un código con tus estudiantes; ellos se inscriben solos desde la app. Nómina, búsqueda y retiro sin planillas sueltas.',
  },
  {
    icono: <ListChecks size={20} />,
    titulo: 'Evaluaciones de selección múltiple',
    descripcion:
      'Arma exámenes a mano, importando un Word ya hecho, o con un prompt sugerido para tu IA favorita — todo en el mismo formato.',
  },
  {
    icono: <ShieldCheck size={20} />,
    titulo: 'Modo examen seguro',
    descripcion:
      'Pantalla completa, sin capturas y con reporte de incidentes si el estudiante sale de la app — disponible en Android y también desde el navegador, para quienes solo tienen iPhone.',
  },
  {
    icono: <Activity size={20} />,
    titulo: 'Monitoreo en vivo',
    descripcion:
      'Mira en tiempo real quién va respondiendo, pausa o cancela el examen para todo el curso, y revisa cada incidente al instante.',
  },
  {
    icono: <FileSpreadsheet size={20} />,
    titulo: 'Centralizador de notas',
    descripcion:
      'Notas de todas las evaluaciones de la materia en una sola matriz, exportable a Excel cuando la necesites.',
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <LogoLockup />
          <Link to="/login" className={botonClases('secondary', 'md')}>
            Ingresar
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-20 text-center sm:py-28">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary-600">
            Plataforma académica para docentes universitarios
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-text sm:text-5xl">
            Asistencia, exámenes seguros y notas — todo en un solo lugar
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-text-secondary">
            Atenza te ayuda a llevar tus materias, evaluar a tus estudiantes con un modo examen
            que cuida la integridad académica, y centralizar las notas — sin depender de hojas
            de cálculo sueltas.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/registro" className={botonClases('primary', 'lg')}>
              Regístrate gratis
            </Link>
            <Link to="/login" className={botonClases('secondary', 'lg')}>
              Ya tengo cuenta
            </Link>
          </div>
          <p className="mt-4 text-sm text-text-disabled">
            30 días de prueba gratis, sin tarjeta de crédito.
          </p>
        </section>

        <section className="border-t border-border bg-canvas py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-2xl font-extrabold tracking-tight text-text">
              Qué puedes hacer con Atenza
            </h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {CARACTERISTICAS.map((c) => (
                <Card key={c.titulo}>
                  <CardBody>
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-50 text-primary-700">
                      {c.icono}
                    </span>
                    <h3 className="mt-3 font-bold text-text">{c.titulo}</h3>
                    <p className="mt-1.5 text-sm text-text-secondary">{c.descripcion}</p>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-surface py-20">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 text-center lg:flex-row lg:text-left">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <Smartphone size={32} />
            </span>
            <div className="flex-1">
              <h2 className="text-2xl font-extrabold tracking-tight text-text">
                App para estudiantes (Android)
              </h2>
              <p className="mx-auto mt-2 max-w-2xl text-text-secondary lg:mx-0">
                Mis materias, asistencia, notas y el modo examen seguro en modo kiosco, desde el
                celular. ¿Tienes iPhone? Rinde el examen igual desde{' '}
                <Link to="/examen/login" className="text-primary-700 hover:underline">
                  el navegador
                </Link>
                , sin instalar nada.
              </p>
            </div>
            <a href={URL_APK_ANDROID} className={`${botonClases('primary', 'lg')} shrink-0`}>
              <Download size={18} /> Descargar APK
            </a>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-text">
            Empieza a usar Atenza hoy
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-text-secondary">
            Crea tu cuenta, arma tu primera materia y prueba el modo examen seguro con tus
            propios estudiantes.
          </p>
          <div className="mt-6">
            <Link to="/registro" className={botonClases('primary', 'lg')}>
              Regístrate gratis
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-6 text-sm text-text-disabled">
          <LogoMark size={16} />
          Atenza © {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
