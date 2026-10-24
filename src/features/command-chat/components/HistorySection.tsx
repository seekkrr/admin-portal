import { useId, useState } from "react";
import { Check, ChevronDown, CornerDownLeft, History, X } from "lucide-react";
import type { CommandHistoryItem } from "@/services/commands.types";
import { focusRing } from "./chatUi";

function dayKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(d: Date): string {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (dayKey(d) === dayKey(today)) return "Today";
    if (dayKey(d) === dayKey(yesterday)) return "Yesterday";
    return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

/**
 * The caller's earlier commands (before this conversation), collapsed by
 * default. "Use again" puts a command back into the composer.
 */
export function HistorySection({ items, onUse }: { items: CommandHistoryItem[]; onUse: (text: string) => void }) {
    const [open, setOpen] = useState(false);
    const listId = useId();
    if (!items.length) return null;

    // Oldest first, like the conversation below it.
    const sorted = [...items].sort((a, b) => a.at.localeCompare(b.at));
    const todayKey = dayKey(new Date());
    const allToday = sorted.every((i) => dayKey(new Date(i.at)) === todayKey);
    const title = allToday ? "Earlier today" : "Earlier";

    const groups: { label: string; items: CommandHistoryItem[] }[] = [];
    for (const item of sorted) {
        const d = new Date(item.at);
        const label = Number.isNaN(d.getTime()) ? "Earlier" : dayLabel(d);
        const last = groups[groups.length - 1];
        if (last && last.label === label) last.items.push(item);
        else groups.push({ label, items: [item] });
    }

    return (
        <section aria-label="Earlier commands" className="mb-4">
            <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-neutral-200" aria-hidden="true" />
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    aria-expanded={open}
                    aria-controls={listId}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-neutral-500 bg-white border border-neutral-200 hover:text-neutral-800 hover:border-neutral-300 transition-colors ${focusRing}`}
                >
                    <History className="w-3.5 h-3.5" aria-hidden="true" />
                    {title} · {items.length}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                <span className="h-px flex-1 bg-neutral-200" aria-hidden="true" />
            </div>
            {open && (
                <div id={listId} className="mt-3 rounded-2xl border border-neutral-200 bg-white/80 divide-y divide-neutral-100">
                    {groups.map((g) => (
                        <div key={g.label} className="py-1">
                            {!allToday && (
                                <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{g.label}</p>
                            )}
                            <ul>
                                {g.items.map((item, i) => {
                                    const d = new Date(item.at);
                                    const time = Number.isNaN(d.getTime())
                                        ? ""
                                        : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
                                    const ok = item.status === "done";
                                    return (
                                        <li key={`${item.at}-${i}`} className="px-4 py-2 flex items-start gap-3">
                                            <span
                                                className={`mt-0.5 w-5 h-5 shrink-0 rounded-full flex items-center justify-center ${
                                                    ok ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                                                }`}
                                            >
                                                {ok ? <Check className="w-3 h-3" aria-hidden="true" /> : <X className="w-3 h-3" aria-hidden="true" />}
                                                <span className="sr-only">{ok ? "Done" : "Failed"}</span>
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm text-neutral-900 break-words">{item.text}</p>
                                                <p className="text-xs text-neutral-500 break-words">
                                                    {time && <time dateTime={item.at}>{time}</time>}
                                                    {time && item.message ? " · " : ""}
                                                    {item.message}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => onUse(item.text)}
                                                className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-neutral-500 hover:text-[#003634] hover:bg-neutral-100 ${focusRing}`}
                                                aria-label={`Use again: ${item.text}`}
                                            >
                                                <CornerDownLeft className="w-3.5 h-3.5" aria-hidden="true" />
                                                <span className="hidden sm:inline">Use again</span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
