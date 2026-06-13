import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { AccessDeniedPage } from "@/features/auth/pages/AccessDeniedPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { LoadingFallback } from "@components/LoadingFallback";

// Lazy-loaded page components
const DashboardPage = lazy(() => import("@/features/dashboard/pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const UsersPage = lazy(() => import("@/features/users/pages/UsersPage").then(m => ({ default: m.UsersPage })));
const CreatorsPage = lazy(() => import("@/features/creators/pages/CreatorsPage").then(m => ({ default: m.CreatorsPage })));
const CreatorEditPage = lazy(() => import("@/features/creators/pages/CreatorEditPage").then(m => ({ default: m.CreatorEditPage })));
const CreatorApplicationsPage = lazy(() => import("@/features/creator-applications/pages/CreatorApplicationsPage").then(m => ({ default: m.CreatorApplicationsPage })));
const QuestsPage = lazy(() => import("@/features/quests/pages/QuestsPage").then(m => ({ default: m.QuestsPage })));
const QuestDetailPage = lazy(() => import("@/features/quests/pages/QuestDetailPage").then(m => ({ default: m.QuestDetailPage })));
const SupportQueriesPage = lazy(() => import("@/features/support-queries/pages/SupportQueriesPage").then(m => ({ default: m.SupportQueriesPage })));
const SupportQueryDetailPage = lazy(() => import("@/features/support-queries/pages/SupportQueryDetailPage").then(m => ({ default: m.SupportQueryDetailPage })));
const AnalyticsPage = lazy(() => import("@/features/analytics/pages/AnalyticsPage").then(m => ({ default: m.AnalyticsPage })));
// Section 8 — Markers
const MarkersPage = lazy(() => import("@/features/markers/pages/MarkersPage").then(m => ({ default: m.MarkersPage })));
const MarkerDetailPage = lazy(() => import("@/features/markers/pages/MarkerDetailPage").then(m => ({ default: m.MarkerDetailPage })));
const MarkerApplicationsPage = lazy(() => import("@/features/markers/pages/MarkerApplicationsPage").then(m => ({ default: m.MarkerApplicationsPage })));
const MarkerApplicationDetailPage = lazy(() => import("@/features/markers/pages/MarkerApplicationDetailPage").then(m => ({ default: m.MarkerApplicationDetailPage })));
// Section 9 — Narratives & Reviews
const NarrativesPage = lazy(() => import("@/features/content/pages/NarrativesPage").then(m => ({ default: m.NarrativesPage })));
const NarrativeDetailPage = lazy(() => import("@/features/content/pages/NarrativeDetailPage").then(m => ({ default: m.NarrativeDetailPage })));
const ReviewsPage = lazy(() => import("@/features/content/pages/ReviewsPage").then(m => ({ default: m.ReviewsPage })));
const ReviewDetailPage = lazy(() => import("@/features/content/pages/ReviewDetailPage").then(m => ({ default: m.ReviewDetailPage })));
// Section 11 — Regions
const RegionsPage = lazy(() => import("@/features/regions/pages/RegionsPage").then(m => ({ default: m.RegionsPage })));
const RegionDetailPage = lazy(() => import("@/features/regions/pages/RegionDetailPage").then(m => ({ default: m.RegionDetailPage })));
// Section 10 — Achievements & Leaderboards
const AchievementsPage = lazy(() => import("@/features/achievements/pages/AchievementsPage").then(m => ({ default: m.AchievementsPage })));
const AchievementDetailPage = lazy(() => import("@/features/achievements/pages/AchievementDetailPage").then(m => ({ default: m.AchievementDetailPage })));
const LeaderboardsPage = lazy(() => import("@/features/achievements/pages/LeaderboardsPage").then(m => ({ default: m.LeaderboardsPage })));
// Section 12 — Task Configs & Step Rewards
const TaskConfigsPage = lazy(() => import("@/features/task-configs/pages/TaskConfigsPage").then(m => ({ default: m.TaskConfigsPage })));
const TaskConfigDetailPage = lazy(() => import("@/features/task-configs/pages/TaskConfigDetailPage").then(m => ({ default: m.TaskConfigDetailPage })));
// Section 14 — Progress Tracking
const ProgressPage = lazy(() => import("@/features/progress/pages/ProgressPage").then(m => ({ default: m.ProgressPage })));

export const AppRoutes = () => {
    return (
        <Routes>
            {/* Public Auth Routes */}
            <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/access-denied" element={<AccessDeniedPage />} />
            </Route>

            {/* Protected Routes */}
            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <DashboardLayout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={
                    <Suspense fallback={<LoadingFallback message="Loading dashboard..." />}>
                        <DashboardPage />
                    </Suspense>
                } />
                {/* Legacy /stats page removed (depended on V1-only interest endpoint); redirect to dashboard */}
                <Route path="stats" element={<Navigate to="/dashboard" replace />} />
                <Route path="users" element={
                    <Suspense fallback={<LoadingFallback message="Loading users..." />}>
                        <UsersPage />
                    </Suspense>
                } />
                <Route path="creators" element={
                    <Suspense fallback={<LoadingFallback message="Loading creators..." />}>
                        <CreatorsPage />
                    </Suspense>
                } />
                <Route path="creators/:creatorId" element={
                    <Suspense fallback={<LoadingFallback message="Loading creator..." />}>
                        <CreatorEditPage />
                    </Suspense>
                } />
                <Route path="creator-applications" element={
                    <Suspense fallback={<LoadingFallback message="Loading applications..." />}>
                        <CreatorApplicationsPage />
                    </Suspense>
                } />
                <Route path="quests" element={
                    <Suspense fallback={<LoadingFallback message="Loading quests..." />}>
                        <QuestsPage />
                    </Suspense>
                } />
                <Route path="quests/:questId" element={
                    <Suspense fallback={<LoadingFallback message="Loading quest..." />}>
                        <QuestDetailPage />
                    </Suspense>
                } />
                <Route path="support-queries" element={
                    <Suspense fallback={<LoadingFallback message="Loading support queries..." />}>
                        <SupportQueriesPage />
                    </Suspense>
                } />
                <Route path="support-queries/:queryId" element={
                    <Suspense fallback={<LoadingFallback message="Loading query details..." />}>
                        <SupportQueryDetailPage />
                    </Suspense>
                } />
                <Route path="analytics" element={
                    <Suspense fallback={<LoadingFallback message="Loading analytics..." />}>
                        <AnalyticsPage />
                    </Suspense>
                } />

                {/* Section 8 — Markers (static paths before :markerId) */}
                <Route path="markers" element={
                    <Suspense fallback={<LoadingFallback message="Loading markers..." />}>
                        <MarkersPage />
                    </Suspense>
                } />
                <Route path="markers/applications" element={
                    <Suspense fallback={<LoadingFallback message="Loading applications..." />}>
                        <MarkerApplicationsPage />
                    </Suspense>
                } />
                <Route path="markers/applications/:appId" element={
                    <Suspense fallback={<LoadingFallback message="Loading application..." />}>
                        <MarkerApplicationDetailPage />
                    </Suspense>
                } />
                <Route path="markers/:markerId" element={
                    <Suspense fallback={<LoadingFallback message="Loading marker..." />}>
                        <MarkerDetailPage />
                    </Suspense>
                } />

                {/* Section 9 — Narratives & Reviews */}
                <Route path="narratives" element={
                    <Suspense fallback={<LoadingFallback message="Loading narratives..." />}>
                        <NarrativesPage />
                    </Suspense>
                } />
                <Route path="narratives/:narrativeId" element={
                    <Suspense fallback={<LoadingFallback message="Loading narrative..." />}>
                        <NarrativeDetailPage />
                    </Suspense>
                } />
                <Route path="reviews" element={
                    <Suspense fallback={<LoadingFallback message="Loading reviews..." />}>
                        <ReviewsPage />
                    </Suspense>
                } />
                <Route path="reviews/:reviewId" element={
                    <Suspense fallback={<LoadingFallback message="Loading review..." />}>
                        <ReviewDetailPage />
                    </Suspense>
                } />

                {/* Section 11 — Regions */}
                <Route path="regions" element={
                    <Suspense fallback={<LoadingFallback message="Loading regions..." />}>
                        <RegionsPage />
                    </Suspense>
                } />
                <Route path="regions/:regionId" element={
                    <Suspense fallback={<LoadingFallback message="Loading region..." />}>
                        <RegionDetailPage />
                    </Suspense>
                } />

                {/* Section 12 — Task Configs (static before :taskId) */}
                <Route path="task-configs" element={
                    <Suspense fallback={<LoadingFallback message="Loading task configs..." />}>
                        <TaskConfigsPage />
                    </Suspense>
                } />
                <Route path="task-configs/:taskId" element={
                    <Suspense fallback={<LoadingFallback message="Loading task config..." />}>
                        <TaskConfigDetailPage />
                    </Suspense>
                } />

                {/* Section 10 — Achievements & Leaderboards */}
                <Route path="achievements" element={
                    <Suspense fallback={<LoadingFallback message="Loading achievements..." />}>
                        <AchievementsPage />
                    </Suspense>
                } />
                <Route path="achievements/:achievementId" element={
                    <Suspense fallback={<LoadingFallback message="Loading achievement..." />}>
                        <AchievementDetailPage />
                    </Suspense>
                } />
                <Route path="leaderboards" element={
                    <Suspense fallback={<LoadingFallback message="Loading leaderboards..." />}>
                        <LeaderboardsPage />
                    </Suspense>
                } />

                {/* Section 14 — Progress Tracking (read-only) */}
                <Route path="progress" element={
                    <Suspense fallback={<LoadingFallback message="Loading progress..." />}>
                        <ProgressPage />
                    </Suspense>
                } />
            </Route>
        </Routes>
    );
};
