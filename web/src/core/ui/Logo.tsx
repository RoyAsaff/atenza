// Isologo real (web/src/logo/isologo.png) — antes era una "A" dibujada a
// mano en SVG inline; mismo componente/API para no tocar los 9 call sites
// (Sidebar, páginas de auth, landing, etc), solo cambia qué se renderiza.

import isologo from '../../logo/isologo.png';

export function LogoMark({
  size = 24,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={isologo}
      alt="Atenza"
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  );
}

// El isologo ya es a color (navy + teal) y autocontenido — antes iba
// dentro de un cuadro navy con el trazo en blanco, ya no hace falta.
export function LogoTile({ size = 36, className = '' }: { size?: number; className?: string }) {
  return <LogoMark size={size} className={className} />;
}

export function LogoLockup({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={32} />
      <span className="text-lg font-extrabold tracking-tight text-text">Atenza</span>
    </span>
  );
}
