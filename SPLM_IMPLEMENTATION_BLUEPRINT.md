# ZenaTech SPLM — Implementation Blueprint
**Produced:** 2026-04-10  
**Engineer:** Senior Principal  
**Baseline coverage after AI-SDLC pass:** ~75% complete  
**This document target:** 100% implementation-ready across all 8 domains

---

## Executive Summary

After a full codebase audit, the project is in a strong state on the backend and a partially-migrated state on the frontend. The .NET 8 Clean Architecture backend is essentially complete (30+ services, 11 controllers, 11 AI-SDLC tables), the database has 9 migration scripts fully applied, and the frontend's Supabase auth and data calls have been replaced with JWT + a custom HTTP client. The remaining work is surgical and well-bounded.

**What is done:**
- Full .NET 8 backend — all services, repositories, controllers (except Versions and Environments)
- SQL Server schema migrations 01–09, including all AI-SDLC tables
- Frontend AuthContext rewritten for JWT (no Supabase auth)
- `apiClient.ts` base HTTP layer exists and is wired to api.ts as a shim
- All 22 panel components exist and import from `apiClient.ts`

**What is missing:**
- `main.tsx` — no `QueryClientProvider` (React Query is dead weight)
- `App.tsx` — no URL-based routing (still `activeTab` state)
- `apiClient.ts` — modules use `any` instead of typed DTOs
- Backend: `VersionsController` not found in any controller file
- Backend: `EnvironmentsController` not found in any controller file
- Backend: Canary PATCH endpoint on `DeploymentsController`
- Backend: Hangfire recurring KPI snapshot job
- Backend: Notification hook on workflow phase transitions
- Database patch 10: check constraints, junction tables, FK hardening

---

## 1. Corrected Architecture

### 1.1 Overview

```
┌────────────────────────────────────────────────────────┐
│  Browser — React 18.3 / TypeScript 5.8 / Vite 5.4 SWC │
│                                                        │
│  Auth: JWT in localStorage via AuthContext.tsx         │
│  State: TanStack Query v5 (QueryClientProvider)        │
│  Routing: React Router DOM v6 nested routes            │
│  UI: shadcn/ui + Radix + Tailwind 3.4                  │
│  Forms: React Hook Form + Zod                          │
│  Charts: Recharts                                      │
│  Notifications: Sonner                                 │
│  HTTP: apiClient.ts → netFetch (Fetch API + Bearer)    │
└───────────────────┬────────────────────────────────────┘
                    │ HTTPS   Bearer JWT
                    ▼
┌────────────────────────────────────────────────────────┐
│  ASP.NET Core 8 Web API                                │
│  Versioned: /api/v1/...                                │
│  Auth: JWT Bearer HS256 (JwtSettings in appsettings)   │
│  JSON: SnakeCaseLower (PropertyNamingPolicy)           │
│  Docs: Swagger / Swashbuckle 6.7                       │
│  Validation: FluentValidation 11.3 (auto-validation)   │
│  Background: Hangfire 1.8 + SQL Server storage         │
│  Logging: Serilog 8                                    │
│                                                        │
│  ── Controllers (API layer) ──────────────────────────  │
│  Auth, Products, Tasks, Developers, Analytics,         │
│  Sprints, Deployments, Releases, Feedback, Research,   │
│  Wiki, AiSdlc, [Versions★], [Environments★]           │
│                                                        │
│  ── Application layer ────────────────────────────────  │
│  Services: IProductService, ITaskService, ...          │
│  CQRS-lite: IXxxService (writes) + IXxxQueries (reads) │
│  DTOs: typed record types per domain                   │
│                                                        │
│  ── Domain layer ──────────────────────────────────────  │
│  30+ entities, enums, BaseEntity                       │
│  Persistence-ignorant (no EF references)               │
│                                                        │
│  ── Infrastructure layer ──────────────────────────────  │
│  AppDbContext (EF Core 8) — writes                     │
│  DapperContext — read-side multi-join queries          │
│  GenericRepository<T> + UnitOfWork                     │
│  AuthService (BCrypt.Net-Next), CurrentUserService     │
│  MockGitDiffService → swap via DI only                 │
└───────────────────┬────────────────────────────────────┘
                    │ EF Core / Dapper
                    ▼
┌────────────────────────────────────────────────────────┐
│  SQL Server (FAHAD_KHALIL\SQLEXPRESS2025)              │
│  Database: ZenaTechSPLM                                │
│  Schema: dbo (app), auth (users)                       │
│  Migrations: 01–09 applied, patch 10 pending           │
│  Hangfire tables: auto-created by Hangfire.SqlServer   │
└────────────────────────────────────────────────────────┘
```

★ = missing controllers, scaffolded in section 6.

### 1.2 Deleted Architecture (never reference again)

All of the following are eliminated. They must not appear in any new code:

| Obsolete | Replaced by |
|----------|-------------|
| Supabase client SDK | `apiClient.ts` → `netFetch` |
| `supabase.auth.*` | `AuthContext.tsx` → `/api/v1/auth/*` |
| `supabase.from('table')` | Domain-specific `Api` modules in apiClient.ts |
| Supabase Realtime | Hangfire polling or SignalR (future) |
| Row Level Security (PostgreSQL) | JWT + RBAC in ASP.NET Core (`[Authorize]` + role checks) |
| `supabase/migrations/` | `database/` numbered SQL scripts |
| `VITE_SUPABASE_URL` | `VITE_API_BASE_URL` |

---

## 2. Delivery Plan

Grouped into five phases from highest ROI to lowest risk of breaking existing functionality.

### Phase 1 — Foundation (2 days, near-zero risk)

- **F1-A**: Add `QueryClientProvider` to `main.tsx` — React Query becomes active
- **F1-B**: Write `src/types/splm.ts` — typed DTO interfaces for all 30+ entities, derived from .NET response shapes
- **F1-C**: Replace `any` in `apiClient.ts` modules (Tasks, Products, Developers, Analytics, Sprints, Deployments, Releases, Feedback, Research, Wiki) with types from `splm.ts`
- **F1-D**: SQL patch 10 — check constraints, FK hardening, missing indexes, junction tables

### Phase 2 — Backend Gap Closure (1 day)

- **B2-A**: `VersionsController` (missing) — GET list, GET by id, POST, PUT, DELETE
- **B2-B**: `EnvironmentsController` (missing) — GET by product, POST, PUT, DELETE
- **B2-C**: `PATCH /deployments/{id}/canary` — update canary fields on existing deployment
- **B2-D**: Hangfire recurring job — daily KPI snapshot (calls `GetKpiDashboardAsync` and persists)
- **B2-E**: Notification hook — `WorkflowAuditLog` creation triggers email/notification stub

### Phase 3 — Frontend Migration to React Query (3 days)

- **F3-A**: Convert all 13 SPLM panels to `useQuery` / `useMutation` patterns
- **F3-B**: Convert all 9 AI-SDLC panels to `useQuery` / `useMutation` patterns
- **F3-C**: Add error boundaries — one top-level `AppErrorBoundary`, one per panel group
- **F3-D**: Wire React Hook Form + Zod into all create/edit forms (one schema per entity)

### Phase 4 — URL-Based Navigation (1 day)

- **F4-A**: Add nested `<Route>` tree to `App.tsx`
- **F4-B**: Replace `activeTab` state in `AppLayout.tsx` with `<Link>` + `useLocation`
- **F4-C**: Update `navGroups` `id` values to match route paths
- **F4-D**: Implement session timer sign-out: call `signOut()` on expiry, reset on user activity

### Phase 5 — Polish & Observability (ongoing)

- **F5-A**: Search (⌘K) — full-text search endpoint + `SearchModal.tsx` functional wiring
- **F5-B**: Notifications bell — Hangfire + polling endpoint `/api/v1/notifications`
- **F5-C**: Replace `next-themes` usage in AppLayout with shadcn/ui `ThemeProvider`
- **F5-D**: Playwright E2E test suite — auth flow, task CRUD, workflow pipeline transition
- **F5-E**: Vitest unit tests — `splm-utils.ts`, `AuthContext can()`, `apiClient netFetch error paths`

