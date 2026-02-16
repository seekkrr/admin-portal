import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@store/auth.store";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { Footer } from "@components/ui";

export function DashboardLayout() {
    const { logout } = useAuthStore();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col">
            <header className="bg-white border-b border-neutral-200 sticky top-0 z-40 font-sans">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center h-20">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-2">
                            <img src="/seekkrr-logo.svg" alt="SeekKrr" className="h-8" />
                        </Link>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center gap-8 ml-auto">
                            {/* Add other nav links here if needed */}
                        </nav>

                        {/* User Menu */}
                        <div className="hidden md:flex items-center gap-4 ml-8">
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
                    <div className="md:hidden border-t border-neutral-200 bg-white">
                        <div className="px-4 py-4 space-y-4">
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

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
                <Outlet />
            </main>

            {/* Footer */}
            <Footer />
        </div>
    );
}
