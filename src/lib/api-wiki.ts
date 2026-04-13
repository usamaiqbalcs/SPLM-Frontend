/**
 * api-wiki.ts — Wiki operations via .NET backend
 *
 * Replaces all Supabase calls. Page versions and page comments are not
 * implemented in the .NET backend, so those functions are stubbed.
 *
 * Wiki page comments: stub returns [] — the WikiPanel falls back to an
 * empty state gracefully.
 */

import { wikiApi } from '@/lib/apiClient';

// ── Spaces ────────────────────────────────────────────────────────────────────

export const listSpaces = async (opts?: { page?: number; pageSize?: number; search?: string }) => {
  const res = await wikiApi.getSpaces(opts);
  if (res && typeof res === 'object' && Array.isArray((res as any).items)) return (res as any).items;
  return Array.isArray(res) ? res : [];
};

export const listSpacesPage = async (opts?: { page?: number; pageSize?: number; search?: string }) => {
  const res = await wikiApi.getSpaces(opts);
  if (res && typeof res === 'object' && 'items' in res) {
    return res as {
      items: any[];
      total_count: number;
      page: number;
      page_size: number;
      total_pages: number;
    };
  }
  const items = Array.isArray(res) ? res : [];
  return {
    items,
    total_count: items.length,
    page: 1,
    page_size: items.length || 25,
    total_pages: 1,
  };
};

export const saveSpace = async (space: any) => {
  if (space.id) {
    return wikiApi.updateSpace(space.id, {
      name: space.name,
      description: space.description ?? '',
      icon: space.icon ?? '📚',
    });
  }
  return wikiApi.createSpace({
    name:        space.name,
    description: space.description ?? '',
    icon:        space.icon ?? '📚',
  });
};

export const deleteSpace = async (id: string) => wikiApi.deleteSpace(id);

// ── Pages ─────────────────────────────────────────────────────────────────────

export const listPages = async (spaceId: string) => wikiApi.getPages(spaceId);

export const getPage = async (pageId: string) => wikiApi.getPage(pageId);

function normalizeWikiParentId(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === '00000000-0000-0000-0000-000000000000') return null;
  return s;
}

export const savePage = async (page: any) => {
  if (page.id) {
    return wikiApi.updatePage(page.id, {
      title:    page.title,
      content:  page.content,
      status:   page.status,
      sortOrder: page.sort_order ?? page.sortOrder,
    });
  }
  const sortRaw = page.sort_order ?? page.sortOrder ?? 0;
  const sortOrder = Number.isFinite(Number(sortRaw))
    ? Math.min(1_000_000, Math.max(0, Math.round(Number(sortRaw))))
    : 0;
  const parentId = normalizeWikiParentId(page.parent_id ?? page.parentId);
  const body: Record<string, unknown> = {
    title: page.title,
    content: page.content ?? '',
    sortOrder,
  };
  if (parentId) body.parentId = parentId;
  return wikiApi.createPage(page.space_id ?? page.spaceId, body);
};

export const deletePage = async (id: string) => wikiApi.deletePage(id);

// ── Templates (stub — not yet in .NET backend) ────────────────────────────────

export const listTemplates = async () => [] as any[];

// ── Page versions (stub — not yet in .NET backend) ────────────────────────────

export const listPageVersions = async (_pageId: string) => [] as any[];

export const createPageVersion = async (_version: any) => ({} as any);

// ── Page comments (stub — not yet in .NET backend) ────────────────────────────

export const listPageComments = async (_pageId: string) => [] as any[];

export const addPageComment = async (_comment: any) => {
  throw new Error('Wiki page comments are not yet supported.');
};

export const deletePageComment = async (_id: string) => {
  throw new Error('Wiki page comments are not yet supported.');
};