---

## 3. Domain Model

### 3.1 Core Entity Graph

```
auth.users (id, email, password_hash)
    │
    ├── dbo.profiles (user_id FK → auth.users, role, name, active)
    └── dbo.user_roles (user_id, role)

dbo.products (id, name, status, priority_score, current_version, tech_stack, ...)
    │
    ├── dbo.tasks (product_id, sprint_id, assigned_to→developers, title, status, priority, ...)
    │     ├── dbo.task_comments (task_id, user_id, content)
    │     └── dbo.task_subtasks (task_id, title, completed, sort_order)
    │
    ├── dbo.sprints (name, goal, status, start_date, end_date)
    │
    ├── dbo.versions (product_id, version, version_type, status, qa_cycle_number, ...)
    │     └── [dbo.version_tasks — patch 10 junction]
    │
    ├── dbo.deployments (product_id, version, environment, status, canary_stage★, ...)
    │
    ├── dbo.environments (product_id, environment, server_host, deploy_method, ...)
    │
    ├── dbo.releases (name, type, status, target_date, checklist JSON)
    │     └── [dbo.release_products — patch 10 junction]
    │
    ├── dbo.feedback (product_id, channel, raw_content, sentiment, urgency_score)
    │
    ├── dbo.research (topic, urgency, ai_analysis, source_url)
    │
    ├── dbo.wiki_spaces (name, description, icon)
    │     └── dbo.wiki_pages (space_id, parent_id, title, content, is_template, ...)
    │           ├── dbo.wiki_page_versions (page_id, version_number, content, ...)
    │           └── dbo.wiki_page_comments (page_id, user_id, content)
    │
    └── dbo.developers (name, email, role, skills, capacity_hours_week, ...)

── AI-SDLC Entities (patch 08) ────────────────────────────────────────────────

dbo.product_workflow_states (product_id UQ, phase, phase_started_at, transitioned_by)
dbo.workflow_audit_logs (product_id, from_phase, to_phase, transition_note, transitioned_by)
dbo.pm_signoff_checklists (product_id UQ, items JSON, all_complete, signed_off_by)
dbo.prompt_library (name, description, category, is_active)
dbo.prompt_versions (prompt_id, version_number, content, model, system_msg)
dbo.qa_cycles (product_id, cycle_number UQ, status, version_ref, ...)
dbo.qa_issues (qa_cycle_id, description, severity, module, repro_steps,
               ai_fix_applied, confidence_rating, review_status, rejection_reason_code,
               prompt_version_id FK → prompt_versions)
dbo.analyzer_reports (qa_cycle_id, status, total_files, changed_files_json, ...)
dbo.git_diff_results (analyzer_report_id, file_path, additions, deletions, ...)
dbo.pdm_acceptance_signoffs (product_id, qa_cycle_id, status, decision_notes, signed_by)
dbo.kpi_snapshots (product_id, qa_cycle_id, ai_auto_fix_rate, cycle_duration_days, ...)
```

★ canary fields added by patch 08 ALTER on dbo.deployments

### 3.2 C# Entity Naming Conventions

All domain entities inherit `BaseEntity` (Id: Guid, CreatedAt, UpdatedAt).  
Navigation properties are NOT included on domain entities (persistence-ignorant).  
All FK columns are typed `Guid` with a matching `_Id` suffix name.

---

## 4. API Contracts

### 4.1 Complete Endpoint Catalog

Base path: `/api/v1/`  
Auth: `Authorization: Bearer <jwt>` required on all endpoints except `/auth/login`, `/auth/register`.  
JSON: snake_case request + response bodies.

#### Auth
```
POST /auth/login          → { token, user_id, email, name, role }
POST /auth/register       → { token, user_id, email, name, role }
GET  /auth/me             → { user_id, name, email, role, active }
```

#### Products
```
GET    /products                  → ProductDto[]
GET    /products/{id}             → ProductDto
POST   /products                  → ProductDto
PUT    /products/{id}             → ProductDto
DELETE /products/{id}             → 204
```

#### Tasks
```
GET    /tasks                     → PagedResult<TaskDto>  (?page, pageSize, status, priority, type, productId, sprintId, assignedTo, search, sortBy, sortDir)
GET    /tasks/{id}                → TaskDto
GET    /tasks/my-queue            → TaskDto[]  (?developerId)
POST   /tasks                     → TaskDto
PUT    /tasks/{id}                → TaskDto
DELETE /tasks/{id}                → 204
GET    /tasks/{id}/comments       → TaskCommentDto[]
POST   /tasks/{id}/comments       → TaskCommentDto
DELETE /tasks/{id}/comments/{cid} → 204
GET    /tasks/{id}/subtasks       → TaskSubtaskDto[]
POST   /tasks/{id}/subtasks       → TaskSubtaskDto
PUT    /tasks/{id}/subtasks/{sid} → TaskSubtaskDto
DELETE /tasks/{id}/subtasks/{sid} → 204
```

#### Sprints
```
GET    /sprints                   → SprintDto[]
GET    /sprints/{id}              → SprintDto
POST   /sprints                   → SprintDto
PUT    /sprints/{id}              → SprintDto
DELETE /sprints/{id}              → 204
POST   /sprints/{id}/assign-task/{taskId} → 204
```

#### Developers
```
GET    /developers                → DeveloperDto[]
GET    /developers/{id}           → DeveloperDto
GET    /developers/by-email       → DeveloperDto  (?email)
POST   /developers                → DeveloperDto
PUT    /developers/{id}           → DeveloperDto
DELETE /developers/{id}           → 204
```

#### Versions ★ (missing controller — see section 6)
```
GET    /versions                  → VersionDto[]  (?productId)
GET    /versions/{id}             → VersionDto
POST   /versions                  → VersionDto
PUT    /versions/{id}             → VersionDto
DELETE /versions/{id}             → 204
POST   /versions/{id}/release     → VersionDto
```

#### Deployments
```
GET    /deployments               → DeploymentDto[]  (?productId)
POST   /deployments               → DeploymentDto
PATCH  /deployments/{id}/canary   → DeploymentDto  ★ (missing — see section 6)
```

#### Environments ★ (missing controller — see section 6)
```
GET    /environments              → EnvironmentDto[]  (?productId)
GET    /environments/{id}         → EnvironmentDto
POST   /environments              → EnvironmentDto
PUT    /environments/{id}         → EnvironmentDto
DELETE /environments/{id}         → 204
```

#### Releases
```
GET    /releases                  → ReleaseDto[]
POST   /releases                  → ReleaseDto
PUT    /releases/{id}             → ReleaseDto
DELETE /releases/{id}             → 204
```

#### Feedback
```
GET    /feedback                  → FeedbackDto[]  (?productId)
POST   /feedback                  → FeedbackDto
DELETE /feedback/{id}             → 204
```

#### Research
```
GET    /research                  → ResearchDto[]
POST   /research                  → ResearchDto
DELETE /research/{id}             → 204
```

#### Wiki
```
GET    /wiki/spaces                         → WikiSpaceDto[]
POST   /wiki/spaces                         → WikiSpaceDto
DELETE /wiki/spaces/{spaceId}               → 204
GET    /wiki/spaces/{spaceId}/pages         → WikiPageDto[]
POST   /wiki/spaces/{spaceId}/pages         → WikiPageDto
GET    /wiki/pages/{pageId}                 → WikiPageDto
PUT    /wiki/pages/{pageId}                 → WikiPageDto
DELETE /wiki/pages/{pageId}                 → 204
GET    /wiki/pages/{pageId}/versions        → WikiPageVersionDto[]
GET    /wiki/pages/{pageId}/comments        → WikiPageCommentDto[]
POST   /wiki/pages/{pageId}/comments        → WikiPageCommentDto
```

