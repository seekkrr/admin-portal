import { Link } from "react-router-dom";
import { AlertTriangle, Link2, ExternalLink, X } from "lucide-react";
import type { NarrativeAttachSummary, NarrativeAttachType } from "@/types";

const TYPE_LABEL: Record<NarrativeAttachType, string> = {
    marker: "marker",
    quest: "quest",
    region: "region",
};

interface NarrativeConflictDialogProps {
    open: boolean;
    summary: NarrativeAttachSummary | null;
    // Chain the in-progress narrative onto the existing content. The parent
    // derives the actual chain fields (chain_id + sequence_order, or chain_with)
    // from `summary`, so no argument is needed here.
    onChainIt: () => void;
    onCancel: () => void;
    isPending?: boolean;
}

export function NarrativeConflictDialog({
    open,
    summary,
    onChainIt,
    onCancel,
    isPending,
}: NarrativeConflictDialogProps) {
    if (!open || !summary) return null;

    const label = TYPE_LABEL[summary.attach_type];

    // The single existing narrative we offer to "edit": first chain's lead
    // narrative, else the first standalone.
    const firstChain = summary.chains[0];
    const firstStandalone = summary.standalone[0];
    const editId = firstChain?.first_narrative_id ?? firstStandalone?._id ?? null;
    const editTitle = firstChain?.label ?? firstStandalone?.title ?? null;
    const willAppendPart = firstChain?.next_sequence_order ?? null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md animate-slide-up rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-neutral-200 p-5">
                    <h3 className="flex items-center gap-2 text-base font-bold text-neutral-900">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        This {label} already has a narrative
                    </h3>
                    <button
                        onClick={onCancel}
                        disabled={isPending}
                        className="rounded-md p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-50"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-4 p-5">
                    <p className="text-sm text-neutral-600">
                        {summary.active_count} existing{" "}
                        {summary.active_count === 1 ? "narrative is" : "narratives are"} attached to
                        this {label}. You can chain your new narrative onto the existing one, or edit
                        the existing narrative instead.
                    </p>

                    {editTitle && (
                        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                            <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                                Existing
                            </div>
                            <div className="mt-1 truncate text-sm font-semibold text-neutral-900">
                                {editTitle || "Untitled"}
                            </div>
                            {willAppendPart !== null && (
                                <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-amber-700">
                                    <Link2 className="h-3.5 w-3.5" />
                                    Yours will be added as part #{willAppendPart}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-2 border-t border-neutral-200 p-5 sm:flex-row sm:justify-end">
                    {editId && (
                        <Link
                            to={`/narratives/${editId}`}
                            onClick={onCancel}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200"
                        >
                            <ExternalLink className="h-4 w-4" />
                            Edit existing
                        </Link>
                    )}
                    <button
                        onClick={onChainIt}
                        disabled={isPending}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                    >
                        {isPending ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                            <Link2 className="h-4 w-4" />
                        )}
                        Chain it
                    </button>
                </div>
            </div>
        </div>
    );
}
