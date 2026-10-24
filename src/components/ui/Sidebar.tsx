import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { findNavMatch, navGroupsForRoles } from "@/config/navigation";
import { useAuthStore } from "@/store/auth.store";
import { NavList } from "@/components/shell/NavList";
import { cx } from "@/utils/cx";

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
    closedGroups: Record<string, boolean>;
    onToggleGroup: (group: string) => void;
    /** Pending counts by menu path. */
    counts?: Record<string, number>;
}

/**
 * Desktop/tablet side menu: grouped, role-filtered, collapsible to icons,
 * sticky under the header. Hidden on phones (they use the drawer).
 */
export function Sidebar({ collapsed, onToggle, closedGroups, onToggleGroup, counts }: SidebarProps) {
    const roles = useAuthStore((s) => s.user?.role);
    const { pathname } = useLocation();
    const groups = useMemo(() => navGroupsForRoles(roles), [roles]);
    const activeTo = findNavMatch(pathname)?.item.to ?? null;

    return (
        <aside
            aria-label="Side menu"
            className={cx(
                "sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 md:flex",
                collapsed ? "w-[4.5rem]" : "w-64"
            )}
        >
            <div className={cx("flex-1 overflow-y-auto overscroll-contain py-3", collapsed ? "px-2" : "px-3")}>
                <NavList groups={groups} activeTo={activeTo} counts={counts} collapsed={collapsed} closedGroups={closedGroups} onToggleGroup={onToggleGroup} />
            </div>
            <div className={cx("border-t border-line p-2", collapsed ? "flex justify-center" : "")}>
                <button
                    type="button"
                    onClick={onToggle}
                    aria-label={collapsed ? "Expand menu" : "Collapse menu"}
                    title={collapsed ? "Expand menu" : "Collapse menu"}
                    className={cx(
                        "flex items-center gap-2 rounded-control text-sm text-ink-muted transition-colors hover:bg-brand-50 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500",
                        collapsed ? "h-10 w-10 justify-center" : "w-full px-3 py-2"
                    )}
                >
                    {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden /> : <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden />}
                    {!collapsed && <span>Collapse menu</span>}
                </button>
            </div>
        </aside>
    );
}