#### Analytics
```
GET    /analytics/dashboard              → DashboardSummaryDto
GET    /analytics/sprints/active         → ActiveSprintDto[]
GET    /analytics/workload               → WorkloadDto[]
```

#### AI-SDLC
```
GET    /workflow-states                           → WorkflowStateDto[]
GET    /workflow-states/product/{productId}       → WorkflowStateDto
POST   /workflow-states/transition                → WorkflowStateDto
GET    /workflow-states/audit/{productId}         → WorkflowAuditLogDto[]

GET    /pm-checklists/{productId}                 → PmSignoffChecklistDto
POST   /pm-checklists                             → PmSignoffChecklistDto

GET    /prompt-library                            → PromptLibraryDto[]
POST   /prompt-library                            → PromptLibraryDto
GET    /prompt-library/{promptId}/versions        → PromptVersionDto[]
POST   /prompt-library/versions                   → PromptVersionDto

GET    /qa-cycles                                 → QaCycleDto[]  (?productId)
GET    /qa-cycles/{id}                            → QaCycleDto
POST   /qa-cycles                                 → QaCycleDto
PUT    /qa-cycles/{id}                            → QaCycleDto
GET    /qa-cycles/{cycleId}/issues                → QaIssueDto[]
GET    /qa-issues/{id}                            → QaIssueDto
POST   /qa-issues                                 → QaIssueDto
POST   /qa-issues/{id}/review                     → QaIssueDto

GET    /analyzer-reports                          → AnalyzerReportDto[]  (?qaCycleId)
GET    /analyzer-reports/{id}                     → AnalyzerReportDto
POST   /analyzer-reports/trigger                  → AnalyzerReportDto

GET    /pdm-signoffs                              → PdmAcceptanceSignoffDto[]  (?productId)
POST   /pdm-signoffs                              → PdmAcceptanceSignoffDto
POST   /pdm-signoffs/{id}/approve                 → PdmAcceptanceSignoffDto

GET    /kpi/dashboard                             → KpiDashboardSummaryDto  (?productId)
GET    /kpi/snapshots                             → KpiSnapshotDto[]  (?productId)
```

### 4.2 Standard Response Shapes

```typescript
// Success (200)
{ ...entity fields in snake_case }

// Paged success (200)
{ items: T[], total_count, page, page_size, total_pages, has_previous_page, has_next_page }

// No content (204) — DELETE and most state-change PATCH endpoints

// Client error (400)
{ errors: string[] }

// Auth error (401)
{ detail: string }

// Not found (404) — implicit from controller NotFound()
```

---

## 5. SQL Server Patch Strategy

Migration naming convention: `NN_Description.sql` — hand-written, idempotent (MERGE or `IF NOT EXISTS` guards), numbered in sequence.

| Script | Status | Description |
|--------|--------|-------------|
| 01_Create_Database.sql | ✅ Applied | Database + auth schema |
| 02_Create_Schema_Tables.sql | ✅ Applied | All core tables |
| 03_Indexes.sql | ✅ Applied | Basic indexes |
| 04_Triggers.sql | ✅ Applied | `updated_at` triggers |
| 05_Stored_Procedures.sql | ✅ Applied | Read-side USPs |
| 06_Seed_Data.sql | ✅ Applied | Reference data |
| 07_Patch_PasswordHash.sql | ✅ Applied | BCrypt hash column fix |
| 08_AI_SDLC_Migration.sql | ✅ Applied | 11 AI-SDLC tables, canary columns |
| 09_Seed_Dummy_Data.sql | ✅ Applied | Dev seed data |
| **10_Hardening.sql** | ❌ **TO DO** | CHECK constraints, junction tables, FK gaps, indexes |

### Patch 10 Content (see `database/10_Hardening.sql` scaffold in section 6)

Changes in patch 10:
- CHECK constraints on all TEXT status/priority/type/phase columns
- Junction table `dbo.version_tasks` (replaces `versions.tasks_included` TEXT)
- Junction table `dbo.release_products` (replaces `releases.products_included` TEXT)
- Missing FKs on wiki and sprint tables (already present in SQL Server schema but verify)
- Composite indexes for high-frequency queries
- `dbo.environments.env_vars_encrypted` → renamed to `env_vars_notes` (with data migration)

---

## 6. Backend Scaffolding

### 6.1 VersionsController (MISSING — add to ZenaTech.Api/Controllers/)

```csharp
// backend/src/ZenaTech.Api/Controllers/VersionsController.cs
using Asp.Versioning;
using Microsoft.AspNetCore.Mvc;
using ZenaTech.Application.Common.Interfaces;
using ZenaTech.Application.Common.Models;
using ZenaTech.Domain.Entities;

namespace ZenaTech.Api.Controllers;

// NOTE: Full IVersionService + VersionDto should mirror the pattern in
// ProductsController / SprintsController.  The service reads via Dapper
// query objects and writes via IRepository<ProductVersion> + IUnitOfWork.
// Abbreviated scaffold below — expand following the established pattern.

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/versions")]
public class VersionsController : BaseApiController
{
    private readonly IVersionService _service;

    public VersionsController(IVersionService service)
    {
        _service = service;
    }

    /// <summary>List all versions, optionally filtered by productId.</summary>
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] Guid? productId,
        CancellationToken ct)
        => Ok(await _service.GetAllAsync(productId, ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var v = await _service.GetByIdAsync(id, ct);
        return v is null ? NotFound() : Ok(v);
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateVersionRequest req,
        CancellationToken ct)
        => FromResult(await _service.CreateAsync(req, ct));

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateVersionRequest req,
        CancellationToken ct)
        => FromResult(await _service.UpdateAsync(id, req, ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => FromResult(await _service.DeleteAsync(id, ct));

    /// <summary>Mark version as released; auto-bumps product.current_version.</summary>
    [HttpPost("{id:guid}/release")]
    public async Task<IActionResult> Release(Guid id, CancellationToken ct)
        => FromResult(await _service.ReleaseAsync(id, ct));
}
```

**IVersionService interface** (Application layer):
```csharp
// Application/Versions/Interfaces/IVersionService.cs
public interface IVersionService
{
    Task<IReadOnlyList<VersionDto>> GetAllAsync(Guid? productId, CancellationToken ct = default);
    Task<VersionDto?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Result<VersionDto>> CreateAsync(CreateVersionRequest req, CancellationToken ct = default);
    Task<Result<VersionDto>> UpdateAsync(Guid id, UpdateVersionRequest req, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<Result<VersionDto>> ReleaseAsync(Guid id, CancellationToken ct = default);
}
```

**VersionDto** (add to Application/Versions/Dtos/VersionDto.cs):
```csharp
public record VersionDto(
    Guid Id,
    Guid ProductId,
    string ProductName,
    string Version,
    string VersionType,     // major | minor | patch
    string Status,          // planned | in_progress | testing | released
    string Title,
    string ReleaseNotes,
    string Changelog,
    string BreakingChanges,
    string GitBranch,
    string GitCommit,
    bool IsCurrent,
    DateOnly? PlannedDate,
    DateTime? ReleasedAt,
    int? QaCycleNumber,
    Guid? AnalyzerReportRef,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record CreateVersionRequest(
    Guid ProductId,
    string Version,
    string VersionType,
    string Title,
    string ReleaseNotes = "",
    string Changelog = "",
    string BreakingChanges = "",
    string GitBranch = "",
    string GitCommit = "",
    DateOnly? PlannedDate = null
);

public record UpdateVersionRequest(
    string? Status = null,
    string? Title = null,
    string? ReleaseNotes = null,
    string? Changelog = null,
    string? BreakingChanges = null,
    string? GitBranch = null,
    string? GitCommit = null,
    DateOnly? PlannedDate = null
);
```

### 6.2 EnvironmentsController (MISSING — add to ZenaTech.Api/Controllers/)

