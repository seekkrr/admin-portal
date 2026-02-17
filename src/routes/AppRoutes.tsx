import { Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { AuthCallbackPage } from "@/features/auth/pages/AuthCallbackPage";
import { AccessDeniedPage } from "@/features/auth/pages/AccessDeniedPage";
import { UsersPage } from "@/features/users/pages/UsersPage";
import { CreatorsPage } from "@/features/creators/pages/CreatorsPage";
import { CreatorEditPage } from "@/features/creators/pages/CreatorEditPage";
import { QuestsPage } from "@/features/quests/pages/QuestsPage";
import { QuestDetailPage } from "@/features/quests/pages/QuestDetailPage";
import { StatsPage } from "@/features/stats/pages/StatsPage";
import { ProtectedRoute } from "./ProtectedRoute";

export const AppRoutes = () => {
    return (
        <Routes>
            {/* Public Auth Routes */}
            <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
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
                <Route index element={<Navigate to="/stats" replace />} />
                <Route path="stats" element={<StatsPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="creators" element={<CreatorsPage />} />
                <Route path="creators/:userId" element={<CreatorEditPage />} />
                <Route path="quests" element={<QuestsPage />} />
                <Route path="quests/:questId" element={<QuestDetailPage />} />
            </Route>
        </Routes>
    );
};
