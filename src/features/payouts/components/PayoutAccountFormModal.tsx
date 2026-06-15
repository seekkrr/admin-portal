import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, RefreshCw, Banknote, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { payoutAccountsService } from "../services/payout-accounts.service";
import type {
    AdminPayoutAccount,
    PayoutAccountMethod,
    CreatePayoutAccountPayload,
    UpdatePayoutAccountPayload,
} from "@/types";

interface PayoutAccountFormModalProps {
    open: boolean;
    onClose: () => void;
    /** When provided, the modal is in EDIT mode (method immutable). */
    account?: AdminPayoutAccount | null;
}

interface FormState {
    method: PayoutAccountMethod;
    currency: string;
    account_holder_name: string;
    account_number: string;
    ifsc_code: string;
    bank_name: string;
    upi_id: string;
}

const EMPTY: FormState = {
    method: "bank_transfer",
    currency: "INR",
    account_holder_name: "",
    account_number: "",
    ifsc_code: "",
    bank_name: "",
    upi_id: "",
};

const inputCls =
    "w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/60 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:bg-white focus:border-transparent";

/**
 * Create / edit modal for V2 payout accounts.
 * - Create: super_admin only (gated by caller). Method selectable.
 * - Edit: admin/super_admin, only when status === "pending_verification".
 *   Method is immutable; for bank accounts the masked number cannot be edited
 *   here (server masks it), so on edit we only allow holder name / currency /
 *   ifsc / bank_name / upi_id changes — account_number is left blank unless
 *   the admin explicitly re-enters it.
 */