```csharp
// backend/src/ZenaTech.Api/Controllers/EnvironmentsController.cs
using Microsoft.AspNetCore.Mvc;
using ZenaTech.Application.Environments.Interfaces;
using ZenaTech.Application.Environments.DTOs;

namespace ZenaTech.Api.Controllers;

[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/environments")]
public class EnvironmentsController : BaseApiController
{
    private readonly IEnvironmentService _service;

    public EnvironmentsController(IEnvironmentService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] Guid? productId,
        CancellationToken ct)
        => Ok(await _service.GetAllAsync(productId, ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var e = await _service.GetByIdAsync(id, ct);
        return e is null ? NotFound() : Ok(e);
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateEnvironmentRequest req,
        CancellationToken ct)
        => FromResult(await _service.CreateAsync(req, ct));

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateEnvironmentRequest req,
        CancellationToken ct)
        => FromResult(await _service.UpdateAsync(id, req, ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => FromResult(await _service.DeleteAsync(id, ct));
}
```

**EnvironmentDto** (Application/Environments/DTOs/EnvironmentDto.cs):
```csharp
public record EnvironmentDto(
    Guid Id,
    Guid ProductId,
    string ProductName,
    string Environment,         // development | staging | production
    string ServerHost,
    string ServerUrl,
    string DeployMethod,        // ssh | ci_cd | manual
    string GitRepo,
    string GitBranch,
    string DeployPath,
    string HealthCheckUrl,
    string EnvVarsNotes,        // was env_vars_encrypted — renamed in patch 10
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record CreateEnvironmentRequest(
    Guid ProductId,
    string Environment,
    string ServerHost,
    string ServerUrl = "",
    string DeployMethod = "manual",
    string GitRepo = "",
    string GitBranch = "main",
    string DeployPath = "",
    string HealthCheckUrl = "",
    string EnvVarsNotes = ""
);

public record UpdateEnvironmentRequest(
    string? ServerHost = null,
    string? ServerUrl = null,
    string? DeployMethod = null,
    string? GitRepo = null,
    string? GitBranch = null,
    string? DeployPath = null,
    string? HealthCheckUrl = null,
    string? EnvVarsNotes = null
);
```

### 6.3 Canary PATCH Endpoint (add to StubControllers.cs DeploymentsController)

```csharp
// Add to the existing DeploymentsController in StubControllers.cs

/// <summary>Update canary deployment fields. Status can be promoted or rolled back.</summary>
[HttpPatch("{id:guid}/canary")]
public async Task<IActionResult> UpdateCanary(
    Guid id,
    [FromBody] UpdateCanaryRequest req,
    CancellationToken ct)
    => FromResult(await _service.UpdateCanaryAsync(id, req, ct));
```

**IDeploymentService extension** (Application/Deployments/Interfaces/IDeploymentService.cs):
```csharp
// Add to IDeploymentService:
Task<Result<DeploymentDto>> UpdateCanaryAsync(Guid id, UpdateCanaryRequest req, CancellationToken ct = default);
```

**UpdateCanaryRequest** (Application/Deployments/DTOs/DeploymentDto.cs):
```csharp
public record UpdateCanaryRequest(
    string? CanaryStage = null,        // none | initiated | 10pct | 50pct | 100pct
    int? RolloutPercentage = null,     // 0-100
    int? MonitoringWindowHrs = null,
    string? CanaryNotes = null,
    bool? Promoted = null              // if true: set canary_promoted_at + status=success
);
```

**DeploymentService.UpdateCanaryAsync** (Application/Deployments/Services/DeploymentService.cs):
```csharp
public async Task<Result<DeploymentDto>> UpdateCanaryAsync(
    Guid id,
    UpdateCanaryRequest req,
    CancellationToken ct = default)
{
    var entity = await _repository.GetByIdAsync(id, ct);
    if (entity is null) return Result<DeploymentDto>.Failure("Deployment not found.");

    if (req.CanaryStage    is not null) entity.CanaryStage           = req.CanaryStage;
    if (req.RolloutPercentage.HasValue) entity.RolloutPercentage     = req.RolloutPercentage.Value;
    if (req.MonitoringWindowHrs.HasValue) entity.MonitoringWindowHrs = req.MonitoringWindowHrs.Value;
    if (req.CanaryNotes    is not null) entity.CanaryNotes           = req.CanaryNotes;

    if (req.Promoted is true)
    {
        entity.CanaryPromotedAt   = DateTime.UtcNow;
        entity.CanaryApprovedBy   = _currentUser.UserId;
        entity.Status             = "success";
        entity.CanaryStage        = "100pct";
        entity.RolloutPercentage  = 100;
    }

    await _uow.SaveChangesAsync(ct);
    _logger.LogInformation("Canary updated for deployment {Id}: stage={Stage}", id, entity.CanaryStage);

    var dto = _mapper.Map<DeploymentDto>(entity);
    return Result<DeploymentDto>.Success(dto);
}
```

### 6.4 Hangfire KPI Snapshot Recurring Job (add to Program.cs)

Add after `app.UseHangfireDashboard(...)`:

```csharp
// ── Hangfire Recurring Jobs ───────────────────────────────────────────────────
// Daily KPI snapshots at 02:00 UTC — reads live cycle/issue data and persists
// a point-in-time snapshot for trend analysis on the KPI Dashboard.
RecurringJob.AddOrUpdate<IAiSdlcService>(
    "kpi-daily-snapshot",
    svc => svc.PersistKpiSnapshotsAsync(null, CancellationToken.None),
    Cron.Daily(2, 0),
    new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });

// Weekly sprint velocity snapshot at Sunday 01:00 UTC
RecurringJob.AddOrUpdate<IAnalyticsService>(
    "sprint-velocity-weekly",
    svc => svc.SnapshotVelocityAsync(CancellationToken.None),
    "0 1 * * 0",
    new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });
```

**Add `PersistKpiSnapshotsAsync` to IAiSdlcService / AiSdlcService**:
```csharp
// IAiSdlcService.cs — add:
Task PersistKpiSnapshotsAsync(Guid? productId, CancellationToken ct = default);

// AiSdlcService.cs — implement:
public async Task PersistKpiSnapshotsAsync(Guid? productId, CancellationToken ct = default)
{
    var summary = await GetKpiDashboardAsync(productId, ct);
    foreach (var snap in summary.Snapshots)
    {
        // Upsert: if snapshot for product + cycle already exists, skip
        var existing = await _kpiSnapshots.FirstOrDefaultAsync(
            k => k.ProductId == snap.ProductId && k.QaCycleId == snap.QaCycleId, ct);
        if (existing is null)
        {
            await _kpiSnapshots.AddAsync(_mapper.Map<KpiSnapshot>(snap), ct);
        }
    }
    await _uow.SaveChangesAsync(ct);
    _logger.LogInformation("KPI snapshots persisted for {Count} products", summary.Snapshots.Count);
}
```

### 6.5 Notification Hook on Workflow Transitions

Add to `AiSdlcService.TransitionPhaseAsync` after the audit log is created:

```csharp
// After: await _uow.SaveChangesAsync(ct);
// Add (minimal stub — replace INotificationService with real impl later):
try
{
    await _notifications.SendPhaseTransitionAsync(
        productId: request.ProductId,
        fromPhase: currentPhase,
        toPhase:   request.ToPhase,
        actorName: _currentUser.UserName,
        note:      request.TransitionNote,
        ct);
}
catch (Exception ex)
{
    // Notification failure must NOT roll back a successful transition
    _logger.LogWarning(ex, "Notification failed for phase transition {ProductId} {ToPhase}",
        request.ProductId, request.ToPhase);
}
```

