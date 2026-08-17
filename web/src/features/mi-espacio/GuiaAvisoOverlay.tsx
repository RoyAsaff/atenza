// Guías nativas (17/08) · Auto-push del lanzamiento — mismo espíritu que
// RendirExamenPage para exámenes: Layout lo monta a pantalla completa apenas
// detecta un intento oficial activo, sin que el estudiante tenga que ir a
// buscarlo a "Materias inscritas". A diferencia de un examen, Atenza no
// aloja el cuestionario — el único gesto acá es "Comenzar", que redirige a
// la página externa del docente (mismo motivo por el que TomarGuiaPage
// tampoco pide pantalla completa: al salir del dominio el navegador la
// cierra sola). Sin pantalla de "enviado/cancelado" propia: en cuanto el
// servidor deja de devolver el intento (terminó, lo canceló el docente),
// el overlay simplemente desaparece — no hay nada que proteger a mitad de
// camino como sí pasa en un examen.

import { PauseCircle, Sparkles } from 'lucide-react';
import { GuiaIntentoParaRendir } from '../../core/tipos';
import { Button, Card, CardBody } from '../../core/ui/ui';

export function GuiaAvisoOverlay({ intento }: { intento: GuiaIntentoParaRendir }) {
  if (intento.estado === 'pausado') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-primary-900 px-6 text-center text-white">
        <PauseCircle size={56} className="mb-4 text-accent-400" />
        <h1 className="text-lg font-bold">Tu docente pausó la guía</h1>
        <p className="mt-2 max-w-sm text-sm text-white/70">
          Espera: vas a poder continuar apenas te reactive.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardBody className="space-y-4 p-8 text-center">
          <Sparkles size={40} className="mx-auto text-primary-600" />
          <div>
            <h1 className="text-lg font-bold text-text">Tu docente lanzó una guía</h1>
            <p className="mt-1 text-sm text-text-secondary">{intento.tema}</p>
          </div>
          <p className="text-sm text-text-secondary">
            Vas a salir a la página de la guía. Ahí vas a ver un botón para comenzar en pantalla
            completa — no cierres ni cambies de pestaña hasta terminar.
          </p>
          <Button
            className="w-full"
            onClick={() => {
              window.location.href = intento.url_acceso;
            }}
          >
            Comenzar →
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
