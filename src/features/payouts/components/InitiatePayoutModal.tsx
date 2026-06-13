import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, RefreshCw, AlertTriangle, CheckCircle, Building2, Smartphone, Star } from "lucide-react";
import { toast } from "sonner";
import { payoutsService } from "../services/payouts.service";
import { payoutAccountsService } from "../services/payout-accounts.service";
import { PayoutAccountStatusBadge } from "./PayoutAccountStatusBadge";
import { formatCurrency } from "@/utils/format";
import type { AdminPayoutAccount } from "@/types";

interface InitiatePayoutModalProps {
    open: boolean;
    onClose: () => void;
    defaultCreatorId?: string;
}

const inputCls =
    "w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/60 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:bg-white focus:border-transparent";

function AccountCard({
    account,
    selected,
    onSelect,
}: {
    account: AdminPayoutAccount;
    selected: boolean;
    onSelect: () => void;
}) {
    const isBank = account.method === "bank_transfer";
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`w-full text-left rounded-xl border p-3.5 transition-all ${
                selected
                    ? "border-emerald-400 bg-emerald-50/60 shadow-sm"
                    : "border-neutral-200 bg-neutral-50/40 hover:border-neutral-300"
            } ${account.status !== "verified" ? "opacity-60" : ""}`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selected ? "bg-emerald-100 text-emerald-600" : "bg-neutral-100 text-neutral-500"}`}>
                        {isBank ? <Building2 className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                    </div>
                    <div className="text-sm">
                        <p className="font-semibold text-neutral-900 capitalize">
                            {account.method.replace(/_/g, " ")}
                            {account.is_primary && (
                                <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-amber-600 font-medium">
                                    <Star className="w-2.5 h-2.5 fill-current" /> Primary
                                </span>
                            )}
                        </p>
                        <p className="text-neutral-500 text-xs font-mono mt-0.5">
                            {isBank
                                ? account.bank_details?.account_number_masked ?? "—"
                                : account.upi_id ?? "—"}
                        </p>
                        {isBank && account.bank_details?.bank_name && (
                            <p className="text-neutral-400 text-xs">{account.bank_details.bank_name}</p>
                        )}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <PayoutAccountStatusBadge status={account.status} />
                    {selected && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                </div>
            </div>
        </button>
    );
}

export function InitiatePayoutModal({ open, onClose, defaultCreatorId }: InitiatePayoutModalProps) {
    const queryClient = useQueryClient();

    const [creatorId, setCreatorId] = useState("");
    const [debouncedCreatorId, setDebouncedCreatorId] = useState("");
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
            setDebouncedCreatorId(defaultCreatorId ?? "");
            setSelectedAccountId(null);
            setAmount("");
            setCurrency("INR");
            setPeriodStart("");
            setPeriodEnd("");
            setNotes("");
            setErrors({});
            setConfirming(false);
        }
    }, [open, defaultCreatorId]);

    // Debounce creator id input (only query when it looks like an ObjectId)
    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedCreatorId(creatorId.trim().length >= 24 ? creatorId.trim() : "");
        }, 500);
        return () => clearTimeout(t);
    }, [creatorId]);

    const { data: accountsData, isLoading: loadingAccounts } = useQuery({
        queryKey: ["payout-accounts-for-creator", debouncedCreatorId],
        queryFn: () => payoutAccountsService.list({ creator_id: debouncedCreatorId, page_size: 50 }),
        enabled: !!debouncedCreatorId,
        staleTime: 60 * 1000,
        select: (d) => d.accounts ?? [],
    });

    // Auto-select primary verified account when accounts load
    useEffect(() => {
        if (!accountsData) return;
        if (selectedAccountId) return; // keep user's manual selection
        const primary = accountsData.find((a) => a.is_primary && a.status === "verified");
        const fallback = accountsData.find((a) => a.status === "verified");
        const auto = primary ?? fallback ?? null;
        setSelectedAccountId(auto?.id ?? null);
    }, [accountsData, selectedAccountId]);

    // Reset account selection when creator changes
    useEffect(() => {
        setSelectedAccountId(null);
    }, [debouncedCreatorId]);

    const selectedAccount = accountsData?.find((a) => a.id === selectedAccountId) ?? null;

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!creatorId.trim()) e.creator_id = "Creator ID is required.";
        else if (creatorId.trim().length < 24) e.creator_id = "Enter a valid ObjectId (24 chars).";
        const amt = Number(amount);
        if (!amount.trim() || Number.isNaN(amt) || amt <= 0) e.amount = "Enter an amount greater than zero.";
        if (!selectedAccountId) e.account = "Select a verified payout account.";
        else if (selectedAccount?.status !== "verified") e.account = "Selected account must be verified.";
        if (periodStart && periodEnd && periodStart > periodEnd) e.periodEnd = "Period end must be on or after the start.";
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

    if (!open) return null;

    const handleNext = () => {
        if (!validate()) return;
        setConfirming(true);
    };

    const verifiedAccounts = accountsData?.filter((a) => a.status === "verified") ?? [];
    const otherAccounts = accountsData?.filter((a) => a.status !== "verified") ?? [];

    const accountIdentifier = selectedAccount
        ? selectedAccount.method === "bank_transfer"
            ? selectedAccount.bank_details?.account_number_masked ?? "—"
            : selectedAccount.upi_id ?? "—"
        : "—";

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
                    <h3 className="text-lg font-bold text-neutral-900 tracking-tight">Initiate Payout</h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {confirming ? (
                    <div className="p-6 space-y-4">
                        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-sm text-amber-800 space-y-1">
                                <p className="font-semibold">Confirm disbursement</p>
                                <p>
                                    Amount:{" "}
                                    <span className="font-semibold">
                                        {formatCurrency(Number(amount), currency || "INR")}
                                    </span>
                                </p>
                                <p>
                                    Creator:{" "}
                                    <span className="font-mono text-xs">{creatorId.trim()}</span>
                                </p>
                                <p>
                                    Account:{" "}
                                    <span className="font-semibold capitalize">
                                        {selectedAccount?.method.replace(/_/g, " ")}
                                    </span>{" "}
                                    <span className="font-mono text-xs">{accountIdentifier}</span>
                                    {selectedAccount?.bank_details?.bank_name && (
                                        <span className="text-amber-700"> · {selectedAccount.bank_details.bank_name}</span>
                                    )}
                                </p>
                                <p className="text-xs text-amber-700 pt-1">This action moves money and cannot be undone.</p>
                            </div>
                        </div>
                        <div className="flex gap-2.5">
                            <button
                                onClick={() => setConfirming(false)}
                                disabled={mutation.isPending}
                                className="px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-all flex-1"
                            >
                                Back
                            </button>
                            <button
                                onClick={() => mutation.mutate()}
                                disabled={mutation.isPending}
                                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50 flex-1 flex items-center justify-center gap-2"
                            >
                                {mutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                                Confirm & Initiate
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="p-6 space-y-5">
                            {/* Creator ID */}
                            <div>
                                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                                    Creator ID
                                </label>
                                <input
                                    className={inputCls}
                                    value={creatorId}
                                    placeholder="24-char ObjectId"
                                    onChange={(e) => setCreatorId(e.target.value)}
                                />
                                {errors.creator_id && (
                                    <p className="text-xs text-red-600 mt-1">{errors.creator_id}</p>
                                )}
                            </div>

                            {/* Payout accounts for creator */}
                            {debouncedCreatorId && (
                                <div>
                                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 block">
                                        Payout Account
                                    </label>
                                    {loadingAccounts ? (
                                        <div className="rounded-xl border border-neutral-200 bg-neutral-50/40 p-4 text-center text-sm text-neutral-400">
                                            <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />
                                            Loading accounts…
                                        </div>
                                    ) : verifiedAccounts.length === 0 && otherAccounts.length === 0 ? (
                                        <div className="rounded-xl border border-neutral-200 bg-neutral-50/40 p-4 text-center text-sm text-neutral-400">
                                            No payout accounts found for this creator.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {verifiedAccounts.map((acc) => (
                                                <AccountCard
                                                    key={acc.id}
                                                    account={acc}
                                                    selected={selectedAccountId === acc.id}
                                                    onSelect={() => setSelectedAccountId(acc.id)}
                                                />
                                            ))}
                                            {otherAccounts.length > 0 && (
                                                <>
                                                    {verifiedAccounts.length > 0 && (
                                                        <p className="text-[11px] text-neutral-400 font-medium uppercase tracking-wide pt-1">
                                                            Unverified (cannot be used)
                                                        </p>
                                                    )}
                                                    {otherAccounts.map((acc) => (
                                                        <AccountCard
                                                            key={acc.id}
                                                            account={acc}
                                                            selected={false}
                                                            onSelect={() => {}} // cannot select unverified
                                                        />
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                    )}
                                    {errors.account && (
                                        <p className="text-xs text-red-600 mt-1">{errors.account}</p>
                                    )}
                                </div>
                            )}

                            {/* Amount + Currency */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="sm:col-span-2">
                                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                                        Amount
                                    </label>
                                    <input
                                        className={inputCls}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={amount}
                                        placeholder="0.00"
                                        onChange={(e) => setAmount(e.target.value)}
                                    />
                                    {errors.amount && (
                                        <p className="text-xs text-red-600 mt-1">{errors.amount}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                                        Currency
                                    </label>
                                    <input
                                        className={inputCls}
                                        value={currency}
                                        maxLength={3}
                                        placeholder="INR"
                                        onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                                    />
                                </div>
                            </div>

                            {/* Period */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                                        Period Start{" "}
                                        <span className="normal-case font-normal text-neutral-400">(optional)</span>
                                    </label>
                                    <input
                                        className={inputCls}
                                        type="date"
                                        value={periodStart}
                                        onChange={(e) => setPeriodStart(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                                        Period End{" "}
                                        <span className="normal-case font-normal text-neutral-400">(optional)</span>
                                    </label>
                                    <input
                                        className={inputCls}
                                        type="date"
                                        value={periodEnd}
                                        onChange={(e) => setPeriodEnd(e.target.value)}
                                    />
                                    {errors.periodEnd && (
                                        <p className="text-xs text-red-600 mt-1">{errors.periodEnd}</p>
                                    )}
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                                    Notes{" "}
                                    <span className="normal-case font-normal text-neutral-400">(optional)</span>
                                </label>
                                <textarea
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/60 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:bg-white focus:border-transparent resize-none"
                                    rows={2}
                                    value={notes}
                                    placeholder="Internal note for this disbursement…"
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex gap-2.5 px-6 py-4 border-t border-neutral-100 sticky bottom-0 bg-white">
                            <button
                                onClick={onClose}
                                className="px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-all flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleNext}
                                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all flex-1"
                            >
                                Review
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
