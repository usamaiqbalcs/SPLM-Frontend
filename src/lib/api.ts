/**
 * api.ts — Thin compatibility shim over the .NET backend
 *
 * Previously this file contained all Supabase data calls.  It is now a
 * thin adapter that delegates every operation to the strongly-typed
 * API modules in apiClient.ts.
 *
 * Nothing changes for the 12 panels that import from this file —
 * they continue to call the same function names with the same signatures.
 *
 * NOTE: The backend returns snake_case JSON (SnakeCaseLower policy) so
 * the field names returned from each function still match what the panels
 * expect (e.g. task.assigned_to, product.tech_stack, etc.).
 */

import {
  tasksApi, productsApi, developersApi,
  feedbackApi, researchApi, releasesApi, deploymentsApi, analyticsApi,
  versionsApi, environmentsApi,
  netFetch,
} from '@/lib/apiClient';

// ── Products ──────────────────────────────────────────────────────────────────

function normalizeProductStatusForApi(s: string | undefined): string {
  const legacy: Record<string, string> = {
    draft: 'active',
    deprecated: 'maintenance',
    retired: 'archived',
    in_development: 'active',
    planned: 'active',
    staging: 'maintenance',
  };
  const v = (s || 'active').toLowerCase().trim();
  const out = legacy[v] ?? v;
  return ['active', 'maintenance', 'sunset', 'archived'].includes(out) ? out : 'active';
}

function normalizeProductTypeForApi(t: string | undefined): string {
  const v = (t || 'web_app').toLowerCase().trim().replace(/-/g, '_');
  const map: Record<string, string> = {
    webapp: 'web_app',
    mobileapp: 'mobile',
    mobile_app: 'mobile',
    saas: 'web_app',
    desktop: 'tool',
  };
  const x = map[v] ?? v;
  return ['web_app', 'mobile', 'api', 'library', 'tool'].includes(x) ? x : 'web_app';
}

const PRODUCT_LIST_ONLY_KEYS = new Set([
  'task_count',
  'open_task_count',
  'developer_count',
  'created_at',
  'updated_at',
]);

export const listProducts = () => productsApi.getAll();

export const getProduct = (id: string) => productsApi.getById(id);

export const saveProduct = async (product: any) => {
  if (product.id) {
    const id = String(product.id);
    const body = {
      name: product.name,
      description: product.description ?? '',
      status: normalizeProductStatusForApi(product.status),
      type: normalizeProductTypeForApi(product.type),
      market_category: product.market_category ?? 'Enterprise SaaS',
      update_cadence: product.update_cadence ?? 'quarterly',
      current_version: product.current_version ?? '1.0.0',
      priority_score: Number(product.priority_score ?? 0),
      customer_count: Math.max(0, Math.floor(Number(product.customer_count ?? 0))),
      tech_stack: product.tech_stack ?? '',
      repository: product.repository ?? '',
      doc_url: product.doc_url ?? '',
      icon: product.icon ?? '📦',
      external_apis: product.external_apis ?? '',
    };
    return productsApi.update(id, body);
  }
  const strip: Record<string, unknown> = { ...product };
  for (const k of PRODUCT_LIST_ONLY_KEYS) delete strip[k];
  delete strip.id;
  return productsApi.create({
    ...strip,
    status: normalizeProductStatusForApi(strip.status as string),
    type: normalizeProductTypeForApi(strip.type as string),
    customer_count: Math.max(0, Math.floor(Number(strip.customer_count ?? 0))),
    external_apis: String(strip.external_apis ?? ''),
  } as any);
};

export const deleteProduct = (id: string) => productsApi.delete(id);

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const listTasks = async (
  filters?: { product_id?: string; assigned_to?: string },
) => {
  return tasksApi.getAll({
    productId:  filters?.product_id,
    assignedTo: filters?.assigned_to,
    pageSize:   500,          // fetch a large page so panels see all tasks
  });
};

