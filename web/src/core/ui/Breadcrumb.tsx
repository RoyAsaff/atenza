import { Fragment, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from './cn';

/** Trail real, usado en el Topbar: Breadcrumb > BreadcrumbItem (to?) > ... */
export function Breadcrumb({ className = '', children }: { className?: string; children: ReactNode[] }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <nav className={cn('flex items-center gap-1.5 text-sm font-medium text-text-secondary', className)}>
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <ChevronRight size={14} className="shrink-0 text-text-disabled" />}
          {item}
        </Fragment>
      ))}
    </nav>
  );
}

export function BreadcrumbItem({ to, children }: { to?: string; children: ReactNode }) {
  if (to) {
    return (
      <Link to={to} className="truncate transition hover:text-text">
        {children}
      </Link>
    );
  }
  return <span className="truncate text-text">{children}</span>;
}

/**
 * Migaja "de vuelta" que ya usan varias páginas de features (un único
 * <Link> con "‹"). Se conserva para no romperlas antes de su migración.
 */
export function PageBreadcrumb({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-text-secondary [&_a]:text-text-secondary [&_a:hover]:text-text">
      {children}
    </div>
  );
}
