/**
 * apiClient.ts — Unified .NET Backend API Layer
 *
 * All data operations now route to the ZenaTech SPLM .NET backend.
 * Supabase is no longer used for data or authentication.
 *
 * Authentication: JWT stored in localStorage under 'zenatech_jwt'.
 *
 * JSON convention: the backend returns snake_case (PropertyNamingPolicy.SnakeCaseLower).
 * Request bodies are automatically converted to snake_case in netFetch so the
 * TypeScript caller can pass camelCase objects as normal.
 */

// ── Configuration ─────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
const TOKEN_KEY = 'zenatech_jwt';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    method,
    headers: authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(toSnake(body)) } : {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({} as Record<string, unknown>));
    const rawErrors = err?.errors;
    let fromErrors = '';
    if (Array.isArray(rawErrors)) {
      fromErrors = (rawErrors as string[]).filter(Boolean).join(' ');
    } else if (rawErrors && typeof rawErrors === 'object') {
      fromErrors = Object.values(rawErrors as Record<string, string[]>)
        .flat()
        .filter(Boolean)
        .join(' ');
    }
    const msg =
      (err?.detail as string | undefined) ||
      (err?.message as string | undefined) ||
      (err?.title as string | undefined) ||
      fromErrors ||
      `HTTP ${res.status}`;
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

// ── Tasks module ──────────────────────────────────────────────────────────────

export const tasksApi = {
  getAll: async (params: TaskQueryParams = {}): Promise<TaskDto[]> => {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)]),
      ),
    ).toString();
    const result = await netFetch<PagedResult<TaskDto>>('GET', `/tasks?${qs}`);
    return result.items;
  },

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

// ── Products module ───────────────────────────────────────────────────────────

export const productsApi = {
  getAll: async () => netFetch<any[]>('GET', '/products'),

  getById: async (id: string) => netFetch<any>('GET', `/products/${id}`),

  create: async (data: any) => netFetch<any>('POST', '/products', data),

  update: async (id: string, data: any) => netFetch<any>('PUT', `/products/${id}`, data),

  delete: async (id: string) => netFetch<void>('DELETE', `/products/${id}`),
};

// ── Developers module ─────────────────────────────────────────────────────────

export const developersApi = {
  getAll: async () => netFetch<any[]>('GET', '/developers'),

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

export const deploymentsApi = {
  getAll: async () => netFetch<any[]>('GET', '/deployments'),

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

export const releasesApi = {
  getAll: async () => netFetch<any[]>('GET', '/releases'),

  create: async (data: any) => netFetch<any>('POST', '/releases', data),

  update: async (id: string, data: any) => netFetch<any>('PUT', `/releases/${id}`, data),

  delete: async (id: string) => netFetch<void>('DELETE', `/releases/${id}`),
};

// ── Feedback module ───────────────────────────────────────────────────────────

export const feedbackApi = {
  getAll: async () => netFetch<any[]>('GET', '/feedback'),

  create: async (data: any) => netFetch<any>('POST', '/feedback', data),

  update: async (id: string, data: any) => netFetch<any>('PUT', `/feedback/${id}`, data),

  delete: async (id: string) => netFetch<void>('DELETE', `/feedback/${id}`),
};

// ── Research module ───────────────────────────────────────────────────────────

export const researchApi = {
  getAll: async () => netFetch<any[]>('GET', '/research'),

  create: async (data: any) => netFetch<any>('POST', '/research', data),

  update: async (id: string, data: any) => netFetch<any>('PUT', `/research/${id}`, data),

  delete: async (id: string) => netFetch<void>('DELETE', `/research/${id}`),
};

// ── Wiki module ───────────────────────────────────────────────────────────────

export const wikiApi = {
  getSpaces: async () => netFetch<any[]>('GET', '/wiki/spaces'),

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
