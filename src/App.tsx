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
import NotFound from '@/pages/NotFound';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';

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
const WorkflowPipelinePanel  = lazy(() => import('@/components/panels/WorkflowPipelinePanel'));
const QACyclesPanel          = lazy(() => import('@/components/panels/QACyclesPanel'));
const AIAnalyzerPanel        = lazy(() => import('@/components/panels/AIAnalyzerPanel'));
const FixReviewPanel         = lazy(() => import('@/components/panels/FixReviewPanel'));
const PMSignOffPanel         = lazy(() => import('@/components/panels/PMSignOffPanel'));
const PDMAcceptancePanel     = lazy(() => import('@/components/panels/PDMAcceptancePanel'));
const PromptLibraryPanel     = lazy(() => import('@/components/panels/PromptLibraryPanel'));
const KPIDashboardPanel      = lazy(() => import('@/components/panels/KPIDashboardPanel'));
const CanaryDeploymentPanel  = lazy(() => import('@/components/panels/CanaryDeploymentPanel'));

/** Wraps each lazy panel in a Suspense boundary with a skeleton fallback. */
const Panel = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingSkeleton />}>{children}</Suspense>
);

const App = () => (
  <AuthProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected shell — all in-app routes live under AppLayout */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<AppLayout />}>
              {/* Index redirect so "/" → "/dashboard" */}
              <Route index element={<Navigate to="/dashboard" replace />} />

              {/* ── Core SPLM routes ───────────────────────────────────── */}
              <Route path="dashboard"    element={<Panel><DashboardPanel /></Panel>} />
              <Route path="queue"        element={<Panel><MyQueuePanel /></Panel>} />
              <Route path="products"     element={<Panel><ProductsPanel /></Panel>} />
              <Route path="tasks"        element={<Panel><TasksPanel /></Panel>} />
              <Route path="sprints"      element={<Panel><SprintsPanel /></Panel>} />
              <Route path="versions"     element={<Panel><VersionControlPanel /></Panel>} />
              <Route path="feedback"     element={<Panel><FeedbackPanel /></Panel>} />
              <Route path="research"     element={<Panel><ResearchPanel /></Panel>} />
              <Route path="wiki"         element={<Panel><WikiPanel /></Panel>} />
              <Route path="deployments"  element={<Panel><DeploymentsPanel /></Panel>} />
              <Route path="environments" element={<Panel><EnvironmentsPanel /></Panel>} />
              <Route path="releases"     element={<Panel><ReleasesPanel /></Panel>} />
              <Route path="team"         element={<Panel><DevelopersPanel /></Panel>} />

              {/* ── AI-SDLC Pipeline routes ────────────────────────────── */}
              <Route path="workflow"       element={<Panel><WorkflowPipelinePanel /></Panel>} />
              <Route path="qa-cycles"      element={<Panel><QACyclesPanel /></Panel>} />
              <Route path="ai-analyzer"    element={<Panel><AIAnalyzerPanel /></Panel>} />
              <Route path="fix-review"     element={<Panel><FixReviewPanel /></Panel>} />
              <Route path="pm-signoff"     element={<Panel><PMSignOffPanel /></Panel>} />
              <Route path="pdm-acceptance" element={<Panel><PDMAcceptancePanel /></Panel>} />
              <Route path="prompts"        element={<Panel><PromptLibraryPanel /></Panel>} />
              <Route path="kpi"            element={<Panel><KPIDashboardPanel /></Panel>} />
              <Route path="canary"         element={<Panel><CanaryDeploymentPanel /></Panel>} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </AuthProvider>
);

export default App;
