import { Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { AuthCallbackPage } from "@/features/auth/pages/AuthCallbackPage";
import { AccessDeniedPage } from "@/features/auth/pages/AccessDeniedPage";
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
            <Route element={
                <ProtectedRoute>
                    <DashboardLayout />
                </ProtectedRoute>
            }>
                <Route path="/" element={
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-neutral-200">
                            <h2 className="text-lg font-medium text-gray-900">Welcome to Admin Portal</h2>
                            <p className="mt-1 text-sm text-gray-500">This is the dashboard of the admin portal.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="bg-white p-6 rounded-lg shadow-sm border border-neutral-200">
                                    <div className="h-8 w-8 bg-indigo-100 rounded-full mb-4"></div>
                                    <h3 className="text-sm font-medium text-gray-900">Stat Card {i}</h3>
                                    <p className="mt-1 text-2xl font-semibold text-indigo-600">1,234</p>
                                </div>
                            ))}
                        </div>
                    </div>
                } />
            </Route>
        </Routes>
    );
};
