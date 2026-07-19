// Entidad Clase según el diagrama de clases (E4)
// Toda clase pertenece a una materia y es el eje que relaciona
// asistencias (E5) y evaluaciones (E6).

export interface Clase {
  id: number;
  fecha: Date; // solo fecha (columna DATE)
  hora: string; // "HH:MM" — el diagrama la tipa como time
  tema: string;
  materia_id: number;
}
