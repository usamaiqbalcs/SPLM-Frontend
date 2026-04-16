import { useState, useEffect, useMemo, useCallback, type ComponentType } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import GlobalSearchBar from '@/components/GlobalSearchBar';
import NotificationsPanel from '@/components/NotificationsPanel';
import HelpModal from '@/components/HelpModal';
import { pathToTab, tabToRouteSegment } from '@/lib/splm-routes';
import { SplmPage } from '@/components/layout/SplmPage';
import { cn } from '@/lib/utils';
import { LogOut, ChevronDown, Bell, HelpCircle, Moon, Sun, PanelLeftClose, PanelLeft, Menu } from 'lucide-react';
import { SPLM_NAV_SECTIONS, SPLM_PAGE_TITLES, SPLM_WIDE_CONTENT_TAB_IDS } from '@/config/splm-navigation';
import { SPLM_NAV_TAB_ICONS } from '@/config/splm-nav-icons';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useSessionTimer } from '@/hooks/useSessionTimer';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

type NavItem = { id: string; label: string; icon: ComponentType<{ className?: string }>; permission?: string };
type NavGroup = { label: string; items: NavItem[] };

/** Sidebar structure from `config/splm-navigation.ts` + Lucide icons from `config/splm-nav-icons.ts`. */
const navGroups: NavGroup[] = SPLM_NAV_SECTIONS.map((section) => ({
  label: section.section,
  items: section.items.map((def) => {
    const Icon = SPLM_NAV_TAB_ICONS[def.tabId];
    if (!Icon) {
      throw new Error(`splm-nav-icons: missing icon for tab "${def.tabId}"`);
    }
    return {
      id: def.tabId,
      label: def.label,
      icon: Icon,
      permission: def.permission,
    };
  }),
}));

function CollapsibleGroup({
  label, open, onToggle, collapsed = false, children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  collapsed?: boolean;
  children: React.ReactNode;
}) {
  if (collapsed) return <div className="mb-2 space-y-0.5">{children}</div>;
  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={`${label} section`}
        className="group relative z-10 flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/45 transition-colors hover:bg-primary-foreground/5 hover:text-primary-foreground/70"
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-200', open ? '' : '-rotate-90')}
          aria-hidden
        />
      </button>
      {open && <div className="mt-0.5 space-y-0.5 pb-2">{children}</div>}
    </div>
  );
}

