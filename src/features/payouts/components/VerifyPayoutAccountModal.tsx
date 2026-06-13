import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { payoutAccountsService } from "../services/payout-accounts.service";
import type { AdminPayoutAccount, VerifyPayoutAccountPayload } from "@/types";

interface VerifyPayoutAccountModalProps {
    open: boolean;
    onClose: () => void;
    account: AdminPayoutAccount;
}

/**
 * Verify / reject a pending payout account. Reject requires a reason.
 * Access: admin / super_admin / finance (gated by caller).
 */
export function VerifyPayoutAccountModal({ open, onClose, account }: VerifyPayoutAccountModalProps) {
    const queryClient = useQueryClient();
    const [action, setAction] = useState<"verify" | "reject">("verify");
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (open) {
            setAction("verify");
            setReason("");
            setError("");
        }
    }, [open]);

    const mutation = useMutation({
        mutationFn: () => {
            const payload: VerifyPayoutAccountPayload =
                action === "reject"
                    ? { action: "reject", rejection_reason: reason.trim() }
                    : { action: "verify" };
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

    if (!open) return null;

    const submit = () => {
        if (action === "reject" && !reason.trim()) {
            setError("A rejection reason is required.");
            return;
        }
        mutation.mutate();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 backdrop-blur-[3px] animate-fade-in p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl ring-1 ring-neutral-900/5 w-full max-w-md animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
                    <h3 className="text-lg font-bold text-neutral-900 tracking-tight">
                        Verify Payout Account
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setAction("verify")}
                            className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                                action === "verify"
                                    ? "border-emerald-300 bg-emerald-50/60 text-emerald-700 shadow-sm"
                                    : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-300"
                            }`}
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Verify
                        </button>
                        <button
                            type="button"
                            onClick={() => setAction("reject")}
                            className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                                action === "reject"
                                    ? "border-red-300 bg-red-50/60 text-red-700 shadow-sm"
                                    : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-300"
                            }`}
                        >
                            <XCircle className="w-4 h-4" />
                            Reject
                        </button>
                    </div>

                    {action === "verify" ? (
                        <p className="text-sm text-neutral-600 leading-relaxed">
                            Mark this account as verified. It will become eligible to receive
                            payouts.
                        </p>
                    ) : (
                        <div>
                            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                                Rejection Reason
                            </label>
                            <textarea
                                value={reason}
                                onChange={(e) => {
                                    setReason(e.target.value);
                                    if (error) setError("");
                                }}
                                rows={3}
                                placeholder="Explain why this account is being rejected…"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/60 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:bg-white focus:border-transparent resize-none"
                            />
                            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
                        </div>
                    )}
                </div>

                <div className="flex gap-2.5 px-6 py-4 border-t border-neutral-100">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-all flex-1"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={mutation.isPending}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-50 flex-1 flex items-center justify-center gap-2 ${
                            action === "verify"
                                ? "bg-emerald-600 hover:bg-emerald-700"
                                : "bg-red-600 hover:bg-red-700"
                        }`}
                    >
                        {mutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                        {action === "verify" ? "Verify Account" : "Reject Account"}
                    </button>
                </div>
            </div>
        </div>
    );
}
