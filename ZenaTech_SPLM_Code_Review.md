# ZenaTech SPLM — Professional Code Review Report
**Date:** April 8, 2026  
**Reviewer:** AI Code Review  
**Project:** ZenaTech Software Product Lifecycle Management (SPLM) Platform  

---

## Tech Stack Identification

Before diving into the review, here is a complete picture of what was found in the project:

| Category | Technology |
|---|---|
| Language | TypeScript 5.8 + React 18 JSX (TSX) |
| UI Framework | React 18.3, React Router DOM v6 |
| Build Tool | Vite 5.4 with SWC compiler |
| Styling | Tailwind CSS 3.4 + shadcn/ui component library |
| Backend-as-a-Service | Supabase (PostgreSQL database, Auth, Row Level Security, Realtime) |
| Database | PostgreSQL (via Supabase) |
| State Management | Local component `useState` only (React Query is installed but **not used**) |
| Forms | Raw `useState` (React Hook Form + Zod are installed but **not used**) |
| Charts | Recharts |
| Icons | Lucide React |
| Testing | Vitest + Testing Library (1 trivial test exists), Playwright (no tests written) |
| Theming | Custom Tailwind CSS vars + `next-themes` (installed but **not used**) |

**Architecture Style:** Single-Page Application (SPA). There is no separate backend — Supabase acts as the backend via its JavaScript client SDK. The app is a pure frontend with database access managed by Row Level Security (RLS) policies in PostgreSQL.

---

## Phase 1: Project Structure

```
ZenaTech_SPLM_Project/
├── src/
│   ├── main.tsx              → App entry point (creates React root)
│   ├── App.tsx               → Root component: routing + toast providers
│   ├── index.css             → Global styles + custom CSS component classes
│   ├── contexts/
│   │   └── AuthContext.tsx   → Authentication state, session, role-based access
│   ├── hooks/
│   │   ├── useSessionTimer.ts → Countdown display timer
│   │   └── use-mobile.tsx    → Responsive breakpoint hook
│   ├── integrations/supabase/
│   │   ├── client.ts         → Supabase client singleton (env-driven)
│   │   └── types.ts          → Auto-generated DB types
│   ├── lib/
│   │   ├── api.ts            → Main API layer (products, tasks, devs, deploys, etc.)
│   │   ├── api-sprints.ts    → Sprint API functions
│   │   ├── api-comments.ts   → Task comments & subtasks API functions
│   │   ├── api-wiki.ts       → Wiki spaces, pages, versions API functions
│   │   ├── splm-utils.ts     → Utility functions (date formatting, semver, ENV config)
│   │   ├── utils.ts          → Tailwind `cn()` class merger
│   │   └── wiki-templates.ts → Wiki template content
│   ├── pages/
│   │   ├── Index.tsx         → Auth gate: shows LoginPage or AppLayout
│   │   ├── LoginPage.tsx     → Login + signup form
│   │   └── NotFound.tsx      → 404 page
│   └── components/
│       ├── AppLayout.tsx     → Main shell: sidebar, header, panel routing
│       ├── NavLink.tsx       → Navigation link component
│       ├── StatusBadge.tsx   → Color-coded status & priority badges
│       ├── panels/           → One component per feature area (13 panels)
│       └── ui/               → shadcn/ui primitive components (30+ components)
├── supabase/
│   └── migrations/           → 5 SQL migration files (schema + RLS policies)
└── public/                   → Static assets
```

**Entry Points:**
- `index.html` → loaded by browser, mounts React via `src/main.tsx`
- `src/main.tsx` → creates React root on `#root` div
- `src/App.tsx` → sets up routing (only two routes: `/` and `*` for 404)
- `src/pages/Index.tsx` → wraps `AuthProvider` and gates the app behind login

**How Parts Connect:**
All navigation between the 13 feature panels (Dashboard, Tasks, Sprints, Wiki, etc.) is handled via a single `activeTab` state string in `AppLayout.tsx`. This is **not** URL-based routing — switching panels does not change the browser URL, which means users cannot share links to specific panels or use the browser back button to navigate between panels.

---

## Phase 2: Code Quality Review

### 2.1 Readability & Naming Conventions

