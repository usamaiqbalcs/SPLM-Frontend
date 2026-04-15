/**
 * apiClient.ts — Unified .NET Backend API Layer
 *
 * All data operations now route to the ZenaTech SPLM .NET backend.
 * Supabase is no longer used for data or authentication.
 *
 * Authentication: short-lived JWT (`zenatech_jwt`) + refresh token (`zenatech_refresh`).
 * On 401, netFetch attempts one rotation via POST /auth/refresh (except auth endpoints).
 *
 * JSON convention: the backend returns snake_case (PropertyNamingPolicy.SnakeCaseLower).
 * Request bodies are automatically converted to snake_case in netFetch so the
 * TypeScript caller can pass camelCase objects as normal.
 */

import type { GlobalSearchResponse } from '@/lib/global-search-types';
import { nullifyEmptyDateFields } from '@/lib/api-json';
import { toast } from 'sonner';
import {
  getAccessToken as getToken,
  looksLikeAccessJwt,
  tryRefreshAccessToken,
} from '@/lib/token-lifecycle';

// ── Configuration ─────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Pull human-readable messages from ASP.NET ProblemDetails / FluentValidation `errors` shapes. */
function flattenApiValidationErrors(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw)) {
    return raw
      .map((x) => (typeof x === 'string' ? x : JSON.stringify(x)))
      .filter(Boolean)
      .join('; ');
  }
  if (typeof raw !== 'object') return String(raw);
  const parts: string[] = [];
  for (const v of Object.values(raw as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === 'string' && item.trim()) parts.push(item.trim());
      }
    } else if (typeof v === 'string' && v.trim()) {
      parts.push(v.trim());
    }
  }
  return parts.join('; ');
}

function authHeaders(): HeadersInit {
  const token = getToken();
  const ok = !!token && looksLikeAccessJwt(token);
  return {
    'Content-Type': 'application/json',
    ...(ok ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Convert camelCase / PascalCase object keys → snake_case recursively.
 *  This lets callers write  { storyPoints: 5 }  and have the backend receive
 *  { story_points: 5 }  which matches the SnakeCaseLower naming policy. */
export function toSnake(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(toSnake);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k.replace(/([A-Z])/g, m => `_${m.toLowerCase()}`),
        toSnake(v),
      ]),
    );
  }
  return obj;
}