export const saveTask = async (task: any) => {
  if (task.id) return tasksApi.update(task.id, task);
  return tasksApi.create(task);
};

export const updateTaskStatus = (id: string, status: string) =>
  tasksApi.update(id, { status });

export const deleteTask = (id: string) => tasksApi.delete(id);

// ── Developers ────────────────────────────────────────────────────────────────

export const listDevelopers = () => developersApi.getAll();

export const saveDeveloper = async (dev: any) => {
  if (dev.id) return developersApi.update(dev.id, dev);
  return developersApi.create(dev);
};

export const deleteDeveloper = (id: string) => developersApi.delete(id);

// ── Feedback ──────────────────────────────────────────────────────────────────

export const listFeedback = () => feedbackApi.getAll();

export const saveFeedback = async (fb: any) => {
  const body = {
    product_id: fb.product_id || undefined,
    channel: fb.channel ?? 'manual',
    raw_content: fb.raw_content ?? '',
    sentiment: fb.sentiment ?? 'neutral',
    urgency_score: Math.min(10, Math.max(1, Number(fb.urgency_score ?? 5))),
  };
  if (fb.id) return feedbackApi.update(String(fb.id), body);
  return feedbackApi.create(body);
};

export const deleteFeedback = (id: string) => feedbackApi.delete(id);

// ── Research ──────────────────────────────────────────────────────────────────

export const listResearch = () => researchApi.getAll();

export const saveResearch = async (r: any) => {
  const body = {
    topic: (r.topic ?? '').trim(),
    source_url: (r.source_url ?? '').trim(),
    urgency: r.urgency ?? 'low',
    affected_products: r.affected_products ?? '',
    ai_analysis: r.ai_analysis ?? '',
  };
  if (r.id) return researchApi.update(String(r.id), body);
  return researchApi.create(body);
};

export const deleteResearch = (id: string) => researchApi.delete(id);

// ── Releases ──────────────────────────────────────────────────────────────────

export const listReleases = () => releasesApi.getAll();

export const saveRelease = async (r: any) => {
  if (r.id) return releasesApi.update(r.id, r);
  return releasesApi.create(r);
};

export const deleteRelease = (id: string) => releasesApi.delete(id);

// ── Deployments ───────────────────────────────────────────────────────────────

export const listDeployments = async (filters?: { environment?: string; status?: string }) => {
  const all = await deploymentsApi.getAll();
  return (all as any[]).filter((d: any) => {
    if (filters?.environment && d.environment !== filters.environment) return false;
    if (filters?.status && d.status !== filters.status) return false;
    return true;
  });
};

export const createDeployment = (d: any) => deploymentsApi.create(d);

export const updateDeploymentStatus = (id: string, status: string, failReason?: string) =>
  deploymentsApi.patch(id, { status, fail_reason: failReason });

// ── Versions / Version Control ────────────────────────────────────────────────

export const listVersions = async (productId: string) => {
  if (!productId) return [] as any[];
  return versionsApi.getAll(productId);
};

export const getVersion = (id: string) => versionsApi.getById(id);

export const saveVersion = async (v: any) => {
  const planned =
    v.planned_date && String(v.planned_date).trim() !== '' ? v.planned_date : undefined;
  if (v.id) {
    return versionsApi.update(v.id, {
      status: v.status,
      title: v.title,
      version: v.version,
      version_type: v.version_type,
      release_notes: v.release_notes,
      changelog: v.changelog,
      breaking_changes: v.breaking_changes,
      git_branch: v.git_branch,
      git_commit: v.git_commit,
      planned_date: planned,
      tasks_included: v.tasks_included ?? '',
    });
  }
  return versionsApi.create({
    product_id: v.product_id,
    version: v.version,
    version_type: v.version_type,
    title: v.title,
    release_notes: v.release_notes ?? '',
    changelog: v.changelog ?? '',
    breaking_changes: v.breaking_changes ?? '',
    git_branch: v.git_branch ?? '',
    git_commit: v.git_commit ?? '',
    planned_date: planned,
  });
};

