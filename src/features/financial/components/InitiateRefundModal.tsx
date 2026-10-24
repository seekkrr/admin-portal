import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { refundsService } from "../services/refunds.service";
import { formatCurrency, shortId } from "@/utils/format";
import type { InitiateRefundPayload, Transaction } from "@/types";

interface InitiateRefundModalProps {
    open: boolean;
    onClose: () => void;
    /** The captured transaction to refund. Omit to let the admin enter a transaction id. */
    transaction?: Pick<Transaction, "_id" | "amount" | "currency" | "order_id"> | null;
}

/**
 * Start a refund against a captured transaction (refunds:create). Blank amount
 * = full refund. Opens the new refund on success; approving it is a separate step.
 */
export function InitiateRefundModal({ open, onClose, transaction }: InitiateRefundModalProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [txnId, setTxnId] = useState("");
    const [amount, setAmount] = useState("");
    const [reason, setReason] = useState("");
    const [amountError, setAmountError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setTxnId("");
            setAmount("");
            setReason("");
            setAmountError(null);
        }
    }, [open]);

    const mutation = useMutation({
        mutationFn: (payload: InitiateRefundPayload) => refundsService.initiate(payload),
        onSuccess: (refund) => {
            queryClient.invalidateQueries({ queryKey: ["admin-refunds"] });
            queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
            queryClient.invalidateQueries({ queryKey: ["transaction-detail"] });
            queryClient.invalidateQueries({ queryKey: ["payment-events"] });
            queryClient.invalidateQueries({ queryKey: ["today", "refunds"] });
            toast.success("Refund initiated");
            onClose();
            navigate(`/refunds/${refund._id}`);
        },
        onError: (err: unknown) => {
            const m = (err as { message?: string })?.message;
            toast.error(m?.trim() ? m : "Failed to initiate refund");
        },
    });

    const targetId = transaction?._id ?? txnId.trim();
    const canSubmit = !!targetId && reason.trim().length >= 3 && !mutation.isPending;

    const submit = () => {
        if (!canSubmit) return;
        const payload: InitiateRefundPayload = { transaction_id: targetId, reason: reason.trim() };
        const a = amount.trim();
        if (a !== "") {
            const n = Number(a);
            if (Number.isNaN(n) || n <= 0) {
                setAmountError("Enter a positive amount, or leave it blank for a full refund.");
                return;
            }
            if (transaction && n > transaction.amount) {
                setAmountError("The amount can't be more than the transaction total.");
                return;
            }
            payload.amount = n;
        }
        setAmountError(null);
        mutation.mutate(payload);
    };

    const currency = transaction?.currency ?? "INR";

    return (
        <Modal
            open={open}
            onClose={onClose}
            dismissible={!mutation.isPending}
            icon={RotateCcw}
            title="Initiate refund"
            description={
                transaction ? (
                    <>
                        Against the captured transaction of{" "}
                        <span className="font-semibold text-ink">{formatCurrency(transaction.amount, transaction.currency)}</span>
                        {transaction.order_id && <span className="font-mono text-xs"> ({shortId(transaction.order_id, 10, 6)})</span>}. Approving it is a
                        separate step.
                    </>
                ) : (
                    "Create a refund request against a captured transaction. Approving it is a separate step."
                )
            }
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={submit} disabled={!canSubmit} loading={mutation.isPending}>
                        Initiate refund
                    </Button>
                </>
            }
        >
            <form
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
            >
                {!transaction && (
                    <Field label="Transaction ID" required hint="The id of a captured transaction (copy it from the transaction's page).">
                        <TextInput
                            value={txnId}
                            onChange={(e) => setTxnId(e.target.value)}
                            placeholder="65f1c2…"
                            className="font-mono"
                            autoComplete="off"
                            spellCheck={false}
                            autoFocus
                        />
                    </Field>
                )}
                <Field label={`Amount (${currency})`} hint="Optional — leave blank for a full refund." error={amountError}>
                    <TextInput
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={amount}
                        onChange={(e) => {
                            setAmount(e.target.value);
                            setAmountError(null);
                        }}
                        placeholder={transaction ? `Full: ${transaction.amount}` : "Full amount"}
                    />
                </Field>
                <Field label="Reason" required hint="At least 3 characters. Kept on the refund record.">
                    <TextArea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>
                <button type="submit" hidden aria-hidden tabIndex={-1} />
            </form>
        </Modal>
    );
}