**Good practices observed:**
- Component file names use PascalCase (`TasksPanel.tsx`, `AppLayout.tsx`) — correct.
- Function names are descriptive (`handleSubmit`, `doSave`, `doStatusChange`).
- Utility functions are cleanly extracted to `splm-utils.ts`.
- The API layer is well-separated from UI concerns.

**Problems found:**

**Cryptic variable names:** Several filter state variables use very short, unclear names:
```tsx
// TasksPanel.tsx — hard to understand at a glance
const [fS, setFS] = useState('');  // filter by Status
const [fP, setFP] = useState('');  // filter by Product
// DeploymentsPanel.tsx
const [envF, setEnvF] = useState('');
const [statusF, setStatusF] = useState('');
```
These should be `filterStatus`, `filterProduct`, `filterEnvironment`, etc.

**Inline dense JSX:** Some component JSX is collapsed onto single lines making it nearly unreadable:
```tsx
// TasksPanel.tsx line 53 — too much logic on one line
try { await saveTask(toSave); toast.success(form.id ? 'Task updated' : 'Task created'); load(); setForm(null); }
```

### 2.2 TypeScript Usage — Major Issue

This is the most significant code quality problem in the project. TypeScript is used throughout, but the `any` type is used pervasively, effectively disabling all type safety.

**Instances of `any` found across the codebase:**
```tsx
// In almost every panel:
const [tasks, setTasks] = useState<any[]>([]);
const [form, setForm] = useState<any>(null);

// In all API functions:
export const saveProduct = async (product: any) => { ... }
export const saveDeveloper = async (dev: any) => { ... }
export const createDeployment = async (d: any) => { ... }

// In event handlers:
catch (e: any) { toast.error(e.message); }
setForm((f: any) => ({ ...f, title: e.target.value }))
```

The project has an auto-generated `types.ts` from Supabase that contains full type definitions for every table (e.g., `Database['public']['Tables']['tasks']['Row']`). These are **never used** in the application code. Every panel and every API function ignores them entirely.

**Fix:** Define typed interfaces and use them:
```tsx
// Define once in a types file:
type Task = Database['public']['Tables']['tasks']['Row'];
type TaskInsert = Database['public']['Tables']['tasks']['Insert'];

// Use throughout:
const [tasks, setTasks] = useState<Task[]>([]);
const [form, setForm] = useState<Partial<TaskInsert> | null>(null);
export const saveTask = async (task: TaskInsert | Partial<Task>) => { ... }
```

### 2.3 Code Duplication

**Data loading pattern is repeated in every panel:**

Every one of the 13 panels contains this identical pattern:
```tsx
const load = () => {
  setLoading(true);
  Promise.all([listX(), listY()])
    .then(([x, y]) => { setX(x); setY(y); })
    .finally(() => setLoading(false));
};
useEffect(() => { load(); }, []);
```

This pattern is duplicated 13 times. No caching, no deduplication, no error handling (errors from `Promise.all` are silently swallowed). If you open the Sprints panel, it fetches tasks, products, and developers — the same data already fetched by the Tasks panel — all over again.

**Repeated fetch of the same base data:** `listProducts()` is called independently in at least 7 different panels. `listDevelopers()` is called in at least 4 panels. This means opening multiple panels makes redundant database calls.

**Fix:** Adopt React Query (already installed) with a `QueryClientProvider`:
```tsx
// Fetch once, reuse everywhere:
const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: listProducts });
const { data: developers = [] } = useQuery({ queryKey: ['developers'], queryFn: listDevelopers });
// Cached for 5 minutes by default, no redundant calls
```

### 2.4 File Organization

The `lib/` folder has a good separation of API concerns by domain (api.ts, api-sprints.ts, api-comments.ts, api-wiki.ts). However, the main `api.ts` handles 8 different resource types in one file (products, tasks, developers, feedback, research, versions, deployments, environments, releases, analytics). This file is 213 lines and will grow larger over time. Consider splitting into `api-products.ts`, `api-tasks.ts`, `api-deployments.ts`, etc.

### 2.5 AppLayout.tsx — God Component

`AppLayout.tsx` is 349 lines and manages:
- Navigation state (`activeTab`)
- Sidebar collapsed/expanded state
- Dark mode state and persistence
- Session timer display
- Permission-based nav item filtering
- Panel rendering logic via a `switch` statement
- Inline `CollapsibleGroup` and `NavButton` sub-components

