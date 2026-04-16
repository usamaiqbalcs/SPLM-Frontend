import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SplmPageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * Standard admin/list page title block (replaces ad-hoc h2 + muted paragraph).
 * Keeps title + subtitle + optional actions aligned with the same content rhythm as tables below.
 */
export function SplmPageHeader({ title, subtitle, actions, className }: SplmPageHeaderProps) {
  return (
    <header className={cn('mb-6 border-b border-border/70 pb-5 sm:mb-7 sm:pb-6', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
          {subtitle != null && subtitle !== '' ? (
            <div className="mt-2.5 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-[15px] sm:leading-relaxed">
              {subtitle}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-0.5">{actions}</div> : null}
      </div>
    </header>
  );
}
