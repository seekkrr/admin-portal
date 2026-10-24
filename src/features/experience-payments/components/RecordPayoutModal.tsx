import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/detail/DetailStates";
import { todayIst } from "@/components/detail/detailFormat";
import { inr } from "../money";
import { experiencePaymentsApi } from "../service";

interface Form {
    amount: string;
    reference: string;
    paid_on: string;
    note: string;
}

const blank = (balance: number | null): Form => ({
    amount: balance && balance > 0 ? String(Math.round(balance * 100) / 100) : "",
    reference: "",
    paid_on: todayIst(),
    note: "",
});

/** Record a bank transfer to a business (POST /admin/businesses/{id}/payouts; audit-logged). */
export function RecordPayoutModal({
    open,
    onClose,
    businessId,
    businessName,
    balance,
}: {
    open: boolean;
    onClose: () => void;
    businessId: string;
    businessName: string;
    /** Current balance owed (null while unknown). */
    balance: number | null;
}) {
    const queryClient = useQueryClient();
    const [form, setForm] = useState<Form>(() => blank(balance));
    const [seenOpen, setSeenOpen] = useState(open);
    // Fresh form every time the dialog opens.
    if (open !== seenOpen) {
        setSeenOpen(open);
        if (open) setForm(blank(balance));
    }
    const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

    const amount = Number(form.amount);
    const amountOk = form.amount.trim() !== "" && Number.isFinite(amount) && amount > 0;
    const today = todayIst();
    const problems: string[] = [];
    if (!amountOk) problems.push("Enter an amount above ₹0.");
    if (!form.reference.trim()) problems.push("Add the bank reference (UTR).");
    if (!form.paid_on) problems.push("Pick the date it was paid.");
    else if (form.paid_on > today) problems.push("The payment date can't be in the future.");
    const overBalance = amountOk && balance !== null && amount > balance + 0.004;

    const save = useMutation({
        mutationFn: () =>
            experiencePaymentsApi.recordPayout(businessId, {
                amount: Math.round(amount * 100) / 100,
                reference: form.reference.trim(),
                paid_on: form.paid_on,
                ...(form.note.trim() ? { note: form.note.trim() } : {}),
            }),
        onSuccess: () => {
            toast.success(`Payout of ${inr(amount)} to ${businessName} recorded`);
            queryClient.invalidateQueries({ queryKey: ["business-payouts", businessId] });
            queryClient.invalidateQueries({ queryKey: ["experience-finance"] });
            queryClient.invalidateQueries({ queryKey: ["admin-audit", "business", businessId] });
            onClose();
        },
        onError: (e: Error) => toast.error(e.message || "Couldn't record the payout"),
    });

    return (
        <Modal
            open={open}
            onClose={onClose}
            dismissible={!save.isPending}
            title="Record payout"
            description={`A bank transfer you've already made to ${businessName}.`}
            icon={Banknote}
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
                        Cancel
                    </Button>
                    <Button variant="primary" icon={Banknote} disabled={problems.length > 0} loading={save.isPending} onClick={() => save.mutate()}>
                        Record payout
                    </Button>
                </>
            }
        >
            <form
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (!problems.length && !save.isPending) save.mutate();
                }}
            >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Amount (₹)" required hint={balance !== null ? `Balance owed: ${inr(balance)}` : undefined}>
                        <TextInput
                            type="number"
                            min={0}
                            step="0.01"
                            inputMode="decimal"
                            value={form.amount}
                            invalid={form.amount.trim() !== "" && !amountOk}
                            onChange={(e) => set("amount", e.target.value)}
                        />
                    </Field>
                    <Field label="Paid on" required>
                        <TextInput type="date" value={form.paid_on} max={today} onChange={(e) => set("paid_on", e.target.value)} />
                    </Field>
                </div>
                <Field label="Reference" required hint="The bank's UTR or transfer reference.">
                    <TextInput value={form.reference} onChange={(e) => set("reference", e.target.value)} maxLength={120} placeholder="e.g. UTR 4122 0981 7731" />
                </Field>
                <Field label="Note">
                    <TextArea value={form.note} onChange={(e) => set("note", e.target.value)} rows={3} maxLength={500} placeholder="Optional — e.g. October bookings" />
                </Field>
                {overBalance && (
                    <Notice tone="warn" title="More than the balance">
                        {inr(amount)} is more than the {inr(balance)} this business is owed. Record it anyway only if that's intended.
                    </Notice>
                )}
                <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
            </form>
        </Modal>
    );
}