**Notification service stub** (Infrastructure/Services/NotificationService.cs):
```csharp
namespace ZenaTech.Infrastructure.Services;

public interface INotificationService
{
    Task SendPhaseTransitionAsync(
        Guid productId, string fromPhase, string toPhase,
        string actorName, string note, CancellationToken ct = default);
}

/// <summary>
/// Stub implementation. Replace the body with real email/Teams/Slack when ready.
/// Register via DI: services.AddScoped&lt;INotificationService, NotificationService&gt;()
/// </summary>
public class NotificationService : INotificationService
{
    private readonly ILogger<NotificationService> _logger;
    public NotificationService(ILogger<NotificationService> logger) => _logger = logger;

    public Task SendPhaseTransitionAsync(
        Guid productId, string fromPhase, string toPhase,
        string actorName, string note, CancellationToken ct = default)
    {
        _logger.LogInformation(
            "[NOTIFICATION] Product {ProductId} transitioned {From} → {To} by {Actor}. Note: {Note}",
            productId, fromPhase, toPhase, actorName, note);
        return Task.CompletedTask;
    }
}
```

---

## 7. Frontend Scaffolding

### 7.1 main.tsx — Add QueryClientProvider

```tsx
// src/main.tsx
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:        1000 * 60 * 5,   // 5 minutes
      gcTime:           1000 * 60 * 10,  // 10 minutes (was cacheTime)
      retry:            2,
      refetchOnWindowFocus: false,        // prevents surprise refetches when user switches tabs
    },
    mutations: {
      retry: 0,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
```

### 7.2 App.tsx — Add Nested URL-Based Routes

```tsx
// src/App.tsx
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import LoginPage from '@/pages/LoginPage';
import NotFound from '@/pages/NotFound';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// Panel lazy imports — reduces initial bundle size
import { lazy, Suspense } from 'react';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';

const DashboardPanel      = lazy(() => import('@/components/panels/DashboardPanel'));
const ProductsPanel       = lazy(() => import('@/components/panels/ProductsPanel'));
const TasksPanel          = lazy(() => import('@/components/panels/TasksPanel'));
const MyQueuePanel        = lazy(() => import('@/components/panels/MyQueuePanel'));
const SprintsPanel        = lazy(() => import('@/components/panels/SprintsPanel'));
const DevelopersPanel     = lazy(() => import('@/components/panels/DevelopersPanel'));
const FeedbackPanel       = lazy(() => import('@/components/panels/FeedbackPanel'));
const ResearchPanel       = lazy(() => import('@/components/panels/ResearchPanel'));
const WikiPanel           = lazy(() => import('@/components/panels/WikiPanel'));
const VersionControlPanel = lazy(() => import('@/components/panels/VersionControlPanel'));
const DeploymentsPanel    = lazy(() => import('@/components/panels/DeploymentsPanel'));
const EnvironmentsPanel   = lazy(() => import('@/components/panels/EnvironmentsPanel'));
const ReleasesPanel       = lazy(() => import('@/components/panels/ReleasesPanel'));
// AI-SDLC
const WorkflowPipelinePanel  = lazy(() => import('@/components/panels/WorkflowPipelinePanel'));
const QACyclesPanel          = lazy(() => import('@/components/panels/QACyclesPanel'));
const AIAnalyzerPanel        = lazy(() => import('@/components/panels/AIAnalyzerPanel'));
const FixReviewPanel         = lazy(() => import('@/components/panels/FixReviewPanel'));
const PMSignOffPanel         = lazy(() => import('@/components/panels/PMSignOffPanel'));
const PDMAcceptancePanel     = lazy(() => import('@/components/panels/PDMAcceptancePanel'));
const PromptLibraryPanel     = lazy(() => import('@/components/panels/PromptLibraryPanel'));
const KPIDashboardPanel      = lazy(() => import('@/components/panels/KPIDashboardPanel'));
const CanaryDeploymentPanel  = lazy(() => import('@/components/panels/CanaryDeploymentPanel'));

const Panel = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingSkeleton />}>{children}</Suspense>
);

const App = () => (
  <AuthProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Protected shell — all app routes live under AppLayout */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard"    element={<Panel><DashboardPanel /></Panel>} />
              <Route path="queue"        element={<Panel><MyQueuePanel /></Panel>} />
              <Route path="products"     element={<Panel><ProductsPanel /></Panel>} />
              <Route path="tasks"        element={<Panel><TasksPanel /></Panel>} />
              <Route path="sprints"      element={<Panel><SprintsPanel /></Panel>} />
              <Route path="versions"     element={<Panel><VersionControlPanel /></Panel>} />
              <Route path="feedback"     element={<Panel><FeedbackPanel /></Panel>} />
              <Route path="research"     element={<Panel><ResearchPanel /></Panel>} />
              <Route path="wiki"         element={<Panel><WikiPanel /></Panel>} />
              <Route path="deployments"  element={<Panel><DeploymentsPanel /></Panel>} />
              <Route path="environments" element={<Panel><EnvironmentsPanel /></Panel>} />
              <Route path="releases"     element={<Panel><ReleasesPanel /></Panel>} />
              <Route path="team"         element={<Panel><DevelopersPanel /></Panel>} />
              {/* AI-SDLC */}
              <Route path="workflow"     element={<Panel><WorkflowPipelinePanel /></Panel>} />
              <Route path="qa-cycles"    element={<Panel><QACyclesPanel /></Panel>} />
              <Route path="ai-analyzer"  element={<Panel><AIAnalyzerPanel /></Panel>} />
              <Route path="fix-review"   element={<Panel><FixReviewPanel /></Panel>} />
              <Route path="pm-signoff"   element={<Panel><PMSignOffPanel /></Panel>} />
              <Route path="pdm-acceptance" element={<Panel><PDMAcceptancePanel /></Panel>} />
              <Route path="prompts"      element={<Panel><PromptLibraryPanel /></Panel>} />
              <Route path="kpi"          element={<Panel><KPIDashboardPanel /></Panel>} />
              <Route path="canary"       element={<Panel><CanaryDeploymentPanel /></Panel>} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </AuthProvider>
);

export default App;
```

### 7.3 ProtectedRoute.tsx (new component)

```tsx
// src/components/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null; // AuthProvider resolves immediately from localStorage

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
```

### 7.4 AppLayout.tsx — Replace activeTab with useLocation/Link

The `AppLayout` switch statement and `activeTab` state must be replaced. Key changes:

```tsx
// REMOVE:
// const [activeTab, setActiveTab] = useState('dashboard');
// <button onClick={() => setActiveTab(item.id)}>

// ADD:
import { Link, useLocation, Outlet } from 'react-router-dom';

// In NavButton, use Link with path matching:
const NavButton = ({ item, collapsed }) => {
  const { pathname } = useLocation();
  const isActive = pathname === `/${item.id}` || pathname.startsWith(`/${item.id}/`);
  return (
    <Link to={`/${item.id}`} className={cn('nav-btn', isActive && 'active')}>
      <item.icon className="size-4 flex-shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
};

// Replace the panel switch statement with:
// <Outlet />   (renders the matched child route's panel)
```

### 7.5 src/types/splm.ts — Full Typed DTO Interfaces