This violates the Single Responsibility Principle. Recommended split:
- `Sidebar.tsx` — sidebar UI and navigation
- `AppHeader.tsx` — top header bar
- `PanelRouter.tsx` — the switch statement that renders panels
- Keep `AppLayout.tsx` thin as a shell that composes the above

---

## Phase 3: Security Review

### 3.1 Authentication

Authentication uses Supabase Auth (JWT-based). This is industry-standard and secure. The `AuthContext` correctly subscribes to auth state changes and re-fetches the user profile on session change.

**Issue — Race condition in AuthContext:**

```tsx
// AuthContext.tsx lines 50-72
// Both of these run simultaneously on mount:
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  async (_event, session) => {
    // ...
    if (session?.user) {
      setTimeout(() => fetchProfile(session.user.id), 0);  // runs fetchProfile
    }
    setLoading(false);
  }
);

supabase.auth.getSession().then(({ data: { session } }) => {
  // ...
  if (session?.user) fetchProfile(session.user.id);  // ALSO runs fetchProfile
  setLoading(false);  // setLoading called TWICE
});
```

On initial load with an existing session, `fetchProfile` is called twice (once from `getSession`, once from `onAuthStateChange`). The `setLoading(false)` is also called twice. This is a harmless race in practice (Supabase returns the same data), but it is wasteful and can cause subtle bugs. The pattern should be simplified to rely solely on `onAuthStateChange`.

### 3.2 Role-Based Access Control (RBAC) — Dual System Mismatch

There are **two separate role systems** that can get out of sync:

1. `profiles.role` — a plain TEXT column, used by the frontend `AuthContext` and the `can()` function
2. `user_roles` table — a properly typed `app_role` ENUM, used by all Supabase RLS policies

The frontend reads from `profiles.role` to determine what to show/hide. The database uses `user_roles` for actual data access enforcement. If an admin manually changes a user's `profiles.role` to `admin` but forgets to update `user_roles`, the user will see admin UI elements but all write operations will be blocked by RLS. The reverse creates a user who can write to the DB but sees a viewer interface.

**Fix:** Consolidate to one system. Derive `profiles.role` from `user_roles` via a view or trigger, or drop one entirely.

### 3.3 Developer Role RLS Overpermission — Bug

In the first migration, there is this RLS policy:
```sql
CREATE POLICY "Developers can update own tasks" ON public.tasks 
  FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'developer'));
```

The policy name says "own tasks" but the condition `has_role(auth.uid(), 'developer')` allows **any developer to update any task**, not just tasks assigned to them. A developer can change the status, priority, description, or even re-assign any task in the system.

**Fix:**
```sql
-- Only allow developers to update tasks assigned to them
CREATE POLICY "Developers can update own tasks" ON public.tasks 
  FOR UPDATE TO authenticated 
  USING (
    assigned_to IN (
      SELECT id FROM public.developers WHERE user_id = auth.uid()
    )
  );
```

### 3.4 Missing Foreign Key Constraints — Database Integrity Risk

Several tables added in later migrations are missing `REFERENCES` clauses:

```sql
-- These columns reference other tables but have NO FOREIGN KEY constraint:
-- wiki_pages.space_id   → should REFERENCES wiki_spaces(id)
-- wiki_pages.parent_id  → should REFERENCES wiki_pages(id)
-- wiki_page_versions.page_id → should REFERENCES wiki_pages(id)
-- wiki_page_comments.page_id → should REFERENCES wiki_pages(id)
-- task_comments.task_id → should REFERENCES tasks(id)
-- task_subtasks.task_id → should REFERENCES tasks(id)
-- sprints.created_by    → should REFERENCES auth.users(id)
```

Without these, deleting a wiki space will **not** cascade-delete its pages, leaving orphaned records. Deleting a task will **not** remove its comments or subtasks. This will cause data corruption over time.

