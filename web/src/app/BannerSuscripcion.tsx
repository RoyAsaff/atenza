import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../core/api/cliente';
import { EstadoCuenta } from '../core/tipos';
import { Alert } from '../core/ui/Alert';

export function BannerSuscripcion() {
  const { data } = useQuery({
    queryKey: ['cuenta-estado'],
    queryFn: async () => {
      const { data } = await api.get<{ estado: EstadoCuenta }>('/api/cuenta/estado');
      return data.estado;
    },
  });

  if (!data || (!data.solo_lectura && !data.en_aviso)) return null;

  return (
    <Alert tone={data.solo_lectura ? 'dark' : 'warning'} className="mb-6">
      {data.solo_lectura ? (
        <>
          Tu cuenta está vencida y en <strong>modo solo lectura</strong>: puedes ver tu contenido,
          pero no crear ni editar nada nuevo.{' '}
          <Link to="/suscripcion/planes" className="underline font-semibold">
            Renovar ahora
          </Link>
        </>
      ) : (
        <>
          Tu plan vence en{' '}
          <strong>
            {data.dias_restantes} día{data.dias_restantes === 1 ? '' : 's'}
          </strong>
          .{' '}
          <Link to="/suscripcion/planes" className="underline font-semibold">
            Renovar ahora
          </Link>
        </>
      )}
    </Alert>
  );
}
