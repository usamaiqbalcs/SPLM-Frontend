/** Keys that map to C# DateOnly? / date columns — empty string must become JSON null, not "". */
function isDateFieldKey(key: string): boolean {
  if (key.endsWith('_date')) return true;
  return (
    key === 'due_date'
    || key === 'target_date'
    || key === 'planned_date'
    || key === 'release_date'
    || key === 'ship_date'
    || key === 'go_live_date'
    || key === 'available_from'
    || key === 'available_to'
  );
}

/**
 * Recursively turn empty strings into `null` for known date fields so .NET can bind to DateOnly?.
 */
export function nullifyEmptyDateFields(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(nullifyEmptyDateFields);
  if (typeof value !== 'object') return value;
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' && isDateFieldKey(k)) {
      out[k] = null;
    } else {
      out[k] = nullifyEmptyDateFields(v);
    }
  }
  return out;
}
