import { useParams } from "react-router-dom";
import { Copy, List } from "lucide-react";
import { toast } from "sonner";
import { AccessDenied } from "@components/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { ButtonLink } from "@/components/ui/Button";
import { CopyText } from "@/components/ui/CopyText";
import { ChangeHistoryPanel } from "@/components/detail/ChangeHistoryPanel";
import { useAdminAccess } from "@/components/detail/useAdminAccess";
import { useDetailTab } from "@/components/detail/useDetailTab";
import { fullName, initials } from "@/components/detail/detailFormat";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useUserDetail } from "../components/user-detail/useUserDetail";
import { UserOverviewTab } from "../components/user-detail/UserOverviewTab";
import { UserProfileTab } from "../components/user-detail/UserProfileTab";
import { UserAccessTab } from "../components/user-detail/UserAccessTab";
import { UserActivityTab } from "../components/user-detail/UserActivityTab";

const TABS = ["overview", "profile", "access", "activity", "history"] as const;
type Tab = (typeof TABS)[number];

const ROLE_LABEL: Record<string, string> = {
    user: "User",
    creator: "Creator",
    moderator: "Moderator",
    finance: "Finance",
    admin: "Admin",
    super_admin: "Super admin",
    business: "Business",
};
const STAFF_ROLES = ["super_admin", "admin", "finance", "moderator"];

/** One user: profile, roles and access, activity and change history (/users/:userId). */
export function UserDetailPage() {
    const { userId = "" } = useParams<{ userId: string }>();
    const { isAdmin, userId: me } = useAdminAccess();
    const [tab, setTab] = useDetailTab<Tab>(TABS, "overview");
    const { data, isLoading, error, refetch, refresh } = useUserDetail(userId, isAdmin);

    const user = data?.overview.user;
    const name = user ? fullName(user.first_name, user.last_name) || user.email || "User" : null;
    usePageTitle(name);

    if (!isAdmin) return <AccessDenied message="Only admins can manage users." />;
    if (isLoading) return <LoadingState label="Loading user…" />;
    if (error || !data || !user) {
        return (
            <ErrorState
                title="Couldn't load this user"
                error={error ?? new Error("User not found.")}
                onRetry={() => refetch()}
            />
        );
    }

    const { overview, full } = data;
    const visibleRoles = user.roles.filter((r) => r !== "user");

    return (
        <div className="space-y-5">
            <div className="flex items-start gap-4">
                {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="h-14 w-14 shrink-0 rounded-full border border-line object-cover sm:h-16 sm:w-16" />
                ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-900 text-lg font-semibold text-white sm:h-16 sm:w-16">
                        {initials(name ?? "")}
                    </span>
                )}
                <PageHeader
                    className="min-w-0 flex-1"
                    title={name}
                    badge={<StatusPill status={user.status} />}
                    description={
                        <span className="flex flex-col gap-1">
                            <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                {user.email && <CopyText value={user.email} title="Copy email" />}
                                {user.phone && <CopyText value={user.phone} title="Copy phone" />}
                            </span>
                            <span className="flex flex-wrap gap-1">
                                {(visibleRoles.length ? visibleRoles : ["user"]).map((r) => (
                                    <Tag key={r} tone={STAFF_ROLES.includes(r) ? "brand" : r === "creator" || r === "business" ? "info" : "neutral"}>
                                        {ROLE_LABEL[r] ?? r}
                                    </Tag>
                                ))}
                                {user.is_creator && !user.roles.includes("creator") && <Tag tone="info">Creator</Tag>}
                            </span>
                        </span>
                    }
                    actions={
                        <ButtonLink to={`/users?focus=${user.id}`} variant="ghost" size="sm" icon={List}>
                            In the list
                        </ButtonLink>
                    }
                    menu={[
                        {
                            label: "Copy user ID",
                            icon: Copy,
                            onSelect: () => {
                                navigator.clipboard
                                    .writeText(user.id)
                                    .then(() => toast.success("User ID copied"))
                                    .catch(() => toast.error("Couldn't copy"));
                            },
                        },
                    ]}
                />
            </div>

            <Tabs<Tab>
                label="User sections"
                idPrefix="user"
                value={tab}
                onChange={setTab}
                tabs={[
                    { value: "overview", label: "Overview" },
                    { value: "profile", label: "Profile" },
                    { value: "access", label: "Access" },
                    { value: "activity", label: "Activity" },
                    { value: "history", label: "Change history" },
                ]}
            />

            <div role="tabpanel" id={`user-panel-${tab}`} aria-labelledby={`user-tab-${tab}`}>
                {tab === "overview" && <UserOverviewTab data={overview} full={full} canEdit={isAdmin} onChanged={refresh} />}
                {tab === "profile" && <UserProfileTab user={user} full={full} canEdit={isAdmin} onSaved={refresh} />}
                {tab === "access" && <UserAccessTab user={user} canEdit={isAdmin} isSelf={me === user.id} onChanged={refresh} />}
                {tab === "activity" && <UserActivityTab data={overview} full={full} />}
                {tab === "history" && <ChangeHistoryPanel entityType="user" entityId={user.id} />}
            </div>
        </div>
    );
}

export default UserDetailPage;
