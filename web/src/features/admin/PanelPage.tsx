// HU-09 · Panel de administración general: KPIs de la plataforma y docentes
// con sus materias, estudiantes, plan y vigencia en un solo lugar.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '../../core/api/cliente';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Spinner,
} from '../../core/ui/ui';

interface ResumenDocente {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
  whatsapp: string | null;
  activo: boolean;
  plan: string | null;
  vigencia: string | null;
  pago_en_verificacion: boolean;
  materias: { id: number; nombre_materia: string; sigla: string | null; estudiantes: number }[];
}

interface Resumen {
  kpis: {
    usuarios: number;
    docentes: number;
    materias: number;
    estudiantes_activos: number;
    pagos_por_verificar: number;
    ingresos_aprobados: number;
    cuentas_por_vencer: number;
  };
  docentes: ResumenDocente[];
}

function Kpi({ titulo, valor, aviso }: { titulo: string; valor: string | number; aviso?: boolean }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-text-secondary">{titulo}</p>
        <p className={`text-2xl font-bold ${aviso ? 'text-red-600' : 'text-text'}`}>{valor}</p>
      </CardBody>
    </Card>
  );
}

export function PanelPage() {
  const [buscar, setBuscar] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-resumen', buscar],
    queryFn: async () => {
      const { data } = await api.get<Resumen>('/api/admin/resumen', {
        params: buscar ? { buscar } : {},
      });
      return data;
    },
  });

  const k = data?.kpis;

  return (
    <div>
      <div className="mb-5">
        <PageHeader eyebrow="Administración" title="Panel general" />
      </div>

      {k && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Kpi titulo="Docentes con materias" valor={k.docentes} />
          <Kpi titulo="Materias" valor={k.materias} />
          <Kpi titulo="Estudiantes activos" valor={k.estudiantes_activos} />
          <Kpi titulo="Usuarios registrados" valor={k.usuarios} />
          <Kpi
            titulo="Pagos por verificar"
            valor={k.pagos_por_verificar}
            aviso={k.pagos_por_verificar > 0}
          />
          <Kpi titulo="Cuentas por vencer (30 días)" valor={k.cuentas_por_vencer} />
          <Kpi titulo="Ingresos aprobados" valor={`Bs. ${k.ingresos_aprobados.toFixed(2)}`} />
        </div>
      )}

      <Card>
        <CardHeader title={`Docentes${data ? ` (${data.docentes.length})` : ''}`} />
        <CardBody>
          <Input
            placeholder="Buscar docente por nombre, apellido o correo…"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            iconoIzq={<Search size={15} />}
            className="mb-3"
          />

          {isLoading && <Spinner />}

          {data && data.docentes.length === 0 && (
            <EmptyState
              title="Sin resultados"
              description={
                buscar
                  ? 'No se encontraron docentes con ese criterio.'
                  : 'Aún no hay docentes con materias.'
              }
            />
          )}

          <div className="divide-y divide-border">
            {data?.docentes.map((d) => {
              const vencida = d.vigencia && new Date(d.vigencia) < new Date();
              const totalEstudiantes = d.materias.reduce((s, m) => s + m.estudiantes, 0);
              return (
                <div key={d.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-text">
                        {d.apellidos}, {d.nombres}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {d.email}
                        {d.whatsapp && ` · WhatsApp ${d.whatsapp}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge tone="primary">{d.plan ?? 'Sin plan'}</Badge>
                      {d.vigencia && (
                        <Badge tone={vencida ? 'danger' : 'success'}>
                          {vencida ? 'Venció' : 'Vigente hasta'}{' '}
                          {new Date(d.vigencia).toLocaleDateString()}
                        </Badge>
                      )}
                      {d.pago_en_verificacion && <Badge tone="danger">Pago por verificar</Badge>}
                      {!d.activo && <Badge tone="danger">inactivo</Badge>}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-text-secondary">
                    {d.materias.length} materia{d.materias.length === 1 ? '' : 's'} ·{' '}
                    {totalEstudiantes} estudiante{totalEstudiantes === 1 ? '' : 's'}
                  </p>
                  <ul className="mt-1 text-sm text-text">
                    {d.materias.map((m) => (
                      <li key={m.id}>
                        {m.nombre_materia}
                        {m.sigla ? ` (${m.sigla})` : ''}{' '}
                        <span className="text-xs text-text-secondary">
                          · {m.estudiantes} estudiante{m.estudiantes === 1 ? '' : 's'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
