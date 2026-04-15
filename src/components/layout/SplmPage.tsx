import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Root wrapper for routed panels: prevents flex children from forcing horizontal
 * overflow and keeps content within the main column.
 */
export function SplmPage({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('min-w-0 w-full max-w-full', className)} {...props} />;
}
