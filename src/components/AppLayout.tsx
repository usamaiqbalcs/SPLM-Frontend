import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardPanel from '@/components/panels/DashboardPanel';
import ProductsPanel from '@/components/panels/ProductsPanel';
import TasksPanel from '@/components/panels/TasksPanel';
import MyQueuePanel from '@/components/panels/MyQueuePanel';
import DevelopersPanel from '@/components/panels/DevelopersPanel';
import FeedbackPanel from '@/components/panels/FeedbackPanel';
import ResearchPanel from '@/components/panels/ResearchPanel';
import VersionControlPanel from '@/components/panels/VersionControlPanel';
import DeploymentsPanel from '@/components/panels/DeploymentsPanel';
import EnvironmentsPanel from '@/components/panels/EnvironmentsPanel';
import ReleasesPanel from '@/components/panels/ReleasesPanel';
import SprintsPanel from '@/components/panels/SprintsPanel';
import WikiPanel from '@/components/panels/WikiPanel';
// ── AI-SDLC New Panels ────────────────────────────────────────────────────────
import WorkflowPipelinePanel from '@/components/panels/WorkflowPipelinePanel';
import QACyclesPanel from '@/components/panels/QACyclesPanel';
import AIAnalyzerPanel from '@/components/panels/AIAnalyzerPanel';
import FixReviewPanel from '@/components/panels/FixReviewPanel';
import PMSignOffPanel from '@/components/panels/PMSignOffPanel';
import PDMAcceptancePanel from '@/components/panels/PDMAcceptancePanel';
import PromptLibraryPanel from '@/components/panels/PromptLibraryPanel';
import KPIDashboardPanel from '@/components/panels/KPIDashboardPanel';
import CanaryDeploymentPanel from '@/components/panels/CanaryDeploymentPanel';
import SearchModal from '@/components/SearchModal';
import NotificationsPanel from '@/components/NotificationsPanel';
import HelpModal from '@/components/HelpModal';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Package, CheckSquare, ListTodo, Users, MessageSquare,
  Microscope, GitBranch, Rocket, Globe, CalendarCheck, LogOut, ChevronDown,
  Search, Bell, HelpCircle, Moon, Sun, Clock, PanelLeftClose, PanelLeft, Gauge, BookOpen,
  GitMerge, FlaskConical, Bot, ClipboardCheck, BadgeCheck, Library, BarChart3,
} from 'lucide-react';
import { useSessionTimer } from '@/hooks/useSessionTimer';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

