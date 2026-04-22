import { useState, useEffect, useMemo, useCallback, type ComponentType } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import GlobalSearchBar from '@/components/GlobalSearchBar';
import NotificationsPanel from '@/components/NotificationsPanel';
import HelpModal from '@/components/HelpModal';
import { pathToTab, tabToRouteSegment } from '@/lib/splm-routes';
import { SplmPage } from '@/components/layout/SplmPage';
import { cn } from '@/lib/utils';
import { LogOut, ChevronDown, Bell, HelpCircle, Moon, Sun, PanelLeftClose, PanelLeft, Menu, UserCircle, Palette, Settings } from 'lucide-react';
import { SPLM_NAV_SECTIONS, SPLM_PAGE_TITLES, SPLM_WIDE_CONTENT_TAB_IDS } from '@/config/splm-navigation';
import { SPLM_NAV_TAB_ICONS } from '@/config/splm-nav-icons';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useSessionTimer } from '@/hooks/useSessionTimer';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { SplmPermissions } from '@/constants/splm-rbac';

type NavItem = { id: string; label: string; icon: ComponentType<{ className?: string }>; permission?: string };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = SPLM_NAV_SECTIONS.map((section) => ({
  label: section.section,
  items: section.items.map((def) => {
    const Icon = SPLM_NAV_TAB_ICONS[def.tabId];
    if (!Icon) throw new Error(`splm-nav-icons: missing icon for tab "${def.tabId}"`);
    return { id: def.tabId, label: def.label, icon: Icon, permission: def.permission };
  }),
}));

function sectionLabelForTabId(tab: string): string | null {
  for (const s of SPLM_NAV_SECTIONS) {
    if (s.items.some((i) => i.tabId === tab)) return s.section;
  }
  return null;
}

/** ZenaTech wordmark — navy tile with lowercase “z” (brand). */
function BrandMark() {
  return (
    <div
      className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#0f2744] text-[15px] font-bold leading-none text-white shadow-sm ring-1 ring-black/5 dark:bg-[#1a3655] dark:ring-white/10"
      aria-hidden
    >
      z
    </div>
  );
}

// ─── Section header ─────────────────────────────────────────────────────────
function SectionHeader({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`Toggle ${label}`}
      className="group mb-1 flex w-full cursor-pointer items-center gap-2 px-1 py-1 transition-all"
    >
      <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80 transition-colors group-hover:text-foreground/90">
        {label}
      </span>
      <span
        className="h-px flex-1 rounded-full bg-border/50 transition-colors group-hover:bg-border"
        aria-hidden
      />
      <ChevronDown
        className={cn(
          'h-3 w-3 shrink-0 text-muted-foreground/40 transition-transform duration-200 group-hover:text-muted-foreground/70',
          open ? '' : '-rotate-90',
        )}
        aria-hidden
      />
    </button>
  );
}