**Fix — add a migration:**
```sql
ALTER TABLE public.wiki_pages ADD CONSTRAINT fk_wiki_pages_space FOREIGN KEY (space_id) REFERENCES public.wiki_spaces(id) ON DELETE CASCADE;
ALTER TABLE public.wiki_pages ADD CONSTRAINT fk_wiki_pages_parent FOREIGN KEY (parent_id) REFERENCES public.wiki_pages(id) ON DELETE SET NULL;
ALTER TABLE public.task_comments ADD CONSTRAINT fk_task_comments_task FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE public.task_subtasks ADD CONSTRAINT fk_task_subtasks_task FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
ALTER TABLE public.wiki_page_versions ADD CONSTRAINT fk_wiki_versions_page FOREIGN KEY (page_id) REFERENCES public.wiki_pages(id) ON DELETE CASCADE;
ALTER TABLE public.wiki_page_comments ADD CONSTRAINT fk_wiki_comments_page FOREIGN KEY (page_id) REFERENCES public.wiki_pages(id) ON DELETE CASCADE;
```

### 3.5 `environments.env_vars_encrypted` — Misleading Column Name

The column is named `env_vars_encrypted` implying its contents are encrypted, but Supabase does not automatically encrypt PostgreSQL TEXT columns. The data is stored in plaintext. If someone with database access (or a compromised Supabase service role key) reads this column, they see raw environment variables including API keys, passwords, and secrets.

**Fix:** Either use Supabase Vault for secret storage, encrypt values application-side before insertion, or rename the column to `env_vars_notes` to avoid giving a false sense of security.

### 3.6 Session Timer Is Cosmetic Only

```tsx
// useSessionTimer.ts
export function useSessionTimer(minutes = 30) {
  const [secs, setSecs] = useState(minutes * 60);
  useEffect(() => {
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [minutes]);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}
```

This is purely a UI countdown. When it reaches 0:00, nothing happens — no sign-out, no warning, no session invalidation. A user can simply refresh the page to reset it to 30:00. This gives a false impression of security-conscious session management.

**Fix:** Wire the timer to actually call `signOut()` when it reaches zero, and reset it on user activity (mouse/keyboard events).

---

## Phase 4: Performance Review

### 4.1 No Caching — Redundant Database Calls

This is the biggest performance issue. Every panel independently fetches the same shared data:

| Data | Panels That Fetch It Independently |
|---|---|
| `listProducts()` | Dashboard, Tasks, Sprints, Deployments, Versions, Environments, Releases, My Queue |
| `listDevelopers()` | Tasks, Sprints, My Queue, Team |
| `listTasks()` | Tasks, Sprints, My Queue, Dashboard (via analytics) |

Opening Dashboard → Tasks → Sprints triggers approximately 12 separate database round-trips for data that could be shared. React Query with its default 5-minute stale time would eliminate virtually all of these redundant calls.

### 4.2 Whole-Table Fetches With No Pagination

```tsx
// api.ts — fetches ALL tasks with no limit
export const listTasks = async (filters?) => {
  let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });
  ...
  const { data, error } = await query;
  return data || [];
};
```

With a growing dataset, this will return thousands of rows to the browser. The same applies to `listProducts`, `listVersions`, `listDeployments`, and others. None have pagination or row limits.

**Fix:** Add `.range(0, 49)` for paginated fetching, and build UI pagination or infinite scroll.

### 4.3 Dashboard Fetches All Deployments, Displays 6

```tsx
// DashboardPanel.tsx
Promise.all([getAnalytics(), listDeployments(), listProducts()])
  .then(([s, d, p]) => { setDeploys(d.slice(0, 6)); ... })
```

`listDeployments()` fetches ALL deployments from the database (no limit), then immediately discards all but 6 with `.slice(0, 6)`. This should be `listDeployments({ limit: 6 })` with the limit applied at the query level.

**Fix:**
```tsx
// api.ts
export const listDeployments = async (filters?, limit?: number) => {
  let query = supabase.from('deployments').select('*').order('created_at', { ascending: false });
  if (limit) query = query.limit(limit);
  ...
};

// DashboardPanel.tsx
listDeployments(undefined, 6)
```

### 4.4 `getAnalytics()` — 5 Parallel Database Calls Per Dashboard Load

```tsx
const [products, tasks, versions, deployments, developers] = await Promise.all([
  supabase.from('products').select('id, name, status, priority_score, current_version, customer_count'),
  supabase.from('tasks').select('id, status, priority, due_date'),
  supabase.from('versions').select('id'),
  supabase.from('deployments').select('id, status, created_at, environment'),
  supabase.from('developers').select('id').eq('active', true),
]);
```

