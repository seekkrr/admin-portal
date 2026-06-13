import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
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
 * Approve (release) an `initiated` refund. This MOVES MONEY — wrapped in the
 * type-CONFIRM ConfirmModal (warning theme) and gated to finance roles by the
 * caller. Collects the Razorpay refund speed (normal/optimum).
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
        <ConfirmModal
            open={open}
            theme="warning"
            title="Approve Refund"
            message={
                <>
                    You are about to release{" "}
                    <span className="font-semibold text-neutral-900">
                        {formatCurrency(refund.amount, refund.currency)}
                    </span>{" "}
                    back to the customer. This action moves money and cannot be undone.
                </>
            }
            confirmLabel="Approve & Release"
            confirmStyle="bg-amber-600 hover:bg-amber-700"
            onConfirm={() => approveMutation.mutate()}
            onCancel={onClose}
            isPending={approveMutation.isPending}
        >
            <div className="mb-1">
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                    Refund speed
                </label>
                <select
                    value={speed}
                    onChange={(e) => setSpeed(e.target.value as RefundSpeed)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-transparent capitalize"
                >
                    <option value="normal">Normal (standard settlement)</option>
                    <option value="optimum">Optimum (faster, may incur fees)</option>
                </select>
            </div>
        </ConfirmModal>
    );
}
