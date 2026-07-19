import { cn } from './cn';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={cn('rounded-md bg-neutral-100', className)}
      style={{
        backgroundImage:
          'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
        backgroundSize: '200% 100%',
        animation: 'atenza-shimmer 1.4s ease-in-out infinite',
      }}
    />
  );
}