```typescript
// src/types/splm.ts
// All shapes match the snake_case JSON returned by the .NET backend.
// Field names are the snake_case version of the C# DTO property names.

// ── Base ─────────────────────────────────────────────────────────────────────

export interface BaseDto {
  id: string;
  created_at: string;
  updated_at: string;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  user_id: string;
  email: string;
  name: string;
  role: UserRole;
}

export type UserRole = 'admin' | 'manager' | 'developer' | 'viewer';

// ── Products ─────────────────────────────────────────────────────────────────

export type ProductStatus = 'active' | 'maintenance' | 'sunset' | 'archived';
export type ProductType   = 'web_app' | 'mobile' | 'api' | 'library' | 'tool';

export interface ProductDto extends BaseDto {
  name: string;
  description: string;
  status: ProductStatus;
  type: ProductType;
  priority_score: number;
  current_version: string;
  update_cadence: string;
  market_category: string;
  tech_stack: string;
  repository: string;
  doc_url: string;
  icon: string;
  external_apis: string;
  customer_count: number;
  last_updated_at?: string;
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export type TaskStatus   = 'backlog' | 'assigned' | 'in_progress' | 'review' | 'done' | 'cancelled';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskType     = 'feature' | 'bug' | 'improvement' | 'research' | 'security';

export interface TaskDto extends BaseDto {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  product_id?: string;
  product_name?: string;
  sprint_id?: string;
  sprint_name?: string;
  assigned_to?: string;
  assignee_name?: string;
  assignee_email?: string;
  story_points: number;
  due_date?: string;
  estimated_hours?: number;
  source?: string;
  ai_priority_score?: number;
  is_overdue: boolean;
  subtask_count: number;
  completed_subtask_count: number;
  comment_count: number;
}

export interface TaskCommentDto extends BaseDto {
  task_id: string;
  user_id: string;
  author_name: string;
  content: string;
}

export interface TaskSubtaskDto extends BaseDto {
  task_id: string;
  title: string;
  completed: boolean;
  sort_order: number;
}

export interface PagedResult<T> {
  items: T[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_previous_page: boolean;
  has_next_page: boolean;
}

// ── Sprints ──────────────────────────────────────────────────────────────────

export type SprintStatus = 'planning' | 'active' | 'completed';

export interface SprintDto extends BaseDto {
  name: string;
  goal: string;
  status: SprintStatus;
  start_date: string;
  end_date: string;
  task_count: number;
  completed_task_count: number;
  story_points_total: number;
  story_points_done: number;
}

// ── Developers ────────────────────────────────────────────────────────────────

export interface DeveloperDto extends BaseDto {
  name: string;
  email: string;
  role: string;
  skills: string;
  office_location: string;
  capacity_hours_week: number;
  current_load_hours: number;
  active: boolean;
  avatar_url?: string;
}

// ── Versions ─────────────────────────────────────────────────────────────────

export type VersionStatus = 'planned' | 'in_progress' | 'testing' | 'released';
export type VersionType   = 'major' | 'minor' | 'patch';

export interface VersionDto extends BaseDto {
  product_id: string;
  product_name: string;
  version: string;
  version_type: VersionType;
  status: VersionStatus;
  title: string;
  release_notes: string;
  changelog: string;
  breaking_changes: string;
  git_branch: string;
  git_commit: string;
  is_current: boolean;
  planned_date?: string;
  released_at?: string;
  qa_cycle_number?: number;
  analyzer_report_ref?: string;
}

// ── Deployments ──────────────────────────────────────────────────────────────

export type DeploymentStatus = 'pending' | 'in_progress' | 'success' | 'failed' | 'rolled_back';
export type DeployType       = 'full' | 'hotfix' | 'rollback';
export type CanaryStage      = 'none' | 'initiated' | '10pct' | '50pct' | '100pct';

export interface DeploymentDto extends BaseDto {
  product_id: string;
  product_name: string;
  version: string;
  environment: string;
  deploy_type: DeployType;
  status: DeploymentStatus;
  branch: string;
  commit_sha: string;
  rollback_version?: string;
  fail_reason?: string;
  deploy_log?: string;
  deployed_by?: string;
  deployer_name?: string;
  // Canary fields
  canary_stage: CanaryStage;
  rollout_percentage: number;
  monitoring_window_hrs: number;
  canary_promoted_at?: string;
  canary_notes?: string;
}

// ── Environments ─────────────────────────────────────────────────────────────

export interface EnvironmentDto extends BaseDto {
  product_id: string;
  product_name: string;
  environment: string;
  server_host: string;
  server_url: string;
  deploy_method: string;
  git_repo: string;
  git_branch: string;
  deploy_path: string;
  health_check_url: string;
  env_vars_notes: string;
}

// ── Releases ─────────────────────────────────────────────────────────────────

export type ReleaseStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
export type ReleaseType   = 'planned' | 'hotfix' | 'emergency';

export interface ChecklistItem { label: string; done: boolean; }

export interface ReleaseDto extends BaseDto {
  name: string;
  type: ReleaseType;
  status: ReleaseStatus;
  target_date?: string;
  checklist: ChecklistItem[];   // JSON array, not raw text
  product_ids: string[];        // junction table (patch 10)
}

// ── Feedback ─────────────────────────────────────────────────────────────────

export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface FeedbackDto extends BaseDto {
  product_id: string;
  product_name: string;
  channel: string;
  raw_content: string;
  sentiment: Sentiment;
  urgency_score: number;
  submitted_by?: string;
  submitter_name?: string;
}

// ── Research ─────────────────────────────────────────────────────────────────

export type ResearchUrgency = 'low' | 'medium' | 'high' | 'critical';

export interface ResearchDto extends BaseDto {
  topic: string;
  source_url: string;
  urgency: ResearchUrgency;
  affected_products: string;
  ai_analysis: string;
  created_by?: string;
}

// ── Wiki ─────────────────────────────────────────────────────────────────────

export interface WikiSpaceDto extends BaseDto {
  name: string;
  description: string;
  icon: string;
  created_by?: string;
  page_count: number;
}

export interface WikiPageDto extends BaseDto {
  space_id: string;
  space_name: string;
  parent_id?: string;
  title: string;
  content: string;
  is_template: boolean;
  template_category?: string;
  sort_order: number;
  created_by?: string;
  last_edited_by?: string;
  version_count: number;
  comment_count: number;
}

export interface WikiPageVersionDto extends BaseDto {
  page_id: string;
  version_number: number;
  title: string;
  content: string;
  edited_by?: string;
  change_summary: string;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface DashboardSummaryDto {
  total_products: number;
  active_products: number;
  open_tasks: number;
  overdue_tasks: number;
  active_sprints: number;
  team_size: number;
  recent_deployments: DeploymentDto[];
  priority_breakdown: { priority: string; count: number }[];
  deployment_trend: { date: string; count: number }[];
}

// ── AI-SDLC ──────────────────────────────────────────────────────────────────

export type WorkflowPhase = 'pm_build' | 'dev_handoff' | 'qa_cycle' | 'acceptance' | 'production';

export interface WorkflowStateDto extends BaseDto {
  product_id: string;
  product_name: string;
  phase: WorkflowPhase;
  phase_started_at: string;
  phase_note: string;
  transitioned_by_name?: string;
}

export interface WorkflowAuditLogDto {
  id: string;
  product_id: string;
  product_name: string;
  from_phase: string;
  to_phase: string;
  transition_note: string;
  transitioned_by_name?: string;
  created_at: string;
}

export interface PmSignoffChecklistDto extends BaseDto {
  product_id: string;
  product_name: string;
  items: ChecklistItem[];   // parsed from JSON
  all_complete: boolean;
  signed_off_by_name?: string;
  signed_off_at?: string;
  notes: string;
}

export interface PromptLibraryDto extends BaseDto {
  name: string;
  description: string;
  category: string;
  is_active: boolean;
  version_count: number;
  current_version_number: number;
}

export interface PromptVersionDto extends BaseDto {
  prompt_id: string;
  prompt_name: string;
  version_number: number;
  content: string;
  model: string;
  system_message: string;
  is_active: boolean;
  created_by_name?: string;
}

export type QaCycleStatus       = 'open' | 'in_review' | 'closed';
export type QaIssueReviewStatus = 'pending' | 'accepted' | 'modified' | 'rejected';
export type ConfidenceRating    = 'high' | 'medium' | 'low';
export type RejectionReasonCode = 'logic_error' | 'performance_issue' | 'security_risk' | 'style_violation' | 'scope_creep';

export interface QaCycleDto extends BaseDto {
  product_id: string;
  product_name: string;
  cycle_number: number;
  status: QaCycleStatus;
  version_ref: string;
  opened_by_name?: string;
  closed_by_name?: string;
  closed_at?: string;
  total_issues: number;
  ai_fixed_issues: number;
  accepted_count: number;
  rejected_count: number;
}

export interface QaIssueDto extends BaseDto {
  qa_cycle_id: string;
  description: string;
  severity: string;
  module: string;
  repro_steps: string;
  ai_fix_applied: string;
  confidence_rating?: ConfidenceRating;
  review_status: QaIssueReviewStatus;
  review_notes?: string;
  rejection_reason_code?: RejectionReasonCode;
  rejection_notes?: string;
  reviewer_name?: string;
  reviewed_at?: string;
  prompt_version_id?: string;
  ai_model_used?: string;
}

export interface AnalyzerReportDto extends BaseDto {
  qa_cycle_id: string;
  status: string;
  total_files_changed: number;
  total_additions: number;
  total_deletions: number;
  issues_flagged: number;
  regression_flags: number;
  overall_confidence: string;
  summary: string;
  changed_files_json: string;
  triggered_by_name?: string;
}

export interface GitDiffResultDto extends BaseDto {
  analyzer_report_id: string;
  file_path: string;
  additions: number;
  deletions: number;
  patch_summary: string;
  issue_id?: string;
}

export interface PdmAcceptanceSignoffDto extends BaseDto {
  product_id: string;
  product_name: string;
  qa_cycle_id: string;
  status: string;
  decision_notes: string;
  signed_by_name?: string;
  signed_at?: string;
}

export interface KpiSnapshotDto extends BaseDto {
  product_id: string;
  product_name: string;
  qa_cycle_id: string;
  ai_auto_fix_rate: number;
  cycle_duration_days: number;
  acceptance_rate: number;
  regression_rate: number;
  override_rate: number;
  incident_count: number;
}

export interface KpiDashboardSummaryDto {
  snapshots: KpiSnapshotDto[];
  avg_auto_fix_rate: number;
  avg_acceptance_rate: number;
  avg_cycle_duration_days: number;
  total_incidents: number;
  trend_direction: 'improving' | 'stable' | 'degrading';
}
```

