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
const StatsPage = lazy(() => import("@/features/stats/pages/StatsPage").then(m => ({ default: m.StatsPage })));
const SupportQueriesPage = lazy(() => import("@/features/support-queries/pages/SupportQueriesPage").then(m => ({ default: m.SupportQueriesPage })));
const SupportQueryDetailPage = lazy(() => import("@/features/support-queries/pages/SupportQueryDetailPage").then(m => ({ default: m.SupportQueryDetailPage })));
const AnalyticsPage = lazy(() => import("@/features/analytics/pages/AnalyticsPage").then(m => ({ default: m.AnalyticsPage })));

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
                {/* Backward compat: /stats redirects to /dashboard */}
                <Route path="stats" element={
                    <Suspense fallback={<LoadingFallback message="Loading stats..." />}>
                        <StatsPage />
                    </Suspense>
                } />
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
            </Route>
        </Routes>
    );
};
