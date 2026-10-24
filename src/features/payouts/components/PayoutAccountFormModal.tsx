import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { cx } from "@/utils/cx";
import { payoutAccountsService } from "../services/payout-accounts.service";
import type { AdminPayoutAccount, PayoutAccountMethod, CreatePayoutAccountPayload, UpdatePayoutAccountPayload } from "@/types";

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

const METHODS: { value: PayoutAccountMethod; label: string; icon: typeof Banknote }[] = [
    { value: "bank_transfer", label: "Bank transfer", icon: Banknote },
    { value: "upi", label: "UPI", icon: Smartphone },
];

/**
 * Create / edit modal for V2 payout accounts.
 * - Create: super_admin only (gated by caller). Method selectable.
 * - Edit: admin/super_admin, only when status === "pending_verification".
 *   Method is immutable; the masked account number is never prefilled — it is
 *   only sent when the admin re-enters it.
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

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!/^[A-Za-z]{3}$/.test(form.currency.trim())) e.currency = "Use a 3-letter ISO code (e.g. INR).";
        if (form.method === "bank_transfer") {
            // On create the account number is required; on edit blank keeps the current one.
            if (!isEdit && !form.account_number.trim()) e.account_number = "Account number is required for bank transfers.";
        } else if (!form.upi_id.trim()) {
            e.upi_id = "UPI ID is required.";
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
                } else if (form.upi_id.trim()) {
                    payload.upi_id = form.upi_id.trim();
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
            if (isEdit && account) queryClient.invalidateQueries({ queryKey: ["payout-account-detail", account.id] });
            toast.success(isEdit ? "Payout account updated" : "Payout account created");
            onClose();
        },
        onError: (err: unknown) => {
            const m = (err as { message?: string })?.message;
            toast.error(m && m.trim() ? m : isEdit ? "Failed to update payout account" : "Failed to create payout account");
        },
    });

    const submit = () => {
        if (!validate()) return;
        mutation.mutate();
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            dismissible={!mutation.isPending}
            icon={Wallet}
            title={isEdit ? "Edit payout account" : "New payout account"}
            description={isEdit ? "Only accounts waiting for verification can be edited." : undefined}
            size="lg"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={submit} loading={mutation.isPending}>
                        {isEdit ? "Save changes" : "Create account"}
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
                <fieldset>
                    <legend className="mb-1.5 text-sm font-medium text-ink">Method</legend>
                    <div role="radiogroup" aria-label="Method" className="grid grid-cols-2 gap-2">
                        {METHODS.map(({ value, label, icon: Icon }) => {
                            const active = form.method === value;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={active}
                                    disabled={isEdit}
                                    onClick={() => set("method", value)}
                                    className={cx(
                                        "flex h-10 items-center justify-center gap-2 rounded-control border text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                                        active ? "border-accent-300 bg-accent-50 text-accent-700" : "border-line-strong bg-surface text-ink-muted hover:text-ink"
                                    )}
                                >
                                    <Icon className="h-4 w-4" aria-hidden />
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    {isEdit && <p className="mt-1 text-xs text-ink-faint">The method can't be changed after creation.</p>}
                </fieldset>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label="Account holder name" className="sm:col-span-2">
                        <TextInput value={form.account_holder_name} placeholder="e.g. Jane Doe" onChange={(e) => set("account_holder_name", e.target.value)} />
                    </Field>
                    <Field label="Currency" error={errors.currency}>
                        <TextInput value={form.currency} maxLength={3} placeholder="INR" onChange={(e) => set("currency", e.target.value.toUpperCase())} />
                    </Field>
                </div>

                {form.method === "bank_transfer" ? (
                    <>
                        <Field
                            label="Account number"
                            required={!isEdit}
                            hint={isEdit ? "Leave blank to keep the current number." : undefined}
                            error={errors.account_number}
                        >
                            <TextInput
                                value={form.account_number}
                                inputMode="numeric"
                                autoComplete="off"
                                placeholder={
                                    isEdit && account?.bank_details?.account_number_masked ? `Current: ${account.bank_details.account_number_masked}` : "Account number"
                                }
                                onChange={(e) => set("account_number", e.target.value)}
                            />
                        </Field>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="IFSC code">
                                <TextInput value={form.ifsc_code} placeholder="e.g. HDFC0001234" onChange={(e) => set("ifsc_code", e.target.value.toUpperCase())} />
                            </Field>
                            <Field label="Bank name">
                                <TextInput value={form.bank_name} placeholder="e.g. HDFC Bank" onChange={(e) => set("bank_name", e.target.value)} />
                            </Field>
                        </div>
                    </>
                ) : (
                    <Field label="UPI ID" required error={errors.upi_id}>
                        <TextInput value={form.upi_id} placeholder="name@bank" autoComplete="off" onChange={(e) => set("upi_id", e.target.value)} />
                    </Field>
                )}
                <button type="submit" hidden aria-hidden tabIndex={-1} />
            </form>
        </Modal>
    );
}
