import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, SelectInput } from "@/components/ui/Field";
import { refundsService } from "../services/refunds.service";
import { formatCurrency } from "@/utils/format";
import type { Refund, RefundSpeed } from "@/types";

interface RefundApprovalModalProps {
    open: boolean;
    refund: Refund | null;
    onClose: () => void;
    onApproved?: (refund: Refund) => void;
}

/**
 * Approve (release) an `initiated` refund. This MOVES MONEY, so it asks for a
 * confirmation and the Razorpay refund speed (normal / optimum). Gated to
 * finance roles by the caller.
 */
export function RefundApprovalModal({ open, refund, onClose, onApproved }: RefundApprovalModalProps) {
    const queryClient = useQueryClient();
    const [speed, setSpeed] = useState<RefundSpeed>("normal");

    useEffect(() => {
        if (open) setSpeed("normal");
    }, [open]);

    const approveMutation = useMutation({
        mutationFn: () => {
            if (!refund) throw new Error("No refund selected");
            return refundsService.approve(refund._id, { speed });
        },
        onSuccess: (updated) => {
            queryClient.invalidateQueries({ queryKey: ["admin-refunds"] });
            queryClient.invalidateQueries({ queryKey: ["refund-detail", refund?._id] });
            queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
            queryClient.invalidateQueries({ queryKey: ["transaction-detail", refund?.transaction_id] });
            queryClient.invalidateQueries({ queryKey: ["payment-events"] });
            queryClient.invalidateQueries({ queryKey: ["today", "refunds"] });
            toast.success("Refund approved — funds release initiated");
            onApproved?.(updated);
            onClose();
        },
        onError: (err: unknown) => {
            const m = (err as { message?: string })?.message;
            toast.error(m?.trim() ? m : "Failed to approve refund");
        },
    });

    if (!refund) return null;

    return (
        <ConfirmDialog
            open={open}
            tone="warning"
            title="Approve refund?"
            description={
                <>
                    This releases <span className="font-semibold text-ink">{formatCurrency(refund.amount, refund.currency)}</span> back to the customer.
                    The money moves straight away and can&apos;t be pulled back.
                </>
            }
            confirmLabel="Approve and release"
            onConfirm={() => approveMutation.mutate()}
            onCancel={onClose}
            isPending={approveMutation.isPending}
        >
            <Field label="Refund speed">
                <SelectInput value={speed} onChange={(e) => setSpeed(e.target.value as RefundSpeed)} disabled={approveMutation.isPending}>
                    <option value="normal">Normal (standard settlement)</option>
                    <option value="optimum">Optimum (faster, may incur fees)</option>
                </SelectInput>
            </Field>
        </ConfirmDialog>
    );
}
