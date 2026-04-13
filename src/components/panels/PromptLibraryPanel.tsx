import { useEffect, useMemo, useState } from 'react';
import { promptLibraryApi, PromptLibraryDto, PromptVersionDto } from '@/lib/api-aisdlc';
import {
  DEFAULT_LIST_PAGE_SIZE,
  ListPageSearchInput,
  rowMatchesListSearch,
  useListPageSearchDebounce,
} from '@/components/listing/listPageSearch';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Copy } from 'lucide-react';
import { toast } from 'sonner';

type Category = 'qa_fix' | 'code_review' | 'test_gen' | 'general';

const CATEGORY_CONFIG: Record<Category, { label: string; color: string }> = {
  qa_fix:      { label: 'QA Fix',          color: 'bg-purple-100 text-purple-800' },
  code_review: { label: 'Code Review',     color: 'bg-blue-100 text-blue-800' },
  test_gen:    { label: 'Test Generation', color: 'bg-green-100 text-green-800' },
  general:     { label: 'General',         color: 'bg-gray-100 text-gray-800' },
};

export default function PromptLibraryPanel() {
  // ← Prompts and versions are loaded separately (API does not embed versions in prompt list)
  const [prompts, setPrompts] = useState<PromptLibraryDto[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptLibraryDto | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<PromptVersionDto[]>([]);
  const [activeVersion, setActiveVersion] = useState<PromptVersionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [newPromptDialog, setNewPromptDialog] = useState(false);
  const [newVersionDialog, setNewVersionDialog] = useState(false);

  const [newPromptForm, setNewPromptForm] = useState({
    name: '', description: '', category: 'general' as Category, content: '',
  });

  const [newVersionForm, setNewVersionForm] = useState({ content: '', change_notes: '' });
  const [promptListPage, setPromptListPage] = useState(1);
  const [promptSearch, setPromptSearch] = useState('');
  const debouncedPromptSearch = useListPageSearchDebounce(promptSearch);

  // Load all prompts
  const loadPrompts = async () => {
    try {
      setLoading(true);
      const data = await promptLibraryApi.getAll();  // ← was list() (doesn't exist)
      setPrompts(data);
      if (data.length > 0) selectPrompt(data[0]);
    } catch (error) {
      toast.error('Failed to load prompts');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Load versions for a given prompt
  const loadVersions = async (promptId: string) => {
    try {
      setVersionsLoading(true);
      const versions = await promptLibraryApi.getVersions(promptId);  // ← was trying to use non-existent get()
      setSelectedVersions(versions);
      setActiveVersion(versions[0] ?? null);
    } catch (error) {
      toast.error('Failed to load versions');
      console.error(error);
      setSelectedVersions([]);
      setActiveVersion(null);
    } finally {
      setVersionsLoading(false);
    }
  };

  const selectPrompt = (prompt: PromptLibraryDto) => {
    setSelectedPrompt(prompt);
    loadVersions(prompt.id);
  };

  useEffect(() => { loadPrompts(); }, []);

  const handleCreatePrompt = async () => {
    if (!newPromptForm.name.trim() || !newPromptForm.content.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      setSubmitting(true);
      await promptLibraryApi.create({
        name: newPromptForm.name,
        description: newPromptForm.description,
        category: newPromptForm.category,
        content: newPromptForm.content,
      });
      // CreatePrompt API already persists version 1; do not call createVersion here (duplicate v2 / extra failure surface).
      toast.success('Prompt created successfully');
      setNewPromptDialog(false);
      setNewPromptForm({ name: '', description: '', category: 'general', content: '' });
      await loadPrompts();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to create prompt';
      toast.error(msg);
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!selectedPrompt || !newVersionForm.content.trim()) {
      toast.error('Please fill in content');
      return;
    }
    try {
      setSubmitting(true);
      // ← correct signature: createVersion({ prompt_id, content, change_notes })
      await promptLibraryApi.createVersion({
        prompt_id: selectedPrompt.id,
        content: newVersionForm.content,
        change_notes: newVersionForm.change_notes,
      });
      toast.success('Version created successfully');
      setNewVersionDialog(false);
      setNewVersionForm({ content: '', change_notes: '' });
      await loadVersions(selectedPrompt.id);
    } catch (error) {
      toast.error('Failed to create version');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const filteredPrompts = useMemo(() => {
    const byCat =
      activeCategory === 'all' ? prompts : prompts.filter((p) => p.category === activeCategory);
    if (!debouncedPromptSearch) return byCat;
    return byCat.filter((p) =>
      rowMatchesListSearch(debouncedPromptSearch, [
        p.name,
        p.description,
        p.category,
        CATEGORY_CONFIG[p.category as Category]?.label,
      ]),
    );
  }, [prompts, activeCategory, debouncedPromptSearch]);

  const promptListTotalPages = Math.max(1, Math.ceil(filteredPrompts.length / DEFAULT_LIST_PAGE_SIZE));
  const pagedFilteredPrompts = useMemo(() => {
    const start = (promptListPage - 1) * DEFAULT_LIST_PAGE_SIZE;
    return filteredPrompts.slice(start, start + DEFAULT_LIST_PAGE_SIZE);
  }, [filteredPrompts, promptListPage]);

  useEffect(() => {
    setPromptListPage((p) => Math.min(Math.max(1, p), promptListTotalPages));
  }, [promptListTotalPages]);

  useEffect(() => {
    setPromptListPage(1);
  }, [activeCategory, debouncedPromptSearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentContent = activeVersion?.content ?? '';

  return (
    <div className="flex h-full gap-4 p-6">
      {/* Left Pane: Prompt List */}
      <div className="w-80 border-r flex flex-col gap-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Prompts</h3>
          <Dialog open={newPromptDialog} onOpenChange={setNewPromptDialog}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4" /></Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Create New Prompt</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" placeholder="Prompt name" value={newPromptForm.name}
                    onChange={(e) => setNewPromptForm({ ...newPromptForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" placeholder="Brief description" value={newPromptForm.description}
                    onChange={(e) => setNewPromptForm({ ...newPromptForm, description: e.target.value })}
                    className="min-h-16" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={newPromptForm.category} onValueChange={(v) => setNewPromptForm({ ...newPromptForm, category: v as Category })}>
                    <SelectTrigger id="category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content">Content</Label>
                  <Textarea id="content" placeholder="Prompt content" value={newPromptForm.content}
                    onChange={(e) => setNewPromptForm({ ...newPromptForm, content: e.target.value })}
                    className="min-h-24 font-mono text-sm" />
                </div>
                <div className="flex gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setNewPromptDialog(false)} disabled={submitting}>Cancel</Button>
                  <Button onClick={handleCreatePrompt} disabled={submitting}>
                    {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Category Filter */}
        <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as Category | 'all')} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-5">
            <TabsTrigger value="all"         className="text-xs">All</TabsTrigger>
            <TabsTrigger value="qa_fix"      className="text-xs">QA</TabsTrigger>
            <TabsTrigger value="code_review" className="text-xs">Review</TabsTrigger>
            <TabsTrigger value="test_gen"    className="text-xs">Test</TabsTrigger>
            <TabsTrigger value="general"     className="text-xs">Other</TabsTrigger>
          </TabsList>
        </Tabs>

        <ListPageSearchInput
          value={promptSearch}
          onChange={setPromptSearch}
          className="w-full h-9 text-sm"
          placeholder="Search prompts…"
          aria-label="Search prompts"
        />

        {/* Prompt List */}
        <div className="overflow-y-auto flex-1 flex flex-col min-h-0">
          <div className="space-y-2 flex-1">
            {filteredPrompts.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3">
                {prompts.length === 0 ? 'No prompts found' : 'No prompts match your search'}
              </p>
            ) : (
              pagedFilteredPrompts.map((prompt) => (
                <button key={prompt.id} onClick={() => selectPrompt(prompt)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedPrompt?.id === prompt.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}>
                  <div className="font-medium text-sm mb-1">{prompt.name}</div>
                  <div className="flex gap-2 items-center">
                    <Badge variant="outline" className={CATEGORY_CONFIG[prompt.category as Category]?.color ?? ''}>
                      {CATEGORY_CONFIG[prompt.category as Category]?.label ?? prompt.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">v{prompt.version_count}</span>
                    {prompt.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800">Active</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
          {promptListTotalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-2 border-t mt-2 shrink-0">
              <Button type="button" variant="outline" size="sm" disabled={promptListPage <= 1}
                onClick={() => setPromptListPage((p) => Math.max(1, p - 1))}>Prev</Button>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {promptListPage}/{promptListTotalPages} ({filteredPrompts.length})
              </span>
              <Button type="button" variant="outline" size="sm" disabled={promptListPage >= promptListTotalPages}
                onClick={() => setPromptListPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      </div>

      {/* Right Pane: Prompt Details */}
      {selectedPrompt ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-1">{selectedPrompt.name}</h2>
            <p className="text-sm text-muted-foreground mb-3">{selectedPrompt.description}</p>
            <div className="flex gap-2 items-center">
              <Badge className={CATEGORY_CONFIG[selectedPrompt.category as Category]?.color ?? ''}>
                {CATEGORY_CONFIG[selectedPrompt.category as Category]?.label ?? selectedPrompt.category}
              </Badge>
              {selectedPrompt.is_active && (
                <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">Active</span>
              )}
            </div>
          </div>

          {/* Current Version Content */}
          <Card className="p-4 mb-6 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">
                {/* ← was selectedPrompt.versions.length */}
                Current Version (v{selectedPrompt.current_version_number})
              </h3>
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(currentContent)}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            {versionsLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Textarea value={currentContent} readOnly className="flex-1 font-mono text-sm resize-none bg-muted" />
            )}
          </Card>

          {/* Version History */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Version History</h3>
              <Dialog open={newVersionDialog} onOpenChange={setNewVersionDialog}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="w-4 h-4 mr-2" />New Version</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader><DialogTitle>Create New Version</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="version-content">Content</Label>
                      <Textarea id="version-content" placeholder="New version content"
                        value={newVersionForm.content}
                        onChange={(e) => setNewVersionForm({ ...newVersionForm, content: e.target.value })}
                        className="min-h-24 font-mono text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="change-notes">Change Notes</Label>
                      <Textarea id="change-notes" placeholder="What changed in this version?"
                        value={newVersionForm.change_notes}
                        onChange={(e) => setNewVersionForm({ ...newVersionForm, change_notes: e.target.value })}
                        className="min-h-16" />
                    </div>
                    <div className="flex gap-2 pt-4 border-t">
                      <Button variant="outline" onClick={() => setNewVersionDialog(false)} disabled={submitting}>Cancel</Button>
                      <Button onClick={handleCreateVersion} disabled={submitting}>
                        {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create Version'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="border rounded-lg overflow-hidden flex-1 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Version</TableHead>
                    <TableHead>Change Notes</TableHead>
                    <TableHead className="w-20">Score</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                    <TableHead className="w-32">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* ← was selectedPrompt.versions (didn't exist); now uses selectedVersions state */}
                  {selectedVersions.map((version) => (
                    <TableRow key={version.id} onClick={() => setActiveVersion(version)}
                      className={`cursor-pointer ${activeVersion?.id === version.id ? 'bg-muted' : 'hover:bg-muted/50'}`}>
                      <TableCell className="font-medium">v{version.version_number}</TableCell>
                      <TableCell className="text-sm">{version.change_notes}</TableCell>
                      <TableCell className="text-sm">
                        {version.effectiveness_score ? `${(version.effectiveness_score * 100).toFixed(0)}%` : '—'}
                      </TableCell>
                      <TableCell>
                        {version.is_current && <Badge variant="default" className="bg-blue-600">Current</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(version.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p>Select a prompt to view details</p>
        </div>
      )}
    </div>
  );
}