type NavItem = { id: string; label: string; icon: any; permission?: string };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'queue', label: 'My Queue', icon: ListTodo },
    ],
  },
  {
    label: 'Product Management',
    items: [
      { id: 'products', label: 'Products', icon: Package, permission: 'edit' },
      { id: 'tasks', label: 'Tasks', icon: CheckSquare, permission: 'edit' },
      { id: 'sprints', label: 'Sprints', icon: Gauge, permission: 'edit' },
      { id: 'versions', label: 'Versions', icon: GitBranch },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { id: 'feedback', label: 'Feedback', icon: MessageSquare },
      { id: 'research', label: 'Research', icon: Microscope, permission: 'edit' },
      { id: 'wiki', label: 'Wiki', icon: BookOpen },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'deployments', label: 'Deployments', icon: Rocket },
      { id: 'environments', label: 'Environments', icon: Globe, permission: 'config' },
      { id: 'releases', label: 'Releases', icon: CalendarCheck },
    ],
  },
  {
    label: 'AI-SDLC Pipeline',
    items: [
      { id: 'workflow',      label: 'Workflow Pipeline', icon: GitMerge,       permission: 'edit' },
      { id: 'qa-cycles',     label: 'QA Cycles',         icon: FlaskConical,   permission: 'edit' },
      { id: 'ai-analyzer',  label: 'AI Analyzer',        icon: Bot,            permission: 'edit' },
      { id: 'fix-review',   label: 'Fix Review',         icon: ClipboardCheck, permission: 'edit' },
      { id: 'canary',       label: 'Canary Deployments', icon: Rocket,         permission: 'edit' },
    ],
  },
  {
    label: 'Sign-Offs & Approvals',
    items: [
      { id: 'pm-signoff',   label: 'PM Sign-Off',       icon: ClipboardCheck, permission: 'edit' },
      { id: 'pdm-signoff',  label: 'PDM Acceptance',    icon: BadgeCheck,     permission: 'edit' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { id: 'prompt-library', label: 'Prompt Library',  icon: Library,        permission: 'edit' },
      { id: 'kpi-dashboard',  label: 'KPI Dashboard',   icon: BarChart3 },
    ],
  },
  {
    label: 'Administration',
    items: [
      { id: 'team', label: 'Team', icon: Users, permission: 'edit' },
    ],
  },
];

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  dashboard:      { title: 'Dashboard',          subtitle: 'System overview & metrics' },
  queue:          { title: 'My Queue',           subtitle: 'Your assigned work items' },
  products:       { title: 'Products',           subtitle: 'Manage software products' },
  tasks:          { title: 'Tasks',              subtitle: 'Task management & tracking' },
  sprints:        { title: 'Sprints',            subtitle: 'Sprint planning & velocity' },
  versions:       { title: 'Version Control',    subtitle: 'MAJOR.MINOR.CYCLE versioning' },
  feedback:       { title: 'Feedback',           subtitle: 'Customer & stakeholder feedback' },
  research:       { title: 'Research',           subtitle: 'Market & technology research' },
  wiki:           { title: 'Wiki',               subtitle: 'Knowledge base & documentation' },
  deployments:    { title: 'Deployments',        subtitle: 'Deployment pipeline & history' },
  environments:   { title: 'Environments',       subtitle: 'Server configuration' },
  releases:       { title: 'Releases',           subtitle: 'Release planning & checklists' },
  team:           { title: 'Team',               subtitle: 'Developer management' },
  // AI-SDLC
  workflow:       { title: 'Workflow Pipeline',  subtitle: 'PM Build → Dev Handoff → QA Cycle → Acceptance → Production' },
  'qa-cycles':    { title: 'QA Cycles',          subtitle: 'AI-assisted quality assurance cycle tracking' },
  'ai-analyzer':  { title: 'AI Analyzer',        subtitle: 'Backend AI analyzer reports & git diff analysis' },
  'fix-review':   { title: 'Fix Review',         subtitle: 'Developer Accept / Modify / Reject queue' },
  'pm-signoff':   { title: 'PM Sign-Off',        subtitle: 'Product Manager build completion checklist' },
  'pdm-signoff':  { title: 'PDM Acceptance',     subtitle: 'Business acceptance sign-off & production gate' },
  'prompt-library': { title: 'Prompt Library',   subtitle: 'Versioned AI prompt repository' },
  'kpi-dashboard':  { title: 'KPI Dashboard',    subtitle: 'AI-SDLC performance metrics & analytics' },
  'canary':         { title: 'Canary Deployments', subtitle: 'Gradual rollout management with monitoring windows' },
};

function CollapsibleGroup({
  label, defaultOpen = false, collapsed = false, children,
}: {
  label: string; defaultOpen?: boolean; collapsed?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (collapsed) return <div className="mb-1">{children}</div>;
  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 pt-2.5 pb-1 text-[9px] tracking-[2px] uppercase text-primary-foreground/25 font-semibold hover:text-primary-foreground/40 transition-colors cursor-pointer"
      >
        {label}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open ? '' : '-rotate-90')} />
      </button>
      {open && children}
    </div>
  );
}