// ── Environments ──────────────────────────────────────────────────────────────

/** Collapse snake_case / PascalCase / camelCase keys so product_id, productId, ProductId all match. */
function envJsonBucket(obj: Record<string, unknown>): Map<string, unknown> {
  const m = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const nk = k.toLowerCase().replace(/_/g, '');
    if (!m.has(nk)) m.set(nk, v);
  }
  return m;
}

function fromBucket(bucket: Map<string, unknown>, ...normNames: string[]): unknown {
  for (const n of normNames) {
    const nk = n.toLowerCase().replace(/_/g, '');
    if (bucket.has(nk)) return bucket.get(nk);
  }
  return undefined;
}

function asStr(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  return String(v);
}

/** Lower-case UUID strings so <select value> matches option values across APIs. */
export function normalizeGuidString(s: string): string {
  const t = String(s).trim();
  if (!t) return '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t) ? t.toLowerCase() : t;
}

/** Normalizes one environment row from list or GET-by-id (any common JSON shape from .NET). */
function mapEnvironmentRow(raw: any) {
  if (raw == null) return {} as Record<string, unknown>;
  let e = raw;
  if (Array.isArray(e)) e = e[0];
  if (e && typeof e === 'object' && 'data' in e && (e as any).data) e = (e as any).data;
  if (e && typeof e === 'object' && 'value' in e && (e as any).value) e = (e as any).value;
  if (!e || typeof e !== 'object') return {} as Record<string, unknown>;

  const o = e as Record<string, unknown>;

  // Fast path: API uses explicit JsonPropertyName snake_case on EnvironmentDto
  if ('product_id' in o || 'server_host' in o || 'environment' in o) {
    const notes = asStr(o.env_vars_notes ?? o.notes);
    return {
      ...o,
      id: asStr(o.id),
      product_id: asStr(o.product_id),
      product_name: asStr(o.product_name),
      server_host: asStr(o.server_host),
      server_url: asStr(o.server_url),
      deploy_method: asStr(o.deploy_method) || 'manual',
      git_repo: asStr(o.git_repo),
      git_branch: asStr(o.git_branch) || 'main',
      deploy_path: asStr(o.deploy_path),
      health_check_url: asStr(o.health_check_url),
      environment: asStr(o.environment),
      notes,
      env_vars_encrypted: notes,
    };
  }

  const b = envJsonBucket(o);

  // environment: JSON may be "environment" (JsonPropertyName) or "environment_name" (naming policy on EnvironmentName)
  const envVal = asStr(
    fromBucket(b, 'environment', 'environmentname', 'environmentName', 'Environment', 'EnvironmentName'),
  );
  const notesVal = asStr(
    fromBucket(b, 'envvarsnotes', 'env_vars_notes', 'EnvVarsNotes', 'notes', 'Notes'),
  );

  return {
    ...o,
    id: asStr(fromBucket(b, 'id', 'Id')) || asStr(o.id),
    product_id: asStr(fromBucket(b, 'productid', 'product_id', 'ProductId')) || asStr(o.product_id),
    product_name: asStr(fromBucket(b, 'productname', 'product_name', 'ProductName')),
    server_host: asStr(fromBucket(b, 'serverhost', 'server_host', 'ServerHost')),
    server_url: asStr(fromBucket(b, 'serverurl', 'server_url', 'ServerUrl')),
    deploy_method: asStr(fromBucket(b, 'deploymethod', 'deploy_method', 'DeployMethod')) || 'manual',
    git_repo: asStr(fromBucket(b, 'gitrepo', 'git_repo', 'GitRepo')),
    git_branch: asStr(fromBucket(b, 'gitbranch', 'git_branch', 'GitBranch')) || 'main',
    deploy_path: asStr(fromBucket(b, 'deploypath', 'deploy_path', 'DeployPath')),
    health_check_url: asStr(fromBucket(b, 'healthcheckurl', 'health_check_url', 'HealthCheckUrl')),
    environment: envVal,
    notes: notesVal,
    env_vars_encrypted: notesVal,
  };
}

