// Marca "Ruta A / FOCUS": una A geométrica sin barra sólida — el espacio
// negativo del ápice concentra un punto focal (atención, precisión, monitoreo).

export function LogoMark({
  size = 24,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Atenza"
    >
      <path d="M12 3 L3 21" />
      <path d="M12 3 L21 21" />
      <circle cx="12" cy="13" r="1.6" fill="var(--color-accent-500)" stroke="none" />
    </svg>
  );
}

export function LogoTile({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md bg-primary-800 text-white ${className}`}
      style={{ width: size, height: size }}
    >
      <LogoMark size={Math.round(size * 0.6)} />
    </span>
  );
}

export function LogoLockup({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoTile size={32} />
      <span className="text-lg font-extrabold tracking-tight text-text">Atenza</span>
    </span>
  );
}
