import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserMinus, UserPlus, Users } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Button, IconButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, SelectInput, Switch, TextInput } from "@/components/ui/Field";
import { Tag } from "@/components/ui/StatusPill";
import { OBJECT_ID, fullName } from "@/components/detail/detailFormat";
import { businessDetailApi, userDetailApi } from "@/services/admin-detail.service";
import { formatDate } from "@/utils/date";
import type { BusinessMemberView, RawAdminUser } from "@/types/admin-detail";
import type { AdminBusiness } from "../../types";

type Role = "manager" | "staff";

const ROLE_OPTIONS = [
    { value: "manager", label: "Manager" },
    { value: "staff", label: "Staff" },
];

interface MemberRow extends BusinessMemberView {
    key: string;
    person: RawAdminUser | undefined;
}

function personName(row: MemberRow): string {
    const p = row.person;
    return (p && (fullName(p.first_name, p.last_name) || p.email)) || (row.user_id ? `User …${row.user_id.slice(-6)}` : "Unknown");
}

/** Team: members with roles; add by user ID or email, change role, chat access, remove. */
export function BusinessTeamTab({ business, canEdit }: { business: AdminBusiness; canEdit: boolean }) {
    const queryClient = useQueryClient();
    const members = business.members as BusinessMemberView[];
    const [who, setWho] = useState("");
    const [role, setRole] = useState<Role>("staff");
    const [removing, setRemoving] = useState<MemberRow | null>(null);

    const people = useQueries({
        queries: members.map((m) => ({
            queryKey: ["user-summary", m.user_id],
            queryFn: () => userDetailApi.summary(m.user_id ?? ""),
            enabled: !!m.user_id,
            staleTime: 5 * 60_000,
            retry: false,
        })),
    });
    const rows: MemberRow[] = members.map((m, i) => ({ ...m, key: `${m.user_id ?? "member"}-${i}`, person: people[i]?.data }));

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ["collabs-business", business.id] });
        queryClient.invalidateQueries({ queryKey: ["admin-audit", "business", business.id] });
    };

    const add = useMutation({
        mutationFn: async () => {
            const ref = who.trim();
            let email = ref;
            if (OBJECT_ID.test(ref)) {
                const user = await userDetailApi.summary(ref);
                if (!user.email) throw new Error("That user has no email on their account, so they can't be added by ID.");
                email = user.email;
            }
            await businessDetailApi.addMember(business.id, email, role);
            return email;
        },
        onSuccess: (email) => {
            toast.success(`${email} added as ${role}`);
            setWho("");
            refresh();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const changeRole = useMutation({
        mutationFn: ({ userId, next }: { userId: string; next: Role }) => businessDetailApi.changeMemberRole(business.id, userId, next),
        onSuccess: (_, { next }) => {
            toast.success(`Role changed to ${next}`);
            refresh();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const chat = useMutation({
        mutationFn: ({ userId, on }: { userId: string; on: boolean }) => businessDetailApi.setMemberChat(business.id, userId, on),
        onSuccess: (_, { on }) => {
            toast.success(`Collab chat turned ${on ? "on" : "off"}`);
            refresh();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const remove = useMutation({
        mutationFn: (row: MemberRow) => businessDetailApi.removeMember(business.id, row.user_id ?? ""),
        onSuccess: (_, row) => {
            toast.success(`${personName(row)} removed from the team`);
            setRemoving(null);
            refresh();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const columns: DataColumn<MemberRow>[] = [
        {
            id: "person",
            header: "Person",
            hideable: false,
            sortValue: (r) => personName(r),
            cell: (r) => (
                <div className="min-w-0">
                    {r.user_id ? (
                        <Link to={`/users/${r.user_id}`} className="font-medium text-ink hover:text-accent-700 hover:underline">
                            {personName(r)}
                        </Link>
                    ) : (
                        <span className="font-medium text-ink">{personName(r)}</span>
                    )}
                    {r.person?.email && <div className="truncate text-xs text-ink-muted">{r.person.email}</div>}
                </div>
            ),
        },
        {
            id: "role",
            header: "Role",
            sortValue: (r) => r.role,
            cell: (r) =>
                r.role === "owner" || !canEdit || !r.user_id ? (
                    <Tag tone={r.role === "owner" ? "brand" : "neutral"}>{r.role.charAt(0).toUpperCase() + r.role.slice(1)}</Tag>
                ) : (
                    <SelectInput
                        aria-label={`Role for ${personName(r)}`}
                        value={r.role}
                        options={ROLE_OPTIONS}
                        disabled={changeRole.isPending}
                        onChange={(e) => changeRole.mutate({ userId: r.user_id ?? "", next: e.target.value as Role })}
                        className="h-8 w-32 text-[13px]"
                    />
                ),
        },
        {
            id: "chat",
            header: "Collab chat",
            cell: (r) =>
                r.role === "owner" ? (
                    <span className="text-xs text-ink-muted">Always</span>
                ) : (
                    <Switch
                        size="sm"
                        hideLabel
                        checked={r.can_chat !== false}
                        label={`Collab chat for ${personName(r)}`}
                        disabled={!canEdit || chat.isPending || !r.user_id}
                        onChange={(on) => chat.mutate({ userId: r.user_id ?? "", on })}
                    />
                ),
        },
        { id: "added", header: "Added", sortValue: (r) => r.added_at ?? "", cell: (r) => <span className="text-ink-muted">{formatDate(r.added_at)}</span> },
    ];

    return (
        <div className="space-y-5">
            <Panel title={`Team (${members.length})`} icon={Users} bodyClassName="p-0">
                <DataTable
                    label="Team members"
                    rows={rows}
                    columns={columns}
                    rowKey={(r) => r.key}
                    toolbar={false}
                    frame="bare"
                    empty={{ icon: Users, title: "No team yet", description: "Assign an owner on the Overview tab." }}
                    card={{ title: personName, subtitle: (r) => r.person?.email ?? null, fields: ["role", "chat", "added"] }}
                    rowActions={
                        canEdit
                            ? (r) =>
                                  r.role === "owner" ? null : (
                                      <IconButton
                                          icon={UserMinus}
                                          size="sm"
                                          label={`Remove ${personName(r)}`}
                                          className="hover:bg-bad-soft hover:text-bad"
                                          onClick={() => setRemoving(r)}
                                      />
                                  )
                            : undefined
                    }
                />
            </Panel>

            {canEdit && (
                <Panel title="Add a team member" icon={UserPlus} description="They need a SeekKrr account. The owner is changed on the Overview tab.">
                    <form
                        className="flex flex-col gap-3 sm:flex-row sm:items-end"
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (who.trim()) add.mutate();
                        }}
                    >
                        <Field label="User ID or email" className="flex-1">
                            <TextInput value={who} onChange={(e) => setWho(e.target.value)} placeholder="name@example.com or a user ID" maxLength={255} autoComplete="off" />
                        </Field>
                        <Field label="Role" className="sm:w-40">
                            <SelectInput value={role} onChange={(e) => setRole(e.target.value as Role)} options={ROLE_OPTIONS} />
                        </Field>
                        <Button type="submit" variant="primary" icon={UserPlus} disabled={!who.trim()} loading={add.isPending}>
                            Add
                        </Button>
                    </form>
                </Panel>
            )}

            <ConfirmDialog
                open={!!removing}
                title={`Remove ${removing ? personName(removing) : "this person"}?`}
                description={`They lose access to ${business.name} in the Partner Portal and app.`}
                confirmLabel="Remove"
                tone="warning"
                isPending={remove.isPending}
                onConfirm={() => removing && remove.mutate(removing)}
                onCancel={() => setRemoving(null)}
            />
        </div>
    );
}
