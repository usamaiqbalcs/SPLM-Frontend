# SPLM UI guidelines (internal)

Modern B2B SaaS patterns for this codebase: **hierarchy first**, **calm surfaces**, **consistent spacing**. Implementation lives in `src/index.css` (tokens, `.portal-*`, `.splm-*`), `tailwind.config.ts` (shadows, radii), and shared shadcn components under `src/components/ui/`.

## Spacing

- **Page shell**: Main content uses horizontal padding `px-4 sm:px-6` and vertical `py-6 lg:py-8` (see `AppLayout`). Max width `--splm-page-max` (1600px) for standard pages; **Dashboard & KPI** use full main width (`SPLM_WIDE_CONTENT_TAB_IDS` in `splm-navigation.ts`); global search stays narrower (`max-w-[960px]`).
- **Between sections**: Prefer `space-y-8` on dashboard-style pages; module panels often use `space-y-4`–`space-y-6` for dense tools.
- **Inside cards**: `CardHeader` / `CardContent` use `p-5 sm:p-6` (see `card.tsx`). Keep related actions in the header row; body is for scan-friendly content.
- **Filter bars**: Use the `splm-filter-shell` class for sticky filter strips (light border, rounded-xl, subtle blur). Separate filter **rows** with `border-t border-border/60 pt-4` when grouping “quick” vs “advanced” filters.

## Cards & surfaces

- Default **Card**: `rounded-xl`, `border-border/80`, `shadow-splm`, hover can upgrade to `shadow-splm-md` for KPI tiles.
- **Titles**: `CardTitle` is `text-base font-semibold` for section headers—not page titles (those come from `AppLayout`).
- **Legacy**: `.portal-card` remains for older screens; new work should prefer shadcn `Card`.

## Tables

- Use `Table`, `TableHead`, `TableCell` from `ui/table`. Headers: uppercase tracking, `text-xs`, `bg-muted/50`. Rows: `py-3`, subtle hover.
- **Sticky first column** (e.g. RBAC): `sticky left-0 bg-card` + light `shadow-[4px_0_12px_-4px_...]` so the matrix reads clearly when scrolled horizontally.
- Wrap wide tables in `rounded-xl border border-border/80 bg-card shadow-splm` with an inner `overflow-x-auto`.

## Forms & filters

- **Labels**: `text-xs font-medium text-muted-foreground` (sentence case). Avoid ultra-small all-caps except table headers or meta chips.
- **Inputs**: Default `Input` height `h-10`; pair with consistent `gap-1.5` between label and control.
- **Primary actions**: Left or inline-end of filter groups; **Reset** as `variant="outline"`.

## Navigation

- **Sidebar**: Section headers are `text-[10px] tracking-[0.14em]`, subdued; items are `rounded-lg`, clear active state (`bg-primary-foreground/12` + left accent). Width expanded ~248px for readability.
- **Header**: Title + subtitle stack; subtitle is `text-sm text-muted-foreground`, one line on large screens where possible.
- **Global search**: Rounded-xl field, `text-sm`, focus ring aligned with design tokens.

## Status & badges

- Use `StatusBadge` for workflow/deployment states. Badges include a light **border** and **truncate** long text; don’t rely on color alone—pair with label text.
- Semantic colors use existing CSS variables (`--success`, `--warning`, `--destructive`, etc.).

## Accessibility

- Interactive chrome buttons: `h-9 w-9`, `rounded-lg`, `focus-visible:ring-2 focus-visible:ring-ring`.
- Charts: keep sufficient height (~240px) and readable axis ticks (`11px`+).

## Empty & loading

- Prefer `SplmEmptyState` (`src/components/layout/SplmEmptyState.tsx`) for zero-data blocks: icon in a soft rounded square, title + short description.

When in doubt, match **Dashboard** and **Audit logs** after this refresh—they exemplify cards, filters, and tables.
