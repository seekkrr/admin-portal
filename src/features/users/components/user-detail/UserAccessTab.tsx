import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, Coins, KeyRound, RotateCcw, ShieldCheck, Trash2, ToggleRight } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Checkbox, Field, Switch, TextInput } from "@/components/ui/Field";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { Notice } from "@/components/detail/DetailStates";
import { count, fullName } from "@/components/detail/detailFormat";
import { usersService } from "@/features/users/services/users.service";
import { effectiveRole, isRedundantRoleChange } from "@/features/users/roles";
import { userDetailApi } from "@/services/admin-detail.service";
import { cx } from "@/utils/cx";
import type { AdminUserProfile } from "@/types/admin-detail";

const LADDER: { role: string; label: string; hint: string }[] = [
    { role: "user", label: "User", hint: "Travels with SeekKrr. No portal access." },
    { role: "moderator", label: "Moderator", hint: "Reviews places, quests, reports and chats." },
    { role: "finance", label: "Finance", hint: "Payments, refunds and payouts." },
    { role: "admin", label: "Admin", hint: "Can change everything in this portal." },
];

const ROLE_LABEL: Record<string, string> = { user: "User", moderator: "Moderator", finance: "Finance", admin: "Admin", super_admin: "Super admin" };

type AccessKind = "creator" | "business";

const ACCESS_COPY: Record<AccessKind, { label: string; hint: string; on: (n: string) => string; off: (n: string) => string }> = {
    creator: {
        label: "Creator access",
        hint: "Creator Portal: quests, collabs and their creator profile.",
        on: (n) => `${n} becomes a creator and can use the Creator Portal straight away.`,
        off: (n) => `${n} loses Creator Portal access. Their quests and history are kept, and turning this back on restores them.`,
    },
    business: {
        label: "Business access",
        hint: "Partner Portal: their business, places, collabs and experiences.",
        on: (n) => `${n} gets an active business they own and can open the Partner Portal straight away. If they had a business before, it comes back.`,
        off: (n) => `${n} loses Partner Portal access and their business is hidden from the app and website. Nothing is deleted; turning this back on restores it.`,
    },
};

type Pending =
    | { kind: "role"; role: string }
    | { kind: "access"; access: AccessKind; enabled: boolean }
    | { kind: "suspend" }
    | { kind: "reactivate" }
    | { kind: "reset-points" }
    | { kind: "delete" };

