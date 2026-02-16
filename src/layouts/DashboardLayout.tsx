import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@store/auth.store";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { Footer, Sidebar } from "@components/ui";
import { NAV_ITEMS } from "@/config/navigation";

export function DashboardLayout() {
    const { logout } = useAuthStore();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        const stored = localStorage.getItem("sidebar_collapsed");
        return stored ? JSON.parse(stored) : false;
    });

    const toggleSidebar = () => {
        const newState = !sidebarCollapsed;
        setSidebarCollapsed(newState);
        localStorage.setItem("sidebar_collapsed", JSON.stringify(newState));
    };

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col">
            <header className="bg-white border-b border-neutral-200 sticky top-0 z-40 font-sans h-16">
                <div className="w-full px-4 sm:px-6 lg:px-8 h-full">
                    <div className="flex items-center h-full gap-4">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-2">
                            <img src="/seekkrr-logo.svg" alt="SeekKrr" className="h-8" />
                        </Link>

                        {/* User Menu */}
                        <div className="hidden md:flex items-center gap-4 ml-auto">
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition-colors"
                            >
                                <LogOut className="w-5 h-5" />
                                <span className="text-sm font-normal">Logout</span>
                            </button>
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            className="md:hidden ml-auto p-2 text-neutral-600 hover:text-neutral-900"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                        >
                            {isMobileMenuOpen ? (
                                <X className="w-6 h-6" />
                            ) : (
                                <Menu className="w-6 h-6" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden border-t border-neutral-200 bg-white absolute w-full left-0 top-16 shadow-lg z-50">
                        <div className="px-4 py-4 space-y-4">
                            {NAV_ITEMS.map((item) => (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    className="block py-2 text-neutral-600 hover:text-neutral-900"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    {item.label}
                                </Link>
                            ))}
                            <div className="pt-4 border-t border-neutral-100">
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2 text-red-600 hover:text-red-700 font-normal"
                                >
                                    <LogOut className="w-5 h-5" />
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            <div className="flex flex-1 max-w-[1920px] mx-auto w-full overflow-hidden">
                {/* Sidebar - Controlled by parent state */}
                <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

                {/* Main Content */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <main className="flex-1 p-6 overflow-y-auto">
                        <Outlet />
                    </main>
                    {/* Footer */}
                    <Footer />
                </div>
            </div>
        </div>
    );
}