const KNOWN_DEPLOY_METHODS = [
  'manual',
  'ssh',
  'github_actions',
  'docker',
  'aws_codedeploy',
  'ftp',
  'ci_cd',
  'kubernetes',
  'terraform',
] as const;

/** Normalizes API/list row into the shape the Environments panel form expects. */
export function normalizeEnvironmentForForm(row: any) {
  const m = mapEnvironmentRow(row) as any;
  const rawDm = String(m.deploy_method || 'manual').trim();
  const slug = rawDm.toLowerCase().replace(/\s+/g, '_');
  const deploy_method = (KNOWN_DEPLOY_METHODS as readonly string[]).includes(slug) ? slug : rawDm || 'manual';
  const id = m.id != null && m.id !== '' ? normalizeGuidString(String(m.id)) : '';
  const product_id =
    m.product_id != null && m.product_id !== '' ? normalizeGuidString(String(m.product_id)) : '';
  // Single DB column `notes` → API `env_vars_notes`; keep both form textareas in sync
  const notesBlob =
    [m.env_vars_encrypted, m.notes, m.env_vars_notes]
      .map((x: unknown) => String(x ?? '').trim())
      .find(s => s.length > 0) ?? '';
  return {
    id,
    product_id,
    product_name: String(m.product_name ?? ''),
    environment: String(m.environment || '').trim() || 'development',
    custom_environment: '',
    server_host: String(m.server_host ?? ''),
    server_url: String(m.server_url ?? ''),
    deploy_method,
    git_repo: String(m.git_repo ?? ''),
    git_branch: String(m.git_branch || 'main'),
    deploy_path: String(m.deploy_path ?? ''),
    health_check_url: String(m.health_check_url ?? ''),
    notes: notesBlob,
    env_vars_encrypted: notesBlob,
  };
}

export const listEnvironments = async () => {
  const rows = await environmentsApi.getAll();
  return (rows as any[]).map(mapEnvironmentRow);
};

function mergeEnvironmentSources(listRow: any, apiRow: any) {
  const A = mapEnvironmentRow(listRow) as any;
  const B = mapEnvironmentRow(apiRow) as any;
  const s = (x: unknown) => String(x ?? '').trim();
  /** Prefer non-empty b; empty string must fall back (?? does not treat '' as missing). */
  const coalesce = (b: unknown, a: unknown) => (s(b) !== '' ? b : a);
  const coalesceId = (b: unknown, a: unknown) => {
    const sb = s(b);
    if (sb !== '') return b;
    return a;
  };
  return {
    ...A,
    ...B,
    id: coalesceId(B.id, A.id),
    product_id: coalesceId(B.product_id, A.product_id),
    product_name: coalesce(B.product_name, A.product_name),
    environment: s(B.environment) || s(A.environment),
    server_host: coalesce(B.server_host, A.server_host),
    server_url: coalesce(B.server_url, A.server_url),
    deploy_method: s(B.deploy_method) || s(A.deploy_method) || 'manual',
    git_repo: coalesce(B.git_repo, A.git_repo),
    git_branch: s(B.git_branch) || s(A.git_branch) || 'main',
    deploy_path: coalesce(B.deploy_path, A.deploy_path),
    health_check_url: coalesce(B.health_check_url, A.health_check_url),
    notes:
      s(B.env_vars_encrypted) ||
      s(B.notes) ||
      s(A.env_vars_encrypted) ||
      s(A.notes),
    env_vars_encrypted:
      s(B.env_vars_encrypted) ||
      s(B.notes) ||
      s(A.env_vars_encrypted) ||
      s(A.notes),
  };
}

