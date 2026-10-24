import { useLocation } from "react-router-dom";
import { findNavMatch } from "@/config/navigation";
import { usePageMetaStore } from "@/hooks/usePageTitle";

export interface Crumb {
    label: string;
    to?: string;
}

export const APP_NAME = "SeekKrr Admin";

/**
 * Breadcrumbs and the browser-tab title, from the route and the menu:
 *   /markers            → Places and map › Places
 *   /markers/<id>       → Places and map › Places › <page title or "Place">
 * Pages name the record they show with usePageTitle().
 */
export function useRouteMeta(): { crumbs: Crumb[]; title: string } {
    const { pathname } = useLocation();
    const override = usePageMetaStore((s) => s.title);
    const match = findNavMatch(pathname);
    if (!match) {
        const label = override ?? "Page not found";
        return { crumbs: [{ label }], title: label };
    }
    const crumbs: Crumb[] = [{ label: match.group.group }, { label: match.item.label, to: match.item.to }];
    if (match.isDetail) crumbs.push({ label: override ?? match.item.detailLabel ?? "Details" });
    return { crumbs, title: crumbs[crumbs.length - 1]?.label ?? match.item.label };
}
