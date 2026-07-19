import { useEffect, useRef, useState } from 'react';

/**
 * Mantiene un elemento montado durante su animación de salida (sustituto
 * liviano de AnimatePresence, sin dependencias de animación en runtime).
 */
export function useUnmountAnim(abierto: boolean, duracionMs = 150) {
  const [montado, setMontado] = useState(abierto);
  const [saliendo, setSaliendo] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (abierto) {
      clearTimeout(temporizador.current);
      setMontado(true);
      setSaliendo(false);
      return;
    }
    if (!montado) return;
    setSaliendo(true);
    temporizador.current = setTimeout(() => {
      setMontado(false);
      setSaliendo(false);
    }, duracionMs);
    return () => clearTimeout(temporizador.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  return { montado, saliendo };
}
