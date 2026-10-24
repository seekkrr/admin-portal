import { useCallback, useState } from "react";
import { safeStorage } from "@/utils/storage";

const COLLAPSED_KEY = "sidebar_collapsed";
const GROUPS_KEY = "sidebar_closed_groups";

/** Sidebar collapsed + closed menu groups, remembered in this browser. */
export function useShellPrefs() {
    const [collapsed, setCollapsed] = useState<boolean>(() => safeStorage.get<boolean>(COLLAPSED_KEY, false) === true);
    const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>(() => {
        const v = safeStorage.get<unknown>(GROUPS_KEY, {});
        return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, boolean>) : {};
    });

    const toggleCollapsed = useCallback(() => {
        setCollapsed((c) => {
            safeStorage.set(COLLAPSED_KEY, !c);
            return !c;
        });
    }, []);

    const toggleGroup = useCallback((group: string) => {
        setClosedGroups((prev) => {
            const next = { ...prev, [group]: !prev[group] };
            safeStorage.set(GROUPS_KEY, next);
            return next;
        });
    }, []);

    return { collapsed, toggleCollapsed, closedGroups, toggleGroup };
}
