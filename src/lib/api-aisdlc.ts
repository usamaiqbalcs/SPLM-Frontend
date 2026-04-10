/**
 * api-aisdlc.ts — AI-SDLC Feature API Client
 *
 * All 14 missing AI-SDLC features route through this module.
 * Uses the same netFetch helper and JWT auth as apiClient.ts.
 */

import { netFetch } from '@/lib/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkflowStateDto {
  id: string;
  product_id: string;
  product_name: string;
  phase: 'pm_build' | 'dev_handoff' | 'qa_cycle' | 'acceptance' | 'production';
  phase_started_at: string;
  phase_note: string;
  transitioned_by_name?: string;
  updated_at: string;
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

export interface PmSignoffChecklistDto {
  id: string;
  product_id: string;
  product_name: string;
  items: string; // JSON
  all_complete: boolean;
  signed_off_by_name?: string;
  signed_off_at?: string;
  notes: string;
  updated_at: string;
}

export interface PromptLibraryDto {
  id: string;
  name: string;
  description: string;
  category: string;
  is_active: boolean;
  version_count: number;
  current_version_number: number;
  updated_at: string;
}

export interface PromptVersionDto {
  id: string;
  prompt_id: string;
  prompt_name: string;
  version_number: number;
  content: string;
  change_notes: string;
  is_current: boolean;
  effectiveness_score: number;
  created_at: string;
}

export interface QaCycleDto {
  id: string;
  product_id: string;
  product_name: string;
  cycle_number: number;
  version_label: string;
  status: 'open' | 'in_review' | 'closed' | 'passed';
  started_at: string;
  closed_at?: string;
  total_issues_found: number;
  total_fixes_applied: number;
  regressions_found: number;
  pass_rate_pct: number;
  notes: string;
  updated_at: string;
}

export interface QaIssueDto {
  id: string;
  qa_cycle_id: string;
  product_id: string;
  product_name: string;
  issue_ref: string;
  title: string;
  description: string;
  affected_module: string;
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  reproduction_steps: string;
  prompt_version_id?: string;
  prompt_name?: string;
  prompt_version_number?: number;
  ai_model_used: string;
  fix_applied: boolean;
  fix_description: string;
  confidence_rating: 'high' | 'medium' | 'low';
  review_status: 'pending' | 'accepted' | 'modified' | 'rejected';
  rejection_reason_code?: string;
  rejection_notes: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  tester_name?: string;
  is_regression: boolean;
  created_at: string;
  updated_at: string;
}

export interface AnalyzerReportDto {
  id: string;
  qa_cycle_id: string;
  product_id: string;
  product_name: string;
  report_reference: string;
  total_issues_found: number;
  total_fixes_applied: number;
  changed_files_json: string; // JSON array
  diff_summary: string;
  overall_confidence: 'high' | 'medium' | 'low';
  analyzer_engine: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  run_triggered_at: string;
  run_completed_at?: string;
  notes: string;
  git_diff?: GitDiffResultDto;
  updated_at: string;
}

export interface GitDiffResultDto {
  id: string;
  base_commit: string;
  head_commit: string;
  diff_content: string;
  files_changed: number;
  lines_added: number;
  lines_removed: number;
  provider: string;
  fetched_at: string;
}

export interface PdmAcceptanceSignoffDto {
  id: string;
  product_id: string;
  product_name: string;
  qa_cycle_id: string;
  status: 'pending' | 'approved' | 'rejected';
  signed_off_by_name?: string;
  signed_off_at?: string;
  rejection_reason: string;
  business_flows_validated: boolean;
  no_p1_p2_open: boolean;
  perf_benchmarks_met: boolean;
  pdm_notes: string;
  updated_at: string;
}

export interface KpiSnapshotDto {
  id: string;
  product_id?: string;
  product_name?: string;
  snapshot_date: string;
  qa_cycle_id?: string;
  ai_auto_fix_rate_pct: number;
  qa_cycle_duration_days: number;
  pm_delivery_on_time: boolean;
  acceptance_pass_rate_pct: number;
  regression_rate_pct: number;
  developer_override_rate_pct: number;
  production_incident_count: number;
  total_issues: number;
  total_fixes_accepted: number;
  total_fixes_rejected: number;
  created_at: string;
}

export interface KpiDashboardSummaryDto {
  avg_ai_auto_fix_rate_pct: number;
  avg_qa_cycle_duration_days: number;
  avg_acceptance_pass_rate_pct: number;
  avg_regression_rate_pct: number;
  avg_developer_override_rate_pct: number;
  total_production_incidents: number;
  total_products: number;
  total_qa_cycles: number;
  recent_snapshots: KpiSnapshotDto[];
  product_breakdown: KpiSnapshotDto[];
}

