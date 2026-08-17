// Menú "+" del topbar (al lado del ícono de perfil, 08/08): centraliza las
// dos formas de sumar una materia — antes vivían como botones sueltos
// dentro de "Inicio" (MisMateriasPage / MateriasInscritasPage), que ahora
// ya no se renderiza como grilla ahí (las materias viven en el sidebar).
//
// Rediseño SaaS (17/08): el plan Gratis limita la cantidad de materias
// (materias_activas/limite_materias, en cuenta-estado) — si ya se alcanzó
// el tope, "Crear materia" lleva a /suscripcion/planes en vez de abrir el
// modal (el backend ya lo bloquea con LIMITE_MATERIAS_EXCEDIDO; esto es
// solo para no hacer al docente rellenar el formulario para nada).

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, KeyRound, Plus } from 'lucide-react';
import { api } from '../core/api/cliente';
import { EstadoCuenta } from '../core/tipos';
import { Dropdown, DropdownItem } from '../core/ui/Dropdown';
import { IconButton } from '../core/ui/IconButton';
import { ModalNuevaMateria } from '../features/mi-espacio/ModalNuevaMateria';
import { ModalUnirse } from '../features/mi-espacio/ModalUnirse';

export function AccionesRapidasMenu() {
  const navigate = useNavigate();
  const [modal, setModal] = useState<'crear' | 'unirse' | null>(null);

  const estado = useQuery({
    queryKey: ['cuenta-estado'],
    queryFn: async () => {
      const { data } = await api.get<{ estado: EstadoCuenta }>('/api/cuenta/estado');
      return data.estado;
    },
  });

  const limiteMateriasAlcanzado =
    estado.data?.limite_materias !== null &&
    estado.data !== undefined &&
    estado.data.materias_activas >= (estado.data.limite_materias ?? Infinity);

  function alCrearMateria() {
    if (limiteMateriasAlcanzado) {
      navigate('/suscripcion/planes');
      return;
    }
    setModal('crear');
  }

  return (
    <>
      <Dropdown
        trigger={() => (
          <IconButton aria-label="Agregar materia" variante="secondary">
            <Plus size={18} />
          </IconButton>
        )}
      >
        <DropdownItem icono={<GraduationCap size={15} />} onSelect={alCrearMateria}>
          Crear materia{limiteMateriasAlcanzado ? ' (actualiza tu plan)' : ''}
        </DropdownItem>
        <DropdownItem icono={<KeyRound size={15} />} onSelect={() => setModal('unirse')}>
          Unirme a una materia
        </DropdownItem>
      </Dropdown>

      {modal === 'crear' && <ModalNuevaMateria onCerrar={() => setModal(null)} />}
      {modal === 'unirse' && <ModalUnirse onCerrar={() => setModal(null)} />}
    </>
  );
}
