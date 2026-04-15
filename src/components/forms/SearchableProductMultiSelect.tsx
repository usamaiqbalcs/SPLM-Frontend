import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type ProductOption = { id: string; name: string };

function parseCsvIds(raw: string): Set<string> {
  return new Set(
    (raw || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export interface SearchableProductMultiSelectProps {
  label: string;
  products: ProductOption[];
  /** Comma-separated product ids */
  value: string;
  onChange: (csv: string) => void;
  helpText?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchableProductMultiSelect({
  label,
  products,
  value,
  onChange,
  helpText,
  disabled,
  className,
}: SearchableProductMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseCsvIds(value), [value]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next].join(','));
  };

  const summary = useMemo(() => {
    if (selected.size === 0) return 'Search and select products…';
    if (selected.size === 1) {
      const id = [...selected][0];
      return products.find((p) => p.id === id)?.name ?? '1 selected';
    }
    return `${selected.size} products selected`;
  }, [selected, products]);

  return (
    <div className={cn('md:col-span-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="mb-0">{label}</Label>
        {products.length > 0 && (
          <div className="flex gap-1 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled}
              onClick={() => onChange(products.map((p) => p.id).join(','))}
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled}
              onClick={() => onChange('')}
            >
              Clear all
            </Button>
          </div>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || products.length === 0}
            className={cn(
              'mt-1 w-full justify-between font-normal text-left h-auto min-h-10 py-2 px-3',
              selected.size === 0 && 'text-muted-foreground',
            )}
          >
            <span className="truncate">{products.length === 0 ? 'No products available' : summary}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] max-w-[min(100vw-2rem,28rem)]" align="start">
          <Command>
            <CommandInput placeholder="Search products…" />
            <CommandList>
              <CommandEmpty>No products match.</CommandEmpty>
              <CommandGroup>
                {products.map((p) => {
                  const isOn = selected.has(p.id);
                  return (
                    <CommandItem
                      key={p.id}
                      value={`${p.name} ${p.id}`}
                      onSelect={() => toggle(p.id)}
                    >
                      <Check className={cn('mr-2 h-4 w-4 shrink-0', isOn ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{p.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {helpText ? <p className="text-[11px] text-muted-foreground mt-1">{helpText}</p> : null}
    </div>
  );
}
