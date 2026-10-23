import { Suspense, useCallback, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@store/auth.store";
import { Footer, Sidebar } from "@components/ui";
import { LoadingFallback } from "@components/LoadingFallback";
import { AppHeader } from "@/components/shell/AppHeader";
import { BottomBar, MobileNavDrawer } from "@/components/shell/MobileNav";
import { Breadcrumbs, DocumentTitle } from "@/components/shell/Breadcrumbs";
import { useShellPrefs } from "@/components/shell/useShellPrefs";
import { onOpenSearchPalette } from "@/components/shell/searchEvents";
import { SearchPalette } from "@/features/search/SearchPalette";
import { useNavCounts } from "@/features/today/useTodayItems";

/**
 * The app frame: sticky header (logo, search, Chat, signed-in user), a grouped
 * role-filtered side menu on tablets/desktops, a drawer + bottom bar on
 * phones, breadcrumbs and the page title. Pages render inside one page width
 * and one gutter — they must not add their own outer padding.
 */
export function DashboardLayout() {
    const { logout } = useAuthStore();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    // The chat screen has its own sticky composer at the bottom, so the phone
    // bottom bar steps aside there (the header avatar still opens the menu).
    const showBottomBar = !(pathname === "/chat" || pathname.startsWith("/chat/"));
    const { collapsed, toggleCollapsed, closedGroups, toggleGroup } = useShellPrefs();
    const [menuOpen, setMenuOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const counts = useNavCounts();
    const todayCount = Object.values(counts).reduce((a, b) => a + b, 0);

    const openSearch = useCallback(() => {
        setMenuOpen(false);
        setSearchOpen(true);
    }, []);
    const closeSearch = useCallback(() => setSearchOpen(false), []);
    const openMenu = useCallback(() => setMenuOpen(true), []);
    const closeMenu = useCallback(() => setMenuOpen(false), []);

    // Ctrl/Cmd+K opens search from anywhere.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setSearchOpen((v) => !v);
            }
        };
        window.addEventListener("keydown", onKey);
        const off = onOpenSearchPalette(openSearch);
        return () => {
            window.removeEventListener("keydown", onKey);
            off();
        };
    }, [openSearch]);

    const handleLogout = async () => {
        setMenuOpen(false);
        await logout();
        navigate("/login");
    };

    return (
        <div className="flex min-h-dvh flex-col">
            <DocumentTitle />
            <AppHeader onOpenSearch={openSearch} onOpenMenu={openMenu} onLogout={handleLogout} />

            <div className="flex w-full flex-1">
                <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} closedGroups={closedGroups} onToggleGroup={toggleGroup} counts={counts} />

                <div className={`${showBottomBar ? "pb-bottom-bar " : ""}flex min-w-0 flex-1 flex-col`}>
                    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-page flex-1 px-4 py-4 focus:outline-none sm:px-6 sm:py-6 lg:px-8">
                        <Breadcrumbs />
                        <Suspense fallback={<LoadingFallback />}>
                            <Outlet />
                        </Suspense>
                    </main>
                    <Footer />
                </div>
            </div>

            {showBottomBar && <BottomBar onOpenSearch={openSearch} onOpenMenu={openMenu} menuOpen={menuOpen} todayCount={todayCount} />}
            <MobileNavDrawer
                open={menuOpen}
                onClose={closeMenu}
                onLogout={handleLogout}
                closedGroups={closedGroups}
                onToggleGroup={toggleGroup}
                counts={counts}
            />
            <SearchPalette open={searchOpen} onClose={closeSearch} />
        </div>
    );
}