export default function AppLayout() {
  const { profile, signOut, can, userRole } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

  // Modal states
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Session timer — auto sign-out on expiry, reset on activity
  const { display: timerDisplay, secs: timerSecs, isWarning: timerWarning } = useSessionTimer(30, async () => {
    toast.warning('Session expired. Signing you out...');
    await signOut();
  });

  // Warn user 5 minutes before session expires
  useEffect(() => {
    if (timerSecs === 5 * 60) {
      toast.warning('Your session will expire in 5 minutes due to inactivity.');
    }
  }, [timerSecs]);

  // Dark mode: restore from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('splm-dark');
    if (saved === 'true') {
      document.documentElement.classList.add('dark');
      setDarkMode(true);
    }
  }, []);

  // Global Cmd+K / Ctrl+K shortcut for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const toggleDark = () => {
    document.documentElement.classList.toggle('dark');
    setDarkMode(d => {
      localStorage.setItem('splm-dark', (!d).toString());
      return !d;
    });
  };

  const canSeeItem = (item: NavItem) => {
    if (!item.permission) return true;
    return can(item.permission);
  };

  const renderPanel = () => {
    switch (activeTab) {
      case 'dashboard':       return <DashboardPanel />;
      case 'products':        return <ProductsPanel />;
      case 'tasks':           return <TasksPanel />;
      case 'sprints':         return <SprintsPanel />;
      case 'queue':           return <MyQueuePanel />;
      case 'team':            return <DevelopersPanel />;
      case 'feedback':        return <FeedbackPanel />;
      case 'research':        return <ResearchPanel />;
      case 'wiki':            return <WikiPanel />;
      case 'versions':        return <VersionControlPanel />;
      case 'deployments':     return <DeploymentsPanel />;
      case 'environments':    return <EnvironmentsPanel />;
      case 'releases':        return <ReleasesPanel />;
      // ── AI-SDLC panels ──────────────────────────────────────────────────
      case 'workflow':        return <WorkflowPipelinePanel />;
      case 'qa-cycles':       return <QACyclesPanel />;
      case 'ai-analyzer':     return <AIAnalyzerPanel />;
      case 'fix-review':      return <FixReviewPanel />;
      case 'pm-signoff':      return <PMSignOffPanel />;
      case 'pdm-signoff':     return <PDMAcceptancePanel />;
      case 'prompt-library':  return <PromptLibraryPanel />;
      case 'kpi-dashboard':   return <KPIDashboardPanel />;
      case 'canary':          return <CanaryDeploymentPanel />;
      default:                return <DashboardPanel />;
    }
  };

  const pageMeta = PAGE_TITLES[activeTab] || { title: 'SPLM' };
  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const NavButton = ({ item, isActive }: { item: NavItem; isActive: boolean }) => {
    const Icon = item.icon;
    const btn = (
      <button
        key={item.id}
        type="button"
        onClick={() => setActiveTab(item.id)}
        className={cn(
          'w-full flex items-center gap-2 py-[7px] rounded-[5px] text-xs font-medium transition-all relative cursor-pointer',
          sidebarCollapsed ? 'justify-center px-0 mx-0' : 'px-2.5 mx-1',
          isActive
            ? 'bg-primary-foreground/15 text-primary-foreground shadow-sm'
            : 'text-primary-foreground/50 hover:bg-primary-foreground/8 hover:text-primary-foreground/80'
        )}
      >
        {isActive && !sidebarCollapsed && (
          <div className="absolute left-0 top-[3px] bottom-[3px] w-[3px] bg-sky rounded-r-sm" />
        )}
        <Icon className={cn('flex-shrink-0', sidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4')} />
        {!sidebarCollapsed && <span className="flex-1 text-left">{item.label}</span>}
      </button>
    );

    if (sidebarCollapsed) {
      return (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>{btn}</TooltipTrigger>
          <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
        </Tooltip>
      );
    }
    return btn;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Global Modals ── */}
      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={(tab) => setActiveTab(tab)}
      />
      <HelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />

      {/* ── Sidebar ── */}
      <aside className={cn(
        'flex-shrink-0 bg-primary flex flex-col overflow-hidden shadow-lg relative z-10 transition-all duration-300',
        sidebarCollapsed ? 'w-[56px]' : 'w-[220px]'
      )}>
        {/* Logo */}
        <div className={cn(
          'border-b border-sidebar-border/20 flex items-center gap-2.5',
          sidebarCollapsed ? 'px-2 py-3.5 justify-center' : 'px-4 py-3.5'
        )}>
          <div className="w-[30px] h-[30px] bg-accent rounded-md flex items-center justify-center text-accent-foreground text-sm font-extrabold flex-shrink-0">
            Z
          </div>
          {!sidebarCollapsed && (
            <div>
              <div className="text-sm font-bold text-primary-foreground tracking-tight">ZenaTech</div>
              <div className="text-[8px] text-primary-foreground/40 tracking-[1.5px] uppercase">SPLM Platform</div>
            </div>
          )}
        </div>

        {/* Session Timer */}
        {!sidebarCollapsed ? (
          <div className={cn(
            'mx-2.5 mt-2.5 px-2.5 py-2 rounded-md border transition-colors',
            timerWarning
              ? 'bg-destructive/20 border-destructive/30'
              : 'bg-primary-foreground/5 border-primary-foreground/10'
          )}>
            <div className={cn(
              'flex items-center gap-1.5 text-[10px]',
              timerWarning ? 'text-destructive font-bold' : 'text-primary-foreground/50'
            )}>
              <Clock className="w-3 h-3" />
              Session:
              <span className={cn('font-semibold', timerWarning ? 'text-destructive' : 'text-primary-foreground/80')}>
                {timerDisplay}
              </span>
              {timerWarning && <span className="ml-auto text-[9px]">⚠ expiring</span>}
            </div>
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                'mx-1.5 mt-2.5 px-1 py-2 rounded-md border flex items-center justify-center',
                timerWarning ? 'bg-destructive/20 border-destructive/30' : 'bg-primary-foreground/5 border-primary-foreground/10'
              )}>
                <Clock className={cn('w-3.5 h-3.5', timerWarning ? 'text-destructive' : 'text-primary-foreground/50')} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Session: {timerDisplay}{timerWarning ? ' ⚠ expiring soon' : ''}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin pb-2 px-1 mt-1">
          {navGroups.map(group => {
            const visibleItems = group.items.filter(canSeeItem);
            if (visibleItems.length === 0) return null;
            const hasActive = visibleItems.some(i => i.id === activeTab);
            return (
              <CollapsibleGroup
                key={group.label}
                label={group.label}
                defaultOpen={hasActive || group.label === 'Overview'}
                collapsed={sidebarCollapsed}
              >
                {visibleItems.map(item => (
                  <NavButton key={item.id} item={item} isActive={activeTab === item.id} />
                ))}
              </CollapsibleGroup>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="px-2 py-1 border-t border-primary-foreground/10">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(c => !c)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-primary-foreground/40 hover:text-primary-foreground/70 hover:bg-primary-foreground/8 transition-all cursor-pointer text-xs',
                  sidebarCollapsed && 'justify-center'
                )}
              >
                {sidebarCollapsed
                  ? <PanelLeft className="w-4 h-4" />
                  : <><PanelLeftClose className="w-4 h-4" /><span>Collapse</span></>
                }
              </button>
            </TooltipTrigger>
            {sidebarCollapsed && (
              <TooltipContent side="right" className="text-xs">Expand sidebar</TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* User footer */}
        <div className={cn('p-3 border-t border-primary-foreground/10', sidebarCollapsed && 'px-1.5')}>
          <div className="flex items-center gap-2">
            <div className={cn(
              'bg-accent rounded-full flex items-center justify-center text-[10px] font-bold text-accent-foreground flex-shrink-0',
              sidebarCollapsed ? 'w-8 h-8' : 'w-7 h-7'
            )}>
              {initials}
            </div>
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-primary-foreground/80 truncate">{profile?.name}</div>
                  <div className="text-[9px] text-primary-foreground/35 capitalize">{userRole}</div>
                </div>
                <button
                  type="button"
                  onClick={signOut}
                  className="p-1 rounded hover:bg-primary-foreground/10 transition-colors text-primary-foreground/40 hover:text-primary-foreground/80 cursor-pointer"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Notifications panel (positioned relative to main area) */}
        <NotificationsPanel
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          onNavigate={(tab) => { setActiveTab(tab); setNotificationsOpen(false); }}
        />

        {/* Header bar */}
        <header className="bg-card border-b border-border px-5 h-12 flex items-center gap-2 flex-shrink-0 shadow-sm">
          <div className="flex-1 flex items-center gap-3">
            <h1 className="text-base font-bold text-foreground">{pageMeta.title}</h1>
            {pageMeta.subtitle && (
              <span className="text-[11px] text-muted-foreground hidden sm:inline">— {pageMeta.subtitle}</span>
            )}
          </div>

          {/* Search button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-md bg-background hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground hidden md:inline">Search...</span>
            <kbd className="text-[9px] text-muted-foreground/60 bg-muted px-1 py-0.5 rounded ml-2 hidden md:inline">⌘K</kbd>
          </button>

          {/* Notifications button */}
          <button
            onClick={() => { setNotificationsOpen(o => !o); setHelpOpen(false); }}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground relative cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={toggleDark}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground cursor-pointer"
            title="Toggle dark mode"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Help button */}
          <button
            onClick={() => { setHelpOpen(true); setNotificationsOpen(false); }}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground cursor-pointer"
            title="Help & shortcuts"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* User badge */}
          <div className="flex items-center gap-2 ml-1 pl-2 border-l border-border">
            <div className="w-7 h-7 bg-accent rounded-full flex items-center justify-center text-[10px] font-bold text-accent-foreground">
              {initials}
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-medium text-foreground leading-tight">{profile?.name}</div>
              <div className="text-[9px] text-muted-foreground capitalize">{userRole}</div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in scrollbar-thin">
          <div className="max-w-[1100px] mx-auto">
            {renderPanel()}
          </div>
        </main>
      </div>
    </div>
  );
}
