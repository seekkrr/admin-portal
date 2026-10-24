import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import type { NavGroup } from "@/config/navigation";
import { CountBadge } from "@/components/ui/StatusPill";
import { cx } from "@/utils/cx";

export interface NavListProps {
    groups: NavGroup[];
    /** `to` of the active item (longest match for the current path). */
    activeTo: string | null;
    /** Pending counts by item `to`. */
    counts?: Record<string, number>;
    /** Icons only (desktop collapsed sidebar). */
    collapsed?: boolean;
    closedGroups: Record<string, boolean>;
    onToggleGroup: (group: string) => void;
    onNavigate?: () => void;
}

/** Grouped, role-filtered menu used by the sidebar and the phone drawer. */
export function NavList({ groups, activeTo, counts = {}, collapsed, closedGroups, onToggleGroup, onNavigate }: NavListProps) {
    return (
        <nav aria-label="Main menu" className="space-y-1">
            {groups.map((group, gi) => {
                // A group that holds the active page never hides it.
                const hasActive = group.items.some((i) => i.to === activeTo);
                const closed = !collapsed && !!closedGroups[group.group] && !hasActive;
                const groupCount = group.items.reduce((n, i) => n + (counts[i.to] ?? 0), 0);
                const listId = `nav-group-${gi}`;
                return (
                    <div key={group.group} className={cx(gi > 0 && (collapsed ? "border-t border-line pt-2" : "pt-2"))}>
                        {!collapsed && (
                            <button
                                type="button"
                                onClick={() => onToggleGroup(group.group)}
                                aria-expanded={!closed}
                                aria-controls={listId}
                                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint transition-colors hover:text-ink-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                            >
                                <span className="flex items-center gap-2">
                                    {group.group}
                                    {closed && <CountBadge count={groupCount} />}
                                </span>
                                <ChevronDown className={cx("h-3.5 w-3.5 transition-transform", closed && "-rotate-90")} aria-hidden />
                            </button>
                        )}
                        <ul id={listId} hidden={closed} className="space-y-0.5">
                            {group.items.map((item) => {
                                const active = item.to === activeTo;
                                const count = counts[item.to];
                                return (
                                    <li key={item.to}>
                                        <Link
                                            to={item.to}
                                            onClick={onNavigate}
                                            aria-current={active ? "page" : undefined}
                                            title={collapsed ? `${item.label}${count ? ` (${count})` : ""}` : undefined}
                                            aria-label={collapsed ? item.label : undefined}
                                            className={cx(
                                                "group relative flex items-center gap-3 rounded-control text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500",
                                                collapsed ? "mx-auto h-10 w-10 justify-center" : "px-3 py-2",
                                                active ? "bg-brand-900 font-medium text-white shadow-sm" : "text-ink-muted hover:bg-brand-50 hover:text-ink"
                                            )}
                                        >
                                            {active && !collapsed && <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent-500" aria-hidden />}
                                            <item.icon className={cx("h-[18px] w-[18px] shrink-0", active ? "text-accent-300" : "text-ink-faint group-hover:text-ink-muted")} aria-hidden />
                                            {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                                            {!collapsed && <CountBadge count={count} />}
                                            {collapsed && !!count && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-highlight ring-2 ring-surface" aria-hidden />}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                );
            })}
        </nav>
    );
}
