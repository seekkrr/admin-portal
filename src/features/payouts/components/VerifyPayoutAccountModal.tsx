import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { payoutAccountsService } from "../services/payout-accounts.service";
import type { AdminPayoutAccount, VerifyPayoutAccountPayload } from "@/types";

interface VerifyPayoutAccountModalProps {
    /** Which decision this dialog confirms; null = closed. */
    action: "verify" | "reject" | null;
    onClose: () => void;
    account: AdminPayoutAccount;
}

/**
 * Verify or reject a pending payout account. Rejecting needs a reason (it's
 * stored on the account and shown to the creator).
 * Access: admin / super_admin / finance (gated by the caller).
 */
export function VerifyPayoutAccountModal({ action, onClose, account }: VerifyPayoutAccountModalProps) {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: (reason?: string) => {
            const payload: VerifyPayoutAccountPayload =
                action === "reject" ? { action: "reject", rejection_reason: (reason ?? "").trim() } : { action: "verify" };
            return payoutAccountsService.verify(account.id, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-payout-accounts"] });
            queryClient.invalidateQueries({ queryKey: ["payout-account-detail", account.id] });
            toast.success(action === "verify" ? "Account verified" : "Account rejected");
            onClose();
        },
        onError: (err: unknown) => {
            const m = (err as { message?: string })?.message;
            toast.error(m && m.trim() ? m : "Failed to update account verification");
        },
    });

    if (action === "reject") {
        return (
            <ConfirmDialog
                open
                tone="danger"
                level="reason"
                title="Reject this payout account?"
                description="The creator sees the reason and can add a new account."
                reasonLabel="Rejection reason"
                reasonPlaceholder="Why is this account being rejected?"
                reasonMinLength={3}
                confirmLabel="Reject account"
                isPending={mutation.isPending}
                onConfirm={(reason) => mutation.mutate(reason)}
                onCancel={onClose}
            />
        );
    }

    return (
        <ConfirmDialog
            open={action === "verify"}
            title="Verify this payout account?"
            description="It becomes eligible to receive payouts."
            confirmLabel="Verify account"
            isPending={mutation.isPending}
            onConfirm={() => mutation.mutate(undefined)}
            onCancel={onClose}
        />
    );
}
