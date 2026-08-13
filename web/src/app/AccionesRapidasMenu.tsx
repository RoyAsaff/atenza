// Menú "+" del topbar (al lado del ícono de perfil, 08/08): centraliza las
// dos formas de sumar una materia — antes vivían como botones sueltos
// dentro de "Inicio" (MisMateriasPage / MateriasInscritasPage), que ahora
// ya no se renderiza como grilla ahí (las materias viven en el sidebar).

import { useState } from 'react';
import { GraduationCap, KeyRound, Plus } from 'lucide-react';
import { Dropdown, DropdownItem } from '../core/ui/Dropdown';
import { IconButton } from '../core/ui/IconButton';
import { ModalNuevaMateria } from '../features/mi-espacio/ModalNuevaMateria';
import { ModalUnirse } from '../features/mi-espacio/ModalUnirse';

export function AccionesRapidasMenu() {
  const [modal, setModal] = useState<'crear' | 'unirse' | null>(null);

  return (
    <>
      <Dropdown
        trigger={() => (
          <IconButton aria-label="Agregar materia" variante="secondary">
            <Plus size={18} />
          </IconButton>
        )}
      >
        <DropdownItem icono={<GraduationCap size={15} />} onSelect={() => setModal('crear')}>
          Crear materia
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