Every dashboard load makes 5 separate round-trips. This should be a single Supabase database function (RPC) that computes all analytics server-side and returns one response.

### 4.5 Every Mutation Triggers a Full Refetch

```tsx
// TasksPanel.tsx — after any save/status change:
const doSave = async () => {
  ...
  load();  // refetches ALL tasks + products + developers + sprints
};
const doStatusChange = async (id: string, status: string) => {
  ...
  load();  // refetches ALL data just to update one status field
};
```

Changing a single task's status triggers a full reload of 4 data sets. With React Query, this would be an optimistic update — the UI updates instantly and syncs in the background.

---

## Phase 5: Database Review

### 5.1 Table Structure

The schema is generally well-designed for an SPLM application. Core entities (products, tasks, developers, versions, deployments, environments, releases) are properly separated into distinct tables. `updated_at` triggers are consistently applied. UUID primary keys are used throughout.

### 5.2 Missing Indexes

The migrations create no explicit indexes beyond the automatic primary key index. For a table like `tasks`, the following queries happen frequently but have no supporting index:

```sql
-- Frequent queries with no index support:
SELECT * FROM tasks WHERE product_id = $1;      -- No index on product_id
SELECT * FROM tasks WHERE assigned_to = $1;     -- No index on assigned_to
SELECT * FROM tasks WHERE sprint_id = $1;       -- No index on sprint_id
SELECT * FROM task_comments WHERE task_id = $1; -- No index on task_id
SELECT * FROM wiki_pages WHERE space_id = $1;   -- No index on space_id
```

**Fix — add to a new migration:**
```sql
CREATE INDEX idx_tasks_product_id ON public.tasks(product_id);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_sprint_id ON public.tasks(sprint_id);
CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX idx_wiki_pages_space_id ON public.wiki_pages(space_id);
CREATE INDEX idx_deployments_product_id ON public.deployments(product_id);
CREATE INDEX idx_versions_product_id ON public.versions(product_id);
```

### 5.3 Denormalization — TEXT Arrays for Relationships

Two tables store relationships as comma-separated text:
```sql
versions.tasks_included TEXT DEFAULT ''   -- comma-separated task IDs
releases.products_included TEXT DEFAULT '' -- comma-separated product IDs
```

This is an antipattern. You cannot efficiently query "which version includes task X?" or "which releases include product Y?". You cannot enforce referential integrity. Filtering and joining are done in application code, not the database.

**Fix:** Create proper junction tables:
```sql
CREATE TABLE version_tasks (version_id UUID REFERENCES versions(id), task_id UUID REFERENCES tasks(id), PRIMARY KEY (version_id, task_id));
CREATE TABLE release_products (release_id UUID REFERENCES releases(id), product_id UUID REFERENCES products(id), PRIMARY KEY (release_id, product_id));
```

### 5.4 Untyped Status Fields

Most tables use plain `TEXT` for status, priority, type, and similar fields:
```sql
tasks.status TEXT DEFAULT 'backlog'   -- Could be anything
tasks.priority TEXT DEFAULT 'medium'  -- Could be anything
products.status TEXT DEFAULT 'active' -- Could be anything
```

Invalid values like `'ACTIVE'`, `'In_Progress'`, or a typo `'baklog'` can be inserted without error. The first migration already creates an `app_role` ENUM which shows the pattern is understood but not applied consistently.

**Fix:** Add check constraints or convert to ENUMs:
```sql
ALTER TABLE public.tasks ADD CONSTRAINT chk_task_status CHECK (status IN ('backlog','assigned','in_progress','review','done','cancelled'));
ALTER TABLE public.tasks ADD CONSTRAINT chk_task_priority CHECK (priority IN ('critical','high','medium','low'));
```

### 5.5 `releases.checklist` as Raw Text

```sql
checklist TEXT DEFAULT '[ ] Code review complete
[ ] Unit tests passing
...'
```

The checklist is a raw markdown string. There is no way to query "how many releases have the security scan completed?" or calculate completion percentage at the database level. 