/** Core fetch helper — attaches auth header and transforms response. */
export async function netFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  const canTryRefresh =
    !path.startsWith('/auth/refresh') &&
    !path.startsWith('/auth/login') &&
    !path.startsWith('/auth/register') &&
    !path.startsWith('/auth/validate-reset-token') &&
    !path.startsWith('/auth/reset-password');

  const exec = () =>
    fetch(`${API_BASE}/api/v1${path}`, {
      method,
      headers: authHeaders(),
      ...(body !== undefined
        ? { body: JSON.stringify(nullifyEmptyDateFields(toSnake(body))) }
        : {}),
    });

  let res = await exec();

  if (res.status === 401 && canTryRefresh && (await tryRefreshAccessToken())) {
    res = await exec();
  }

  if (!res.ok) {
    if (res.status === 403) {
      const err = await res.json().catch(() => ({} as Record<string, unknown>));
      const friendly =
        typeof err?.message === 'string' && err.message.trim()
          ? String(err.message).trim()
          : 'You do not have permission to perform this action.';
      toast.error(friendly);
      throw new Error(friendly);
    }
    const err = await res.json().catch(() => ({} as Record<string, unknown>));
    const fromErrors = flattenApiValidationErrors(err?.errors);
    const detail = typeof err?.detail === 'string' ? err.detail.trim() : '';
    const title = typeof err?.title === 'string' ? err.title.trim() : '';
    const generic = 'One or more validation errors occurred.';
    const msg =
      (fromErrors ? fromErrors : '') ||
      (detail && detail !== generic ? detail : '') ||
      (typeof err?.message === 'string' && err.message.trim() ? String(err.message).trim() : '') ||
      (title && title !== generic ? title : '') ||
      (detail || title || `HTTP ${res.status}`);
    throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Type definitions ──────────────────────────────────────────────────────────
// Field names match the snake_case JSON the backend returns.

export interface TaskDto {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  type: string;
  product_id?: string;
  product_name?: string;
  sprint_id?: string;
  sprint_name?: string;
  assigned_to?: string;
  assignee_name?: string;
  assignee_email?: string;
  assignee_avatar?: string;
  story_points: number;
  estimated_hours?: number;
  due_date?: string;
  is_overdue: boolean;
  subtask_count: number;
  completed_subtask_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
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

export interface TaskQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  priority?: string;
  type?: string;
  productId?: string;
  sprintId?: string;
  assignedTo?: string;
  isOverdue?: boolean;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface ProductQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface DeveloperQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

function toQueryString(params: Record<string, unknown>): string {
  return new URLSearchParams(
    Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ),
  ).toString();
}

// ── Tasks module ──────────────────────────────────────────────────────────────

export const tasksApi = {
  getPage: async (params: TaskQueryParams = {}): Promise<PagedResult<TaskDto>> => {
    const merged = { page: 1, pageSize: 10, ...params };
    const qs = toQueryString(merged as Record<string, unknown>);
    return netFetch<PagedResult<TaskDto>>('GET', `/tasks?${qs}`);
  },

  /** @deprecated Prefer getPage — returns one page of items only (default 10). */
  getAll: async (params: TaskQueryParams = {}): Promise<TaskDto[]> =>
    (await tasksApi.getPage(params)).items,

  getById: async (id: string): Promise<TaskDto | null> =>
    netFetch<TaskDto>('GET', `/tasks/${id}`),

  getMyQueue: async (developerId: string): Promise<TaskDto[]> =>
    netFetch<TaskDto[]>('GET', `/tasks/my-queue?developerId=${developerId}`),

  create: async (data: Partial<TaskDto>): Promise<TaskDto> =>
    netFetch<TaskDto>('POST', '/tasks', data),

  update: async (id: string, data: Partial<TaskDto>): Promise<TaskDto> =>
    netFetch<TaskDto>('PUT', `/tasks/${id}`, data),

  delete: async (id: string): Promise<void> =>
    netFetch<void>('DELETE', `/tasks/${id}`),

  getComments: async (taskId: string) =>
    netFetch<any[]>('GET', `/tasks/${taskId}/comments`),

  addComment: async (taskId: string, content: string) =>
    netFetch<any>('POST', `/tasks/${taskId}/comments`, { content }),

  deleteComment: async (taskId: string, commentId: string) =>
    netFetch<void>('DELETE', `/tasks/${taskId}/comments/${commentId}`),

  getSubtasks: async (taskId: string) =>
    netFetch<any[]>('GET', `/tasks/${taskId}/subtasks`),

  addSubtask: async (taskId: string, title: string) =>
    netFetch<any>('POST', `/tasks/${taskId}/subtasks`, { title }),

  updateSubtask: async (taskId: string, subtaskId: string, data: { completed?: boolean; title?: string }) =>
    netFetch<any>('PUT', `/tasks/${taskId}/subtasks/${subtaskId}`, data),

  deleteSubtask: async (taskId: string, subtaskId: string) =>
    netFetch<void>('DELETE', `/tasks/${taskId}/subtasks/${subtaskId}`),
};

// ── Header notifications (read keys persisted server-side) ───────────────────

export const notificationsApi = {
  getReadKeys: async (): Promise<{ keys: string[] }> =>
    netFetch<{ keys: string[] }>('GET', '/notifications/read-keys'),

  addReadKeys: async (keys: string[], options?: { markAll?: boolean }): Promise<void> => {
    if (!keys.length && !options?.markAll) return;
    await netFetch<void>('POST', '/notifications/read-keys', {
      keys,
      markAll: options?.markAll === true,
    });
  },
};

// ── Products module ───────────────────────────────────────────────────────────

export const productsApi = {
  getPage: async (params: ProductQueryParams = {}) => {
    const merged = { page: 1, pageSize: 10, ...params };
    const qs = toQueryString(merged as Record<string, unknown>);
    return netFetch<PagedResult<any>>('GET', `/products?${qs}`);
  },

  /** First page only (up to 100 rows) — for simple dropdowns; use getPage for full lists. */
  getAll: async () => (await productsApi.getPage({ page: 1, pageSize: 100 })).items,

  getById: async (id: string) => netFetch<any>('GET', `/products/${id}`),

  create: async (data: any) => netFetch<any>('POST', '/products', data),

  update: async (id: string, data: any) => netFetch<any>('PUT', `/products/${id}`, data),

  delete: async (id: string) => netFetch<void>('DELETE', `/products/${id}`),
};

// ── Developers module ─────────────────────────────────────────────────────────

export const developersApi = {
  getPage: async (params: DeveloperQueryParams = {}) => {
    const merged = { page: 1, pageSize: 10, ...params };
    const qs = toQueryString(merged as Record<string, unknown>);
    return netFetch<PagedResult<any>>('GET', `/developers?${qs}`);
  },

  getAll: async () => (await developersApi.getPage({ page: 1, pageSize: 100 })).items,

  getByEmail: async (email: string) =>
    netFetch<any>('GET', `/developers/by-email?email=${encodeURIComponent(email)}`),

  create: async (data: any) => netFetch<any>('POST', '/developers', data),

  update: async (id: string, data: any) => netFetch<any>('PUT', `/developers/${id}`, data),

  delete: async (id: string) => netFetch<void>('DELETE', `/developers/${id}`),
};

// ── Analytics module ──────────────────────────────────────────────────────────

export const analyticsApi = {
  getDashboard: async () => netFetch<any>('GET', '/analytics/dashboard'),

  getActiveSprints: async () => netFetch<any[]>('GET', '/analytics/sprints/active'),

  getWorkload: async () => netFetch<any[]>('GET', '/analytics/workload'),
};

// ── Sprints module ────────────────────────────────────────────────────────────

export const sprintsApi = {
  getAll: async () => netFetch<any[]>('GET', '/sprints'),

  getById: async (id: string) => netFetch<any>('GET', `/sprints/${id}`),

  create: async (data: any) => netFetch<any>('POST', '/sprints', data),

  update: async (id: string, data: any) => netFetch<any>('PUT', `/sprints/${id}`, data),

  delete: async (id: string) => netFetch<void>('DELETE', `/sprints/${id}`),

  assignTask: async (sprintId: string, taskId: string) =>
    netFetch<any>('POST', `/sprints/${sprintId}/assign-task/${taskId}`),
};

// ── Deployments module ────────────────────────────────────────────────────────

export interface DeploymentQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  productId?: string;
  environment?: string;
  status?: string;
}

