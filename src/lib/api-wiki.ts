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

export const listSpaces = async () => wikiApi.getSpaces();

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

export const savePage = async (page: any) => {
  if (page.id) {
    return wikiApi.updatePage(page.id, {
      title:    page.title,
      content:  page.content,
      status:   page.status,
      sortOrder: page.sort_order ?? page.sortOrder,
    });
  }
  return wikiApi.createPage(page.space_id ?? page.spaceId, {
    title:    page.title,
    content:  page.content ?? '',
    parentId: page.parent_id ?? page.parentId ?? null,
    sortOrder: page.sort_order ?? page.sortOrder ?? 0,
  });
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
