import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "@/utils/cx";
import { Menu, type MenuItem } from "./Menu";

export interface PageHeaderProps {
    title: ReactNode;
    /** One short line under the title. */
    description?: ReactNode;
    icon?: LucideIcon;
    /** Small element next to the title (count, status pill). */
    badge?: ReactNode;
    /** The main action (usually one primary Button). */
    primaryAction?: ReactNode;
    /** Other visible actions (secondary buttons, links). */
    actions?: ReactNode;
    /** Less-used actions, collapsed into a "⋯" menu. */
    menu?: MenuItem[];
    className?: string;
}

/**
 * The one page heading. On phones the actions wrap under the title; the
 * overflow menu stays next to the title so it is always reachable.
 */
export function PageHeader({ title, description, icon: Icon, badge, primaryAction, actions, menu, className }: PageHeaderProps) {
    const menuItems = menu ?? [];
    const hasMenu = menuItems.some((m) => !m.hidden);
    const hasActions = !!primaryAction || !!actions;
    return (
        <header className={cx("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
            <div className="flex min-w-0 items-start gap-3">
                {Icon && (
                    <span className="mt-0.5 hidden h-10 w-10 shrink-0 items-center justify-center rounded-card bg-brand-900 text-white shadow-sm sm:flex">
                        <Icon className="h-5 w-5" aria-hidden />
                    </span>
                )}
                <div className="min-w-0 flex-1">
                    <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                        <span className="min-w-0 break-words">{title}</span>
                        {badge}
                    </h1>
                    {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
                </div>
                {hasMenu && (
                    <div className="sm:hidden">
                        <Menu items={menuItems} />
                    </div>
                )}
            </div>
            {(hasActions || hasMenu) && (
                <div className={cx("flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end", hasActions ? "flex" : "hidden sm:flex")}>
                    {actions}
                    {primaryAction}
                    {hasMenu && (
                        <div className="hidden sm:block">
                            <Menu items={menuItems} />
                        </div>
                    )}
                </div>
            )}
        </header>
    );
}

/** Section heading inside a page (one style everywhere). */
export function SectionHeading({ children, actions, className }: { children: ReactNode; actions?: ReactNode; className?: string }) {
    return (
        <div className={cx("flex flex-wrap items-center justify-between gap-2", className)}>
            <h2 className="text-base font-semibold text-ink">{children}</h2>
            {actions}
        </div>
    );
}