export default function AppLayout() {
  const { profile, signOut, can, userRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => pathToTab(location.pathname));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

  // Modal states
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Keep inactivity expiry logic without per-second countdown state/rendering.
  useSessionTimer(
    30,
    async () => {
      toast.warning('Session expired. Signing you out...');
      await signOut();
    },
    {
      warnBeforeSeconds: 5 * 60,
      onWarn: () => {
        toast.warning('Your session will expire in 5 minutes due to inactivity.');
      },
    },
  );

  // Dark mode: restore from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('splm-dark');
    if (saved === 'true') {
      document.documentElement.classList.add('dark');
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    setActiveTab(pathToTab(location.pathname));
  }, [location.pathname]);

  const visibleNavGroups = useMemo(() => {
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (!item.permission) return true;
          return can(item.permission);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [can]);

  const [openSectionId, setOpenSectionId] = useState<string>('Overview');

  const toggleGroup = useCallback((label: string) => {
    /**
     * Root cause/fix: per-group open state could drift when several sections were open,
     * causing unreliable first-click toggles across groups. Use one accordion-style
     * section key so each click deterministically opens/closes exactly one section.
     */
    setOpenSectionId((prev) => (prev === label ? '' : label));
  }, []);

  useEffect(() => {
    // Keep the active route's group open after navigation.
    const activeGroup = visibleNavGroups.find((group) => group.items.some((i) => i.id === activeTab));
    if (!activeGroup) return;
    setOpenSectionId(activeGroup.label);
  }, [activeTab, visibleNavGroups]);

  useEffect(() => {
    // If permissions hide the currently open section, fall back safely.
    if (visibleNavGroups.some((g) => g.label === openSectionId)) return;
    setOpenSectionId(visibleNavGroups[0]?.label ?? '');
  }, [openSectionId, visibleNavGroups]);

  const toggleDark = () => {
    document.documentElement.classList.toggle('dark');
    setDarkMode(d => {
      localStorage.setItem('splm-dark', (!d).toString());
      return !d;
    });
  };

  const pageMeta = SPLM_PAGE_TITLES[activeTab] || { title: 'SPLM' };
  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const NavButton = ({
    item,
    isActive,
    collapsed,
    afterClick,
  }: {
    item: NavItem;
    isActive: boolean;
    collapsed: boolean;
    afterClick?: () => void;
  }) => {
    const Icon = item.icon;
    const btn = (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          navigate(`/${tabToRouteSegment(item.id)}`);
          afterClick?.();
        }}
        className={cn(
          'relative flex w-full cursor-pointer items-center gap-3 rounded-lg py-2 text-[13px] font-medium transition-colors',
          collapsed ? 'mx-0 justify-center px-0' : 'mx-1.5 px-3',
          isActive
            ? 'bg-primary-foreground/12 text-primary-foreground shadow-inner ring-1 ring-primary-foreground/10'
            : 'text-primary-foreground/60 hover:bg-primary-foreground/[0.07] hover:text-primary-foreground/95',
        )}
      >
        {isActive && !collapsed && (
          <div className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-full bg-sky" aria-hidden />
        )}
        <Icon className={cn('shrink-0 opacity-90', collapsed ? 'h-5 w-5' : 'h-[18px] w-[18px]')} />
        {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
      </button>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>{btn}</TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }
    return btn;
  };

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-background">

      {/* ── Global Modals ── */}
      <HelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="flex w-[min(100vw,280px)] flex-col border-primary-foreground/15 bg-primary p-0 text-primary-foreground sm:max-w-[280px] [&>button]:text-primary-foreground"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Main menu</SheetTitle>
          </SheetHeader>
          <div className="flex items-center gap-2.5 border-b border-primary-foreground/15 px-4 py-3.5">
            <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-md bg-accent text-sm font-extrabold text-accent-foreground">
              Z
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-tight">ZenaTech</div>
              <div className="text-[8px] uppercase tracking-[1.5px] text-primary-foreground/40">SPLM Platform</div>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto px-1 pb-4 pt-2 scrollbar-thin">
            {visibleNavGroups.map((group) => {
              return (
                <div key={group.label} className="mb-3">
                  <div className="px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[2px] text-primary-foreground/35">
                    {group.label}
                  </div>
                  {group.items.map((item) => (
                    <NavButton
                      key={item.id}
                      item={item}
                      isActive={activeTab === item.id}
                      collapsed={false}
                      afterClick={() => setMobileNavOpen(false)}
                    />
                  ))}
                </div>
              );
            })}
          </nav>
          <div className="border-t border-primary-foreground/10 p-3">
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                void signOut();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-xs font-medium text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Sidebar (tablet/desktop) ── */}
      <aside
        className={cn(
          'relative z-10 hidden flex-shrink-0 flex-col overflow-hidden border-r border-primary-foreground/10 bg-primary shadow-splm-md transition-all duration-300 md:flex',
          sidebarCollapsed ? 'w-[60px]' : 'w-[248px]',
        )}
      >
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

        {/* Navigation */}
        <nav className="mt-1 flex-1 overflow-y-auto px-1.5 pb-3 scrollbar-thin">
          {visibleNavGroups.map(group => {
            return (
              <CollapsibleGroup
                key={group.label}
                label={group.label}
                open={openSectionId === group.label}
                onToggle={() => toggleGroup(group.label)}
                collapsed={sidebarCollapsed}
              >
                {group.items.map((item) => (
                  <NavButton
                    key={item.id}
                    item={item}
                    isActive={activeTab === item.id}
                    collapsed={sidebarCollapsed}
                  />
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
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Notifications panel (positioned relative to main area) */}
        <NotificationsPanel
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          onUnreadCount={setNotificationUnread}
          onNavigate={(tab) => {
            navigate(`/${tabToRouteSegment(tab)}`);
            setNotificationsOpen(false);
          }}
        />

        {/* Header bar */}
        <header className="flex min-h-[3.25rem] flex-shrink-0 flex-col gap-3 border-b border-border/80 bg-card/85 px-4 py-3 shadow-sm backdrop-blur-md sm:min-h-14 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-border/80 bg-background text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">{pageMeta.title}</h1>
              {pageMeta.subtitle ? (
                <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-muted-foreground lg:line-clamp-1">
                  {pageMeta.subtitle}
                </p>
              ) : null}
            </div>
          </div>

          <GlobalSearchBar className="order-last w-full min-w-0 sm:order-none sm:max-w-md lg:max-w-xl sm:flex-1" />

          <div className="flex shrink-0 items-center justify-end gap-1 sm:ml-auto sm:justify-start sm:gap-1.5">
          {/* Notifications button */}
          <button
            onClick={() => { setNotificationsOpen(o => !o); setHelpOpen(false); }}
            className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Notifications"
            type="button"
          >
            <Bell className="h-4 w-4" />
            {notificationUnread > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" aria-hidden />
            )}
          </button>

          {/* Dark mode toggle */}
          <button
            type="button"
            onClick={toggleDark}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Toggle dark mode"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Help button */}
          <button
            type="button"
            onClick={() => { setHelpOpen(true); setNotificationsOpen(false); }}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Help & shortcuts"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          {/* User badge */}
          <div className="ml-1 flex items-center gap-2.5 border-l border-border/80 pl-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
              {initials}
            </div>
            <div className="hidden min-w-0 sm:block">
              <div className="truncate text-xs font-medium leading-tight text-foreground">{profile?.name}</div>
              <div className="text-[10px] capitalize leading-tight text-muted-foreground">{userRole}</div>
            </div>
          </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 animate-fade-in scrollbar-thin [scrollbar-gutter:stable] sm:px-6 lg:px-10 lg:py-8">
          {/*
            Root cause (narrow “paginated page” feel): a global max-width + mx-auto wrapped every route.
            Search keeps a deliberate narrow column; dashboards use full main width (see SPLM_WIDE_CONTENT_TAB_IDS).
          */}
          <div
            className={cn(
              'w-full min-w-0',
              activeTab === 'search'
                ? 'mx-auto max-w-[960px]'
                : SPLM_WIDE_CONTENT_TAB_IDS.has(activeTab)
                  ? 'max-w-none'
                  : 'mx-auto max-w-[var(--splm-page-max)]',
            )}
          >
            <SplmPage>
              <Outlet />
            </SplmPage>
          </div>
        </main>
      </div>
    </div>
  );
}
