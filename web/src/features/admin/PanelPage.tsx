// HU-09 · Panel de administración general: usuarios y materias con búsqueda

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '../../core/api/cliente';
import { Materia, Usuario } from '../../core/tipos';
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

export function PanelPage() {
  const [buscarUsuario, setBuscarUsuario] = useState('');
  const [buscarMateria, setBuscarMateria] = useState('');

  const usuarios = useQuery({
    queryKey: ['admin-usuarios', buscarUsuario],
    queryFn: async () => {
      const { data } = await api.get<{ usuarios: Usuario[] }>('/api/admin/usuarios', {
        params: buscarUsuario ? { buscar: buscarUsuario } : {},
      });
      return data.usuarios;
    },
  });

  const materias = useQuery({
    queryKey: ['admin-materias', buscarMateria],
    queryFn: async () => {
      const { data } = await api.get<{ materias: Materia[] }>('/api/admin/materias', {
        params: buscarMateria ? { buscar: buscarMateria } : {},
      });
      return data.materias;
    },
  });

  return (
    <div>
      <div className="mb-5">
        <PageHeader eyebrow="Administración" title="Panel general" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title={`Usuarios${usuarios.data ? ` (${usuarios.data.length})` : ''}`} />
          <CardBody>
            <Input
              placeholder="Buscar por nombre, apellido o correo…"
              value={buscarUsuario}
              onChange={(e) => setBuscarUsuario(e.target.value)}
              iconoIzq={<Search size={15} />}
              className="mb-3"
            />

            {usuarios.isLoading && <Spinner />}

            {usuarios.data && usuarios.data.length === 0 && (
              <EmptyState
                title="Sin resultados"
                description={
                  buscarUsuario
                    ? 'No se encontraron usuarios con ese criterio.'
                    : 'Aún no hay usuarios registrados.'
                }
              />
            )}

            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {usuarios.data?.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-text">
                      {u.apellidos}, {u.nombres}
                    </p>
                    <p className="text-xs text-text-secondary">{u.email}</p>
                  </div>
                  <div className="flex gap-1">
                    {u.rol_nombre === 'admin' && <Badge tone="primary">admin</Badge>}
                    {!u.activo && <Badge tone="danger">inactivo</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={`Materias${materias.data ? ` (${materias.data.length})` : ''}`} />
          <CardBody>
            <Input
              placeholder="Buscar por nombre, sigla o código…"
              value={buscarMateria}
              onChange={(e) => setBuscarMateria(e.target.value)}
              iconoIzq={<Search size={15} />}
              className="mb-3"
            />

            {materias.isLoading && <Spinner />}

            {materias.data && materias.data.length === 0 && (
              <EmptyState
                title="Sin resultados"
                description={
                  buscarMateria
                    ? 'No se encontraron materias con ese criterio.'
                    : 'Aún no hay materias registradas.'
                }
              />
            )}

            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {materias.data?.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-text">
                      {m.nombre_materia} {m.sigla ? `(${m.sigla})` : ''}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {m.carrera} · {m.semestre} · código{' '}
                      <span className="font-mono">{m.codigo}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
