import { useState, type ReactNode } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft,
    Pencil,
    Star,
    Trash2,
    ShieldCheck,
    Banknote,
    Smartphone,
    ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { payoutAccountsService } from "../services/payout-accounts.service";
import { PayoutAccountStatusBadge } from "../components/PayoutAccountStatusBadge";
import { PayoutAccountFormModal } from "../components/PayoutAccountFormModal";
import { VerifyPayoutAccountModal } from "../components/VerifyPayoutAccountModal";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { LoadingFallback } from "@components/LoadingFallback";
import { useAuthStore } from "@/store/auth.store";
import { formatDateTime, shortId, orDash } from "@/utils/format";

const CAN_FINANCE = ["admin", "super_admin", "finance"];
const CAN_MANAGE = ["admin", "super_admin"];
const IS_SUPER = ["super_admin"];

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <dt className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                {label}
            </dt>
            <dd className="mt-1 text-sm text-neutral-800 break-words">{children}</dd>
        </div>
    );
}

export function PayoutAccountDetailPage() {
    const { accountId: accountIdParam } = useParams<{ accountId: string }>();
    const accountId = accountIdParam ?? "";
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const roles = useAuthStore((s) => s.user?.role);

    const canView = roles?.some((r) => CAN_FINANCE.includes(r));
    const canManage = roles?.some((r) => CAN_MANAGE.includes(r));
    const isSuper = roles?.some((r) => IS_SUPER.includes(r));

    const [showEdit, setShowEdit] = useState(false);
    const [showVerify, setShowVerify] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [confirmPrimary, setConfirmPrimary] = useState(false);
    const [hardDelete, setHardDelete] = useState(false);

    const { data: account, isLoading, error } = useQuery({
        queryKey: ["payout-account-detail", accountId],
        queryFn: () => payoutAccountsService.getById(accountId),
        enabled: !!accountId && !!canView,
        staleTime: 5 * 60 * 1000,
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["admin-payout-accounts"] });
        queryClient.invalidateQueries({ queryKey: ["payout-account-detail", accountId] });
    };

    const setPrimaryMutation = useMutation({
        mutationFn: () => payoutAccountsService.setPrimary(accountId),
        onSuccess: () => {
            invalidate();
            toast.success("Set as primary account");
            setConfirmPrimary(false);
        },
        onError: (err: unknown) => {
            const m = (err as { message?: string })?.message;
            toast.error(m && m.trim() ? m : "Failed to set primary");
            setConfirmPrimary(false);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => payoutAccountsService.remove(accountId, hardDelete && !!isSuper),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-payout-accounts"] });
            toast.success(hardDelete ? "Account permanently deleted" : "Account deleted");
            setConfirmDelete(false);
            navigate("/payout-accounts", { replace: true });
        },
        onError: (err: unknown) => {
            const m = (err as { message?: string })?.message;
            toast.error(m && m.trim() ? m : "Failed to delete account");
            setConfirmDelete(false);
        },
    });

    if (!canView) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-500 mb-4">
                    You do not have permission to view payout accounts.
                </p>
                <Link to="/payout-accounts" className="text-emerald-600 hover:underline">
                    Back to Payout Accounts
                </Link>
            </div>
        );
    }

    if (isLoading) return <LoadingFallback message="Loading payout account..." />;
    if (error || !account) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-500 mb-4">
                    Failed to load payout account or it does not exist.
                </p>
                <Link to="/payout-accounts" className="text-emerald-600 hover:underline">
                    Back to Payout Accounts
                </Link>
            </div>
        );
    }

    const isPending = account.status === "pending_verification";
    const canEdit = canManage && isPending;
    const canVerify = canView && isPending;
    const canSetPrimary = canManage && account.status === "verified" && !account.is_primary;

    return (
        <div className="animate-fade-in max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <Link
                    to="/payout-accounts"
                    className="flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Payout Accounts
                </Link>

                <div className="flex items-center gap-2 flex-wrap">
                    {canVerify && (
                        <button
                            onClick={() => setShowVerify(true)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                        >
                            <ShieldCheck className="w-4 h-4" />
                            Verify / Reject
                        </button>
                    )}
                    {canEdit && (
                        <button
                            onClick={() => setShowEdit(true)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                        >
                            <Pencil className="w-4 h-4" />
                            Edit
                        </button>
                    )}
                    {canSetPrimary && (
                        <button
                            onClick={() => setConfirmPrimary(true)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                        >
                            <Star className="w-4 h-4" />
                            Set Primary
                        </button>
                    )}
                    {canManage && (
                        <button
                            onClick={() => {
                                setHardDelete(false);
                                setConfirmDelete(true);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                    )}
                </div>
            </div>

            <Card>
                <CardContent className="p-6 sm:p-8">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
                                {account.method === "bank_transfer" ? (
                                    <Banknote className="w-5 h-5 text-emerald-600" />
                                ) : (
                                    <Smartphone className="w-5 h-5 text-emerald-600" />
                                )}
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                                    {account.method === "bank_transfer" ? "Bank Transfer" : "UPI"}{" "}
                                    Account
                                    {account.is_primary && (
                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                                            <Star className="w-3 h-3 fill-amber-400" /> Primary
                                        </span>
                                    )}
                                </h1>
                                <p className="text-sm text-neutral-500 mt-0.5 font-mono">
                                    {shortId(account.id)}
                                </p>
                            </div>
                        </div>
                        <PayoutAccountStatusBadge status={account.status} />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="border-b border-neutral-100 pb-4">
                    <CardTitle className="text-base">Account Details</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                        <Field label="Creator">
                            <Link
                                to={`/creators/${account.creator_id}`}
                                className="inline-flex items-center gap-1 text-emerald-600 hover:underline font-mono"
                            >
                                {shortId(account.creator_id)}
                                <ExternalLink className="w-3 h-3" />
                            </Link>
                        </Field>
                        <Field label="Currency">{orDash(account.currency)}</Field>
                        <Field label="Account Holder">{orDash(account.account_holder_name)}</Field>
                        <Field label="Primary">{account.is_primary ? "Yes" : "No"}</Field>

                        {account.method === "bank_transfer" ? (
                            <>
                                <Field label="Account Number (masked)">
                                    <span className="font-mono">
                                        {orDash(account.bank_details?.account_number_masked)}
                                    </span>
                                </Field>
                                <Field label="IFSC Code">
                                    {orDash(account.bank_details?.ifsc_code)}
                                </Field>
                                <Field label="Bank Name">
                                    {orDash(account.bank_details?.bank_name)}
                                </Field>
                            </>
                        ) : (
                            <Field label="UPI ID (masked)">
                                <span className="font-mono">{orDash(account.upi_id)}</span>
                            </Field>
                        )}
                    </dl>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="border-b border-neutral-100 pb-4">
                    <CardTitle className="text-base">Verification & Audit</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                        <Field label="Verified By">
                            {account.verified_by ? (
                                <span className="font-mono">{shortId(account.verified_by)}</span>
                            ) : (
                                "—"
                            )}
                        </Field>
                        <Field label="Verified At">{formatDateTime(account.verified_at)}</Field>
                        <Field label="Created">{formatDateTime(account.created_at)}</Field>
                        <Field label="Updated">{formatDateTime(account.updated_at)}</Field>
                        {account.rejection_reason && (
                            <div className="sm:col-span-2">
                                <dt className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                                    Rejection Reason
                                </dt>
                                <dd className="mt-1 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                    {account.rejection_reason}
                                </dd>
                            </div>
                        )}
                    </dl>
                </CardContent>
            </Card>

            {/* Modals */}
            <PayoutAccountFormModal
                open={showEdit}
                onClose={() => setShowEdit(false)}
                account={account}
            />
            <VerifyPayoutAccountModal
                open={showVerify}
                onClose={() => setShowVerify(false)}
                account={account}
            />

            <ConfirmModal
                open={confirmPrimary}
                title="Set Primary Account"
                message="Make this the creator's primary payout account? The current primary (if any) will be demoted."
                confirmLabel="Set Primary"
                confirmStyle="bg-emerald-600 hover:bg-emerald-700"
                theme="info"
                onConfirm={() => setPrimaryMutation.mutate()}
                onCancel={() => setConfirmPrimary(false)}
                isPending={setPrimaryMutation.isPending}
            />

            <ConfirmModal
                open={confirmDelete}
                title={hardDelete ? "Permanently Delete Account" : "Delete Payout Account"}
                message={
                    hardDelete
                        ? "This will PERMANENTLY remove the payout account. This cannot be undone."
                        : "This will soft-delete the payout account. The server may refuse if it is the creator's only or primary verified account."
                }
                confirmLabel={hardDelete ? "Hard Delete" : "Delete"}
                confirmStyle="bg-red-600 hover:bg-red-700"
                theme="danger"
                onConfirm={() => deleteMutation.mutate()}
                onCancel={() => setConfirmDelete(false)}
                isPending={deleteMutation.isPending}
            >
                {isSuper && (
                    <label className="flex items-center gap-2 mb-3 text-sm text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 cursor-pointer">
                        <input
                            type="checkbox"
                            className="rounded border-neutral-300 text-red-600 focus:ring-red-500"
                            checked={hardDelete}
                            onChange={(e) => setHardDelete(e.target.checked)}
                        />
                        Permanently delete (hard delete) — super-admin only
                    </label>
                )}
            </ConfirmModal>
        </div>
    );
}
