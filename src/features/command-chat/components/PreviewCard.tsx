import { useEffect, useId, useRef } from "react";
import { AlertTriangle, ArrowRight, Check, Loader2, RotateCw, X } from "lucide-react";
import type { ChangeValue, PreviewResult } from "@/services/commands.types";
import type { EntryError, PreviewStatus } from "../chatModel";
import { btnDanger, btnPrimary, btnSecondary, focusRing } from "./chatUi";

function show(v: ChangeValue): string {
    if (v === null || v === undefined || v === "") return "—";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    return String(v);
}

/** "Check before you confirm" — what will change, then Confirm (POST run) or Cancel. */
export function PreviewCard({
    result,
    status = "open",
    error,
    busy,
    autoFocus,
    onConfirm,
    onCancel,
    onRetry,
}: {
    result: PreviewResult;
    status?: PreviewStatus;
    error?: EntryError;
    busy: boolean;
    autoFocus: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    onRetry: () => void;
}) {
    const titleId = useId();
    const headingRef = useRef<HTMLHeadingElement>(null);
    const danger = result.danger;
    const settled = status === "confirmed" || status === "cancelled";

    useEffect(() => {
        if (autoFocus) headingRef.current?.focus({ preventScroll: true });
    }, [autoFocus]);

    return (
        <section
            aria-labelledby={titleId}
            className={`rounded-2xl border bg-white overflow-hidden shadow-sm ${
                danger && !settled ? "border-red-200" : "border-neutral-200"
            } ${settled ? "opacity-80" : ""}`}
        >
            <div className={`px-4 pt-3.5 pb-3 ${danger && !settled ? "bg-red-50/60" : "bg-neutral-50/60"}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-wider ${danger ? "text-red-600" : "text-[#00716d]"}`}>
                    {danger ? "Check carefully before you confirm" : "Check before you confirm"}
                </p>
                <h3
                    ref={headingRef}
                    id={titleId}
                    tabIndex={-1}
                    className="mt-0.5 text-[15px] font-semibold text-neutral-900"
                    style={{ outline: "none" }}
                >
                    {result.title}
                </h3>
                {result.summary && <p className="mt-0.5 text-sm text-neutral-600">{result.summary}</p>}
            </div>

            {result.changes.length > 0 && (
                <dl className="divide-y divide-neutral-100 border-t border-neutral-100">
                    {result.changes.map((c, i) => (
                        <div key={`${c.label}-${i}`} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm">
                            <dt className="sm:w-32 shrink-0 text-neutral-500">{c.label}</dt>
                            <dd className="flex items-center gap-2 flex-wrap min-w-0">
                                <span className="text-neutral-400 line-through decoration-neutral-300 break-words">
                                    <span className="sr-only">From </span>
                                    {show(c.before)}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" aria-hidden="true" />
                                <span className={`font-medium break-words ${danger ? "text-red-700" : "text-[#003634]"}`}>
                                    <span className="sr-only">to </span>
                                    {show(c.after)}
                                </span>
                            </dd>
                        </div>
                    ))}
                </dl>
            )}

            <div className="px-4 py-3 border-t border-neutral-100 flex flex-wrap items-center justify-end gap-2">
                {status === "confirmed" && (
                    <span className="mr-auto inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                        <Check className="w-4 h-4" aria-hidden="true" /> Confirmed
                    </span>
                )}
                {status === "cancelled" && (
                    <span className="mr-auto inline-flex items-center gap-1.5 text-sm text-neutral-500">
                        <X className="w-4 h-4" aria-hidden="true" /> Cancelled
                    </span>
                )}
                {status === "failed" && error && (
                    <div className="mr-auto flex items-start gap-2 text-sm text-red-700 min-w-0 basis-full sm:basis-auto sm:flex-1" role="alert">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                        <span className="min-w-0">
                            {error.message}{" "}
                            {error.action && (
                                <button type="button" onClick={onRetry} disabled={busy} className={`font-medium underline underline-offset-2 hover:text-red-900 disabled:opacity-50 rounded ${focusRing}`}>
                                    <RotateCw className="inline w-3.5 h-3.5 mr-1 -mt-0.5" aria-hidden="true" />
                                    {error.action === "retry" ? "Retry" : "Send again"}
                                </button>
                            )}
                        </span>
                    </div>
                )}
                {!settled && status !== "failed" && (
                    <>
                        <button type="button" onClick={onCancel} disabled={busy} className={btnSecondary}>
                            Cancel
                        </button>
                        <button type="button" onClick={onConfirm} disabled={busy} className={danger ? btnDanger : btnPrimary}>
                            {status === "running" ? (
                                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            ) : danger ? (
                                <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                            ) : (
                                <Check className="w-4 h-4" aria-hidden="true" />
                            )}
                            {status === "running" ? "Working…" : result.confirm_label}
                        </button>
                    </>
                )}
                {status === "failed" && error?.action && (
                    <button type="button" onClick={onCancel} disabled={busy} className={btnSecondary}>
                        Cancel
                    </button>
                )}
            </div>
        </section>
    );
}
