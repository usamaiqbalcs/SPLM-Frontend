import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  listSpacesPage, saveSpace, deleteSpace,
  listPages, savePage, deletePage, getPage,
  listPageVersions, createPageVersion,
  listPageComments, addPageComment, deletePageComment,
  listTemplates,
} from '@/lib/api-wiki';
import { WIKI_TEMPLATES } from '@/lib/wiki-templates';
import { useAuth } from '@/contexts/AuthContext';
import { ListPageSearchInput, useListPageSearchDebounce } from '@/components/listing/listPageSearch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { fmtDateTime } from '@/lib/splm-utils';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import {
  FileText, FolderOpen, Plus, ChevronRight, ChevronDown, Edit3,
  Clock, MessageSquare, Send, Trash2, ArrowLeft, Eye, History,
  BookTemplate, Copy, X,
} from 'lucide-react';

type ViewMode = 'browse' | 'edit' | 'view' | 'history' | 'templates';

export default function WikiPanel() {
  const [searchParams] = useSearchParams();
  const wikiLinkHandledKey = useRef<string | null>(null);
  const { user, can, profile } = useAuth();
  const [spaces, setSpaces] = useState<any[]>([]);
  const [spacePage, setSpacePage] = useState(1);
  const [spaceTotalPages, setSpaceTotalPages] = useState(1);
  const [spaceTotalCount, setSpaceTotalCount] = useState(0);
  const [spaceSearch, setSpaceSearch] = useState('');
  const debouncedSpaceSearch = useListPageSearchDebounce(spaceSearch);
  const [pages, setPages] = useState<any[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<any>(null);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('browse');
  const [loading, setLoading] = useState(true);

  // Forms
  const [spaceForm, setSpaceForm] = useState<any>(null);
  const [pageTitle, setPageTitle] = useState('');
  const [pageContent, setPageContent] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');

  // Version history
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);

  // Comments
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');

  // Tree expand state
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());

  // Confirmations
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSpacePage(1);
  }, [debouncedSpaceSearch]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listSpacesPage({
      page: spacePage,
      pageSize: 10,
      search: debouncedSpaceSearch || undefined,
    })
      .then((res) => {
        if (cancelled) return;
        setSpaces(res.items);
        setSpaceTotalPages(Math.max(1, res.total_pages));
        setSpaceTotalCount(res.total_count);
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load wiki spaces');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spacePage, debouncedSpaceSearch]);

  useEffect(() => {
    if (!selectedSpace) { setPages([]); return; }
    listPages(selectedSpace.id).then(setPages);
  }, [selectedSpace]);

  useEffect(() => {
    if (!selectedPage) return;
    loadComments();
    // Note: real-time Supabase subscription removed — polling not needed for wiki comments
    // since they are currently stubbed (no .NET backend endpoint yet).
  }, [selectedPage?.id]);

  const loadComments = async () => {
    if (!selectedPage) return;
    try { const c = await listPageComments(selectedPage.id); setComments(c); } catch {}
  };

  // Profile names are not available without Supabase profiles table.
  // The .NET backend does not yet expose a wiki-page-comments endpoint,
  // so comments remain empty and these helpers are effectively unused.
  const getProfileName = (_userId: string) => '—';
  const getInitials = (_userId: string) => '?';

  // Space CRUD
  const doSaveSpace = async () => {
    if (!spaceForm?.name) return toast.error('Space name is required');
    try {
      await saveSpace({ ...spaceForm, created_by: spaceForm.created_by || user?.id });
      toast.success(spaceForm.id ? 'Space updated' : 'Space created');
      if (!spaceForm.id) setSpacePage(1);
      else {
        const res = await listSpacesPage({ page: spacePage, pageSize: 10 });
        setSpaces(res.items);
        setSpaceTotalPages(Math.max(1, res.total_pages));
        setSpaceTotalCount(res.total_count);
      }
      setSpaceForm(null);
    } catch (e: any) { toast.error(e.message); }
  };

  // Page CRUD
  const openPage = async (page: any) => {
    setSelectedPage(page);
    setPageTitle(page.title);
    setPageContent(page.content || '');
    setViewMode('view');
    setVersions([]);
    setSelectedVersion(null);
  };

  useEffect(() => {
    const spaceId = searchParams.get('spaceId');
    const pageId = searchParams.get('pageId');
    if (!spaceId || !pageId) {
      wikiLinkHandledKey.current = null;
      return;
    }
    const key = `${spaceId}:${pageId}`;
    if (wikiLinkHandledKey.current === key) return;

    let cancelled = false;
    (async () => {
      const fail = (msg: string) => {
        if (cancelled) return;
        wikiLinkHandledKey.current = key;
        toast.error(msg);
      };
      try {
        let sp = spaces.find((s: any) => String(s.id) === String(spaceId));
        if (!sp) {
          const res = await listSpacesPage({ page: 1, pageSize: 200 });
          if (cancelled) return;
          sp = res.items.find((s: any) => String(s.id) === String(spaceId));
        }
        if (!sp) {
          fail('Wiki space not found');
          return;
        }
        if (cancelled) return;
        setSelectedSpace(sp);
        const pg = await getPage(pageId);
        if (cancelled) return;
        if (!pg) {
          fail('Wiki page not found');
          return;
        }
        wikiLinkHandledKey.current = key;
        setSelectedPage(pg);
        setPageTitle(pg.title);
        setPageContent(pg.content || '');
        setViewMode('view');
        setVersions([]);
        setSelectedVersion(null);
      } catch {
        fail('Could not open wiki page from link');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, spaces]);

  const startNewPage = (parentPageId: string | null = null) => {
    setSelectedPage(null);
    setPageTitle('');
    setPageContent('');
    setParentId(parentPageId);
    setChangeSummary('');
    setViewMode('edit');
  };

  const startEdit = () => {
    if (!selectedPage) return;
    setPageTitle(selectedPage.title);
    setPageContent(selectedPage.content || '');
    setChangeSummary('');
    setViewMode('edit');
  };

  const doSavePage = async () => {
    if (!pageTitle.trim()) return toast.error('Page title is required');
    if (!selectedSpace) return;
    setSaving(true);
    try {
      if (selectedPage) {
        // Save version snapshot first
        const versionList = await listPageVersions(selectedPage.id);
        const nextVersion = (versionList.length > 0 ? Math.max(...versionList.map((v: any) => v.version_number)) : 0) + 1;
        await createPageVersion({
          page_id: selectedPage.id,
          version_number: nextVersion,
          title: pageTitle,
          content: pageContent,
          edited_by: user?.id,
          change_summary: changeSummary || 'Updated page',
        });
        const updated = await savePage({ ...selectedPage, title: pageTitle, content: pageContent, last_edited_by: user?.id });
        setSelectedPage(updated);
        toast.success('Page updated (v' + nextVersion + ')');
      } else {
        const newPage = await savePage({
          space_id: selectedSpace.id,
          parent_id: parentId,
          title: pageTitle,
          content: pageContent,
          created_by: user?.id,
          last_edited_by: user?.id,
        });
        await createPageVersion({
          page_id: newPage.id,
          version_number: 1,
          title: pageTitle,
          content: pageContent,
          edited_by: user?.id,
          change_summary: 'Initial creation',
        });
        setSelectedPage(newPage);
        toast.success('Page created');
      }
      setViewMode('view');
      setChangeSummary('');
      const updatedPages = await listPages(selectedSpace.id);
      setPages(updatedPages);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const doDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'page') {
        await deletePage(deleteTarget.id);
        toast.success('Page deleted');
        setSelectedPage(null);
        setViewMode('browse');
        if (selectedSpace) {
          const updated = await listPages(selectedSpace.id);
          setPages(updated);
        }
      } else if (deleteTarget.type === 'space') {
        await deleteSpace(deleteTarget.id);
        toast.success('Space deleted');
        if (selectedSpace?.id === deleteTarget.id) { setSelectedSpace(null); setSelectedPage(null); }
        {
          const res = await listSpacesPage({ page: spacePage, pageSize: 10 });
          if (res.items.length === 0 && spacePage > 1) setSpacePage((p) => Math.max(1, p - 1));
          else {
            setSpaces(res.items);
            setSpaceTotalPages(Math.max(1, res.total_pages));
            setSpaceTotalCount(res.total_count);
          }
        }
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setDeleteTarget(null); }
  };

  // Version history
  const openHistory = async () => {
    if (!selectedPage) return;
    const v = await listPageVersions(selectedPage.id);
    setVersions(v);
    setSelectedVersion(null);
    setViewMode('history');
  };

  const restoreVersion = async (version: any) => {
    if (!selectedPage) return;
    setPageTitle(version.title);
    setPageContent(version.content);
    setChangeSummary(`Restored from v${version.version_number}`);
    setViewMode('edit');
    toast.info(`Loaded v${version.version_number} — save to apply`);
  };

  // Comments
  const doAddComment = async () => {
    if (!newComment.trim() || !selectedPage || !user) return;
    try {
      await addPageComment({ page_id: selectedPage.id, user_id: user.id, content: newComment.trim() });
      setNewComment('');
      await loadComments();
    } catch (e: any) { toast.error(e.message); }
  };

  const doDeleteComment = async (id: string) => {
    try { await deletePageComment(id); await loadComments(); } catch (e: any) { toast.error(e.message); }
  };

  // Templates
  const applyTemplate = (template: any) => {
    setPageTitle(template.name);
    setPageContent(template.content);
    setParentId(null);
    setChangeSummary('');
    setViewMode('edit');
  };

  // Page tree
  const buildTree = (parentId: string | null = null): any[] => {
    return pages
      .filter(p => (p.parent_id || null) === parentId && !p.is_template)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  };

  const toggleExpand = (pageId: string) => {
    setExpandedPages(prev => {
      const next = new Set(prev);
      next.has(pageId) ? next.delete(pageId) : next.add(pageId);
      return next;
    });
  };

  const renderMarkdown = (content: string) => {
    // Basic markdown rendering
    let html = content
      .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-foreground mt-4 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-foreground mt-5 mb-2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-xl font-extrabold text-foreground mt-6 mb-3">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
      .replace(/^- \[x\] (.+)$/gm, '<div class="flex items-center gap-2 py-0.5"><input type="checkbox" checked disabled class="rounded" /><span class="line-through text-muted-foreground">$1</span></div>')
      .replace(/^- \[ \] (.+)$/gm, '<div class="flex items-center gap-2 py-0.5"><input type="checkbox" disabled class="rounded" /><span>$1</span></div>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
      .replace(/^---$/gm, '<hr class="my-4 border-border" />')
      .replace(/^>\s*(.+)$/gm, '<blockquote class="border-l-4 border-primary/30 pl-4 py-1 text-muted-foreground italic my-2">$1</blockquote>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/@(\w+)/g, '<span class="bg-primary/10 text-primary px-1 rounded font-semibold">@$1</span>');

    // Tables
    html = html.replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(Boolean).map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) return '';
      const isHeader = cells.some(c => c.includes('---'));
      if (isHeader) return '';
      return '<tr>' + cells.map(c => `<td class="border border-border px-3 py-1.5 text-sm">${c}</td>`).join('') + '</tr>';
    });

    // Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-muted rounded-md p-3 my-3 overflow-x-auto"><code class="text-xs font-mono">$2</code></pre>');

    return html;
  };

  const PageTreeItem = ({ page, depth = 0 }: { page: any; depth?: number }) => {
    const children = buildTree(page.id);
    const isExpanded = expandedPages.has(page.id);
    const isActive = selectedPage?.id === page.id;

    return (
      <div>
        <div
          className={cn(
            'flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer text-xs transition-colors group',
            isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground hover:bg-muted'
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {children.length > 0 ? (
            <button onClick={(e) => { e.stopPropagation(); toggleExpand(page.id); }} className="cursor-pointer p-0.5">
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <FileText className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate" onClick={() => openPage(page)}>{page.title}</span>
          <button
            onClick={(e) => { e.stopPropagation(); startNewPage(page.id); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5 hover:bg-muted rounded"
            title="Add child page"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        {isExpanded && children.map(child => (
          <PageTreeItem key={child.id} page={child} depth={depth + 1} />
        ))}
      </div>
    );
  };

  if (loading) return <TableSkeleton />;

  return (
    <div className="min-w-0 animate-fade-in">
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.type === 'space' ? 'Space' : 'Page'}`}
        description={`This will permanently delete the ${deleteTarget?.type}. This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={doDeleteConfirm}
      />

      {/* Space creation form */}
      {spaceForm && (
        <div className="bg-card rounded-lg border p-5 mb-5 animate-fade-in">
          <h3 className="text-sm font-bold text-primary mb-3">{spaceForm.id ? 'Edit Space' : 'New Space'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div><Label>Icon</Label><Input value={spaceForm.icon || '📁'} onChange={e => setSpaceForm((f: any) => ({ ...f, icon: e.target.value }))} className="w-20" /></div>
            <div className="md:col-span-2"><Label>Name *</Label><Input value={spaceForm.name || ''} onChange={e => setSpaceForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Engineering" /></div>
          </div>
          <div className="mb-3"><Label>Description</Label><Input value={spaceForm.description || ''} onChange={e => setSpaceForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
          <div className="flex gap-2">
            <Button size="sm" onClick={doSaveSpace}>💾 Save</Button>
            <Button size="sm" variant="outline" onClick={() => setSpaceForm(null)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="flex min-h-[min(520px,70dvh)] flex-col gap-4 lg:min-h-[600px] lg:flex-row lg:gap-5">
        {/* Left sidebar — Spaces & Page Tree */}
        <div className="flex w-full min-w-0 flex-shrink-0 flex-col overflow-hidden rounded-lg border bg-card lg:w-[240px]">
          <div className="px-3 py-2.5 border-b flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Spaces</span>
            <div className="flex gap-1">
              {can('edit') && (
                <button onClick={() => setSpaceForm({ name: '', icon: '📁', description: '' })} className="p-1 rounded hover:bg-muted cursor-pointer text-muted-foreground" title="New Space">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => { setSelectedPage(null); setViewMode('templates'); }} className="p-1 rounded hover:bg-muted cursor-pointer text-muted-foreground" title="Templates">
                <BookTemplate className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="px-2 py-1.5 border-b">
            <ListPageSearchInput
              value={spaceSearch}
              onChange={setSpaceSearch}
              className="w-full h-8 text-xs"
              placeholder="Search spaces…"
              aria-label="Search wiki spaces"
            />
          </div>

          {/* Space list */}
          <div className="px-2 py-1.5 border-b">
            {spaces.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-2 text-center">No spaces yet</p>
            ) : spaces.map(s => (
              <div
                key={s.id}
                onClick={() => { setSelectedSpace(s); setSelectedPage(null); setViewMode('browse'); }}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs transition-colors group',
                  selectedSpace?.id === s.id ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground hover:bg-muted'
                )}
              >
                <span>{s.icon}</span>
                <span className="flex-1 truncate">{s.name}</span>
                {can('edit') && (
                  <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); setSpaceForm(s); }} className="p-0.5 hover:bg-muted rounded cursor-pointer"><Edit3 className="w-3 h-3" /></button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'space', id: s.id }); }} className="p-0.5 hover:bg-destructive/10 rounded cursor-pointer text-destructive"><Trash2 className="w-3 h-3" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {spaceTotalPages > 1 && (
            <div className="flex items-center justify-between gap-1 px-2 py-1.5 border-b bg-muted/30">
              <button
                type="button"
                disabled={loading || spacePage <= 1}
                onClick={() => setSpacePage((p) => Math.max(1, p - 1))}
                className="text-[10px] px-1.5 py-0.5 rounded border bg-background disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {spacePage}/{spaceTotalPages} ({spaceTotalCount})
              </span>
              <button
                type="button"
                disabled={loading || spacePage >= spaceTotalPages}
                onClick={() => setSpacePage((p) => p + 1)}
                className="text-[10px] px-1.5 py-0.5 rounded border bg-background disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}

          {/* Page tree */}
          {selectedSpace && (
            <div className="flex-1 overflow-y-auto scrollbar-thin px-1 py-1.5">
              <div className="flex items-center justify-between px-2 mb-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pages</span>
                <button onClick={() => startNewPage(null)} className="p-0.5 rounded hover:bg-muted cursor-pointer text-muted-foreground" title="New page">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              {buildTree(null).length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-4 text-center">No pages yet</p>
              ) : (
                buildTree(null).map(page => <PageTreeItem key={page.id} page={page} />)
              )}
            </div>
          )}
        </div>

        {/* Main content area */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
          {/* Templates browser */}
          {viewMode === 'templates' && (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <BookTemplate className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Document Templates</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {WIKI_TEMPLATES.map((t, i) => (
                  <div
                    key={i}
                    onClick={() => { if (selectedSpace) applyTemplate(t); else toast.error('Select a space first'); }}
                    className="border rounded-lg p-4 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group"
                  >
                    <div className="text-2xl mb-2">{t.icon}</div>
                    <div className="font-bold text-sm text-foreground">{t.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{t.category}</div>
                    <div className="text-xs text-muted-foreground mt-2 line-clamp-2">{t.content.split('\n').slice(0, 2).join(' ')}</div>
                    <div className="mt-3 text-[11px] text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      Use template →
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Browse mode — no page selected */}
          {viewMode === 'browse' && !selectedPage && selectedSpace && (
            <div className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <span className="text-3xl">{selectedSpace.icon}</span>
                <div>
                  <h2 className="text-lg font-bold text-foreground">{selectedSpace.name}</h2>
                  {selectedSpace.description && <p className="text-xs text-muted-foreground">{selectedSpace.description}</p>}
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-4">{pages.filter(p => !p.is_template).length} pages in this space</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pages.filter(p => !p.parent_id && !p.is_template).slice(0, 8).map(p => (
                  <div key={p.id} onClick={() => openPage(p)} className="border rounded-lg p-4 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold text-sm text-foreground">{p.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{(p.content || '').slice(0, 120)}</p>
                    <div className="text-[10px] text-muted-foreground mt-2">{fmtDateTime(p.updated_at)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No space selected */}
          {!selectedSpace && viewMode !== 'templates' && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FolderOpen className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-medium">Select a space</p>
              <p className="text-xs mt-1">Choose or create a space to browse wiki pages</p>
            </div>
          )}

          {/* View mode */}
          {viewMode === 'view' && selectedPage && (
            <div className="flex flex-col h-full">
              {/* Page header */}
              <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <button onClick={() => { setSelectedPage(null); setViewMode('browse'); }} className="p-1 rounded hover:bg-muted cursor-pointer"><ArrowLeft className="w-4 h-4" /></button>
                  <h1 className="text-lg font-bold text-foreground truncate">{selectedPage.title}</h1>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <Button size="sm" variant="outline" onClick={openHistory}><History className="w-3.5 h-3.5 mr-1" /> History</Button>
                  <Button size="sm" onClick={startEdit}><Edit3 className="w-3.5 h-3.5 mr-1" /> Edit</Button>
                  {can('edit') && (
                    <Button size="sm" variant="destructive" onClick={() => setDeleteTarget({ type: 'page', id: selectedPage.id })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Page meta */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground sm:px-6">
                <span>Created by {getProfileName(selectedPage.created_by)}</span>
                <span>Last edited {fmtDateTime(selectedPage.updated_at)}</span>
                {selectedPage.last_edited_by && <span>by {getProfileName(selectedPage.last_edited_by)}</span>}
              </div>

              {/* Page content */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-8 py-6 max-w-[800px] mx-auto prose-sm">
                  <div dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedPage.content || '*No content yet*') }} className="text-sm leading-relaxed text-foreground [&_table]:w-full [&_table]:border-collapse" />
                </div>

                {/* Comments section */}
                <div className="px-8 py-5 border-t max-w-[800px] mx-auto">
                  <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Comments ({comments.length})
                  </h3>
                  <div className="space-y-3 mb-4">
                    {comments.map(c => (
                      <div key={c.id} className="flex gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-[9px] font-bold text-accent-foreground flex-shrink-0">
                          {getInitials(c.user_id)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[11px] font-semibold text-foreground">{getProfileName(c.user_id)}</span>
                            <span className="text-[10px] text-muted-foreground">{fmtDateTime(c.created_at)}</span>
                          </div>
                          <div className="bg-muted rounded-lg px-3 py-2 text-sm text-foreground">{c.content}</div>
                          {c.user_id === user?.id && (
                            <button onClick={() => doDeleteComment(c.id)} className="text-[10px] text-muted-foreground hover:text-destructive mt-0.5 cursor-pointer">Delete</button>
                          )}
                        </div>
                      </div>
                    ))}
                    {comments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet. Start the discussion.</p>}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Write a comment..." value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && doAddComment()} className="text-sm" />
                    <Button size="sm" onClick={doAddComment} disabled={!newComment.trim()}><Send className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit mode */}
          {viewMode === 'edit' && (
            <div className="flex flex-col h-full">
              <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex min-w-0 items-center gap-2">
                  <button onClick={() => { selectedPage ? setViewMode('view') : setViewMode('browse'); }} className="p-1 rounded hover:bg-muted cursor-pointer"><X className="w-4 h-4" /></button>
                  <span className="truncate text-sm font-bold text-foreground">{selectedPage ? 'Edit Page' : 'New Page'}</span>
                </div>
                <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <Input placeholder="Change summary..." value={changeSummary} onChange={e => setChangeSummary(e.target.value)} className="h-8 w-full min-w-0 text-xs sm:max-w-xs" />
                  <Button size="sm" className="w-full shrink-0 sm:w-auto" onClick={doSavePage} disabled={saving}>{saving ? 'Saving…' : '💾 Save'}</Button>
                </div>
              </div>
              <div className="border-b px-4 py-3 sm:px-6">
                <Input value={pageTitle} onChange={e => setPageTitle(e.target.value)} placeholder="Page title" className="border-0 bg-transparent px-0 text-lg font-bold focus-visible:ring-0" />
              </div>
              <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
                {/* Editor */}
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                  <textarea
                    ref={textareaRef}
                    value={pageContent}
                    onChange={e => setPageContent(e.target.value)}
                    placeholder="Write your content using Markdown...

# Heading 1
## Heading 2
**bold** *italic* `code`
- Bullet list
1. Numbered list
- [ ] Checkbox
- [x] Completed
@mention a team member
> Blockquote
---"
                    className="min-h-[220px] flex-1 resize-none border-b bg-background px-4 py-4 font-mono text-sm outline-none xl:min-h-0 xl:border-b-0 xl:border-r xl:px-6"
                    spellCheck
                  />
                </div>
                {/* Live preview */}
                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-card px-4 py-4 xl:px-6">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold mb-3 tracking-wider">Preview</div>
                  <div dangerouslySetInnerHTML={{ __html: renderMarkdown(pageContent || '*Start typing to see preview...*') }} className="text-sm leading-relaxed text-foreground [&_table]:w-full [&_table]:border-collapse" />
                </div>
              </div>
            </div>
          )}

          {/* History mode */}
          {viewMode === 'history' && selectedPage && (
            <div className="flex flex-col h-full">
              <div className="px-6 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => setViewMode('view')} className="p-1 rounded hover:bg-muted cursor-pointer"><ArrowLeft className="w-4 h-4" /></button>
                  <span className="text-sm font-bold text-foreground">Version History — {selectedPage.title}</span>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
                {/* Version list */}
                <div className="max-h-[40vh] w-full overflow-y-auto border-b scrollbar-thin lg:max-h-none lg:w-[280px] lg:flex-shrink-0 lg:border-b-0 lg:border-r">
                  {versions.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-4 text-center">No version history</p>
                  ) : versions.map(v => (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVersion(v)}
                      className={cn(
                        'px-4 py-3 border-b cursor-pointer hover:bg-muted/50 transition-colors',
                        selectedVersion?.id === v.id && 'bg-primary/10'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-foreground">v{v.version_number}</span>
                        {v.version_number === versions[0]?.version_number && (
                          <span className="text-[9px] bg-success/10 text-success px-1.5 rounded-full font-bold">LATEST</span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{v.change_summary || 'No summary'}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {getProfileName(v.edited_by)} · {fmtDateTime(v.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Version content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {selectedVersion ? (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-bold text-foreground">v{selectedVersion.version_number}: {selectedVersion.title}</h3>
                          <p className="text-xs text-muted-foreground">{selectedVersion.change_summary}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => restoreVersion(selectedVersion)}>
                          <Copy className="w-3.5 h-3.5 mr-1" /> Restore this version
                        </Button>
                      </div>
                      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedVersion.content || '') }} className="text-sm leading-relaxed text-foreground [&_table]:w-full [&_table]:border-collapse" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <History className="w-8 h-8 mb-2 opacity-30" />
                      <p className="text-sm">Select a version to preview</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
