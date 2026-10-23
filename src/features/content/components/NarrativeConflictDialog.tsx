import { AlertTriangle, ExternalLink, Link2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { NarrativeAttachSummary, NarrativeAttachType } from "@/types";

const TYPE_LABEL: Record<NarrativeAttachType, string> = {
    marker: "place",
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

export function NarrativeConflictDialog({ open, summary, onChainIt, onCancel, isPending }: NarrativeConflictDialogProps) {
    if (!summary) return null;

    const label = TYPE_LABEL[summary.attach_type];

    // The single existing narrative we offer to "edit": first chain's lead
    // narrative, else the first standalone.
    const firstChain = summary.chains[0];
    const firstStandalone = summary.standalone[0];
    const editId = firstChain?.first_narrative_id ?? firstStandalone?._id ?? null;
    const editTitle = firstChain?.label ?? firstStandalone?.title ?? null;
    const willAppendPart = firstChain?.next_sequence_order ?? null;

    return (
        <Modal
            open={open}
            onClose={onCancel}
            dismissible={!isPending}
            icon={AlertTriangle}
            title={`This ${label} already has a narrative`}
            size="md"
            footer={
                <>
                    {editId && (
                        <ButtonLink to={`/narratives/${editId}`} onClick={onCancel} variant="secondary" icon={ExternalLink}>
                            Edit existing
                        </ButtonLink>
                    )}
                    <Button variant="primary" icon={Link2} onClick={onChainIt} loading={isPending}>
                        Chain it
                    </Button>
                </>
            }
        >
            <p className="text-sm text-ink-muted">
                {summary.active_count} existing {summary.active_count === 1 ? "narrative is" : "narratives are"} attached to this {label}. You can chain your
                new narrative onto the existing one, or edit the existing narrative instead.
            </p>

            {editTitle && (
                <div className="rounded-control border border-line bg-surface-muted px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Existing</div>
                    <div className="mt-1 truncate text-sm font-semibold text-ink">{editTitle || "Untitled"}</div>
                    {willAppendPart !== null && (
                        <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-warn">
                            <Link2 className="h-3.5 w-3.5" aria-hidden />
                            Yours will be added as part #{willAppendPart}
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}
