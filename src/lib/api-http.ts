/**
 * Shared API origin + safe JSON parsing for all backend fetches.
 *
 * Root cause of "Unexpected token '<' … not valid JSON" in production:
 * - The browser requested a URL that returned HTML (SPA index, nginx error page, login redirect)
 *   while the client assumed JSON — typically wrong/missing VITE_API_BASE_URL, or reverse-proxy
 *   sending /api traffic to the static file handler instead of the .NET API.
 *
 * parseSuccessJson / parseErrorJson read the body as text first, detect HTML, and throw
 * actionable errors instead of JSON.parse throwing opaque SyntaxErrors.
 */

let warnedMissingApiBase = false;

/**
 * Backend origin with no trailing slash.
 * - **Development:** defaults to `http://localhost:5000` when unset (matches typical local API).
 * - **Production:** defaults to `''` so requests are **same-origin** (`/api/v1/...`). Your web server
 *   must reverse-proxy `/api` (and usually `/health`) to the .NET app. If the API is on another host,
 *   set `VITE_API_BASE_URL` at **build** time (e.g. `https://api.example.com`).
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (raw == null || String(raw).trim() === '') {
    if (import.meta.env.DEV) return 'http://localhost:5000';
    if (import.meta.env.PROD && typeof window !== 'undefined' && !warnedMissingApiBase) {
      warnedMissingApiBase = true;
      console.info(
        '[SPLM] VITE_API_BASE_URL is unset — using same-origin API paths (/api/v1/...). ' +
          'Ensure your reverse proxy forwards /api to the backend, or set VITE_API_BASE_URL to the API origin at build time.',
      );
    }
    return '';
  }
  return String(raw).trim().replace(/\/+$/, '');
}

function snippet(text: string, max = 300): string {
  const s = text.replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function looksLikeHtml(body: string): boolean {
  const t = body.trimStart();
  const low = t.slice(0, 16).toLowerCase();
  return t.startsWith('<!') || low.startsWith('<!doctype') || low.startsWith('<html');
}

/**
 * Parse a successful response body as JSON (2xx with body). Do not use for 204 No Content — caller must skip.
 */
export async function parseSuccessJson<T>(res: Response, context: string): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`${context}: empty response body (HTTP ${res.status})`);
  }
  if (looksLikeHtml(trimmed)) {
    const ct = res.headers.get('content-type') ?? '';
    console.error(
      `[${context}] Expected JSON, got HTML. HTTP ${res.status} Content-Type: ${ct || 'n/a'}`,
      snippet(trimmed),
    );
    throw new Error(
      `${context}: received HTML instead of JSON (HTTP ${res.status}). ` +
        'Usually the API URL is wrong (set VITE_API_BASE_URL at build time), or the reverse proxy serves the SPA for /api. ' +
        `Snippet: ${snippet(trimmed, 220)}`,
    );
  }
  const ct = res.headers.get('content-type') ?? '';
  const jsonish = trimmed.startsWith('{') || trimmed.startsWith('[');
  if (!jsonish && !ct.includes('json')) {
    console.warn(`[${context}] Unexpected Content-Type: ${ct || 'none'}`, snippet(trimmed, 200));
  }
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[${context}] JSON.parse failed: ${msg}`, snippet(trimmed));
    throw new Error(`${context}: invalid JSON (${msg}). Snippet: ${snippet(trimmed, 220)}`);
  }
}

/**
 * Parse error response body — ASP.NET ProblemDetails JSON, or plain text, or HTML fallback message.
 */
export async function parseErrorJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) return {};
  if (looksLikeHtml(trimmed)) {
    console.warn(`[API] HTTP ${res.status} error body was HTML, not JSON`, snippet(trimmed, 200));
    return {
      title: `HTTP ${res.status}`,
      detail:
        'Server returned an HTML page instead of a JSON error. Check VITE_API_BASE_URL and reverse-proxy rules for /api.',
    };
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {
      title: `HTTP ${res.status}`,
      detail: trimmed.slice(0, 500) || `HTTP ${res.status}`,
    };
  }
}