export const deploymentsApi = {
  getPage: async (params: DeploymentQueryParams = {}): Promise<PagedResult<any>> => {
    const merged = { page: 1, pageSize: 10, ...params };
    const qs = toQueryString(merged as Record<string, unknown>);
    return netFetch<PagedResult<any>>('GET', `/deployments?${qs}`);
  },

  getAll: async () => (await deploymentsApi.getPage({ page: 1, pageSize: 100 })).items,

  create: async (data: any) => netFetch<any>('POST', '/deployments', data),

  /** Advance pipeline (pending→building→…) or mark failed. */
  patch: async (id: string, data: { status?: string; fail_reason?: string }) =>
    netFetch<any>('PATCH', `/deployments/${id}`, data),
};

// ── Versions (semantic product versions) ─────────────────────────────────────

export const versionsApi = {
  getAll: async (productId?: string) => {
    const q = productId ? `?productId=${encodeURIComponent(productId)}` : '';
    return netFetch<any[]>('GET', `/versions${q}`);
  },

  getById: async (id: string) => netFetch<any>('GET', `/versions/${id}`),

  create: async (data: any) => netFetch<any>('POST', '/versions', data),

  update: async (id: string, data: any) => netFetch<any>('PUT', `/versions/${id}`, data),

  delete: async (id: string) => netFetch<void>('DELETE', `/versions/${id}`),

  release: async (id: string) => netFetch<any>('POST', `/versions/${id}/release`),
};

// ── Deployment environments (per product) ───────────────────────────────────

export const environmentsApi = {
  getAll: async (productId?: string) => {
    const q = productId ? `?productId=${encodeURIComponent(productId)}` : '';
    return netFetch<any[]>('GET', `/environments${q}`);
  },

  getById: async (id: string) => netFetch<any>('GET', `/environments/${id}`),

  create: async (data: any) => netFetch<any>('POST', '/environments', data),

  update: async (id: string, data: any) => netFetch<any>('PUT', `/environments/${id}`, data),

  delete: async (id: string) => netFetch<void>('DELETE', `/environments/${id}`),
};

// ── Releases module ───────────────────────────────────────────────────────────

export interface ReleaseQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

