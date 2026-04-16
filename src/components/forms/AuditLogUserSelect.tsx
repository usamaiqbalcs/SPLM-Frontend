import * as React from 'react';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';

import { auditLogsApi, type AdminUserListItemDto } from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import { useListPageSearchDebounce } from '@/components/listing/listPageSearch';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

function formatUserLabel(u: AdminUserListItemDto): string {
  const name = (u.name ?? '').trim() || u.email;
  return `${name} — ${u.email}`;
}

function sameUserId(a: string, b: string): boolean {
  return a.replace(/-/g, '').toLowerCase() === b.replace(/-/g, '').toLowerCase();
}

export type AuditLogUserSelectProps = {
  value: string;
  onValueChange: (userId: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentWidth?: 'trigger' | 'wide';
  id?: string;
  'aria-label'?: string;
};

export function AuditLogUserSelect({
  value,
  onValueChange,
  placeholder = 'Any user',
  searchPlaceholder = 'Search user by name or email',
  disabled,
  className,
  triggerClassName,
  contentWidth = 'wide',
  id,
  'aria-label': ariaLabel,
}: AuditLogUserSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState('');
  const debouncedSearch = useListPageSearchDebounce(searchInput);
  const [results, setResults] = React.useState<AdminUserListItemDto[]>([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [resolvedLabel, setResolvedLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    const v = value.trim();
    if (!v) {
      setResolvedLabel(null);
      return;
    }
    let cancelled = false;
    auditLogsApi
      .searchUsersForFilter({ search: v })
      .then((res) => {
        if (cancelled) return;
        const hit = res.items?.find((u) => sameUserId(u.user_id, v));
        setResolvedLabel(hit ? formatUserLabel(hit) : `User ${v.slice(0, 8)}…`);
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedLabel(`User ${v.slice(0, 8)}…`);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  React.useEffect(() => {
    const q = debouncedSearch.trim();
    if (!q) {
      setResults([]);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    auditLogsApi
      .searchUsersForFilter({ search: q })
      .then((res) => {
        if (cancelled) return;
        setResults(res.items ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setResults([]);
      })
      .finally(() => {
        if (cancelled) return;
        setSearchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const displayText = value.trim() ? resolvedLabel ?? '…' : null;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSearchInput('');
  };

  const clear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onValueChange('');
    setResolvedLabel(null);
  };

  return (
    <div className={cn('relative flex w-full min-w-0 items-center gap-1', className)}>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-busy={searchLoading}
            aria-label={ariaLabel}
            disabled={disabled}
            className={cn(
              'min-w-0 flex-1 justify-between font-normal h-9 min-h-9 px-2.5 text-sm',
              !displayText && 'text-muted-foreground',
              triggerClassName,
            )}
          >
            <span className="truncate text-left">{displayText ?? placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn(
            'p-0',
            contentWidth === 'wide'
              ? 'w-[min(100vw-2rem,28rem)]'
              : 'w-[var(--radix-popover-trigger-width)] max-w-[min(100vw-2rem,28rem)]',
          )}
          align="start"
        >
          <Command shouldFilter={false} label="Search users">
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchInput}
              onValueChange={setSearchInput}
            />
            <CommandList aria-busy={searchLoading}>
              {searchLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading…
                </div>
              ) : debouncedSearch.trim() === '' ? (
                <CommandEmpty>Type to search by name, email, or user ID.</CommandEmpty>
              ) : results.length === 0 ? (
                <CommandEmpty>No users found</CommandEmpty>
              ) : (
                <CommandGroup>
                  {results.map((u) => {
                    const label = formatUserLabel(u);
                    const selected = value.trim() !== '' && sameUserId(value, u.user_id);
                    return (
                      <CommandItem
                        key={u.user_id}
                        value={`${label} ${u.user_id}`}
                        keywords={[u.user_id, u.email, u.name]}
                        onSelect={() => {
                          onValueChange(u.user_id);
                          setResolvedLabel(label);
                          setOpen(false);
                          setSearchInput('');
                        }}
                      >
                        <Check
                          className={cn('mr-2 h-4 w-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')}
                          aria-hidden
                        />
                        <span className="truncate">{label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.trim() !== '' && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={clear}
          aria-label="Clear user filter"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