export function PayoutAccountFormModal({ open, onClose, account }: PayoutAccountFormModalProps) {
    const queryClient = useQueryClient();
    const isEdit = !!account;
    const [form, setForm] = useState<FormState>(EMPTY);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!open) return;
        if (account) {
            setForm({
                method: account.method,
                currency: account.currency || "INR",
                account_holder_name: account.account_holder_name ?? "",
                // Masked server-side — do not prefill the real number.
                account_number: "",
                ifsc_code: account.bank_details?.ifsc_code ?? "",
                bank_name: account.bank_details?.bank_name ?? "",
                upi_id: account.method === "upi" ? (account.upi_id ?? "") : "",
            });
        } else {
            setForm(EMPTY);
        }
        setErrors({});
    }, [open, account]);

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((f) => ({ ...f, [key]: value }));

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        const cur = form.currency.trim();
        if (!/^[A-Za-z]{3}$/.test(cur)) e.currency = "Use a 3-letter ISO code (e.g. INR).";

        if (form.method === "bank_transfer") {
            // On create the account number is required; on edit it's optional
            // (blank = keep existing masked value).
            if (!isEdit && !form.account_number.trim()) {
                e.account_number = "Account number is required for bank transfers.";
            }
        } else if (form.method === "upi") {
            if (!form.upi_id.trim()) e.upi_id = "UPI ID is required.";
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const mutation = useMutation({
        mutationFn: async () => {
            if (isEdit && account) {
                const payload: UpdatePayoutAccountPayload = {
                    currency: form.currency.trim().toUpperCase(),
                    account_holder_name: form.account_holder_name.trim() || undefined,
                };
                if (account.method === "bank_transfer") {
                    const bank: Record<string, string> = {};
                    if (form.account_number.trim()) bank.account_number = form.account_number.trim();
                    if (form.ifsc_code.trim()) bank.ifsc_code = form.ifsc_code.trim();
                    if (form.bank_name.trim()) bank.bank_name = form.bank_name.trim();
                    if (Object.keys(bank).length > 0) payload.bank_details = bank;
                } else {
                    if (form.upi_id.trim()) payload.upi_id = form.upi_id.trim();
                }
                return payoutAccountsService.update(account.id, payload);
            }
            const payload: CreatePayoutAccountPayload = {
                method: form.method,
                currency: form.currency.trim().toUpperCase(),
                account_holder_name: form.account_holder_name.trim() || undefined,
            };
            if (form.method === "bank_transfer") {
                payload.bank_details = {
                    account_number: form.account_number.trim(),
                    ifsc_code: form.ifsc_code.trim() || undefined,
                    bank_name: form.bank_name.trim() || undefined,
                };
            } else {
                payload.upi_id = form.upi_id.trim();
            }
            return payoutAccountsService.create(payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-payout-accounts"] });
            if (isEdit && account) {
                queryClient.invalidateQueries({ queryKey: ["payout-account-detail", account.id] });
            }
            toast.success(isEdit ? "Payout account updated" : "Payout account created");
            onClose();
        },
        onError: (err: unknown) => {
            const m = (err as { message?: string })?.message;
            toast.error(
                m && m.trim()
                    ? m
                    : isEdit
                      ? "Failed to update payout account"
                      : "Failed to create payout account"
            );
        },
    });

    if (!open) return null;

    const submit = () => {
        if (!validate()) return;
        mutation.mutate();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 backdrop-blur-[3px] animate-fade-in p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl ring-1 ring-neutral-900/5 w-full max-w-lg animate-scale-in max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 sticky top-0 bg-white z-10">
                    <h3 className="text-lg font-bold text-neutral-900 tracking-tight">
                        {isEdit ? "Edit Payout Account" : "New Payout Account"}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Method */}
                    <div>
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                            Method
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {(["bank_transfer", "upi"] as PayoutAccountMethod[]).map((m) => {
                                const active = form.method === m;
                                const Icon = m === "bank_transfer" ? Banknote : Smartphone;
                                return (
                                    <button
                                        key={m}
                                        type="button"
                                        disabled={isEdit}
                                        onClick={() => set("method", m)}
                                        className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                                            active
                                                ? "border-emerald-300 bg-emerald-50/60 text-emerald-700 shadow-sm"
                                                : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-300"
                                        } ${isEdit ? "opacity-60 cursor-not-allowed" : ""}`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {m === "bank_transfer" ? "Bank Transfer" : "UPI"}
                                    </button>
                                );
                            })}
                        </div>
                        {isEdit && (
                            <p className="text-xs text-neutral-400 mt-1.5">
                                Method cannot be changed after creation.
                            </p>
                        )}
                    </div>

                    {/* Holder name + currency */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                                Account Holder Name
                            </label>
                            <input
                                className={inputCls}
                                value={form.account_holder_name}
                                placeholder="e.g. Jane Doe"
                                onChange={(e) => set("account_holder_name", e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                                Currency
                            </label>
                            <input
                                className={inputCls}
                                value={form.currency}
                                maxLength={3}
                                placeholder="INR"
                                onChange={(e) => set("currency", e.target.value.toUpperCase())}
                            />
                            {errors.currency && (
                                <p className="text-xs text-red-600 mt-1">{errors.currency}</p>
                            )}
                        </div>
                    </div>

                    {form.method === "bank_transfer" ? (
                        <div className="space-y-4 rounded-xl border border-neutral-100 bg-neutral-50/40 p-4">
                            <div>
                                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                                    Account Number {isEdit && <span className="text-neutral-400 normal-case font-normal">(leave blank to keep current)</span>}
                                </label>
                                <input
                                    className={inputCls}
                                    value={form.account_number}
                                    placeholder={isEdit && account?.bank_details?.account_number_masked
                                        ? `Current: ${account.bank_details.account_number_masked}`
                                        : "Account number"}
                                    onChange={(e) => set("account_number", e.target.value)}
                                />
                                {errors.account_number && (
                                    <p className="text-xs text-red-600 mt-1">{errors.account_number}</p>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                                        IFSC Code
                                    </label>
                                    <input
                                        className={inputCls}
                                        value={form.ifsc_code}
                                        placeholder="e.g. HDFC0001234"
                                        onChange={(e) => set("ifsc_code", e.target.value.toUpperCase())}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                                        Bank Name
                                    </label>
                                    <input
                                        className={inputCls}
                                        value={form.bank_name}
                                        placeholder="e.g. HDFC Bank"
                                        onChange={(e) => set("bank_name", e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-neutral-100 bg-neutral-50/40 p-4">
                            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                                UPI ID
                            </label>
                            <input
                                className={inputCls}
                                value={form.upi_id}
                                placeholder="name@bank"
                                onChange={(e) => set("upi_id", e.target.value)}
                            />
                            {errors.upi_id && (
                                <p className="text-xs text-red-600 mt-1">{errors.upi_id}</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex gap-2.5 px-6 py-4 border-t border-neutral-100 sticky bottom-0 bg-white">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-all flex-1"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={mutation.isPending}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50 flex-1 flex items-center justify-center gap-2"
                    >
                        {mutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                        {isEdit ? "Save Changes" : "Create Account"}
                    </button>
                </div>
            </div>
        </div>
    );
}
