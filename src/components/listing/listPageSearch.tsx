import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export const LIST_SEARCH_DEBOUNCE_MS = 400;

/** Default rows per page for SPLM list/table views (server- or client-paged). */
export const DEFAULT_LIST_PAGE_SIZE = 10;

export type ListPaginationBarProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (p: number) => void;
  disabled?: boolean;
  className?: string;
};

/** Prev/next + range summary; hides when there is nothing to show. */
export function ListPaginationBar({
  page,
  totalPages,
  totalItems,
  pageSize = DEFAULT_LIST_PAGE_SIZE,
  onPageChange,
  disabled,
  className,
}: ListPaginationBarProps) {
  if (totalItems === 0) return null;
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-4 pt-3 border-t text-sm text-muted-foreground',
        className,
      )}
    >
      <span className="tabular-nums">
        Showing {start}–{end} of {totalItems} · Page {safePage} of {safeTotalPages}
      </span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || safePage >= safeTotalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/** Debounced string for list filtering (same cadence as Products panel). */
export function useListPageSearchDebounce(raw: string, delayMs = LIST_SEARCH_DEBOUNCE_MS): string {
  const [debounced, setDebounced] = useState(() => raw.trim());
  useEffect(() => {
    const t = setTimeout(() => setDebounced(raw.trim()), delayMs);
    return () => clearTimeout(t);
  }, [raw, delayMs]);
  return debounced;
}

/** Case-insensitive partial match across any provided string fragments. */
export function rowMatchesListSearch(q: string, parts: Array<string | undefined | null>): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return parts.some((p) => String(p ?? '').toLowerCase().includes(needle));
}

type ListPageSearchInputProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
};

/** Shared search field styling (matches Products panel). */
export function ListPageSearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className = 'w-48',
  'aria-label': ariaLabel = 'Search list',
}: ListPageSearchInputProps) {
  return (
    <Input
      className={className}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
    />
  );
}
