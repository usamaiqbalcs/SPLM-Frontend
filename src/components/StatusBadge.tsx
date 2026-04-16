import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  className?: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-muted', text: 'text-muted-foreground' },
  active: { bg: 'bg-blue-100', text: 'text-primary' },
  maintenance: { bg: 'bg-warning-bg', text: 'text-warning' },
  deprecated: { bg: 'bg-danger-bg', text: 'text-danger' },
  retired: { bg: 'bg-muted', text: 'text-muted-foreground' },
  backlog: { bg: 'bg-muted', text: 'text-muted-foreground' },
  assigned: { bg: 'bg-blue-100', text: 'text-primary' },
  in_progress: { bg: 'bg-purple-bg', text: 'text-purple' },
  review: { bg: 'bg-warning-bg', text: 'text-warning' },
  done: { bg: 'bg-success-bg', text: 'text-success' },
  cancelled: { bg: 'bg-muted', text: 'text-muted-foreground' },
  critical: { bg: 'bg-danger-bg', text: 'text-danger' },
  high: { bg: 'bg-warning-bg', text: 'text-warning' },
  medium: { bg: 'bg-blue-100', text: 'text-primary' },
  low: { bg: 'bg-success-bg', text: 'text-success' },
  pending: { bg: 'bg-warning-bg', text: 'text-warning' },
  running: { bg: 'bg-blue-100', text: 'text-primary' },
  success: { bg: 'bg-success-bg', text: 'text-success' },
  failed: { bg: 'bg-danger-bg', text: 'text-danger' },
  rolled_back: { bg: 'bg-muted', text: 'text-muted-foreground' },
  planned: { bg: 'bg-muted', text: 'text-muted-foreground' },
  released: { bg: 'bg-success-bg', text: 'text-success' },
  hotfix: { bg: 'bg-danger-bg', text: 'text-danger' },
  building: { bg: 'bg-teal-bg', text: 'text-teal' },
  testing: { bg: 'bg-purple-bg', text: 'text-purple' },
  deploying: { bg: 'bg-blue-100', text: 'text-primary' },
  major: { bg: 'bg-danger-bg', text: 'text-danger' },
  minor: { bg: 'bg-blue-100', text: 'text-primary' },
  patch: { bg: 'bg-success-bg', text: 'text-success' },
  in_development: { bg: 'bg-purple-bg', text: 'text-purple' },
  staging: { bg: 'bg-purple-bg', text: 'text-purple' },
  quarterly: { bg: 'bg-blue-100', text: 'text-primary' },
  monthly: { bg: 'bg-success-bg', text: 'text-success' },
  yearly: { bg: 'bg-warning-bg', text: 'text-warning' },
  on_demand: { bg: 'bg-muted', text: 'text-muted-foreground' },
  planning: { bg: 'bg-muted', text: 'text-muted-foreground' },
  completed: { bg: 'bg-success-bg', text: 'text-success' },
  feature: { bg: 'bg-blue-100', text: 'text-primary' },
  bug_fix: { bg: 'bg-danger-bg', text: 'text-danger' },
  api_update: { bg: 'bg-teal-bg', text: 'text-teal' },
  security: { bg: 'bg-warning-bg', text: 'text-warning' },
  research: { bg: 'bg-purple-bg', text: 'text-purple' },
  manual: { bg: 'bg-muted', text: 'text-muted-foreground' },
};

export function StatusBadge({ status, size = 'sm', className }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status] || { bg: 'bg-muted', text: 'text-muted-foreground' };
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border border-black/[0.06] font-semibold uppercase tracking-wide dark:border-white/10',
        colors.bg,
        colors.text,
        size === 'sm' ? 'px-2 py-0.5 text-[10px] leading-tight' : 'px-3 py-1 text-xs',
        className,
      )}
      title={(status || '').replace(/_/g, ' ')}
    >
      <span className="truncate">{(status || '').replace(/_/g, ' ')}</span>
    </span>
  );
}

export function PriorityBar({ score, width = 60 }: { score: number; width?: number }) {
  const color = score >= 75 ? 'bg-success' : score >= 50 ? 'bg-warning' : 'bg-danger';
  const textColor = score >= 75 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-danger';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 rounded-full bg-muted overflow-hidden" style={{ width }}>
        <div className={cn('h-full rounded-full transition-all duration-400', color)} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className={cn('font-bold text-sm', textColor)}>{Math.round(score)}</span>
    </div>
  );
}
