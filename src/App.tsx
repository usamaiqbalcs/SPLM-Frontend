/**
 * App.tsx — Root router component
 *
 * Replaces the single-route setup with a nested route tree under AppLayout.
 * Each panel gets its own URL path so users can bookmark, share, and use
 * the browser Back button to navigate between sections.
 *
 * Lazy loading: every panel is code-split so only the dashboard JS is loaded
 * on initial render.  Remaining panels load on demand.
 *
 * AuthProvider wraps the entire tree so AuthContext is available everywhere
 * including inside nested route components.
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import LoginPage from '@/pages/LoginPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import NotFound from '@/pages/NotFound';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RequirePermission } from '@/components/RequirePermission';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { routeSegmentRequiresPermission } from '@/constants/splm-route-access';

// ── Lazy panel imports ────────────────────────────────────────────────────────
// Vite + SWC will create a separate chunk per panel.
// The Suspense boundary (see <Panel> below) shows a skeleton while loading.

const DashboardPanel        = lazy(() => import('@/components/panels/DashboardPanel'));
const ProductsPanel         = lazy(() => import('@/components/panels/ProductsPanel'));
const TasksPanel            = lazy(() => import('@/components/panels/TasksPanel'));
const MyQueuePanel          = lazy(() => import('@/components/panels/MyQueuePanel'));
const SprintsPanel          = lazy(() => import('@/components/panels/SprintsPanel'));
const DevelopersPanel       = lazy(() => import('@/components/panels/DevelopersPanel'));
const FeedbackPanel         = lazy(() => import('@/components/panels/FeedbackPanel'));
const ResearchPanel         = lazy(() => import('@/components/panels/ResearchPanel'));
const WikiPanel             = lazy(() => import('@/components/panels/WikiPanel'));
const VersionControlPanel   = lazy(() => import('@/components/panels/VersionControlPanel'));
const DeploymentsPanel      = lazy(() => import('@/components/panels/DeploymentsPanel'));
const EnvironmentsPanel     = lazy(() => import('@/components/panels/EnvironmentsPanel'));
const ReleasesPanel         = lazy(() => import('@/components/panels/ReleasesPanel'));
// AI-SDLC panels
const AiSdlcOverviewPanel     = lazy(() => import('@/components/panels/AiSdlcOverviewPanel'));
const WorkflowPipelinePanel  = lazy(() => import('@/components/panels/WorkflowPipelinePanel'));
const QACyclesPanel          = lazy(() => import('@/components/panels/QACyclesPanel'));
const AIAnalyzerPanel        = lazy(() => import('@/components/panels/AIAnalyzerPanel'));
const FixReviewPanel         = lazy(() => import('@/components/panels/FixReviewPanel'));
const PMSignOffPanel         = lazy(() => import('@/components/panels/PMSignOffPanel'));
const PDMAcceptancePanel     = lazy(() => import('@/components/panels/PDMAcceptancePanel'));
const PromptLibraryPanel     = lazy(() => import('@/components/panels/PromptLibraryPanel'));
const KPIDashboardPanel      = lazy(() => import('@/components/panels/KPIDashboardPanel'));
const CanaryDeploymentPanel  = lazy(() => import('@/components/panels/CanaryDeploymentPanel'));
const GlobalSearchPage        = lazy(() => import('@/pages/GlobalSearchPage'));
const AuditLogsPanel          = lazy(() => import('@/components/panels/AuditLogsPanel'));
const AdminUsersPanel         = lazy(() => import('@/components/panels/AdminUsersPanel'));
const AdminRbacPanel          = lazy(() => import('@/components/panels/AdminRbacPanel'));

/** Wraps each lazy panel in a Suspense boundary with a skeleton fallback. */
const Panel = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingSkeleton />}>{children}</Suspense>
);

/** Enforces the same permission as the sidebar for this URL segment (deep-link safe). */
function PanelRoute({
  segment,
  children,
}: {
  segment: string;
  children: React.ReactNode;
}) {
  const perm = routeSegmentRequiresPermission[segment];
  const inner = <Panel>{children}</Panel>;
  if (!perm) return inner;
  return <RequirePermission permission={perm}>{inner}</RequirePermission>;
}