/** Paged releases + filter-scoped status counts (matches backend ReleasePageDto). */
export interface ReleasePageDto {
  items: any[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_previous_page: boolean;
  has_next_page: boolean;
  stats: {
    total: number;
    planned: number;
    in_progress: number;
    staging: number;
    released: number;
    cancelled: number;
  };
}

export const releasesApi = {
  getPage: async (params: ReleaseQueryParams = {}): Promise<ReleasePageDto> => {
    const merged = { page: 1, pageSize: 10, ...params };
    const qs = toQueryString(merged as Record<string, unknown>);
    return netFetch<ReleasePageDto>('GET', `/releases?${qs}`);
  },

  getAll: async () => (await releasesApi.getPage({ page: 1, pageSize: 100 })).items,

  create: async (data: any) => netFetch<any>('POST', '/releases', data),

  update: async (id: string, data: any) => netFetch<any>('PUT', `/releases/${id}`, data),

  delete: async (id: string) => netFetch<void>('DELETE', `/releases/${id}`),
};

// ── Feedback module ───────────────────────────────────────────────────────────

export interface FeedbackQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  productId?: string;
  channel?: string;
  sentiment?: string;
}

export interface FeedbackPageDto {
  items: any[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_previous_page: boolean;
  has_next_page: boolean;
  stats: {
    total: number;
    positive: number;
    neutral: number;
    negative: number;
    critical: number;
    avg_urgency: number;
  };
}

export const feedbackApi = {
  getPage: async (params: FeedbackQueryParams = {}): Promise<FeedbackPageDto> => {
    const merged = { page: 1, pageSize: 10, ...params };
    const qs = toQueryString(merged as Record<string, unknown>);
    return netFetch<FeedbackPageDto>('GET', `/feedback?${qs}`);
  },

  getAll: async () => (await feedbackApi.getPage({ page: 1, pageSize: 100 })).items,

  create: async (data: any) => netFetch<any>('POST', '/feedback', data),

  update: async (id: string, data: any) => netFetch<any>('PUT', `/feedback/${id}`, data),

  delete: async (id: string) => netFetch<void>('DELETE', `/feedback/${id}`),
};

// ── Research module ───────────────────────────────────────────────────────────

export interface ResearchQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  urgency?: string;
  productId?: string;
}

