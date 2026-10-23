import { useEffect } from "react";
import { create } from "zustand";

interface PageMetaState {
    /** A page-provided name for the current record (e.g. a place's title). */
    title: string | null;
    setTitle: (title: string | null) => void;
}

/**
 * The app shell builds the browser-tab title and breadcrumbs from the route.
 * Detail pages can name the record they show with `usePageTitle`, which
 * replaces the generic last crumb ("Place") with the real name.
 */
export const usePageMetaStore = create<PageMetaState>((set) => ({
    title: null,
    setTitle: (title) => set({ title }),
}));

export function usePageTitle(title: string | null | undefined) {
    const setTitle = usePageMetaStore((s) => s.setTitle);
    useEffect(() => {
        setTitle(title?.trim() || null);
        return () => setTitle(null);
    }, [title, setTitle]);
}