/** Loads one environment; always merges GET result with list row when provided (fixes binding gaps). */
export const getEnvironment = async (id: string, listFallback?: any) => {
  const fromList = listFallback ? normalizeEnvironmentForForm(listFallback) : null;
  try {
    const row = await environmentsApi.getById(id);
    if (fromList && listFallback) {
      return normalizeEnvironmentForForm(mergeEnvironmentSources(listFallback, row));
    }
    return normalizeEnvironmentForForm(row);
  } catch {
    if (fromList) return fromList;
    throw new Error('Environment not found');
  }
};

export const saveEnvironment = async (env: any) => {
  const envVarsNotes = [env.notes, env.env_vars_encrypted]
    .filter((x) => x != null && String(x).trim() !== '')
    .join('\n\n');

  const rowId = env.id ?? env.Id;
  if (rowId) {
    return environmentsApi.update(String(rowId), {
      server_host: env.server_host ?? '',
      server_url: env.server_url ?? '',
      deploy_method: env.deploy_method ?? 'manual',
      git_repo: env.git_repo ?? '',
      git_branch: env.git_branch ?? 'main',
      deploy_path: env.deploy_path ?? '',
      health_check_url: env.health_check_url ?? '',
      env_vars_notes: envVarsNotes,
    });
  }

  const envName = String(env.environment ?? '').trim();
  if (!envName) {
    throw new Error('Environment name is required.');
  }
  if (envName.length > 50) {
    throw new Error('Environment name cannot exceed 50 characters.');
  }

  if (!env.product_id) {
    throw new Error('Product is required.');
  }

  if (!env.server_host?.trim()) {
    throw new Error('Server host is required for a new environment.');
  }

  return environmentsApi.create({
    product_id: env.product_id,
    environment: envName,
    server_host: env.server_host.trim(),
    server_url: (env.server_url ?? '').trim(),
    deploy_method: env.deploy_method ?? 'manual',
    git_repo: (env.git_repo ?? '').trim(),
    git_branch: (env.git_branch ?? 'main').trim(),
    deploy_path: (env.deploy_path ?? '').trim(),
    health_check_url: (env.health_check_url ?? '').trim(),
    env_vars_notes: envVarsNotes,
  });
};

export const deleteEnvironment = async (id: string) => {
  await environmentsApi.delete(id);
};

// ── Analytics ─────────────────────────────────────────────────────────────────

export const getAnalytics = async () => {
  try {
    return await analyticsApi.getDashboard();
  } catch {
    // Fallback: compute from tasks + products if analytics endpoint not available
    const [products, tasks, deployments, developers] = await Promise.all([
      productsApi.getAll().catch(() => [] as any[]),
      tasksApi.getAll({ pageSize: 500 }).catch(() => [] as any[]),
      deploymentsApi.getAll().catch(() => [] as any[]),
      developersApi.getAll().catch(() => [] as any[]),
    ]);

    const today = new Date().toISOString().split('T')[0];
    const openTasks        = (tasks as any[]).filter(t => !['done', 'cancelled'].includes(t.status || ''));
    const criticalTasks    = openTasks.filter(t => t.priority === 'critical');
    const overdueTasks     = openTasks.filter(t => t.is_overdue);
    const deploysToday     = (deployments as any[]).filter(d => (d.created_at || '').startsWith(today));
    const failedDeploys    = deploysToday.filter(d => d.status === 'failed');

    const taskByStatus: Record<string, number> = {};
    (tasks as any[]).forEach(t => {
      const s = t.status || 'backlog';
      taskByStatus[s] = (taskByStatus[s] || 0) + 1;
    });

    return {
      products:         (products as any[]).length,
      active_products:  (products as any[]).filter(p => p.status === 'active').length,
      open_tasks:       openTasks.length,
      critical_tasks:   criticalTasks.length,
      overdue_tasks:    overdueTasks.length,
      total_versions:   0,
      deploys_today:    deploysToday.length,
      failed_deploys:   failedDeploys.length,
      developers:       (developers as any[]).length,
      avg_priority:     0,
      top_products:     (products as any[]).slice(0, 5),
      task_by_status:   taskByStatus,
    };
  }
};