### 7.6 apiClient.ts — Replace `any` with Typed Imports

The existing `apiClient.ts` has correct function structure but uses `any` throughout. Replace the type annotations:

```typescript
// src/lib/apiClient.ts — typed versions of the module exports
// (Show only the parts that change — keep netFetch, authHeaders, toSnake identical)

import type {
  TaskDto, TaskCommentDto, TaskSubtaskDto, PagedResult, TaskQueryParams,
  ProductDto, DeveloperDto, VersionDto, DeploymentDto, EnvironmentDto,
  ReleaseDto, FeedbackDto, ResearchDto,
  WikiSpaceDto, WikiPageDto, WikiPageVersionDto,
  SprintDto, DashboardSummaryDto,
} from '@/types/splm';

// ── Products module ───────────────────────────────────────────────────────────

export const productsApi = {
  getAll:   (): Promise<ProductDto[]>          => netFetch('GET',    '/products'),
  getById:  (id: string): Promise<ProductDto>  => netFetch('GET',    `/products/${id}`),
  create:   (data: Partial<ProductDto>): Promise<ProductDto>
                                               => netFetch('POST',   '/products', data),
  update:   (id: string, data: Partial<ProductDto>): Promise<ProductDto>
                                               => netFetch('PUT',    `/products/${id}`, data),
  delete:   (id: string): Promise<void>        => netFetch('DELETE', `/products/${id}`),
};

// ── Tasks module ──────────────────────────────────────────────────────────────

export const tasksApi = {
  getAll: (params: TaskQueryParams = {}): Promise<TaskDto[]> => {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)]),
      ),
    ).toString();
    return netFetch<PagedResult<TaskDto>>('GET', `/tasks?${qs}`)
      .then(r => r.items);
  },

  getById:   (id: string): Promise<TaskDto | null> => netFetch('GET',    `/tasks/${id}`),
  getMyQueue:(devId: string): Promise<TaskDto[]>    => netFetch('GET',    `/tasks/my-queue?developerId=${devId}`),
  create:    (data: Partial<TaskDto>): Promise<TaskDto> => netFetch('POST', '/tasks', data),
  update:    (id: string, data: Partial<TaskDto>): Promise<TaskDto> => netFetch('PUT', `/tasks/${id}`, data),
  delete:    (id: string): Promise<void>           => netFetch('DELETE', `/tasks/${id}`),

  getComments: (taskId: string): Promise<TaskCommentDto[]>
                                                   => netFetch('GET',    `/tasks/${taskId}/comments`),
  addComment:  (taskId: string, content: string): Promise<TaskCommentDto>
                                                   => netFetch('POST',   `/tasks/${taskId}/comments`, { content }),
  deleteComment:(taskId: string, cid: string): Promise<void>
                                                   => netFetch('DELETE', `/tasks/${taskId}/comments/${cid}`),

  getSubtasks:   (taskId: string): Promise<TaskSubtaskDto[]>
                                                   => netFetch('GET',    `/tasks/${taskId}/subtasks`),
  addSubtask:    (taskId: string, title: string): Promise<TaskSubtaskDto>
                                                   => netFetch('POST',   `/tasks/${taskId}/subtasks`, { title }),
  updateSubtask: (taskId: string, sid: string, data: Partial<Pick<TaskSubtaskDto, 'completed' | 'title'>>): Promise<TaskSubtaskDto>
                                                   => netFetch('PUT',    `/tasks/${taskId}/subtasks/${sid}`, data),
  deleteSubtask: (taskId: string, sid: string): Promise<void>
                                                   => netFetch('DELETE', `/tasks/${taskId}/subtasks/${sid}`),
};

// (Replace all other modules with typed versions following the same pattern)
```

### 7.7 React Query Usage Pattern — Panel Template

All panels must follow this pattern (shown for a generic panel):

```tsx
// Example: how to convert a panel from useState/useEffect to React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tasksApi, productsApi } from '@/lib/apiClient';
import type { TaskDto, ProductDto } from '@/types/splm';

export default function TasksPanel() {
  const qc = useQueryClient();

  // ── Data fetching (replaces useEffect + setState) ────────────────────────
  const { data: tasks = [], isLoading: tasksLoading, error: tasksError } =
    useQuery({
      queryKey: ['tasks'],
      queryFn:  () => tasksApi.getAll({ pageSize: 200 }),
    });

  const { data: products = [] } =
    useQuery({ queryKey: ['products'], queryFn: productsApi.getAll });

  // ── Mutations (replaces inline async functions) ──────────────────────────
  const createTask = useMutation({
    mutationFn: (data: Partial<TaskDto>) => tasksApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task created');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTask = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TaskDto> }) =>
      tasksApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
    onError:   (e: Error) => toast.error(e.message),
  });

  const deleteTask = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['tasks'] }),
    onError:    (e: Error) => toast.error(e.message),
  });

  // ── Error state ──────────────────────────────────────────────────────────
  if (tasksError) return (
    <div className="p-8 text-center text-destructive">
      Failed to load tasks: {(tasksError as Error).message}
    </div>
  );

  // ── Loading state ────────────────────────────────────────────────────────
  if (tasksLoading) return <LoadingSkeleton />;

  // ── Render ───────────────────────────────────────────────────────────────
  return ( /* ... */ );
}
```

### 7.8 Query Key Conventions

All React Query keys follow a consistent hierarchy to enable targeted invalidation:

```typescript
// Single entity type
queryKey: ['tasks']
queryKey: ['products']
queryKey: ['sprints']

// Filtered by parent
queryKey: ['tasks', { productId }]
queryKey: ['qa-cycles', { productId }]
queryKey: ['qa-issues', { cycleId }]

// Single entity by id
queryKey: ['tasks', taskId]
queryKey: ['wiki-pages', pageId]

// Nested under parent
queryKey: ['tasks', taskId, 'comments']
queryKey: ['tasks', taskId, 'subtasks']
queryKey: ['wiki-pages', pageId, 'versions']

// AI-SDLC
queryKey: ['workflow-states']
queryKey: ['workflow-audit', productId]
queryKey: ['analyzer-reports', { qaCycleId }]
queryKey: ['kpi-dashboard']
queryKey: ['kpi-snapshots', { productId }]
```