export interface ResearchPageDto {
  items: any[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_previous_page: boolean;
  has_next_page: boolean;
  stats: {
    total: number;
    low: number;
    medium: number;
    within_30_days?: number;
    within30_days?: number;
    immediate: number;
  };
}

export const researchApi = {
  getPage: async (params: ResearchQueryParams = {}): Promise<ResearchPageDto> => {
    const merged = { page: 1, pageSize: 10, ...params };
    const qs = toQueryString(merged as Record<string, unknown>);
    return netFetch<ResearchPageDto>('GET', `/research?${qs}`);
  },

  getAll: async () => (await researchApi.getPage({ page: 1, pageSize: 100 })).items,

  create: async (data: any) => netFetch<any>('POST', '/research', data),

  update: async (id: string, data: any) => netFetch<any>('PUT', `/research/${id}`, data),

  delete: async (id: string) => netFetch<void>('DELETE', `/research/${id}`),
};

// ── Global search (unified backend) ───────────────────────────────────────────

export const globalSearchApi = {
  search: async (q: string, limit = 60): Promise<GlobalSearchResponse> => {
    const qs = toQueryString({ q: q.trim(), limit } as Record<string, unknown>);
    return netFetch<GlobalSearchResponse>('GET', `/search?${qs}`);
  },
};

// ── Public auth (password reset via email link) ───────────────────────────────

export const authPublicApi = {
  validateResetToken: async (token: string): Promise<{ valid: boolean }> =>
    netFetch<{ valid: boolean }>('POST', '/auth/validate-reset-token', { token }),

  resetPassword: async (body: {
    token: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ success: boolean; message: string }> =>
    netFetch<{ success: boolean; message: string }>('POST', '/auth/reset-password', body),
};

// ── Admin users (identity.manage) ─────────────────────────────────────────────

export interface AdminUserListItemDto {
  user_id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUserPageDto {
  items: AdminUserListItemDto[];
  total: number;
  page: number;
  limit: number;
}

export const adminUsersApi = {
  getPage: async (params: { page?: number; pageSize?: number; search?: string } = {}) => {
    const merged = { page: 1, pageSize: 25, ...params };
    const qs = toQueryString(merged as Record<string, unknown>);
    return netFetch<AdminUserPageDto>('GET', `/admin/users?${qs}`);
  },

  getById: async (userId: string): Promise<AdminUserListItemDto> =>
    netFetch<AdminUserListItemDto>('GET', `/admin/users/${userId}`),

  patchRole: async (userId: string, role: string): Promise<AdminUserListItemDto> =>
    netFetch<AdminUserListItemDto>('PATCH', `/admin/users/${userId}/role`, { role }),

  patchActive: async (userId: string, active: boolean): Promise<AdminUserListItemDto> =>
    netFetch<AdminUserListItemDto>('PATCH', `/admin/users/${userId}/active`, { active }),

  createUser: async (body: {
    email: string;
    name: string;
    password: string;
    role: string;
  }): Promise<AdminUserListItemDto> => netFetch<AdminUserListItemDto>('POST', '/admin/users', body),

  sendPasswordReset: async (
    userId: string,
  ): Promise<{ success: boolean; message: string }> =>
    netFetch<{ success: boolean; message: string }>('POST', `/admin/users/${userId}/send-password-reset`),
};

// ── Admin RBAC (identity.manage) ──────────────────────────────────────────────

export interface RbacRoleRowDto {
  name: string;
  display_name?: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface RbacPermissionRowDto {
  name: string;
  description?: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface RbacMatrixDto {
  roles: RbacRoleRowDto[];
  permissions: RbacPermissionRowDto[];
  role_permissions: Record<string, string[]>;
}

export const adminRbacApi = {
  getMatrix: (): Promise<RbacMatrixDto> => netFetch<RbacMatrixDto>('GET', '/admin/rbac/matrix'),

  updateRolePermissions: (roleName: string, permissionNames: string[]): Promise<void> =>
    netFetch<void>('PUT', `/admin/rbac/roles/${encodeURIComponent(roleName)}/permissions`, {
      permissionNames,
    }),
};

// ── Admin audit logs (audit.read) ─────────────────────────────────────────────

export interface AuditLogQueryParams {
  page?: number;
  pageSize?: number;
  module?: string;
  action?: string;
  performedBy?: string;
  recordId?: string;
  recordNameContains?: string;
  search?: string;
  fromUtc?: string;
  toUtc?: string;
  sortBy?: string;
  sortDescending?: boolean;
}

export interface AuditLogDto {
  id: number;
  module_name: string;
  record_id: string;
  record_name?: string | null;
  action: string;
  description?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  performed_by?: string | null;
  performed_by_name?: string | null;
  performed_by_email?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface AuditLogPageDto {
  items: AuditLogDto[];
  total: number;
  page: number;
  limit: number;
}

export const auditLogsApi = {
  getPage: async (params: AuditLogQueryParams = {}): Promise<AuditLogPageDto> => {
    const merged = {
      page: 1,
      pageSize: 25,
      sortBy: 'created_at',
      sortDescending: true,
      ...params,
    };
    const qs = toQueryString(merged as Record<string, unknown>);
    return netFetch<AuditLogPageDto>('GET', `/admin/audit-logs?${qs}`);
  },

  getById: async (id: number): Promise<AuditLogDto> =>
    netFetch<AuditLogDto>('GET', `/admin/audit-logs/${id}`),
};

// ── Wiki module ───────────────────────────────────────────────────────────────

export const wikiApi = {
  getSpaces: async (params?: { page?: number; pageSize?: number; search?: string }) => {
    const merged = { page: 1, pageSize: 10, ...params };
    const qs = toQueryString(merged as Record<string, unknown>);
    return netFetch<any>('GET', `/wiki/spaces?${qs}`);
  },

  createSpace: async (data: any) => netFetch<any>('POST', '/wiki/spaces', data),

  updateSpace: async (id: string, data: any) => netFetch<any>('PUT', `/wiki/spaces/${id}`, data),

  deleteSpace: async (id: string) => netFetch<void>('DELETE', `/wiki/spaces/${id}`),

  getPages: async (spaceId: string) => netFetch<any[]>('GET', `/wiki/spaces/${spaceId}/pages`),

  getPage: async (pageId: string) => netFetch<any>('GET', `/wiki/pages/${pageId}`),

  createPage: async (spaceId: string, data: any) =>
    netFetch<any>('POST', `/wiki/spaces/${spaceId}/pages`, data),

  updatePage: async (pageId: string, data: any) =>
    netFetch<any>('PUT', `/wiki/pages/${pageId}`, data),

  deletePage: async (pageId: string) => netFetch<void>(`DELETE`, `/wiki/pages/${pageId}`),
};

// ── Health check ──────────────────────────────────────────────────────────────

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