**Fix:** Store as JSONB:
```sql
checklist JSONB DEFAULT '[]'::jsonb
-- Example: [{"label": "Code review complete", "done": false}, ...]
```

---

## Phase 6: Frontend Review

### 6.1 Component Structure

The panel-based architecture is clean and consistent. Each panel is self-contained with its own data fetching, state, and UI. The `ui/` directory correctly contains only generic primitives (shadcn/ui components). Custom app-specific components sit in `components/` directly.

**Issues:**
- Panels are monolithic (150–300+ lines each) mixing data fetching, business logic, and rendering. Each panel should be decomposed into a data-fetching container and one or more pure presentational components.
- Form state uses `useState<any>(null)` with a single object that represents both "no form open" (`null`) and "form open" (an object). The null check renders the form as a full-page replacement of the panel, which is an unusual UX pattern — most modern UIs use modals or slide-over drawers for forms.

### 6.2 State Management

The app uses only local `useState`. There is no global state manager. React Query is installed but a `QueryClientProvider` is never added to `App.tsx` or `main.tsx`, so it cannot be used by any component. The `@tanstack/react-query` package is dead weight in its current state.

**Fix — add to `main.tsx`:**
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
```

### 6.3 Panel Navigation Is Not URL-Based

All navigation is managed via `setActiveTab(item.id)` in `AppLayout.tsx`. This means:
- The browser URL never changes when navigating between panels
- Users cannot bookmark a specific panel
- The browser Back button does not work within the app
- Sharing a direct link to the Sprints or Wiki panel is impossible

**Fix:** Use React Router's nested routes, replacing the `switch(activeTab)` pattern:
```tsx
// App.tsx
<Route path="/" element={<AppLayout />}>
  <Route index element={<DashboardPanel />} />
  <Route path="tasks" element={<TasksPanel />} />
  <Route path="sprints" element={<SprintsPanel />} />
  ...
</Route>
```

### 6.4 Non-Functional UI Elements

The following UI elements appear interactive but do nothing:

- **Search button** (header) — shows `⌘K` shortcut hint but has no `onClick` handler and no search functionality
- **Bell (notifications) button** (header) — shows a red notification dot but no `onClick` handler
- **Help button** (header) — no `onClick` handler

These create user confusion. They should either be implemented or removed.

### 6.5 Unused Installed Packages

The following packages appear in `package.json` but are not used in the application:

| Package | Purpose | Status |
|---|---|---|
| `@tanstack/react-query` | Server state caching | Installed, never set up |
| `react-hook-form` | Form state management | Installed, never used |
| `zod` | Schema validation | Installed, never used |
| `next-themes` | Theme management | Installed, `ThemeProvider` never used |

Dark mode is implemented by directly manipulating `document.documentElement.classList` instead of using `next-themes`. The login form uses raw `useState` instead of React Hook Form + Zod validation.

---

## Phase 7: Bug & Risk Identification

### Bug 1 — `selectedTask` Goes Stale After Refresh

```tsx
// TasksPanel.tsx
onRefresh={() => { load(); const updated = tasks.find(t => t.id === selectedTask.id); if (updated) setSelectedTask(updated); }}
```

`tasks` here is a stale closure reference to the state before `load()` has resolved. The `find()` will always look in the old task list, so `selectedTask` in the drawer will never update correctly after a refresh. The updated data is not yet in `tasks` when this runs.

**Fix:** After `load()` resolves, re-derive `selectedTask` from the new state inside the `.then()` callback.

### Bug 2 — `useSessionTimer` Dependency Array Issue

```tsx
useEffect(() => {
  const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
  return () => clearInterval(t);
}, [minutes]);  // 'minutes' never changes, but if it did, timer would reset
```

If `minutes` prop changes (unlikely but possible), the timer restarts from full. This is minor but the ESLint exhaustive-deps rule would flag this. The real bug is that the timer resets to full on every page refresh.

### Bug 3 — No Error Handling in Data Load

```tsx
Promise.all([listTasks(), listProducts(), listDevelopers(), listSprints()])
  .then(([t, p, d, s]) => { ... })
  .finally(() => setLoading(false));
  // No .catch() — errors are silently swallowed
