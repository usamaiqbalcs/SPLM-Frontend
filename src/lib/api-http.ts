/**
 * Shared API origin + safe JSON parsing for all backend fetches.
 *
 * Root cause of "Unexpected token '<' … not valid JSON" in production:
 *   VITE_API_BASE_URL was not set at build time. Vite bakes VITE_* vars into the
 *   JS bundle — runtime env vars have no effect. Without the var, getApiBaseUrl()
 *   returns '' and all fetch calls go to the same-origin CloudFront URL
 *   (https://d2gauznfeopiov.cloudfront.net/api/v1/...). CloudFront has no /api/*
 *   behavior pointing to the Lambda/API Gateway backend, so it serves index.html.
 *   The client then tries JSON.parse("<!doctype html...") → SyntaxError.
 *
 * Fix: set VITE_API_BASE_URL=https://<apigw-id>.execute-api.<region>.amazonaws.com
 *      in your CI environment BEFORE running `npm run build`.
 *      OR add a CloudFront behavior for /api/* → API Gateway origin and leave the
 *      var empty (same-origin mode).
 */

/**
 * Backend origin with no trailing slash.
 *
 * - Dev:        falls back to http://localhost:5000 when unset.
 * - Production: MUST be set at build time via VITE_API_BASE_URL.
 *               If unset, throws immediately so the misconfiguration is caught
 *               at startup rather than silently returning HTML for every API call.
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  const url = raw != null ? String(raw).trim().replace(/\/+$/, '') : '';

  if (!url) {
    if (import.meta.env.DEV) return 'http://localhost:5000';

    // Production with no URL set — throw so the error is obvious in the console
    // rather than every API call silently returning HTML from CloudFront.
    throw new Error(
      '[SPLM] VITE_API_BASE_URL is not set in this production build.\n' +
      'Set it to your API Gateway invoke URL before building:\n' +
      '  VITE_API_BASE_URL=https://<id>.execute-api.<region>.amazonaws.com npm run build\n' +
      'Or add a CloudFront behavior: /api/* → API Gateway origin, then leave the var empty.',
    );
  }

  return url;
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
 * Parse a successful (2xx) response body as JSON.
 * Reads as text first so HTML responses produce an actionable error instead of
 * an opaque SyntaxError from JSON.parse.
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
      `[${context}] Expected JSON but received HTML.\n` +
      `  HTTP ${res.status}  Content-Type: ${ct || 'n/a'}\n` +
      `  This means VITE_API_BASE_URL is wrong/missing, or CloudFront is serving\n` +
      `  index.html for /api/* instead of forwarding to the API Gateway origin.\n` +
      `  Snippet: ${snippet(trimmed, 220)}`,
    );
    throw new Error(
      `${context}: received HTML instead of JSON (HTTP ${res.status}). ` +
      'Check VITE_API_BASE_URL and CloudFront /api/* behavior.',
    );
  }

  const ct = res.headers.get('content-type') ?? '';
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[') && !ct.includes('json')) {
    console.warn(`[${context}] Unexpected Content-Type: ${ct || 'none'}`, snippet(trimmed, 200));
  }

  try {
    return JSON.parse(text) as T;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[${context}] JSON.parse failed: ${msg}`, snippet(trimmed));
    throw new Error(`${context}: invalid JSON — ${msg}. Snippet: ${snippet(trimmed, 220)}`);
  }
}

/**
 * Parse an error response body — handles ASP.NET ProblemDetails JSON, plain text,
 * and HTML fallback (e.g. CloudFront error pages).
 */
export async function parseErrorJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) return {};

  if (looksLikeHtml(trimmed)) {
    console.warn(
      `[API] HTTP ${res.status} error body is HTML, not JSON.\n` +
      'Check VITE_API_BASE_URL and CloudFront /api/* behavior.',
      snippet(trimmed, 200),
    );
    return {
      title: `HTTP ${res.status}`,
      detail: 'Server returned HTML instead of a JSON error. Check VITE_API_BASE_URL and CloudFront /api/* routing.',
    };
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { title: `HTTP ${res.status}`, detail: trimmed.slice(0, 500) || `HTTP ${res.status}` };
  }
}
