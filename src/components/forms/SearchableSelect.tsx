import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
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

export type SearchableSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

/** Map enum-like string values to options; labels default to humanized snake_case. */
export function optionsFromStrings(
  values: readonly string[],
  formatLabel: (v: string) => string = (v) => v.replace(/_/g, ' '),
): SearchableSelectOption[] {
  return values.map((v) => ({ value: v, label: formatLabel(v) }));
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  /** Match trigger width (default) or a wider menu for long labels */
  contentWidth?: 'trigger' | 'wide';
  size?: 'default' | 'sm' | 'xs';
  id?: string;
  'aria-label'?: string;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No matches.',
  disabled,
  className,
  triggerClassName,
  contentWidth = 'trigger',
  size = 'default',
  id,
  'aria-label': ariaLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedLabel = React.useMemo(() => {
    const hit = options.find((o) => o.value === value);
    return hit?.label ?? null;
  }, [options, value]);

  const triggerSize =
    size === 'xs'
      ? 'h-7 min-h-[28px] px-2 text-xs'
      : size === 'sm'
        ? 'h-9 min-h-9 px-2.5 text-sm'
        : 'h-10 min-h-10 px-3 text-sm';

  return (
    <div className={cn(className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel}
            disabled={disabled}
            className={cn(
              'w-full justify-between font-normal',
              triggerSize,
              !selectedLabel && 'text-muted-foreground',
              triggerClassName,
            )}
          >
            <span className="truncate text-left">{selectedLabel ?? placeholder}</span>
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
          <Command shouldFilter>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value.length ? opt.value : `__empty__-${opt.label}`}
                    value={`${opt.label} ${opt.value}`}
                    keywords={[opt.value, opt.label]}
                    disabled={opt.disabled}
                    onSelect={() => {
                      onValueChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        value === opt.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
