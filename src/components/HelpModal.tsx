import { useEffect } from 'react';
import { X } from 'lucide-react';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ['⌘', 'K'],   desc: 'Open global search' },
  { keys: ['Esc'],       desc: 'Close any modal or search' },
  { keys: ['↑', '↓'],   desc: 'Navigate search results' },
  { keys: ['↵'],         desc: 'Open selected search result' },
  { keys: ['Enter'],     desc: 'Submit forms & add comments' },
];

const MODULES = [
  { icon: '📊', label: 'Dashboard',    desc: 'Live KPIs, charts, recent deployments and top priority products.' },
  { icon: '📦', label: 'Products',     desc: 'Full CRUD for software products — tech stack, versions, customer count, priority scoring.' },
  { icon: '✅', label: 'Tasks',        desc: 'Work items with List & Kanban board views. Drag cards to change status. Click any row for the detail drawer.' },
  { icon: '🏃', label: 'Sprints',      desc: 'Create sprints, set goals and dates, assign tasks, track velocity.' },
  { icon: '📝', label: 'Wiki',         desc: 'Markdown editor with live preview, version history, page hierarchy, and real-time comments.' },
  { icon: '🔀', label: 'Versions',     desc: 'Semantic version tracking (major.minor.patch) per product with changelogs.' },
  { icon: '🚀', label: 'Deployments',  desc: 'Track deployments per environment (dev/staging/prod). Shows a live pipeline view.' },
  { icon: '🌐', label: 'Environments', desc: 'Store server config, git repo, deploy paths, and health check URLs per product.' },
  { icon: '📅', label: 'Releases',     desc: 'Plan releases with an 11-step checklist and multi-product coordination.' },
  { icon: '💬', label: 'Feedback',     desc: 'Log customer feedback with sentiment and urgency scoring.' },
  { icon: '🔬', label: 'Research',     desc: 'Track market and technology research with source URLs and analysis notes.' },
  { icon: '👥', label: 'Team',         desc: 'Developer profiles, skills, office locations, and capacity planning.' },
  { icon: '📋', label: 'My Queue',     desc: 'Personal view of tasks assigned to you, grouped by status and due date.' },
];

const TIPS = [
  'In Tasks, switch between **List** and **Kanban Board** using the toggle in the top-right.',
  'On the Kanban board, drag cards between columns to instantly update task status.',
  'Click any task row to open the **Task Detail Drawer** — add comments, subtasks, and story points.',
  'The sidebar can be **collapsed** with the arrow at the bottom for more screen space.',
  'In Wiki, the editor shows a **live split-pane preview** as you type Markdown.',
  'Every Wiki page save creates a **version snapshot** — restore any previous version from History.',
  'Use **Cmd+K** (or Ctrl+K on Windows) from anywhere to search across all modules.',
];

export default function HelpModal({ open, onClose }: HelpModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-3 py-6 sm:items-center sm:px-4 sm:py-8">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative my-auto w-full max-w-[600px] overflow-hidden rounded-xl border bg-card shadow-2xl animate-scale-in max-h-[min(92dvh,calc(100vh-3rem))] flex flex-col">

        {/* Header */}
        <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b px-4 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-extrabold text-sm">
                Z
              </div>
              <div>
                <h2 className="font-extrabold text-foreground text-base leading-tight">ZenaTech SPLM</h2>
                <p className="text-[11px] text-muted-foreground">Software Product Lifecycle Management</p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-4 scrollbar-thin sm:p-6">

          {/* Keyboard shortcuts */}
          <div>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[2px] mb-3">
              Keyboard Shortcuts
            </h3>
            <div className="bg-muted/40 rounded-lg divide-y divide-border">
              {SHORTCUTS.map((s, i) => (
                <div key={i} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0 text-sm text-foreground">{s.desc}</span>
                  <div className="flex flex-shrink-0 flex-wrap gap-1">
                    {s.keys.map(k => (
                      <kbd
                        key={k}
                        className="text-[11px] bg-card border border-border px-2 py-0.5 rounded font-mono text-foreground shadow-sm"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[2px] mb-3">
              Tips & Tricks
            </h3>
            <div className="space-y-2">
              {TIPS.map((tip, i) => {
                // Render **bold** text in tips
                const parts = tip.split(/(\*\*[^*]+\*\*)/g);
                return (
                  <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-primary font-bold mt-0.5 flex-shrink-0">›</span>
                    <span>
                      {parts.map((p, j) =>
                        p.startsWith('**') ? (
                          <strong key={j}>{p.slice(2, -2)}</strong>
                        ) : (
                          p
                        )
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modules grid */}
          <div>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[2px] mb-3">
              All 13 Modules
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MODULES.map((m, i) => (
                <div key={i} className="flex gap-2.5 bg-muted/30 rounded-lg p-3 hover:bg-muted/50 transition-colors">
                  <span className="text-xl flex-shrink-0">{m.icon}</span>
                  <div>
                    <div className="font-semibold text-xs text-foreground">{m.label}</div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{m.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer info */}
          <div className="pt-2 border-t text-center space-y-1">
            <p className="text-[11px] text-muted-foreground">
              Built with React 18 · TypeScript · Supabase · Tailwind CSS
            </p>
            <p className="text-[10px] text-muted-foreground/50">
              NASDAQ: ZENA · FSE: 49Q · BMV: ZENA · Epazz Inc.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
