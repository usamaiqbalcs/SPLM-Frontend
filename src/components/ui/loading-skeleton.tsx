import { Skeleton } from '@/components/ui/skeleton';

/**
 * Generic full-page loading fallback used by Suspense boundaries in App.tsx.
 * Renders a centred pulse strip so lazy-loaded panels don't flash blank white.
 */
export function LoadingSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[40vh] gap-3 p-8">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-4 w-56" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-card rounded-lg border p-5 space-y-3">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

export function TileSkeleton() {
  return (
    <div className="bg-card rounded-lg border p-5">
      <Skeleton className="h-3 w-24 mb-2" />
      <Skeleton className="h-8 w-16 mb-1" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-card rounded-lg border p-5 space-y-3">
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3 border-b border-muted last:border-0">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <TileSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

export function GridCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="bg-card rounded-lg border p-5">
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-muted/30 rounded-lg p-4 border space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
