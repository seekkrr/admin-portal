import { type ReactNode } from "react";
import { CheckCircle, XCircle, AlertCircle, MessageSquare } from "lucide-react";
import type { QuestReviewHistoryEntry } from "@/types";

interface ReviewHistoryProps {
    entries: QuestReviewHistoryEntry[];
}

const ACTION_STYLES: Record<string, { icon: ReactNode; badge: string }> = {
    approved: {
        icon: <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />,
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    rejected: {
        icon: <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />,
        badge: "bg-rose-50 text-rose-700 border-rose-200",
    },
    changes_requested: {
        icon: <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />,
        badge: "bg-orange-50 text-orange-700 border-orange-200",
    },
    submitted: {
        icon: <MessageSquare className="w-4 h-4 text-blue-500 flex-shrink-0" />,
        badge: "bg-blue-50 text-blue-700 border-blue-200",
    },
};

const DEFAULT_STYLE = {
    icon: <MessageSquare className="w-4 h-4 text-neutral-400 flex-shrink-0" />,
    badge: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

function formatAction(action: string): string {
    return action
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

export function ReviewHistory({ entries }: ReviewHistoryProps) {
    if (entries.length === 0) {
        return (
            <p className="text-sm text-neutral-400 italic">No review actions yet for this quest.</p>
        );
    }

    const sorted = [...entries].sort(
        (a, b) =>
            new Date(b.commented_at ?? 0).getTime() -
            new Date(a.commented_at ?? 0).getTime()
    );

    return (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {sorted.map((entry, i) => {
                const style = ACTION_STYLES[entry.action] ?? DEFAULT_STYLE;
                return (
                    <div
                        key={i}
                        className="bg-neutral-50 rounded-xl border border-neutral-200 p-4 space-y-2"
                    >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                                {style.icon}
                                <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${style.badge}`}
                                >
                                    {formatAction(entry.action)}
                                </span>
                            </div>
                            <div className="text-xs text-neutral-400 flex items-center gap-1.5 flex-shrink-0">
                                {entry.commented_by && (
                                    <>
                                        <span className="font-medium text-neutral-500">
                                            Admin (…{entry.commented_by.slice(-6)})
                                        </span>
                                        <span>·</span>
                                    </>
                                )}
                                <span>
                                    {entry.commented_at
                                        ? new Date(entry.commented_at).toLocaleString("en-IN", {
                                              day: "2-digit",
                                              month: "short",
                                              hour: "2-digit",
                                              minute: "2-digit",
                                              hour12: true,
                                          })
                                        : "—"}
                                </span>
                            </div>
                        </div>
                        {entry.comment && (
                            <p className="text-sm text-neutral-700 leading-relaxed pl-6 italic">
                                "{entry.comment}"
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
