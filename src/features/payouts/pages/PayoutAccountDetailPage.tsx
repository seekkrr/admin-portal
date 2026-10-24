import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Banknote, CheckCircle2, Pencil, Smartphone, Star, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { DetailList, DetailRow, Panel } from "@/components/ui/Panel";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Checkbox } from "@/components/ui/Field";
import { Tag } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { usePageTitle } from "@/hooks/usePageTitle";
import { payoutAccountsService } from "../services/payout-accounts.service";
import { PayoutAccountStatusBadge } from "../components/PayoutAccountStatusBadge";
import { PayoutAccountFormModal } from "../components/PayoutAccountFormModal";
import { VerifyPayoutAccountModal } from "../components/VerifyPayoutAccountModal";
import { FINANCE_ROLES, MANAGE_ROLES, SUPER_ROLES, hasRole, methodLabel } from "../components/accountDisplay";
import { orDash, shortId } from "@/utils/format";
import { formatDateTime } from "@/utils/date";

export function PayoutAccountDetailPage() {
    const { accountId: accountIdParam } = useParams<{ accountId: string }>();
    const accountId = accountIdParam ?? "";
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const roles = useAuthStore((s) => s.user?.role);

    const canView = hasRole(roles, FINANCE_ROLES);
    const canManage = hasRole(roles, MANAGE_ROLES);
    const isSuper = hasRole(roles, SUPER_ROLES);

    const [showEdit, setShowEdit] = useState(false);
    const [verifyAction, setVerifyAction] = useState<"verify" | "reject" | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [confirmPrimary, setConfirmPrimary] = useState(false);
    const [hardDelete, setHardDelete] = useState(false);

    const { data: account, isLoading, error, refetch } = useQuery({
        queryKey: ["payout-account-detail", accountId],
        queryFn: () => payoutAccountsService.getById(accountId),
        enabled: !!accountId && canView,
        staleTime: 5 * 60 * 1000,
    });

    usePageTitle(account ? account.account_holder_name || `${methodLabel(account.method)} account ${shortId(account.id)}` : null);

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["admin-payout-accounts"] });
        queryClient.invalidateQueries({ queryKey: ["payout-account-detail", accountId] });
    };

    const errMsg = (err: unknown, fallback: string) => {
        const m = (err as { message?: string })?.message;
        return m && m.trim() ? m : fallback;
    };

    const setPrimaryMutation = useMutation({
        mutationFn: () => payoutAccountsService.setPrimary(accountId),
        onSuccess: () => {
            invalidate();
            toast.success("Set as primary account");
            setConfirmPrimary(false);
        },
        onError: (err: unknown) => {
            toast.error(errMsg(err, "Failed to set primary"));
            setConfirmPrimary(false);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => payoutAccountsService.remove(accountId, hardDelete && isSuper),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-payout-accounts"] });
            toast.success(hardDelete ? "Account permanently deleted" : "Account deleted");
            setConfirmDelete(false);
            navigate("/payout-accounts", { replace: true });
        },
        onError: (err: unknown) => {
            toast.error(errMsg(err, "Failed to delete account"));
            setConfirmDelete(false);
        },
    });

    if (!canView) return <AccessDenied message="You need a finance, admin, or super-admin role to view payout accounts." />;
    if (isLoading) return <LoadingState label="Loading payout account…" />;
    if (error || !account) {
        return (
            <Panel>
                <ErrorState title="Couldn't load this payout account" error={error ?? new Error("It may have been removed.")} onRetry={error ? () => refetch() : undefined} />
                <div className="flex justify-center pb-6">
                    <ButtonLink to="/payout-accounts" icon={ArrowLeft} variant="ghost">
                        Back to payout accounts
                    </ButtonLink>
                </div>
            </Panel>
        );
    }

    const isPending = account.status === "pending_verification";
    const canEdit = canManage && isPending;
    const canVerify = canView && isPending;
    const canSetPrimary = canManage && account.status === "verified" && !account.is_primary;
    const isBank = account.method === "bank_transfer";

    return (
        <div className="space-y-5">
            <PageHeader
                icon={isBank ? Banknote : Smartphone}
                title={`${methodLabel(account.method)} account`}
                badge={
                    <>
                        <PayoutAccountStatusBadge status={account.status} />
                        {account.is_primary && (
                            <Tag tone="warn">
                                <Star className="h-3 w-3 fill-current" aria-hidden /> Primary
                            </Tag>
                        )}
                    </>
                }
                description={
                    <>
                        {account.account_holder_name || "No holder name"} · <span className="font-mono text-xs">{shortId(account.id)}</span>
                    </>
                }
                actions={
                    <>
                        {canVerify && (
                            <Button icon={XCircle} onClick={() => setVerifyAction("reject")}>
                                Reject
                            </Button>
                        )}
                        {canEdit && (
                            <Button icon={Pencil} onClick={() => setShowEdit(true)}>
                                Edit
                            </Button>
                        )}
                        {canSetPrimary && (
                            <Button icon={Star} onClick={() => setConfirmPrimary(true)}>
                                Set primary
                            </Button>
                        )}
                    </>
                }
                primaryAction={
                    canVerify && (
                        <Button variant="primary" icon={CheckCircle2} onClick={() => setVerifyAction("verify")}>
                            Verify
                        </Button>
                    )
                }
                menu={[
                    {
                        label: "Delete account",
                        icon: Trash2,
                        danger: true,
                        hidden: !canManage,
                        onSelect: () => {
                            setHardDelete(false);
                            setConfirmDelete(true);
                        },
                    },
                ]}
            />

            <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Account details">
                    <DetailList>
                        <DetailRow label="Creator" value={<IdLink kind="creator" id={account.creator_id} short={false} />} />
                        <DetailRow label="Currency" value={orDash(account.currency)} />
                        <DetailRow label="Account holder" value={orDash(account.account_holder_name)} />
                        <DetailRow label="Primary" value={account.is_primary ? "Yes" : "No"} />
                        {isBank ? (
                            <>
                                <DetailRow label="Account number (masked)" value={<span className="font-mono">{orDash(account.bank_details?.account_number_masked)}</span>} />
                                <DetailRow label="IFSC code" value={orDash(account.bank_details?.ifsc_code)} />
                                <DetailRow label="Bank name" value={orDash(account.bank_details?.bank_name)} />
                            </>
                        ) : (
                            <DetailRow label="UPI ID (masked)" value={<span className="font-mono">{orDash(account.upi_id)}</span>} />
                        )}
                    </DetailList>
                </Panel>

                <Panel title="Verification and audit">
                    <DetailList>
                        <DetailRow label="Verified by" value={<IdLink kind="user" id={account.verified_by} />} />
                        <DetailRow label="Verified at" value={formatDateTime(account.verified_at)} />
                        <DetailRow label="Created" value={formatDateTime(account.created_at)} />
                        <DetailRow label="Updated" value={formatDateTime(account.updated_at)} />
                        {account.rejection_reason && (
                            <DetailRow
                                label="Rejection reason"
                                value={<span className="block rounded-lg border border-bad-line bg-bad-soft px-3 py-2 text-bad">{account.rejection_reason}</span>}
                            />
                        )}
                    </DetailList>
                </Panel>
            </div>

            <PayoutAccountFormModal open={showEdit} onClose={() => setShowEdit(false)} account={account} />
            <VerifyPayoutAccountModal action={verifyAction} onClose={() => setVerifyAction(null)} account={account} />

            <ConfirmDialog
                open={confirmPrimary}
                title="Make this the primary account?"
                description="Payouts go to the creator's primary account. The current primary (if any) stops being primary."
                confirmLabel="Set primary"
                onConfirm={() => setPrimaryMutation.mutate()}
                onCancel={() => setConfirmPrimary(false)}
                isPending={setPrimaryMutation.isPending}
            />

            <ConfirmDialog
                open={confirmDelete}
                tone="danger"
                level={hardDelete ? "type" : "simple"}
                typeToConfirm="DELETE"
                title={hardDelete ? "Permanently delete this account?" : "Delete this payout account?"}
                description={
                    hardDelete
                        ? "The payout account is removed for good."
                        : "The account is soft-deleted. The server may refuse if it's the creator's only or primary verified account."
                }
                confirmLabel={hardDelete ? "Delete permanently" : "Delete"}
                onConfirm={() => deleteMutation.mutate()}
                onCancel={() => setConfirmDelete(false)}
                isPending={deleteMutation.isPending}
            >
                {isSuper && (
                    <Checkbox checked={hardDelete} onChange={setHardDelete} label="Delete permanently" hint="Super-admin only. Removes the record; can't be undone." />
                )}
            </ConfirmDialog>
        </div>
    );
}
