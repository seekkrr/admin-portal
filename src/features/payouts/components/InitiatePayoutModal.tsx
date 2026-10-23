import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Banknote, Building2, CheckCircle, Loader2, Smartphone, Star } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { Tag } from "@/components/ui/StatusPill";
import { cx } from "@/utils/cx";
import { formatCurrency } from "@/utils/format";
import { payoutsService } from "../services/payouts.service";
import { payoutAccountsService } from "../services/payout-accounts.service";
import { PayoutAccountStatusBadge } from "./PayoutAccountStatusBadge";
import { CreatorPicker } from "./CreatorPicker";
import { maskedDetail, methodLabel } from "./accountDisplay";
import type { AdminPayoutAccount } from "@/types";

interface InitiatePayoutModalProps {
    open: boolean;
    onClose: () => void;
    defaultCreatorId?: string;
    defaultAmount?: string;
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;

function AccountOption({ account, selected, onSelect }: { account: AdminPayoutAccount; selected: boolean; onSelect?: () => void }) {
    const isBank = account.method === "bank_transfer";
    const usable = account.status === "verified";
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!usable}
            onClick={onSelect}
            className={cx(
                "w-full rounded-control border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                selected ? "border-accent-300 bg-accent-50" : "border-line-strong bg-surface hover:border-brand-200"
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                    <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", selected ? "bg-accent-100 text-accent-700" : "bg-brand-50 text-brand-700")}>
                        {isBank ? <Building2 className="h-4 w-4" aria-hidden /> : <Smartphone className="h-4 w-4" aria-hidden />}
                    </span>
                    <div className="min-w-0 text-sm">
                        <p className="flex flex-wrap items-center gap-1.5 font-medium text-ink">
                            {methodLabel(account.method)}
                            {account.is_primary && (
                                <Tag tone="warn">
                                    <Star className="h-2.5 w-2.5 fill-current" aria-hidden /> Primary
                                </Tag>
                            )}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-ink-muted">{maskedDetail(account)}</p>
                        {isBank && account.bank_details?.bank_name && <p className="text-xs text-ink-faint">{account.bank_details.bank_name}</p>}
                    </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <PayoutAccountStatusBadge status={account.status} />
                    {selected && <CheckCircle className="h-4 w-4 text-accent-600" aria-label="Selected" />}
                </div>
            </div>
        </button>
    );
}

/**
 * Initiate a creator disbursement (admin/super_admin). Two steps: fill in the
 * payout, then review and confirm — it moves money and can't be undone.
 */
export function InitiatePayoutModal({ open, onClose, defaultCreatorId, defaultAmount }: InitiatePayoutModalProps) {
    const queryClient = useQueryClient();

    const [creatorId, setCreatorId] = useState("");
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [amount, setAmount] = useState("");
    const [currency, setCurrency] = useState("INR");
    const [periodStart, setPeriodStart] = useState("");
    const [periodEnd, setPeriodEnd] = useState("");
    const [notes, setNotes] = useState("");
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [confirming, setConfirming] = useState(false);

    useEffect(() => {
        if (open) {
            setCreatorId(defaultCreatorId ?? "");
            setSelectedAccountId(null);
            setAmount(defaultAmount ?? "");
            setCurrency("INR");
            setPeriodStart("");
            setPeriodEnd("");
            setNotes("");
            setErrors({});
            setConfirming(false);
        }
    }, [open, defaultCreatorId, defaultAmount]);

    const lookupId = OBJECT_ID.test(creatorId.trim()) ? creatorId.trim() : "";

    const { data: accountsData, isLoading: loadingAccounts } = useQuery({
        queryKey: ["payout-accounts-for-creator", lookupId],
        queryFn: () => payoutAccountsService.list({ creator_id: lookupId, page_size: 50 }),
        enabled: open && !!lookupId,
        staleTime: 60 * 1000,
        select: (d) => d.accounts ?? [],
    });

    // Reset account selection when the creator changes
    useEffect(() => {
        setSelectedAccountId(null);
    }, [lookupId]);

    // Auto-select the primary verified account when accounts load
    useEffect(() => {
        if (!accountsData || selectedAccountId) return;
        const primary = accountsData.find((a) => a.is_primary && a.status === "verified");
        const fallback = accountsData.find((a) => a.status === "verified");
        setSelectedAccountId((primary ?? fallback)?.id ?? null);
    }, [accountsData, selectedAccountId]);

    const selectedAccount = accountsData?.find((a) => a.id === selectedAccountId) ?? null;

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!creatorId.trim()) e.creator_id = "Choose a creator.";
        else if (!OBJECT_ID.test(creatorId.trim())) e.creator_id = "Enter a valid creator ID (24 characters).";
        const amt = Number(amount);
        if (!amount.trim() || Number.isNaN(amt) || amt <= 0) e.amount = "Enter an amount greater than zero.";
        if (!selectedAccountId) e.account = "Select a verified payout account.";
        else if (selectedAccount?.status !== "verified") e.account = "The selected account must be verified.";
        if (periodStart && periodEnd && periodStart > periodEnd) e.periodEnd = "The period end must be on or after the start.";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const mutation = useMutation({
        mutationFn: () => {
            if (!selectedAccountId) throw new Error("No payout account selected");
            return payoutsService.initiate({
                creator_id: creatorId.trim(),
                amount: Number(amount),
                currency: currency.trim().toUpperCase() || "INR",
                payout_account_id: selectedAccountId,
                ...(periodStart ? { period_start: periodStart } : {}),
                ...(periodEnd ? { period_end: periodEnd } : {}),
                ...(notes.trim() ? { notes: notes.trim() } : {}),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-payouts"] });
            queryClient.invalidateQueries({ queryKey: ["payout-creator-summary", creatorId.trim()] });
            toast.success("Payout initiated");
            onClose();
        },
        onError: (err: unknown) => {
            const m = (err as { message?: string })?.message;
            toast.error(m && m.trim() ? m : "Failed to initiate payout");
            setConfirming(false);
        },
    });

    const verifiedAccounts = accountsData?.filter((a) => a.status === "verified") ?? [];
    const otherAccounts = accountsData?.filter((a) => a.status !== "verified") ?? [];

    const footer = confirming ? (
        <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={mutation.isPending}>
                Back
            </Button>
            <Button variant="primary" onClick={() => mutation.mutate()} loading={mutation.isPending}>
                Confirm and initiate
            </Button>
        </>
    ) : (
        <>
            <Button variant="secondary" onClick={onClose}>
                Cancel
            </Button>
            <Button variant="primary" onClick={() => validate() && setConfirming(true)}>
                Review
            </Button>
        </>
    );

    return (
        <Modal
            open={open}
            onClose={onClose}
            dismissible={!mutation.isPending}
            icon={Banknote}
            title={confirming ? "Confirm payout" : "Initiate payout"}
            size="lg"
            footer={footer}
        >
            {confirming ? (
                <div className="flex items-start gap-3 rounded-control border border-warn-line bg-warn-soft p-4">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden />
                    <dl className="space-y-1 text-sm text-ink">
                        <div>
                            <dt className="inline text-ink-muted">Amount: </dt>
                            <dd className="inline font-semibold">{formatCurrency(Number(amount), currency || "INR")}</dd>
                        </div>
                        <div>
                            <dt className="inline text-ink-muted">Creator: </dt>
                            <dd className="inline font-mono text-xs">{creatorId.trim()}</dd>
                        </div>
                        <div>
                            <dt className="inline text-ink-muted">Account: </dt>
                            <dd className="inline">
                                <span className="font-medium">{methodLabel(selectedAccount?.method)}</span>{" "}
                                <span className="font-mono text-xs">{selectedAccount ? maskedDetail(selectedAccount) : "—"}</span>
                                {selectedAccount?.bank_details?.bank_name && <span className="text-ink-muted"> · {selectedAccount.bank_details.bank_name}</span>}
                            </dd>
                        </div>
                        <p className="pt-1 text-xs font-medium text-warn">This moves money and can&apos;t be undone.</p>
                    </dl>
                </div>
            ) : (
                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (validate()) setConfirming(true);
                    }}
                >
                    <Field label="Creator" htmlFor="payout-creator" required error={errors.creator_id}>
                        <CreatorPicker id="payout-creator" value={creatorId} onChange={setCreatorId} invalid={!!errors.creator_id} />
                    </Field>

                    {lookupId && (
                        <div>
                            <p className="mb-1.5 text-sm font-medium text-ink">Payout account</p>
                            {loadingAccounts ? (
                                <p role="status" className="flex items-center justify-center gap-2 rounded-control border border-line bg-surface-muted p-4 text-sm text-ink-muted">
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading accounts…
                                </p>
                            ) : verifiedAccounts.length === 0 && otherAccounts.length === 0 ? (
                                <p className="rounded-control border border-line bg-surface-muted p-4 text-center text-sm text-ink-muted">No payout accounts found for this creator.</p>
                            ) : (
                                <div role="radiogroup" aria-label="Payout account" className="space-y-2">
                                    {verifiedAccounts.map((acc) => (
                                        <AccountOption key={acc.id} account={acc} selected={selectedAccountId === acc.id} onSelect={() => setSelectedAccountId(acc.id)} />
                                    ))}
                                    {otherAccounts.length > 0 && (
                                        <>
                                            {verifiedAccounts.length > 0 && (
                                                <p className="pt-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">Not verified (can&apos;t be used)</p>
                                            )}
                                            {otherAccounts.map((acc) => (
                                                <AccountOption key={acc.id} account={acc} selected={false} />
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                            {errors.account && <p className="mt-1 text-xs font-medium text-bad">{errors.account}</p>}
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Field label="Amount" required error={errors.amount} className="sm:col-span-2">
                            <TextInput type="number" inputMode="decimal" min="0" step="0.01" value={amount} placeholder="0.00" onChange={(e) => setAmount(e.target.value)} />
                        </Field>
                        <Field label="Currency">
                            <TextInput value={currency} maxLength={3} placeholder="INR" onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
                        </Field>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Period start" hint="Optional">
                            <TextInput type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                        </Field>
                        <Field label="Period end" hint="Optional" error={errors.periodEnd}>
                            <TextInput type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                        </Field>
                    </div>

                    <Field label="Notes" hint="Optional internal note for this disbursement.">
                        <TextArea rows={2} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
                    </Field>
                    <button type="submit" hidden aria-hidden tabIndex={-1} />
                </form>
            )}
        </Modal>
    );
}
