import { Calendar } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type DateFieldProps = {
  id?: string;
  label: string;
  /** HTML date value `yyyy-MM-dd` or empty string when unset */
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  helperText?: string;
  error?: string;
  className?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
};

/**
 * Styled date input with calendar affordance and focus ring (better than raw `<Input type="date" />`).
 */
export function DateField({
  id,
  label,
  value,
  onChange,
  required,
  helperText,
  error,
  className,
  disabled,
  min,
  max,
}: DateFieldProps) {
  const inputId = id ?? `date-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={inputId} className="flex items-center gap-1 text-sm">
        {label}
        {required ? <span className="text-destructive" aria-hidden>*</span> : null}
      </Label>
      <div
        className={cn(
          'flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 shadow-sm transition-colors',
          'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 focus-within:ring-offset-2 focus-within:ring-offset-background',
          error && 'border-destructive focus-within:ring-destructive/25',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          id={inputId}
          type="date"
          disabled={disabled}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'min-w-0 flex-1 border-0 bg-transparent py-0 text-sm outline-none',
            'text-foreground placeholder:text-muted-foreground',
            '[color-scheme:light] dark:[color-scheme:dark]',
          )}
        />
      </div>
      {helperText && !error ? (
        <p className="text-[11px] text-muted-foreground">{helperText}</p>
      ) : null}
      {error ? <p className="text-[11px] font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
