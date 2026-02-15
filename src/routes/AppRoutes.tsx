import { Routes, Route } from "react-router-dom";
import { MainLayout } from "@/layouts/MainLayout";

export const AppRoutes = () => {
    return (
        <Routes>
            <Route element={<MainLayout />}>
                <Route path="/" element={
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-neutral-200">
                            <h2 className="text-lg font-medium text-gray-900">Welcome to Admin Portal</h2>
                            <p className="mt-1 text-sm text-gray-500">This is the initial setup of the admin portal.</p>
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
