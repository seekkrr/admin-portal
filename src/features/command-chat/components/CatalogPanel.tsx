import { useEffect, useRef, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import type { CatalogCommand } from "@/services/commands.types";
import { exampleChip, focusRing } from "./chatUi";

const AREA_ORDER = ["Today", "Places", "People", "Businesses", "Experiences", "Quests"];

function groupCatalog(commands: CatalogCommand[]): { area: string; commands: CatalogCommand[] }[] {
    const groups = new Map<string, CatalogCommand[]>();
    for (const c of commands) {
        const list = groups.get(c.area) ?? [];
        list.push(c);
        groups.set(c.area, list);
    }
    const rank = (a: string) => {
        const i = AREA_ORDER.indexOf(a);
        return i === -1 ? AREA_ORDER.length : i;
    };
    return [...groups.entries()]
        .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
        .map(([area, list]) => ({ area, commands: list }));
}

/** "What you can do": the caller's commands by area; tapping an example puts it in the composer. */
export function CatalogPanel({
    commands,
    isLoading,
    error,
    unavailable,
    onRetry,
    onInsert,
}: {
    commands: CatalogCommand[] | undefined;
    isLoading: boolean;
    error: boolean;
    unavailable: boolean;
    onRetry: () => void;
    onInsert: (text: string) => void;
}) {
    if (unavailable) {
        return <p className="text-sm text-neutral-500">The list of commands will appear here once this server has the chat.</p>;
    }
    if (isLoading) {
        return (
            <p className="flex items-center gap-2 text-sm text-neutral-500" role="status">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading…
            </p>
        );
    }
    if (error) {
        return (
            <p className="text-sm text-neutral-500">
                Couldn&apos;t load the list.{" "}
                <button type="button" onClick={onRetry} className={`font-medium text-[#00716d] hover:underline rounded ${focusRing}`}>
                    Try again
                </button>
            </p>
        );
    }
    const groups = groupCatalog(commands ?? []);
    if (!groups.length) return <p className="text-sm text-neutral-500">No commands are available to you yet.</p>;
    return (
        <div className="space-y-5">
            {groups.map((g) => (
                <section key={g.area} aria-labelledby={`cat-${g.area}`}>
                    <h3 id={`cat-${g.area}`} className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                        {g.area}
                    </h3>
                    <ul className="mt-2 space-y-3">
                        {g.commands.map((c) => (
                            <li key={c.id}>
                                <p className="text-sm font-medium text-neutral-800">{c.label}</p>
                                {c.examples.length > 0 && (
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                        {c.examples.map((ex) => (
                                            <button
                                                key={ex}
                                                type="button"
                                                onClick={() => onInsert(ex)}
                                                className={exampleChip}
                                                aria-label={`Use: ${ex}`}
                                            >
                                                {ex}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    );
}

/** Phone: the same list in a bottom sheet. */
export function CatalogSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
    const closeRef = useRef<HTMLButtonElement>(null);
    const returnFocus = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!open) return;
        returnFocus.current = document.activeElement as HTMLElement | null;
        closeRef.current?.focus();
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("keydown", onKey);
            returnFocus.current?.focus?.();
        };
    }, [open, onClose]);

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 animate-fade-in" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="command-catalog-title"
                onClick={(e) => e.stopPropagation()}
                className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[80dvh] flex flex-col animate-slide-up"
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 shrink-0">
                    <h2 id="command-catalog-title" className="text-base font-semibold text-neutral-900">
                        What you can do
                    </h2>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className={`p-1.5 rounded-xl text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 ${focusRing}`}
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>
                <div className="px-5 py-4 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
            </div>
        </div>
    );
}
