/**
 * splm.ts — ZenaTech SPLM typed DTO interfaces
 *
 * All shapes match the snake_case JSON returned by the .NET 8 backend
 * (PropertyNamingPolicy = SnakeCaseLower).
 *
 * These types replace every `any` usage across apiClient.ts, api-aisdlc.ts,
 * and all panel components.
 *
 * Naming rule:
 *   - Field names exactly match what the backend serialises to JSON
 *   - Enum-like string unions are defined as TypeScript union types
 *   - Nullable optional fields use the `?` modifier (undefined in TS, null in C#)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED
// ═══════════════════════════════════════════════════════════════════════════════

export interface BaseDto {
  id:         string;
  created_at: string;  // ISO 8601 UTC string from DATETIME2
  updated_at: string;
}

export interface PagedResult<T> {
  items:              T[];
  total_count:        number;
  page:               number;
  page_size:          number;
  total_pages:        number;
  has_previous_page:  boolean;
  has_next_page:      boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════════

export type UserRole = 'admin' | 'manager' | 'developer' | 'viewer';

export interface AuthResponse {
  token:    string;
  user_id:  string;
  email:    string;
  name:     string;
  role:     UserRole;
}

export interface MeResponse {
  user_id:  string;
  name:     string;
  email:    string;
  role:     UserRole;
  active:   boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════

export type ProductStatus = 'active' | 'maintenance' | 'sunset' | 'archived';
export type ProductType   = 'web_app' | 'mobile' | 'api' | 'library' | 'tool';

export interface ProductDto extends BaseDto {
  name:             string;
  description:      string;
  status:           ProductStatus;
  type:             ProductType;
  priority_score:   number;
  current_version:  string;
  update_cadence:   string;
  market_category:  string;
  tech_stack:       string;
  repository:       string;
  doc_url:          string;
  icon:             string;
  external_apis:    string;
  customer_count:   number;
  last_updated_at?: string;
  created_by?:      string;
}

export interface CreateProductRequest {
  name:             string;
  description?:     string;
  status?:          ProductStatus;
  type?:            ProductType;
  priority_score?:  number;
  current_version?: string;
  update_cadence?:  string;
  market_category?: string;
  tech_stack?:      string;
  repository?:      string;
  doc_url?:         string;
  icon?:            string;
  external_apis?:   string;
  customer_count?:  number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════════════════════════

export type TaskStatus   = 'backlog' | 'assigned' | 'in_progress' | 'review' | 'done' | 'cancelled';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskType     = 'feature' | 'bug' | 'improvement' | 'research' | 'security';

export interface TaskDto extends BaseDto {
  title:                    string;
  description:              string;
  status:                   TaskStatus;
  priority:                 TaskPriority;
  type:                     TaskType;
  product_id?:              string;
  product_name?:            string;
  sprint_id?:               string;
  sprint_name?:             string;
  assigned_to?:             string;
  assignee_name?:           string;
  assignee_email?:          string;
  story_points:             number;
  due_date?:                string;   // ISO date YYYY-MM-DD
  estimated_hours?:         number;
  source?:                  string;   // manual | feedback | research | ai
  ai_priority_score?:       number;
  is_overdue:               boolean;
  subtask_count:            number;
  completed_subtask_count:  number;
  comment_count:            number;
}

export interface TaskCommentDto extends BaseDto {
  task_id:      string;
  user_id:      string;
  author_name:  string;
  content:      string;
}

export interface TaskSubtaskDto extends BaseDto {
  task_id:     string;
  title:       string;
  completed:   boolean;
  sort_order:  number;
}

export interface TaskQueryParams {
  page?:        number;
  pageSize?:    number;
  search?:      string;
  status?:      TaskStatus;
  priority?:    TaskPriority;
  type?:        TaskType;
  productId?:   string;
  sprintId?:    string;
  assignedTo?:  string;
  isOverdue?:   boolean;
  sortBy?:      string;
  sortDir?:     'asc' | 'desc';
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPRINTS
// ═══════════════════════════════════════════════════════════════════════════════

export type SprintStatus = 'planning' | 'active' | 'completed';

export interface SprintDto extends BaseDto {
  name:                  string;
  goal:                  string;
  status:                SprintStatus;
  start_date:            string;   // ISO date
  end_date:              string;   // ISO date
  task_count:            number;
  completed_task_count:  number;
  story_points_total:    number;
  story_points_done:     number;
  created_by?:           string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEVELOPERS
// ═══════════════════════════════════════════════════════════════════════════════

export interface DeveloperDto extends BaseDto {
  name:                  string;
  email:                 string;
  role:                  string;   // developer | lead | architect | designer | qa | devops
  skills:                string;   // comma-separated
  office_location:       string;
  capacity_hours_week:   number;
  current_load_hours:    number;
  active:                boolean;
  avatar_url?:           string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERSIONS
// ═══════════════════════════════════════════════════════════════════════════════

export type VersionStatus = 'planned' | 'in_progress' | 'testing' | 'released';
export type VersionType   = 'major' | 'minor' | 'patch';

export interface VersionDto extends BaseDto {
  product_id:           string;
  product_name:         string;
  version:              string;   // MAJOR.MINOR.CYCLE
  version_type:         VersionType;
  status:               VersionStatus;
  title:                string;
  release_notes:        string;
  changelog:            string;
  breaking_changes:     string;
  git_branch:           string;
  git_commit:           string;
  is_current:           boolean;
  planned_date?:        string;   // ISO date
  released_at?:         string;   // ISO datetime
  qa_cycle_number?:     number;
  analyzer_report_ref?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEPLOYMENTS
// ═══════════════════════════════════════════════════════════════════════════════

export type DeploymentStatus = 'pending' | 'in_progress' | 'success' | 'failed' | 'rolled_back';
export type DeployType       = 'full' | 'hotfix' | 'rollback';
export type CanaryStage      = 'none' | 'initiated' | '10pct' | '50pct' | '100pct';

export interface DeploymentDto extends BaseDto {
  product_id:            string;
  product_name:          string;
  version:               string;
  environment:           string;   // development | staging | production
  deploy_type:           DeployType;
  status:                DeploymentStatus;
  branch:                string;
  commit_sha:            string;
  rollback_version?:     string;
  fail_reason?:          string;
  deploy_log?:           string;
  deployer_name?:        string;
  // Canary fields (patch 08)
  canary_stage:          CanaryStage;
  rollout_percentage:    number;
  monitoring_window_hrs: number;
  canary_promoted_at?:   string;
  canary_notes?:         string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENVIRONMENTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface EnvironmentDto extends BaseDto {
  product_id:       string;
  product_name:     string;
  environment:      string;   // development | staging | production
  server_host:      string;
  server_url:       string;
  deploy_method:    string;   // ssh | ci_cd | manual
  git_repo:         string;
  git_branch:       string;
  deploy_path:      string;
  health_check_url: string;
  env_vars_notes:   string;   // renamed from env_vars_encrypted in patch 10
}

// ═══════════════════════════════════════════════════════════════════════════════
// RELEASES
// ═══════════════════════════════════════════════════════════════════════════════

export type ReleaseStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
export type ReleaseType   = 'planned' | 'hotfix' | 'emergency';

export interface ChecklistItem {
  label: string;
  done:  boolean;
}

export interface ReleaseDto extends BaseDto {
  name:        string;
  type:        ReleaseType;
  status:      ReleaseStatus;
  target_date?: string;
  checklist:   ChecklistItem[];   // JSON array (patch 10 converts TEXT → JSON)
  product_ids: string[];          // junction table release_products (patch 10)
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK
// ═══════════════════════════════════════════════════════════════════════════════

export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface FeedbackDto extends BaseDto {
  product_id:      string;
  product_name:    string;
  channel:         string;   // manual | email | support | survey | social
  raw_content:     string;
  sentiment:       Sentiment;
  urgency_score:   number;   // 1-10
  submitted_by?:   string;
  submitter_name?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESEARCH
// ═══════════════════════════════════════════════════════════════════════════════

export type ResearchUrgency = 'low' | 'medium' | 'high' | 'critical';

export interface ResearchDto extends BaseDto {
  topic:             string;
  source_url:        string;
  urgency:           ResearchUrgency;
  affected_products: string;   // comma-separated product IDs
  ai_analysis:       string;
  created_by?:       string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIKI
// ═══════════════════════════════════════════════════════════════════════════════

export interface WikiSpaceDto extends BaseDto {
  name:        string;
  description: string;
  icon:        string;   // emoji
  created_by?: string;
  page_count:  number;
}

export interface WikiPageDto extends BaseDto {
  space_id:           string;
  space_name:         string;
  parent_id?:         string;
  title:              string;
  content:            string;   // Markdown
  is_template:        boolean;
  template_category?: string;
  sort_order:         number;
  created_by?:        string;
  last_edited_by?:    string;
  version_count:      number;
  comment_count:      number;
}

export interface WikiPageVersionDto extends BaseDto {
  page_id:        string;
  version_number: number;
  title:          string;
  content:        string;
  edited_by?:     string;
  change_summary: string;
}

export interface WikiPageCommentDto extends BaseDto {
  page_id:     string;
  user_id:     string;
  author_name: string;
  content:     string;
  anchor?:     string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

export interface DashboardSummaryDto {
  total_products:       number;
  active_products:      number;
  open_tasks:           number;
  overdue_tasks:        number;
  active_sprints:       number;
  team_capacity_pct:    number;
  recent_deployments:   DeploymentDto[];
  priority_breakdown:   { priority: string; count: number }[];
  deployment_trend:     { date: string; count: number }[];
  task_status_breakdown:{ status: string; count: number }[];
}

export interface ActiveSprintDto {
  id:                    string;
  name:                  string;
  goal:                  string;
  start_date:            string;
  end_date:              string;
  task_count:            number;
  completed_task_count:  number;
  story_points_total:    number;
  story_points_done:     number;
}

export interface WorkloadDto {
  developer_id:          string;
  developer_name:        string;
  capacity_hours_week:   number;
  current_load_hours:    number;
  open_task_count:       number;
  utilization_pct:       number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI-SDLC — Workflow Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

export type WorkflowPhase =
  | 'pm_build'
  | 'dev_handoff'
  | 'qa_cycle'
  | 'acceptance'
  | 'production';

export interface WorkflowStateDto extends BaseDto {
  product_id:             string;
  product_name:           string;
  phase:                  WorkflowPhase;
  phase_started_at:       string;
  phase_note:             string;
  transitioned_by_name?:  string;
}

export interface WorkflowAuditLogDto {
  id:                     string;
  product_id:             string;
  product_name:           string;
  from_phase:             string;
  to_phase:               string;
  transition_note:        string;
  transitioned_by_name?:  string;
  created_at:             string;
}

export interface TransitionPhaseRequest {
  product_id:       string;
  to_phase:         WorkflowPhase;
  transition_note?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI-SDLC — PM Sign-Off Checklist
// ═══════════════════════════════════════════════════════════════════════════════

export interface PmSignoffChecklistDto extends BaseDto {
  product_id:           string;
  product_name:         string;
  items:                ChecklistItem[];   // parsed from JSON
  all_complete:         boolean;
  signed_off_by_name?:  string;
  signed_off_at?:       string;
  notes:                string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI-SDLC — Prompt Library
// ═══════════════════════════════════════════════════════════════════════════════

export interface PromptLibraryDto extends BaseDto {
  name:                   string;
  description:            string;
  category:               string;
  is_active:              boolean;
  version_count:          number;
  current_version_number: number;
}

export interface PromptVersionDto extends BaseDto {
  prompt_id:         string;
  prompt_name:       string;
  version_number:    number;
  content:           string;
  model:             string;   // e.g. gpt-4o, claude-3-5-sonnet
  system_message:    string;
  is_active:         boolean;
  created_by_name?:  string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI-SDLC — QA Cycles & Issues
// ═══════════════════════════════════════════════════════════════════════════════

export type QaCycleStatus       = 'open' | 'in_review' | 'closed';
export type QaIssueReviewStatus = 'pending' | 'accepted' | 'modified' | 'rejected';
export type ConfidenceRating    = 'high' | 'medium' | 'low';
export type RejectionReasonCode =
  | 'logic_error'
  | 'performance_issue'
  | 'security_risk'
  | 'style_violation'
  | 'scope_creep';

export interface QaCycleDto extends BaseDto {
  product_id:        string;
  product_name:      string;
  cycle_number:      number;
  status:            QaCycleStatus;
  version_ref:       string;
  opened_by_name?:   string;
  closed_by_name?:   string;
  closed_at?:        string;
  total_issues:      number;
  ai_fixed_issues:   number;
  accepted_count:    number;
  rejected_count:    number;
}

export interface QaIssueDto extends BaseDto {
  qa_cycle_id:            string;
  description:            string;
  severity:               string;   // critical | high | medium | low
  module:                 string;
  repro_steps:            string;
  ai_fix_applied:         string;
  confidence_rating?:     ConfidenceRating;
  review_status:          QaIssueReviewStatus;
  review_notes?:          string;
  rejection_reason_code?: RejectionReasonCode;
  rejection_notes?:       string;
  reviewer_name?:         string;
  reviewed_at?:           string;
  prompt_version_id?:     string;
  ai_model_used?:         string;
}

export interface ReviewQaIssueRequest {
  review_status:           QaIssueReviewStatus;
  review_notes?:           string;
  rejection_reason_code?:  RejectionReasonCode;
  rejection_notes?:        string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI-SDLC — Analyzer Reports & Git Diffs
// ═══════════════════════════════════════════════════════════════════════════════

export interface AnalyzerReportDto extends BaseDto {
  qa_cycle_id:          string;
  status:               string;   // pending | running | completed | failed
  total_files_changed:  number;
  total_additions:      number;
  total_deletions:      number;
  issues_flagged:       number;
  regression_flags:     number;
  overall_confidence:   string;
  summary:              string;
  changed_files_json:   string;   // JSON array of { file, additions, deletions, issue_id }
  triggered_by_name?:   string;
}

export interface GitDiffResultDto extends BaseDto {
  analyzer_report_id: string;
  file_path:          string;
  additions:          number;
  deletions:          number;
  patch_summary:      string;
  issue_id?:          string;
}

export interface TriggerAnalyzerRequest {
  qa_cycle_id:    string;
  repo_path?:     string;   // used by real IGitDiffService; ignored by mock
  branch_from?:   string;
  branch_to?:     string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI-SDLC — PDM Acceptance Sign-Off
// ═══════════════════════════════════════════════════════════════════════════════

export type PdmSignoffStatus = 'pending' | 'approved' | 'rejected';

export interface PdmAcceptanceSignoffDto extends BaseDto {
  product_id:       string;
  product_name:     string;
  qa_cycle_id:      string;
  status:           PdmSignoffStatus;
  decision_notes:   string;
  signed_by_name?:  string;
  signed_at?:       string;
}

export interface ApprovePdmSignoffRequest {
  decision_notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI-SDLC — KPI Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

export interface KpiSnapshotDto extends BaseDto {
  product_id:            string;
  product_name:          string;
  qa_cycle_id:           string;
  ai_auto_fix_rate:      number;   // 0–1 decimal fraction
  cycle_duration_days:   number;
  acceptance_rate:       number;   // 0–1
  regression_rate:       number;   // 0–1
  override_rate:         number;   // 0–1  (manual fix overrides)
  incident_count:        number;
}

export interface KpiDashboardSummaryDto {
  snapshots:               KpiSnapshotDto[];
  avg_auto_fix_rate:       number;
  avg_acceptance_rate:     number;
  avg_cycle_duration_days: number;
  total_incidents:         number;
  trend_direction:         'improving' | 'stable' | 'degrading';
}
