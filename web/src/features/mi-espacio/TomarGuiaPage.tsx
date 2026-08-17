// Guías nativas (16/08) · Pantalla de confirmación antes de salir a la
// página externa. A diferencia de un examen, acá NO tiene sentido pedir
// pantalla completa en ESTA página: al navegar a otro dominio el navegador
// la cierra sola. La pantalla completa de verdad la pide la propia página
// externa (con el script que se le entrega al docente), en su propio
// click de "Comenzar" — ver el plan de guías nativas.

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { api, mensajeDeError } from '../../core/api/cliente';
import { GuiaIntentoParaRendir } from '../../core/tipos';
import { Alert, Button, Card, CardBody, PageBreadcrumb, PageHeader, Spinner } from '../../core/ui/ui';

// Ruteada dos veces (docente viendo su propia materia, y estudiante desde
// "inscrito") — no pide el detalle de la materia (esa consulta exige ser
// el docente dueño) para funcionar igual en los dos casos; el link de
// vuelta se arma según por dónde entró, sin otra llamada de por medio.
export function TomarGuiaPage() {
  const { id, guiaId } = useParams();
  const materiaId = Number(id);
  const location = useLocation();
  const esInscrito = location.pathname.startsWith('/inscrito/');
  const [error, setError] = useState('');

  const tomar = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ intento: GuiaIntentoParaRendir }>(
        `/api/materias/${materiaId}/guias/${guiaId}/tomar`,
      );
      return data.intento;
    },
    onSuccess: (intento) => {
      window.location.href = intento.url_acceso;
    },
    onError: (err: unknown) => setError(mensajeDeError(err)),
  });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageBreadcrumb>
        <Link to={esInscrito ? `/inscrito/${id}` : `/materias/${id}`}>‹ Volver a la materia</Link>
      </PageBreadcrumb>
      <PageHeader eyebrow="Guía" title="Vas a salir a tu guía" />

      <Card>
        <CardBody className="space-y-4">
          <Alert tone="info" icon={<AlertTriangle size={16} />}>
            Se va a abrir en pantalla completa. No cierres ni cambies de pestaña hasta terminar
            — el docente ve si saliste de la pantalla.
          </Alert>
          <p className="text-sm text-text-secondary">
            Al continuar salís de Atenza hacia la página de la guía. Ahí vas a ver un botón para
            comenzar en pantalla completa.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={() => tomar.mutate()} disabled={tomar.isPending}>
            {tomar.isPending ? (
              <>
                <Spinner /> Abriendo…
              </>
            ) : (
              <>
                <ExternalLink size={16} /> Continuar
              </>
            )}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