---

## 8. SQL Patch 10 — Hardening

See the scaffolded `database/10_Hardening.sql` file for the full script. Summary of changes:

```sql
-- 1. CHECK constraints on status/priority/type columns
ALTER TABLE dbo.tasks
  ADD CONSTRAINT chk_task_status   CHECK (status   IN ('backlog','assigned','in_progress','review','done','cancelled')),
      CONSTRAINT chk_task_priority CHECK (priority IN ('critical','high','medium','low')),
      CONSTRAINT chk_task_type     CHECK (type      IN ('feature','bug','improvement','research','security'));

ALTER TABLE dbo.products
  ADD CONSTRAINT chk_product_status CHECK (status IN ('active','maintenance','sunset','archived'));

ALTER TABLE dbo.deployments
  ADD CONSTRAINT chk_deploy_status  CHECK (status IN ('pending','in_progress','success','failed','rolled_back')),
      CONSTRAINT chk_deploy_type    CHECK (deploy_type IN ('full','hotfix','rollback'));

-- 2. Junction tables (replaces comma-separated TEXT columns)
CREATE TABLE dbo.version_tasks (
    version_id  UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.versions(id) ON DELETE CASCADE,
    task_id     UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.tasks(id)    ON DELETE CASCADE,
    added_at    DATETIME2(7) NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT PK_version_tasks PRIMARY KEY (version_id, task_id)
);

CREATE TABLE dbo.release_products (
    release_id  UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.releases(id)  ON DELETE CASCADE,
    product_id  UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.products(id),
    added_at    DATETIME2(7) NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT PK_release_products PRIMARY KEY (release_id, product_id)
);

-- 3. Rename misleading column
EXEC sp_rename 'dbo.environments.env_vars_encrypted', 'env_vars_notes', 'COLUMN';

-- 4. Convert releases.checklist to JSON if not already done
-- (verify current column type — if TEXT, migrate with default '[]')

-- 5. Composite covering indexes for high-frequency Dapper queries
CREATE NONCLUSTERED INDEX IX_tasks_product_status
  ON dbo.tasks (product_id, status) INCLUDE (title, priority, assigned_to, sprint_id, due_date);

CREATE NONCLUSTERED INDEX IX_tasks_assignee_status
  ON dbo.tasks (assigned_to, status) INCLUDE (title, priority, product_id, due_date);

CREATE NONCLUSTERED INDEX IX_qa_issues_cycle_review
  ON dbo.qa_issues (qa_cycle_id, review_status) INCLUDE (severity, confidence_rating, ai_fix_applied);

CREATE NONCLUSTERED INDEX IX_deployments_product_env
  ON dbo.deployments (product_id, environment) INCLUDE (status, created_at, version);
```

---

## 9. AI-SDLC Integration Guidance

### 9.1 How AI-SDLC Connects to the Core SPLM Domain

```
Product (core domain)
    │
    ├── ProductWorkflowState  [1:1 per product, UQ constraint enforced]
    │         phase = pm_build → dev_handoff → qa_cycle → acceptance → production
    │
    ├── PmSignoffChecklist    [1:1 per product — gate for dev_handoff transition]
    │         all_complete must be true before TransitionPhaseAsync allows dev_handoff
    │
    ├── QaCycle               [1:N per product, cycle_number auto-increments]
    │     │   MAJOR.MINOR.CYCLE: cycle_number maps to the CYCLE component of versions.version
    │     │
    │     ├── QaIssue[]         [issues found in this cycle]
    │     │     └── PromptVersion (FK)  [records which prompt produced the AI fix]
    │     │
    │     └── AnalyzerReport    [1:1 per cycle — triggered by PM or automatically]
    │           └── GitDiffResult[]  [one row per changed file in the diff]
    │
    ├── PdmAcceptanceSignoff  [gate for production transition — status=approved required]
    │
    └── KpiSnapshot           [1:N per product — persisted by Hangfire daily job]
```

### 9.2 State Machine Rules (do not violate)

Forward-only transitions enforced in `AiSdlcService.ValidTransitions`:

```
pm_build → dev_handoff    GUARD: PmSignoffChecklist.all_complete == true
dev_handoff → qa_cycle    no guard
qa_cycle → acceptance     ADVISORY: AnalyzerReport must exist for current cycle
acceptance → production   GUARD: PdmAcceptanceSignoff.status == "approved" for current cycle
production → (none)       terminal state
```

Rejection rules (enforced in `ReviewQaIssueAsync`):
- `review_status = "rejected"` requires `rejection_reason_code` (one of 5 enum values)
- `rejection_notes` stored for audit trail
- All rejections are queryable by code for trend analysis

### 9.3 Real AI Analyzer Integration (replacing the mock)

The system uses an `IGitDiffService` abstraction. To connect a real Git provider:

1. Create `RealGitDiffService.cs` in Infrastructure/Services implementing `IGitDiffService`
2. In `Infrastructure/DependencyInjection.cs` replace:
   ```csharp
   services.AddScoped<IGitDiffService, MockGitDiffService>();
   // with:
   services.AddScoped<IGitDiffService, RealGitDiffService>();
   ```
3. No other code changes required — the `AiSdlcService.TriggerAnalyzerAsync` method calls `_gitDiffService.GetDiffAsync(...)` regardless of implementation.

For async processing at scale, wrap the diff + analysis in a Hangfire background job:

```csharp
// In AiSdlcController.cs — TriggerAnalyzer action:
// Instead of awaiting inline:
BackgroundJob.Enqueue<IAiSdlcService>(
    svc => svc.RunAnalyzerBackgroundAsync(request, CancellationToken.None));
return Ok(new { status = "queued", message = "Analyzer started in background." });
```

### 9.4 Prompt Library Versioning

The `PromptLibrary` + `PromptVersion` entities provide full version history for AI prompts. Each `QaIssue` records `PromptVersionId` and `AiModelUsed` — meaning you can always replay "what prompt was used when this fix was suggested?" which is essential for compliance and regression analysis.

Workflow:
1. Create a prompt in Prompt Library
2. Add version 1 with content + model + system message
3. When applying an AI fix to a QaIssue, pass `PromptVersionId` = the active version's ID
4. To change the prompt, create version 2 (never edit versions — append only)
5. KPI Dashboard will show whether newer prompt versions improve acceptance rate over time

---

## 10. Remaining Risk Register

| ID | Item | Severity | Resolution |
|----|------|----------|------------|
| R1 | `VersionsController` missing | HIGH | Scaffold from section 6.1 |
| R2 | `EnvironmentsController` missing | HIGH | Scaffold from section 6.2 |
| R3 | Canary PATCH endpoint missing | MEDIUM | Add per section 6.3 |
| R4 | No `QueryClientProvider` | HIGH | Fix per section 7.1 (5-minute task) |
| R5 | URL-based routing not implemented | MEDIUM | Fix per sections 7.2–7.4 |
| R6 | `apiClient.ts` uses `any` throughout | MEDIUM | Replace per sections 7.5–7.6 |
| R7 | DB check constraints missing | MEDIUM | Apply patch 10 (section 8) |
| R8 | Junction tables not created | LOW | Apply patch 10 (releases.products_included, versions.tasks_included are TEXT — no FKs) |
| R9 | Session timer cosmetic only | LOW | Wire signOut() to timer zero + activity reset |
| R10 | Real AI analyzer not connected | LOW | IGitDiffService abstraction ready — swap impl via DI |
| R11 | KPI Hangfire job not scheduled | MEDIUM | Add RecurringJob per section 6.4 |
| R12 | No notification on phase transitions | LOW | Stub ready per section 6.5 — wire in real email |
| R13 | No error boundaries | MEDIUM | Add AppErrorBoundary + per-panel boundaries |
| R14 | No Zod schemas / RHF on forms | LOW | Phase 3 refactor |

---

*Blueprint generated 2026-04-10. All file paths are relative to the project root at `ZenaTech_SPLM_Project/`.*