// ─── Main layout ─────────────────────────────────────────────────────────────
export default function AppLayout() {
  const { profile, signOut, can, userRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState(() => pathToTab(location.pathname));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Accordion nav: only the section for the current route is expanded; others open on header click.
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const label = sectionLabelForTabId(pathToTab(location.pathname));
    return label ? new Set([label]) : new Set();
  });

  useSessionTimer(
    30,
    async () => {
      toast.warning('Session expired. Signing you out...');
      await signOut();
    },
    {
      warnBeforeSeconds: 5 * 60,
      onWarn: () => toast.warning('Your session will expire in 5 minutes due to inactivity.'),
    },
  );

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

  const visibleNavGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => (!item.permission ? true : can(item.permission))),
        }))
        .filter((group) => group.items.length > 0),
    [can],
  );

  const activeNavSection = useMemo(
    () => visibleNavGroups.find((g) => g.items.some((i) => i.id === activeTab))?.label ?? null,
    [activeTab, visibleNavGroups],
  );

  const toggleGroup = useCallback(
    (label: string) => {
      setOpenSections((prev) => {
        if (prev.has(label)) {
          if (activeNavSection === label) {
            return prev;
          }
          if (activeNavSection) {
            return new Set([activeNavSection]);
          }
          return new Set();
        }
        return new Set([label]);
      });
    },
    [activeNavSection],
  );

  // Keep sidebar in sync with the current route: expand only the section that contains the active item.
  useEffect(() => {
    setOpenSections(
      activeNavSection ? new Set([activeNavSection]) : new Set(),
    );
  }, [activeNavSection]);

  const goToDashboard = useCallback(() => {
    navigate(`/${tabToRouteSegment('dashboard')}`);
    setMobileNavOpen(false);
  }, [navigate]);

  const toggleDark = () => {
    document.documentElement.classList.toggle('dark');
    setDarkMode((d) => {
      localStorage.setItem('splm-dark', (!d).toString());
      return !d;
    });
  };

  const pageMeta = SPLM_PAGE_TITLES[activeTab] || { title: 'SPLM' };
  const initials = profile?.name
    ? profile.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  // ─── Nav item button ────────────────────────────────────────────────────────
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
          'group relative flex w-full cursor-pointer items-center gap-3 rounded-lg py-[8px] text-[14px] font-semibold transition-all duration-150',
          collapsed ? 'justify-center px-0' : 'px-3',
          isActive
            ? 'bg-primary/[0.09] text-primary'
            : 'text-foreground/60 hover:bg-muted hover:text-foreground',
        )}
      >
        {/* Active left-edge bar */}
        {isActive && (
          <span
            className={cn(
              'absolute left-0 rounded-r-full bg-primary',
              collapsed
                ? 'top-1/2 h-5 w-[3px] -translate-y-1/2'
                : 'bottom-[5px] top-[5px] w-[3px]',
            )}
            aria-hidden
          />
        )}

        <Icon
          className={cn(
            'shrink-0 transition-colors duration-150',
            collapsed ? 'h-[19px] w-[19px]' : 'h-[16px] w-[16px]',
            isActive
              ? 'text-primary'
              : 'text-foreground/40 group-hover:text-foreground/70',
          )}
        />

        {!collapsed && (
          <span className="flex-1 truncate text-left leading-none">{item.label}</span>
        )}
      </button>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>{btn}</TooltipTrigger>
          <TooltipContent side="right" className="text-sm font-semibold text-foreground">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }
    return btn;
  };

  // ─── Shared nav renderer ────────────────────────────────────────────────────
  const renderNavGroups = (collapsed: boolean, afterClick?: () => void) =>
    visibleNavGroups.map((group) => (
      <div key={group.label} className="mb-2">
        {!collapsed && (
          <SectionHeader
            label={group.label}
            open={openSections.has(group.label)}
            onToggle={() => toggleGroup(group.label)}
          />
        )}
        {(collapsed || openSections.has(group.label)) && (
          <div className={cn('space-y-[3px]', !collapsed && 'pl-0.5')}>
            {group.items.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                isActive={activeTab === item.id}
                collapsed={collapsed}
                afterClick={afterClick}
              />
            ))}
          </div>
        )}
      </div>
    ));

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-background">

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* ── Mobile nav sheet ── */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="flex w-[min(100vw,272px)] flex-col border-r border-border bg-card p-0 sm:max-w-[272px] [&>button]:rounded-md [&>button]:text-muted-foreground [&>button]:hover:bg-muted [&>button]:hover:text-foreground"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Main menu</SheetTitle>
          </SheetHeader>

          {/* Logo — wordmark goes to dashboard */}
          <button
            type="button"
            onClick={goToDashboard}
            className="flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            aria-label="Go to dashboard"
          >
            <BrandMark />
            <div className="min-w-0">
              <div className="text-[14px] font-bold leading-none tracking-tight text-foreground">ZenaTech</div>
              <div className="mt-0.5 text-[8.5px] uppercase tracking-[1.5px] text-muted-foreground">SPLM PLATFORM</div>
            </div>
          </button>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-2 pb-4 pt-2 scrollbar-thin">
            {renderNavGroups(false, () => setMobileNavOpen(false))}
          </nav>

          {/* Footer */}
          <div className="flex flex-col gap-1 border-t border-border p-3">
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                navigate(`/${tabToRouteSegment('profile')}`);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <UserCircle className="h-3.5 w-3.5" />
              Profile
            </button>
            <button
              type="button"
              onClick={() => { setMobileNavOpen(false); void signOut(); }}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Sidebar (tablet/desktop) ── */}
      <aside
        className={cn(
          'relative z-10 hidden flex-shrink-0 flex-col overflow-hidden border-r border-border bg-card shadow-sm transition-all duration-300 md:flex',
          sidebarCollapsed ? 'w-[64px]' : 'w-[256px]',
        )}
      >
        {/* ── Logo — wordmark goes to dashboard ── */}
        {sidebarCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={goToDashboard}
                className="flex w-full items-center justify-center border-b border-border px-4 py-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                aria-label="Go to dashboard"
              >
                <BrandMark />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-sm font-semibold text-foreground">
              Dashboard
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={goToDashboard}
            className="flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            aria-label="Go to dashboard"
          >
            <BrandMark />
            <div className="min-w-0">
              <div className="text-[14px] font-bold leading-none tracking-tight text-foreground">ZenaTech</div>
              <div className="mt-0.5 text-[8.5px] uppercase tracking-[1.5px] text-muted-foreground">SPLM PLATFORM</div>
            </div>
          </button>
        )}

        {/* ── Navigation ── */}
        <nav className="mt-1 flex-1 overflow-y-auto px-2 pb-3 pt-1 scrollbar-thin">
          {renderNavGroups(sidebarCollapsed)}
        </nav>

        {/* ── Collapse toggle ── */}
        <div className="border-t border-border px-2.5 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setSidebarCollapsed((c) => !c)}
                className={cn(
                  'group flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-muted-foreground/60 transition-all hover:bg-muted hover:text-muted-foreground',
                  sidebarCollapsed && 'justify-center',
                )}
              >
                {sidebarCollapsed ? (
                  <PanelLeft className="h-4 w-4 transition-transform group-hover:scale-110" />
                ) : (
                  <>
                    <PanelLeftClose className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
                    <span>Collapse</span>
                  </>
                )}
              </button>
            </TooltipTrigger>
            {sidebarCollapsed && (
              <TooltipContent side="right" className="text-sm font-semibold text-foreground">
                Expand sidebar
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">

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
        <header className="flex min-h-[3.25rem] flex-shrink-0 flex-col gap-3 border-b border-border/80 bg-card/85 px-4 py-3 shadow-sm backdrop-blur-md sm:min-h-14 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 sm:px-6">
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
            <button
              onClick={() => { setNotificationsOpen(o => !o); setHelpOpen(false); }}
              className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Notifications"
              type="button"
            >
              <Bell className="h-4 w-4" />
              {notificationUnread > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" aria-hidden />
              )}
            </button>

            <button
              type="button"
              onClick={toggleDark}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Toggle dark mode"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={() => { setHelpOpen(true); setNotificationsOpen(false); }}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Help & shortcuts"
            >
              <HelpCircle className="h-4 w-4" />
            </button>

            {/* Account — top right (name, role, chevron) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'ml-1 flex max-w-[min(100%,15rem)] items-center gap-2 rounded-lg border border-border/80 bg-muted/45 px-2 py-1.5 text-left shadow-sm outline-none transition-colors hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring',
                    'min-h-9',
                  )}
                  aria-label="Account menu"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0f2744] text-[10px] font-bold text-white ring-2 ring-border/60 dark:bg-[#1a3655]">
                    {initials}
                  </div>
                  <div className="hidden min-w-0 flex-1 sm:block">
                    <div className="truncate text-xs font-semibold leading-tight text-foreground">{profile?.name}</div>
                    <div className="truncate text-[10px] capitalize leading-tight text-muted-foreground">{userRole}</div>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-foreground">{profile?.name ?? 'Account'}</span>
                    <span className="truncate text-xs text-muted-foreground">{profile?.email ?? ''}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/${tabToRouteSegment('profile')}`)}>
                  <UserCircle className="h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                {can(SplmPermissions.IdentityManage) && (
                  <DropdownMenuItem
                    onClick={() => navigate(`/${tabToRouteSegment('user-management')}`)}
                  >
                    <Settings className="h-4 w-4" />
                    Account settings
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    toggleDark();
                  }}
                >
                  <Palette className="h-4 w-4" />
                  Theme ({darkMode ? 'Dark' : 'Light'})
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    void signOut();
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 animate-fade-in scrollbar-thin [scrollbar-gutter:stable] sm:px-6 lg:py-8">
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