const App = () => (
  <AuthProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Protected shell — all in-app routes live under AppLayout */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<AppLayout />}>
              {/* Index redirect so "/" → "/dashboard" */}
              <Route index element={<Navigate to="/dashboard" replace />} />

              {/* ── Core SPLM routes (permissions from `config/splm-navigation.ts`) ── */}
              <Route path="dashboard"    element={<PanelRoute segment="dashboard"><DashboardPanel /></PanelRoute>} />
              <Route path="queue"        element={<PanelRoute segment="queue"><MyQueuePanel /></PanelRoute>} />
              <Route path="products"     element={<PanelRoute segment="products"><ProductsPanel /></PanelRoute>} />
              <Route path="tasks"        element={<PanelRoute segment="tasks"><TasksPanel /></PanelRoute>} />
              <Route path="sprints"      element={<PanelRoute segment="sprints"><SprintsPanel /></PanelRoute>} />
              <Route path="versions"     element={<PanelRoute segment="versions"><VersionControlPanel /></PanelRoute>} />
              <Route path="feedback"     element={<PanelRoute segment="feedback"><FeedbackPanel /></PanelRoute>} />
              <Route path="research"     element={<PanelRoute segment="research"><ResearchPanel /></PanelRoute>} />
              <Route path="wiki"         element={<PanelRoute segment="wiki"><WikiPanel /></PanelRoute>} />
              <Route path="deployments"  element={<PanelRoute segment="deployments"><DeploymentsPanel /></PanelRoute>} />
              <Route path="environments" element={<PanelRoute segment="environments"><EnvironmentsPanel /></PanelRoute>} />
              <Route path="releases"     element={<PanelRoute segment="releases"><ReleasesPanel /></PanelRoute>} />
              <Route path="team"         element={<PanelRoute segment="team"><DevelopersPanel /></PanelRoute>} />
              <Route path="audit-logs"   element={<PanelRoute segment="audit-logs"><AuditLogsPanel /></PanelRoute>} />
              <Route path="user-management" element={<PanelRoute segment="user-management"><AdminUsersPanel /></PanelRoute>} />
              <Route path="rbac" element={<PanelRoute segment="rbac"><AdminRbacPanel /></PanelRoute>} />

              {/* ── AI-SDLC Pipeline routes ────────────────────────────── */}
              <Route path="ai-overview"    element={<PanelRoute segment="ai-overview"><AiSdlcOverviewPanel /></PanelRoute>} />
              <Route path="workflow"       element={<PanelRoute segment="workflow"><WorkflowPipelinePanel /></PanelRoute>} />
              <Route path="qa-cycles"      element={<PanelRoute segment="qa-cycles"><QACyclesPanel /></PanelRoute>} />
              <Route path="ai-analyzer"    element={<PanelRoute segment="ai-analyzer"><AIAnalyzerPanel /></PanelRoute>} />
              <Route path="fix-review"     element={<PanelRoute segment="fix-review"><FixReviewPanel /></PanelRoute>} />
              <Route path="pm-signoff"     element={<PanelRoute segment="pm-signoff"><PMSignOffPanel /></PanelRoute>} />
              <Route path="pdm-acceptance" element={<PanelRoute segment="pdm-acceptance"><PDMAcceptancePanel /></PanelRoute>} />
              <Route path="prompts"        element={<PanelRoute segment="prompts"><PromptLibraryPanel /></PanelRoute>} />
              <Route path="kpi"            element={<PanelRoute segment="kpi"><KPIDashboardPanel /></PanelRoute>} />
              <Route path="canary"         element={<PanelRoute segment="canary"><CanaryDeploymentPanel /></PanelRoute>} />
              <Route path="search"         element={<PanelRoute segment="search"><GlobalSearchPage /></PanelRoute>} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </AuthProvider>
);

export default App;
