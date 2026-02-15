import { Outlet } from "react-router-dom";

export const MainLayout = () => {
    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col">
            <header className="bg-white shadow-sm h-16 flex items-center px-6 border-b border-neutral-200">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">A</div>
                    <h1 className="text-xl font-bold text-gray-900">SeekKrr Admin</h1>
                </div>
            </header>
            <div className="flex flex-1">
                <aside className="w-64 bg-white border-r border-neutral-200 hidden md:block p-4">
                    <nav className="space-y-1">
                        <a href="#" className="block px-3 py-2 text-sm font-medium rounded-md bg-indigo-50 text-indigo-700">Dashboard</a>
                        <a href="#" className="block px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50">Users</a>
                        <a href="#" className="block px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50">Quests</a>
                        <a href="#" className="block px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50">Settings</a>
                    </nav>
                </aside>
                <main className="flex-1 p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