/** Roles, portal access, suspension, points and deletion for one user. */
export function UserAccessTab({
    user,
    canEdit,
    isSelf,
    onChanged,
}: {
    user: AdminUserProfile;
    canEdit: boolean;
    isSelf: boolean;
    onChanged: () => void;
}) {
    const navigate = useNavigate();
    const name = fullName(user.first_name, user.last_name) || user.email || "This user";
    const roles = user.roles;
    const current = effectiveRole(roles);
    const isSuper = roles.includes("super_admin");
    const isBusiness = roles.includes("business");
    const suspended = user.status === "suspended";
    const locked = !canEdit || isSuper;

    const [pending, setPending] = useState<Pending | null>(null);
    const [businessName, setBusinessName] = useState("");
    const [points, setPoints] = useState("");
    const [hardDelete, setHardDelete] = useState(false);
    const close = () => {
        setPending(null);
        setBusinessName("");
        setHardDelete(false);
    };

    const done = (msg: string) => {
        toast.success(msg);
        close();
        onChanged();
    };
    const fail = (e: Error) => toast.error(e.message);

    const roleMutation = useMutation({
        mutationFn: (role: string) => usersService.updateUserRole(user.id, role, roles),
        onSuccess: (_, role) => done(`Role changed to ${ROLE_LABEL[role] ?? role}`),
        onError: fail,
    });
    const accessMutation = useMutation({
        mutationFn: ({ access, enabled }: { access: AccessKind; enabled: boolean }) =>
            usersService.setAccess(user.id, access, enabled, access === "business" && enabled ? businessName.trim() || undefined : undefined),
        onSuccess: (_, { access, enabled }) => done(`${ACCESS_COPY[access].label} turned ${enabled ? "on" : "off"}`),
        onError: fail,
    });
    const statusMutation = useMutation({
        mutationFn: ({ status, reason }: { status: "active" | "suspended"; reason?: string }) => userDetailApi.patch(user.id, { status, reason }),
        onSuccess: (_, { status }) => done(status === "active" ? `${name} can sign in again` : `${name} is suspended`),
        onError: fail,
    });
    const pointsMutation = useMutation({
        mutationFn: ({ mode, amount }: { mode: "add" | "deduct"; amount: number }) =>
            mode === "add" ? usersService.addPoints(user.id, amount) : usersService.deductPoints(user.id, amount),
        onSuccess: (res) => {
            setPoints("");
            done(`Points updated. New total: ${count(res.points_earned)}`);
        },
        onError: fail,
    });
    const deleteMutation = useMutation({
        mutationFn: (hard: boolean) => usersService.deleteUser(user.id, hard),
        onSuccess: () => {
            toast.success(hardDelete ? "User permanently deleted" : "User deleted");
            onChanged();
            navigate("/users", { replace: true });
        },
        onError: fail,
    });

    const amount = Number.parseInt(points, 10);
    const amountValid = Number.isFinite(amount) && amount > 0;

    return (
        <div className="space-y-5">
            {isSuper && <Notice tone="info" title="Super admin">Super admin accounts can't be changed from this page.</Notice>}
            {isSelf && !isSuper && <Notice tone="warn" title="This is your own account">Changing your own role or status can lock you out of the portal.</Notice>}

            <Panel title="Role" icon={ShieldCheck} description="Pick one step on the ladder. Creator and business access stay as they are.">
                <div role="radiogroup" aria-label="Role" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {LADDER.map((step) => {
                        const isCurrent = current === step.role;
                        const redundant = isRedundantRoleChange(step.role, roles);
                        return (
                            <button
                                key={step.role}
                                type="button"
                                role="radio"
                                aria-checked={isCurrent}
                                disabled={locked || redundant || roleMutation.isPending}
                                onClick={() => setPending({ kind: "role", role: step.role })}
                                className={cx(
                                    "rounded-control border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed",
                                    isCurrent ? "border-accent-300 bg-accent-50" : "border-line hover:border-accent-300 hover:bg-accent-50/50 disabled:opacity-60"
                                )}
                            >
                                <span className="flex items-center justify-between gap-2 text-sm font-medium text-ink">
                                    {step.label}
                                    {isCurrent && <Tag tone="brand">Current</Tag>}
                                </span>
                                <span className="mt-0.5 block text-xs text-ink-muted">{step.hint}</span>
                            </button>
                        );
                    })}
                </div>
            </Panel>

            <Panel title="Portal access" icon={ToggleRight}>
                <div className="space-y-4">
                    {(["creator", "business"] as const).map((kind) => {
                        const on = kind === "creator" ? user.is_creator : isBusiness;
                        return (
                            <Switch
                                key={kind}
                                checked={on}
                                label={ACCESS_COPY[kind].label}
                                description={ACCESS_COPY[kind].hint}
                                disabled={!canEdit || accessMutation.isPending}
                                onChange={() => setPending({ kind: "access", access: kind, enabled: !on })}
                            />
                        );
                    })}
                </div>
            </Panel>

            <Panel
                title="Account status"
                icon={suspended ? RotateCcw : Ban}
                actions={<StatusPill status={user.status} />}
                description={suspended ? "They can't sign in until reactivated." : "Suspending signs them out and blocks sign-in."}
            >
                {suspended ? (
                    <Button variant="primary" icon={RotateCcw} disabled={locked} onClick={() => setPending({ kind: "reactivate" })}>
                        Reactivate account
                    </Button>
                ) : (
                    <Button variant="secondary" icon={Ban} disabled={locked} onClick={() => setPending({ kind: "suspend" })}>
                        Suspend account
                    </Button>
                )}
            </Panel>

            <Panel title="Points" icon={Coins} actions={<Tag tone="warn">{count(user.points)} pts</Tag>}>
                <form
                    className="flex flex-col gap-3 sm:flex-row sm:items-end"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (amountValid) pointsMutation.mutate({ mode: "add", amount });
                    }}
                >
                    <Field label="Amount" className="sm:w-48">
                        <TextInput
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={points}
                            onChange={(e) => setPoints(e.target.value)}
                            disabled={!canEdit || pointsMutation.isPending}
                            placeholder="e.g. 50"
                        />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                        <Button type="submit" variant="primary" disabled={!canEdit || !amountValid} loading={pointsMutation.isPending && pointsMutation.variables?.mode === "add"}>
                            Add
                        </Button>
                        <Button
                            variant="secondary"
                            disabled={!canEdit || !amountValid}
                            loading={pointsMutation.isPending && pointsMutation.variables?.mode === "deduct"}
                            onClick={() => pointsMutation.mutate({ mode: "deduct", amount })}
                        >
                            Deduct
                        </Button>
                        <Button variant="ghost" disabled={!canEdit || user.points <= 0} onClick={() => setPending({ kind: "reset-points" })}>
                            Reset to 0
                        </Button>
                    </div>
                </form>
            </Panel>

            {canEdit && !isSuper && (
                <Panel title="Delete account" icon={KeyRound}>
                    <p className="mb-3 text-sm text-ink-muted">
                        Deleting marks the account as deleted and removes personal details. A permanent delete removes everything and can't be undone.
                    </p>
                    <Button variant="danger" icon={Trash2} onClick={() => setPending({ kind: "delete" })}>
                        Delete user
                    </Button>
                </Panel>
            )}

            {/* ── Confirmations ── */}
            <ConfirmDialog
                open={pending?.kind === "role"}
                title="Change role?"
                description={
                    pending?.kind === "role"
                        ? `${name} becomes ${ROLE_LABEL[pending.role] ?? pending.role}. Their portal permissions change right away.`
                        : undefined
                }
                confirmLabel="Change role"
                tone={pending?.kind === "role" && pending.role === "admin" ? "warning" : "primary"}
                isPending={roleMutation.isPending}
                onConfirm={() => pending?.kind === "role" && roleMutation.mutate(pending.role)}
                onCancel={close}
            />
            {pending?.kind === "access" && (
                <ConfirmDialog
                    open
                    title={`Turn ${pending.enabled ? "on" : "off"} ${ACCESS_COPY[pending.access].label.toLowerCase()}?`}
                    description={pending.enabled ? ACCESS_COPY[pending.access].on(name) : ACCESS_COPY[pending.access].off(name)}
                    confirmLabel={pending.enabled ? "Turn on" : "Turn off"}
                    tone={pending.enabled ? "primary" : "warning"}
                    isPending={accessMutation.isPending}
                    onConfirm={() => accessMutation.mutate({ access: pending.access, enabled: pending.enabled })}
                    onCancel={close}
                >
                    {pending.access === "business" && pending.enabled && (
                        <Field label="Business name (optional)" hint="They can change it in the Partner Portal.">
                            <TextInput value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={150} placeholder={`${user.first_name || "Their"}'s business`} />
                        </Field>
                    )}
                </ConfirmDialog>
            )}
            <ConfirmDialog
                open={pending?.kind === "suspend"}
                title={`Suspend ${name}?`}
                description="They're signed out and can't sign in until an admin reactivates the account."
                confirmLabel="Suspend"
                tone="warning"
                level="reason"
                reasonLabel="Reason"
                reasonPlaceholder="e.g. Repeated fake check-ins"
                reasonMinLength={3}
                isPending={statusMutation.isPending}
                onConfirm={(reason) => statusMutation.mutate({ status: "suspended", reason })}
                onCancel={close}
            />
            <ConfirmDialog
                open={pending?.kind === "reactivate"}
                title={`Reactivate ${name}?`}
                description="They can sign in again straight away."
                confirmLabel="Reactivate"
                level="reason"
                reasonLabel="Note"
                reasonPlaceholder="Why the account is coming back (optional)"
                reasonMinLength={0}
                isPending={statusMutation.isPending}
                onConfirm={(reason) => statusMutation.mutate({ status: "active", reason })}
                onCancel={close}
            />
            <ConfirmDialog
                open={pending?.kind === "reset-points"}
                title="Reset points to 0?"
                description={`${count(user.points)} points are taken away from ${name}.`}
                confirmLabel="Reset points"
                tone="warning"
                isPending={pointsMutation.isPending}
                onConfirm={() => pointsMutation.mutate({ mode: "deduct", amount: user.points })}
                onCancel={close}
            />
            <ConfirmDialog
                open={pending?.kind === "delete"}
                title={hardDelete ? "Permanently delete this user?" : "Delete this user?"}
                description={hardDelete ? "All of their data is removed for good." : "The account is marked as deleted and they can't sign in."}
                confirmLabel={hardDelete ? "Delete permanently" : "Delete"}
                tone="danger"
                level={hardDelete ? "type" : "simple"}
                typeToConfirm={name}
                isPending={deleteMutation.isPending}
                onConfirm={() => deleteMutation.mutate(hardDelete)}
                onCancel={close}
            >
                <Checkbox checked={hardDelete} onChange={setHardDelete} label="Delete permanently" hint="Removes all data. This can't be undone." />
            </ConfirmDialog>
        </div>
    );
}