// ── Route base — AiSdlcController is registered at api/v1/ai-sdlc/... ─────────
const B = '/ai-sdlc';

// ── Workflow Pipeline ──────────────────────────────────────────────────────────

export const workflowApi = {
  getAll: () => netFetch<WorkflowStateDto[]>('GET', `${B}/workflow-states`),
  getByProduct: (productId: string) => netFetch<WorkflowStateDto>('GET', `${B}/workflow-states/product/${productId}`),
  transition: (data: { product_id: string; to_phase: string; note?: string }) =>
    netFetch<WorkflowStateDto>('POST', `${B}/workflow-states/transition`, data),
  getAudit: (productId: string) => netFetch<WorkflowAuditLogDto[]>('GET', `${B}/workflow-states/audit/${productId}`),
};

// ── PM Sign-Off Checklist ──────────────────────────────────────────────────────

export const pmChecklistApi = {
  get: (productId: string) => netFetch<PmSignoffChecklistDto>('GET', `${B}/pm-checklists/${productId}`),
  upsert: (data: any) => netFetch<PmSignoffChecklistDto>('POST', `${B}/pm-checklists`, data),
};

// ── Prompt Library ─────────────────────────────────────────────────────────────

export const promptLibraryApi = {
  getAll: () => netFetch<PromptLibraryDto[]>('GET', `${B}/prompt-library`),
  create: (data: any) => netFetch<PromptLibraryDto>('POST', `${B}/prompt-library`, data),
  getVersions: (promptId: string) => netFetch<PromptVersionDto[]>('GET', `${B}/prompt-library/${promptId}/versions`),
  createVersion: (data: any) => netFetch<PromptVersionDto>('POST', `${B}/prompt-library/versions`, data),
};

// ── QA Cycles ──────────────────────────────────────────────────────────────────

export const qaCyclesApi = {
  getAll: (productId?: string) => netFetch<QaCycleDto[]>('GET', `${B}/qa-cycles${productId ? `?productId=${productId}` : ''}`),
  getById: (id: string) => netFetch<QaCycleDto>('GET', `${B}/qa-cycles/${id}`),
  create: (data: any) => netFetch<QaCycleDto>('POST', `${B}/qa-cycles`, data),
  update: (id: string, data: any) => netFetch<QaCycleDto>('PUT', `${B}/qa-cycles/${id}`, data),
};

// ── QA Issues ──────────────────────────────────────────────────────────────────

export const qaIssuesApi = {
  getByCycle: (cycleId: string) => netFetch<QaIssueDto[]>('GET', `${B}/qa-cycles/${cycleId}/issues`),
  getById: (id: string) => netFetch<QaIssueDto>('GET', `${B}/qa-issues/${id}`),
  create: (data: any) => netFetch<QaIssueDto>('POST', `${B}/qa-issues`, data),
  review: (id: string, data: { review_status: string; rejection_reason_code?: string; rejection_notes?: string }) =>
    netFetch<QaIssueDto>('POST', `${B}/qa-issues/${id}/review`, data),
};

// ── Analyzer Reports ───────────────────────────────────────────────────────────

export const analyzerReportsApi = {
  getAll: (qaCycleId?: string) => netFetch<AnalyzerReportDto[]>('GET', `${B}/analyzer-reports${qaCycleId ? `?qaCycleId=${qaCycleId}` : ''}`),
  getById: (id: string) => netFetch<AnalyzerReportDto>('GET', `${B}/analyzer-reports/${id}`),
  trigger: (data: { qa_cycle_id: string; product_id: string }) =>
    netFetch<AnalyzerReportDto>('POST', `${B}/analyzer-reports/trigger`, data),
};

// ── PDM Acceptance Sign-Off ────────────────────────────────────────────────────

export const pdmSignoffApi = {
  getAll: (productId?: string) => netFetch<PdmAcceptanceSignoffDto[]>('GET', `${B}/pdm-signoffs${productId ? `?productId=${productId}` : ''}`),
  upsert: (data: any) => netFetch<PdmAcceptanceSignoffDto>('POST', `${B}/pdm-signoffs`, data),
  approve: (id: string, data: { status: string; rejection_reason?: string }) =>
    netFetch<PdmAcceptanceSignoffDto>('POST', `${B}/pdm-signoffs/${id}/approve`, data),
};

// ── KPI Dashboard ──────────────────────────────────────────────────────────────

export const kpiApi = {
  getDashboard: (productId?: string) =>
    netFetch<KpiDashboardSummaryDto>('GET', `${B}/kpi/dashboard${productId ? `?productId=${productId}` : ''}`),
  getSnapshots: (productId?: string) =>
    netFetch<KpiSnapshotDto[]>('GET', `${B}/kpi/snapshots${productId ? `?productId=${productId}` : ''}`),
};