```

If any API call fails (network error, auth expiry, RLS violation), the panel shows a loading skeleton forever (since `setLoading(false)` is called in `finally`, but no error state is set). The user gets no feedback that something went wrong.

**Fix:**
```tsx
const [error, setError] = useState<string | null>(null);
Promise.all([...])
  .then(([t, p, d, s]) => { setTasks(t); ... })
  .catch(err => setError(err.message))
  .finally(() => setLoading(false));
// Then render an error state when error !== null
```

### Bug 4 — No Error Boundaries

There are no React `ErrorBoundary` components anywhere. An unhandled exception in any component (e.g., trying to call `.map()` on `null` if an API returns unexpected data) will crash the entire application, showing a blank white screen with no user-visible error message.

**Fix:** Add at minimum one top-level `ErrorBoundary` in `App.tsx` and ideally one per panel.

### Bug 5 — `parseInt` Without Fallback on Hour Input

```tsx
onChange={e => setForm((f: any) => ({ ...f, estimated_hours: parseInt(e.target.value) || 4 }))}
```

`parseInt('')` returns `NaN`, `NaN || 4` returns `4` — this fallback works. However, `parseInt('1.5')` returns `1` silently, discarding the decimal. Use `parseFloat` instead for hour inputs, or validate that the value is a valid number.

---

## Phase 8: Improvement Suggestions

### Critical Issues (Must Fix)

**C1 — Replace all `any` types with proper TypeScript interfaces**
The Supabase auto-generated `types.ts` already has full schema types. Use them. This is the single change that would have the largest positive impact on code reliability and maintainability.

**C2 — Add missing foreign key constraints to Wiki and Sprint tables**
Without these, deleting a wiki space leaves orphaned pages. Deleting tasks leaves orphaned comments and subtasks. Run the migration shown in section 3.4.

**C3 — Fix the "Developers can update own tasks" RLS policy**
The current policy allows any developer to modify any task. Fix as shown in section 3.3. This is a genuine security bug.

**C4 — Wire up `QueryClientProvider` or remove React Query**
Either set up React Query properly (recommended) or remove the package. Currently it's installed but inert, which is confusing.

**C5 — Add error handling to all `Promise.all` data fetches**
Every panel silently swallows API errors. Add `.catch()` handlers and render user-visible error states.

### Medium Issues (Should Improve)

**M1 — Convert panel navigation to URL-based routing**
Use React Router nested routes so users can share links and use the browser's back button.

**M2 — Add pagination to all list queries**
`listTasks`, `listProducts`, `listDeployments`, `listVersions` should accept `page` and `pageSize` parameters and implement server-side pagination.

**M3 — Fix the stale closure bug in TasksPanel `onRefresh`**
The `selectedTask` in the drawer does not update correctly after data refresh.

**M4 — Resolve the dual RBAC system (profiles.role vs. user_roles)**
Having two role systems that must stay in sync is error-prone. Consolidate to one.

**M5 — Create junction tables for versions.tasks_included and releases.products_included**
Replace the comma-separated text columns with proper relational tables.

**M6 — Add database indexes for frequent query patterns**
Add the indexes listed in section 5.2. This will become critical as data grows.

**M7 — Make the session timer functional**
Either auto-sign-out on expiry with activity-based reset, or remove the timer UI if it won't be implemented.

**M8 — Rename `environments.env_vars_encrypted` or actually encrypt the data**
The column name is misleading and creates a false sense of security.

### Minor Issues (Nice to Have)

**m1 — Rename cryptic filter variables** (`fS` → `filterStatus`, `fP` → `filterProduct`, etc.)

**m2 — Set up React Hook Form + Zod for form validation** — Both are already installed. The login form does no password length validation. Task and product forms have no client-side validation beyond checking for empty required fields.

**m3 — Use `next-themes` ThemeProvider** instead of directly manipulating `document.documentElement.classList`.

**m4 — Break up `AppLayout.tsx`** into `Sidebar.tsx`, `AppHeader.tsx`, and a panel router.

**m5 — Implement or remove the Search, Notifications, and Help buttons** in the header.

**m6 — Add a real test suite** — The current test file (`expect(true).toBe(true)`) provides zero coverage. Prioritize testing `splm-utils.ts` (semverBump, fmtDate), `AuthContext.tsx` (can(), permission logic), and key API functions.

**m7 — Add React Error Boundaries** at app level and per panel.

**m8 — Add database check constraints** on TEXT status/priority/type fields.

**m9 — Create a Supabase RPC for analytics** to replace the 5-call `getAnalytics()` function.

---

## Phase 9: Refactoring Plan

A step-by-step approach that avoids breaking existing functionality:

**Step 1 — Foundation (1–2 days, zero risk)**
- Add `QueryClientProvider` to `main.tsx`
- Add database indexes migration
- Add missing FK constraints migration
- Fix `environments.env_vars_encrypted` naming
- Rename cryptic filter variables

**Step 2 — Type Safety (2–3 days, low risk)**
- Create a `src/types/index.ts` file with typed interfaces derived from `Database` types
- Replace `any` in API functions first (they're simple and isolated)
- Replace `any` in `useState` declarations panel by panel, starting with the smallest panel
- Enable stricter ESLint TypeScript rules

**Step 3 — Error Handling (1 day, low risk)**
- Add `.catch()` to every `Promise.all` data load
- Add an `error` state to each panel and render an error message
- Add a top-level `ErrorBoundary` in `App.tsx`

**Step 4 — Security Fixes (half day, critical)**
- Fix the developer RLS policy (migration)
- Consolidate `profiles.role` and `user_roles` into one authoritative source

**Step 5 — Data Layer Upgrade (2–4 days, medium risk)**
- Convert each panel's data fetching to React Query `useQuery` hooks, one panel at a time
- Start with `DashboardPanel` (most complex, highest impact)
- Convert mutations to `useMutation` — this automatically handles optimistic updates and invalidation

**Step 6 — URL-Based Navigation (1 day, medium risk)**
- Add nested routes to `App.tsx`
- Replace `activeTab` state with `useNavigate` and `useParams`
- Test all deep-link scenarios

**Step 7 — Form Validation (1–2 days, low risk)**
- Add Zod schemas for each entity (Task, Product, Developer, Sprint, etc.)
- Wire React Hook Form into one panel's form as a proof of concept
- Roll out to remaining panels

**Step 8 — Component Decomposition (ongoing)**
- Split `AppLayout.tsx` into `Sidebar`, `AppHeader`, panel router
- Break large panels into smaller components with clear responsibilities

---

## Phase 10: Final Summary

### Overall Ratings

| Dimension | Rating | Notes |
|---|---|---|
| **Code Quality** | 5.5 / 10 | Good structure, clean separation of API layer, but pervasive `any` types, cryptic naming, missing error handling, and duplicated data-loading patterns significantly reduce quality |
| **Security** | 6.5 / 10 | Supabase RLS is correctly applied to most tables and provides solid protection. Points deducted for: RLS developer policy bug (any developer updates any task), dual RBAC system risk, cosmetic-only session timer, and misleading encrypted column name |
| **Scalability** | 4.5 / 10 | No caching (React Query not wired up), no pagination, whole-table fetches, 5 parallel DB calls for analytics, and full refetch after every mutation will not scale beyond a few hundred records per table. Architecture needs React Query and pagination before production load |
| **Maintainability** | 5 / 10 | Consistent file organization and API separation are positives. Negatives: `any` types everywhere prevent TypeScript from helping, 3 unused packages add confusion, monolithic panels are hard to test, zero meaningful test coverage, and non-functional UI elements (search, notifications, help) signal incomplete implementation |

### Key Strengths
- Supabase with Row Level Security is an excellent and secure architectural choice for this type of application
- The API layer is cleanly separated into `lib/api*.ts` files — easy to understand and modify
- The `StatusBadge` and utility function design is clean and reusable
- shadcn/ui provides consistent, accessible UI components out of the box
- Database `updated_at` triggers and the `handle_new_user` trigger are well-implemented automation

### Top 3 Priority Actions
1. **Fix the developer RLS policy bug** — this is the only genuine security vulnerability with real data access implications
2. **Replace `any` types with the existing Supabase-generated types** — immediate code safety improvement with no architecture change needed
3. **Wire up React Query and add error handling** — fixes silent data-fetch failures and eliminates the most significant performance and reliability issues simultaneously

---

*This review was generated by automated analysis of all source files, migrations, and configuration. All line number references and code examples are drawn directly from the project files.*
