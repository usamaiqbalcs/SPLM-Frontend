# ZenaTech SPLM Platform

## Software Product Lifecycle Manager

A comprehensive enterprise-grade Software Product Lifecycle Management (SPLM) platform built for managing multi-product software companies. Combines project management (Jira-like), knowledge management (Confluence-like), deployment operations, and analytics in a single unified interface.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Features](#features)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [Authentication & Authorization](#authentication--authorization)
6. [Migration Scripts](#migration-scripts)
7. [Environment Variables](#environment-variables)
8. [Setup & Installation](#setup--installation)
9. [Key Components](#key-components)
10. [API Layer](#api-layer)
11. [Design System](#design-system)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript 5, Vite 5 |
| **Styling** | Tailwind CSS v3, shadcn/ui components, CSS custom properties (HSL design tokens) |
| **State** | React Query (TanStack Query v5), React Context |
| **Routing** | React Router DOM v6 |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime, Row Level Security) |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **Forms** | React Hook Form + Zod validation |

---

## Features

### 📊 Dashboard
- System-wide metrics: total products, active tasks, deployments, team capacity
- Priority distribution charts, sprint velocity, recent activity feed
- Quick-action shortcuts

### 📦 Products
- Full CRUD for software products with metadata (tech stack, APIs, customer count, market category)
- Priority scoring, version tracking, update cadence management

### ✅ Tasks (Jira-like)
- Task management with statuses: backlog → in_progress → review → done
- **Kanban Board** — drag-and-drop columns by status
- **Task Detail Drawer** — side panel with full task editing
- **Subtasks** — checklist-style sub-items per task
- **Story Points** — estimation for sprint planning
- **Task Comments** — threaded activity log with real-time updates
- Filtering by product, assignee, priority, type, status
- Bulk operations and AI priority scoring

### 🏃 Sprints
- Sprint creation with goals, start/end dates
- Sprint backlog management (assign tasks to sprints)
- Velocity tracking and burndown metrics
- Sprint statuses: planning → active → completed

### 📝 Wiki (Confluence-like)
- **Spaces** — organize pages into themed workspaces
- **Hierarchical Pages** — nested parent/child page trees
- **Markdown Editor** — split-pane editor with live preview
- **Version History** — automatic snapshots on every edit, restore previous versions
- **Page Comments** — threaded discussions on each page
- **Document Templates** — 5 built-in templates (Meeting Notes, Project Plan, API Docs, Retrospective, Decision Log)
- Real-time collaborative updates via Supabase Realtime

### 🔀 Version Control
- Semantic versioning (major.minor.patch) per product
- Changelogs, release notes, breaking changes documentation
- Git branch/commit tracking
- Version statuses: planned → in_progress → testing → released

### 🚀 Deployments
- Deployment pipeline tracking per product/environment
- Deploy types: full, hotfix, rollback
- Status tracking: pending → in_progress → success → failed → rolled_back
- Deploy logs, failure reasons, commit SHA tracking

### 🌐 Environments
- Server configuration per product (dev, staging, production)
- Git repo/branch mapping, deploy paths, health check URLs
- Environment variable management

### 📅 Releases
- Release planning with checklists (11-item default checklist)
- Multi-product release coordination
- Release types: planned, hotfix, emergency
- Status workflow: planned → in_progress → completed → cancelled

### 💬 Feedback
- Customer/stakeholder feedback ingestion
- Sentiment analysis (positive/neutral/negative)
- Urgency scoring, channel tracking
- Product linkage

### 🔬 Research
- Market & technology research tracking
- Urgency levels, affected products mapping
- AI analysis field for insights
- Source URL tracking

### 👥 Team (Developers)
- Developer profiles with skills, office location
- Capacity planning (hours/week vs current load)
- Active/inactive status management

### 📋 My Queue
- Personal work queue showing tasks assigned to the logged-in user
- Filtered view of active assignments

### 🔒 Authentication & RBAC
- Email/password authentication via Supabase Auth
- Four roles: admin, manager, developer, viewer
- Permission-based UI rendering (nav items hidden based on role)
- Row Level Security on all tables

### 🎨 UI/UX
- Dark/light mode toggle with localStorage persistence
- Collapsible sidebar with tooltips when collapsed
- Session timer in sidebar
- Responsive layout with mobile support
- Loading skeletons, toast notifications, confirmation dialogs

---

## Project Structure

```
├── index.html                          # Entry HTML
├── vite.config.ts                      # Vite configuration
├── tailwind.config.ts                  # Tailwind CSS configuration with design tokens
├── tsconfig.json                       # TypeScript config
├── components.json                     # shadcn/ui configuration
├── postcss.config.js                   # PostCSS config
├── supabase/
│   ├── config.toml                     # Supabase project config
│   └── migrations/                     # SQL migration files (5 migrations)
├── src/
│   ├── main.tsx                        # App entry point (QueryClient, AuthProvider, Router)
│   ├── App.tsx                         # Root router component
│   ├── App.css                         # Global styles
│   ├── index.css                       # Tailwind directives + CSS custom properties (design tokens)
│   ├── contexts/
│   │   └── AuthContext.tsx             # Authentication context (user, session, profile, RBAC)
│   ├── pages/
│   │   ├── Index.tsx                   # Main page (auth gate → LoginPage or AppLayout)
│   │   ├── LoginPage.tsx               # Login/signup form
│   │   └── NotFound.tsx                # 404 page
│   ├── components/
│   │   ├── AppLayout.tsx               # Main layout (sidebar, header, content area, nav)
│   │   ├── NavLink.tsx                 # Navigation link component
│   │   ├── StatusBadge.tsx             # Status indicator badge
│   │   ├── panels/
│   │   │   ├── DashboardPanel.tsx      # Dashboard with metrics, charts, activity feed
│   │   │   ├── ProductsPanel.tsx       # Products CRUD table
│   │   │   ├── TasksPanel.tsx          # Tasks list with filters + Kanban toggle
│   │   │   ├── KanbanBoard.tsx         # Drag-and-drop Kanban board
│   │   │   ├── TaskDetailDrawer.tsx    # Side drawer for task editing (subtasks, comments)
│   │   │   ├── SprintsPanel.tsx        # Sprint planning & management
│   │   │   ├── WikiPanel.tsx           # Wiki spaces, pages, editor, versions, comments
│   │   │   ├── MyQueuePanel.tsx        # Personal task queue
│   │   │   ├── DevelopersPanel.tsx     # Team management
│   │   │   ├── FeedbackPanel.tsx       # Feedback management
│   │   │   ├── ResearchPanel.tsx       # Research tracking
│   │   │   ├── VersionControlPanel.tsx # Semantic versioning
│   │   │   ├── DeploymentsPanel.tsx    # Deployment pipeline
│   │   │   ├── EnvironmentsPanel.tsx   # Environment configuration
│   │   │   └── ReleasesPanel.tsx       # Release planning
│   │   └── ui/                         # 50+ shadcn/ui components (button, dialog, table, etc.)
│   ├── hooks/
│   │   ├── useSessionTimer.ts          # Session duration timer
│   │   ├── use-mobile.tsx              # Mobile breakpoint detection
│   │   └── use-toast.ts               # Toast notification hook
│   ├── lib/
│   │   ├── api.ts                      # Core API functions (products, tasks, developers, etc.)
│   │   ├── api-sprints.ts             # Sprint & subtask API functions
│   │   ├── api-comments.ts            # Task comments API
│   │   ├── api-wiki.ts                # Wiki spaces, pages, versions, comments API
│   │   ├── wiki-templates.ts          # 5 document templates for wiki
│   │   ├── splm-utils.ts             # Utility functions (priority colors, status maps)
│   │   └── utils.ts                   # General utilities (cn, classname merging)
│   └── integrations/supabase/
│       ├── client.ts                   # Supabase client instance (auto-generated)
│       └── types.ts                    # Database TypeScript types (auto-generated)
```

---

## Database Schema

### Tables

#### `profiles`
Stores user profile data linked to Supabase Auth users.
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | References auth.users, UNIQUE |
| name | TEXT | Display name |
| email | TEXT | User email |
| role | TEXT | UI role: admin, manager, developer, viewer |
| active | BOOLEAN | Account active status |
| created_at, updated_at | TIMESTAMPTZ | Timestamps |

#### `user_roles`
RBAC roles table (separate from profiles for security).
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | References auth.users |
| role | app_role ENUM | admin, manager, developer, viewer |

#### `products`
Software products being managed.
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| name | TEXT | Product name |
| description | TEXT | Product description |
| status | TEXT | active, maintenance, sunset, archived |
| priority_score | NUMERIC(5,2) | 0-10 priority |
| current_version | TEXT | Semantic version string |
| update_cadence | TEXT | quarterly, monthly, etc. |
| market_category | TEXT | Enterprise SaaS, etc. |
| tech_stack | TEXT | Comma-separated technologies |
| external_apis | TEXT | External API integrations |
| customer_count | INTEGER | Number of customers |
| created_by | UUID | Creator reference |

#### `tasks`
Work items (features, bugs, improvements).
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| product_id | UUID | FK → products |
| title | TEXT | Task title |
| description | TEXT | Task description |
| type | TEXT | feature, bug, improvement, research, security |
| priority | TEXT | critical, high, medium, low |
| status | TEXT | backlog, in_progress, review, done |
| assigned_to | UUID | FK → developers |
| sprint_id | UUID | FK → sprints (nullable) |
| story_points | INTEGER | Estimation points |
| due_date | DATE | Due date |
| estimated_hours | NUMERIC(5,1) | Hour estimate |
| source | TEXT | manual, feedback, research, ai |
| ai_priority_score | NUMERIC(5,2) | AI-calculated priority |
| created_by | UUID | Creator reference |

#### `sprints`
Sprint planning periods.
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| name | TEXT | Sprint name |
| goal | TEXT | Sprint goal |
| status | TEXT | planning, active, completed |
| start_date, end_date | DATE | Sprint duration |
| created_by | UUID | Creator reference |

#### `task_comments`
Threaded comments on tasks (realtime enabled).
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| task_id | UUID | FK → tasks |
| user_id | UUID | Comment author |
| content | TEXT | Comment body |

#### `task_subtasks`
Checklist sub-items within tasks.
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| task_id | UUID | FK → tasks |
| title | TEXT | Subtask title |
| completed | BOOLEAN | Completion status |
| sort_order | INTEGER | Display order |

#### `developers`
Team member profiles.
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| name, email | TEXT | Identity |
| role | TEXT | developer, lead, architect, etc. |
| skills | TEXT | Comma-separated skills |
| office_location | TEXT | Office location |
| capacity_hours_week | INTEGER | Weekly capacity |
| current_load_hours | NUMERIC(5,1) | Current workload |
| active | BOOLEAN | Active status |

#### `feedback`
Customer/stakeholder feedback.
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| product_id | UUID | FK → products |
| channel | TEXT | manual, email, support, etc. |
| raw_content | TEXT | Feedback content |
| sentiment | TEXT | positive, neutral, negative |
| urgency_score | INTEGER | 1-10 urgency |
| submitted_by | UUID | Submitter |

#### `research`
Market & technology research entries.
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| topic | TEXT | Research topic |
| source_url | TEXT | Source link |
| urgency | TEXT | low, medium, high, critical |
| affected_products | TEXT | Impacted products |
| ai_analysis | TEXT | AI analysis content |

#### `versions`
Semantic version tracking per product.
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| product_id | UUID | FK → products |
| version | TEXT | Semantic version (e.g., 2.1.0) |
| version_type | TEXT | major, minor, patch |
| status | TEXT | planned, in_progress, testing, released |
| title, release_notes, changelog, breaking_changes | TEXT | Documentation |
| git_branch, git_commit | TEXT | Git references |
| is_current | BOOLEAN | Current version flag |
| planned_date | DATE | Target release date |
| released_at | TIMESTAMPTZ | Actual release timestamp |

#### `deployments`
Deployment pipeline records.
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| product_id | UUID | FK → products |
| version | TEXT | Deployed version |
| environment | TEXT | development, staging, production |
| deploy_type | TEXT | full, hotfix, rollback |
| status | TEXT | pending, in_progress, success, failed, rolled_back |
| branch, commit_sha | TEXT | Git details |
| rollback_version, fail_reason, deploy_log | TEXT | Operational data |
| deployed_by | UUID | Deployer |

#### `environments`
Server/environment configuration.
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| product_id | UUID | FK → products |
| environment | TEXT | Environment name (unique per product) |
| server_host, server_url | TEXT | Server details |
| deploy_method | TEXT | ssh, ci_cd, manual |
| git_repo, git_branch, deploy_path | TEXT | Git/deploy config |
| health_check_url | TEXT | Health endpoint |

#### `releases`
Release planning and checklists.
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| name | TEXT | Release name |
| type | TEXT | planned, hotfix, emergency |
| status | TEXT | planned, in_progress, completed, cancelled |
| target_date | DATE | Target release date |
| checklist | TEXT | Multi-line checklist text |
| products_included | TEXT | Comma-separated product IDs |

#### `wiki_spaces`
Wiki workspace containers.
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| name | TEXT | Space name |
| description | TEXT | Space description |
| icon | TEXT | Emoji icon (default: 📁) |
| created_by | UUID | Creator |

#### `wiki_pages`
Wiki page content with hierarchy.
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| space_id | UUID | FK → wiki_spaces |
| parent_id | UUID | Self-referencing for nesting |
| title | TEXT | Page title |
| content | TEXT | Markdown content |
| is_template | BOOLEAN | Template flag |
| template_category | TEXT | Template category |
| sort_order | INTEGER | Display order |
| created_by, last_edited_by | UUID | User references |

#### `wiki_page_versions`
Page version history snapshots.
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| page_id | UUID | FK → wiki_pages |
| version_number | INTEGER | Version counter |
| title | TEXT | Page title at that version |
| content | TEXT | Content snapshot |
| edited_by | UUID | Editor |
| change_summary | TEXT | Change description |

#### `wiki_page_comments`
Discussion comments on wiki pages (realtime enabled).
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| page_id | UUID | FK → wiki_pages |
| user_id | UUID | Comment author |
| content | TEXT | Comment body |
| anchor | TEXT | Optional text anchor for inline comments |

### Enums

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'developer', 'viewer');
```

### Functions

```sql
-- Check if user has a specific role
public.has_role(_user_id UUID, _role app_role) RETURNS BOOLEAN

-- Check if user has any of the given roles
public.has_any_role(_user_id UUID, _roles app_role[]) RETURNS BOOLEAN

-- Auto-update updated_at column
public.update_updated_at_column() RETURNS TRIGGER

-- Auto-create profile + assign viewer role on signup
public.handle_new_user() RETURNS TRIGGER
```

### Realtime

The following tables have Supabase Realtime enabled:
- `task_comments`
- `wiki_pages`
- `wiki_page_comments`

---

## Authentication & Authorization

### Auth Flow
1. User signs up with email/password via Supabase Auth
2. `handle_new_user()` trigger auto-creates a `profiles` row and assigns `viewer` role in `user_roles`
3. On login, `AuthContext` fetches the profile and determines permissions
4. UI elements are conditionally rendered based on role permissions

### Role Permissions Matrix

| Permission | admin | manager | developer | viewer |
|-----------|-------|---------|-----------|--------|
| read | ✅ | ✅ | ✅ | ✅ |
| edit | ✅ | ✅ | ❌ | ❌ |
| config | ✅ | ❌ | ❌ | ❌ |
| users | ✅ | ❌ | ❌ | ❌ |
| reports | ✅ | ✅ | ✅ | ❌ |
| assign | ✅ | ✅ | ❌ | ❌ |
| override | ✅ | ✅ | ❌ | ❌ |
| deploy | ✅ | ✅ | ✅ | ❌ |
| release | ✅ | ✅ | ❌ | ❌ |

### Row Level Security (RLS)
All tables have RLS enabled. Policies use `has_role()` and `has_any_role()` security definer functions to check permissions without recursive policy lookups.

---

## Migration Scripts

Located in `supabase/migrations/`:

1. **`20260406092822_*.sql`** — Initial schema: all core tables (profiles, products, tasks, developers, feedback, research, versions, deployments, environments, releases, assign_log, user_roles), RLS policies, triggers, `handle_new_user()` function
2. **`20260406092835_*.sql`** — Tightens feedback INSERT policy to require `auth.uid() = submitted_by`
3. **`20260407132259_*.sql`** — Adds Jira features: `sprints` table, `task_comments` table, `task_subtasks` table, `story_points` and `sprint_id` columns on tasks, realtime for comments
4. **`20260407221613_*.sql`** — Adds Confluence features: `wiki_spaces`, `wiki_pages`, `wiki_page_versions`, `wiki_page_comments` tables with RLS and realtime
5. **`20260407221628_*.sql`** — Tightens wiki INSERT policies to require `auth.uid()` matching

---

## Environment Variables

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
VITE_SUPABASE_PROJECT_ID=<project-ref>
```

These are auto-configured when using Lovable Cloud. For local development, create a `.env` file with your Supabase project credentials.

---

## Setup & Installation

### Prerequisites
- Node.js 18+ or Bun
- A Supabase project (or use Lovable Cloud)

### Local Development

```bash
# Install dependencies
npm install
# or
bun install

# Run migrations against your Supabase project
# Apply each SQL file in supabase/migrations/ in order via Supabase Dashboard SQL Editor

# Start development server
npm run dev
# or
bun run dev

# Open http://localhost:8080
```

### Creating an Admin User

1. Sign up through the login page
2. In Supabase SQL Editor, promote the user:
```sql
-- Find the user ID
SELECT id, email FROM auth.users WHERE email = 'your@email.com';

-- Update profile role
UPDATE public.profiles SET role = 'admin' WHERE user_id = '<user-id>';

-- Add admin role to user_roles
INSERT INTO public.user_roles (user_id, role) VALUES ('<user-id>', 'admin');
```

---

## Key Components

### `AuthContext.tsx`
Central authentication provider. Manages user session, profile fetching, role-based permission checking via `can()` method, and sign in/up/out flows.

### `AppLayout.tsx`
Main application shell with:
- Collapsible sidebar with grouped navigation
- Header bar (search, notifications, dark mode, user badge)
- Session timer
- Content area rendering active panel

### Panel Components
Each module is a self-contained panel component in `src/components/panels/`:
- Fetches its own data via React Query
- Manages local UI state (modals, filters, sorting)
- Uses shadcn/ui components for consistent design

### API Layer (`src/lib/`)
- `api.ts` — Products, tasks, developers, feedback, research, versions, deployments, environments, releases, assign log
- `api-sprints.ts` — Sprints, subtasks CRUD
- `api-comments.ts` — Task comments CRUD
- `api-wiki.ts` — Wiki spaces, pages, versions, page comments CRUD

---

## Design System

### CSS Custom Properties (HSL)
Defined in `src/index.css` with light and dark mode variants:
- `--background`, `--foreground` — Base colors
- `--primary`, `--primary-foreground` — Brand colors (dark navy sidebar)
- `--accent`, `--accent-foreground` — Accent/highlight colors
- `--muted`, `--muted-foreground` — Subdued elements
- `--destructive` — Error/danger states
- `--card`, `--popover` — Surface colors
- `--border`, `--input`, `--ring` — Input/border colors
- `--sidebar-*` — Sidebar-specific tokens
- `--sky` — Accent blue for active indicators
- `--chart-1` through `--chart-5` — Chart color palette

### Tailwind Config
Extended with custom colors mapped to CSS variables, custom animations (`fade-in`, `slide-in`, `scale-in`, `glow`), and typography plugin.

---

## License

Proprietary — ZenaTech / Epazz Inc.
