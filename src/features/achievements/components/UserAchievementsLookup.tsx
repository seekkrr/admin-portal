import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { Field } from "@/components/ui/Field";
import { Panel } from "@/components/ui/Panel";
import { IdLink } from "@/components/ui/IdLink";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDateTime } from "@/utils/date";
import { achievementsService } from "../services/achievements.service";
import type { UserAchievement } from "@/types";

const COLUMNS: DataColumn<UserAchievement>[] = [
    { id: "achievement", header: "Achievement", hideable: false, csv: (ua) => ua.achievement_id, cell: (ua) => <IdLink kind="achievement" id={ua.achievement_id} /> },
    {
        id: "progress",
        header: "Progress",
        sortValue: (ua) => (ua.progress_required ? ua.progress_current / ua.progress_required : 0),
        csv: (ua) => `${ua.progress_current}/${ua.progress_required}`,
        cell: (ua) => (
            <span className="tabular-nums text-ink-muted">
                {ua.progress_current} / {ua.progress_required}
            </span>
        ),
    },
    {
        id: "status",
        header: "Status",
        sortValue: (ua) => ua.is_completed,
        csv: (ua) => (ua.is_completed ? "earned" : "in progress"),
        cell: (ua) => <StatusPill status={ua.is_completed ? "completed" : "in_progress"} label={ua.is_completed ? "Earned" : "In progress"} tone={ua.is_completed ? "good" : "neutral"} />,
    },
    {
        id: "earned",
        header: "Earned",
        sortValue: (ua) => ua.earned_at ?? "",
        csv: (ua) => formatDateTime(ua.earned_at),
        cell: (ua) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(ua.earned_at)}</span>,
    },
];

/** Achievements earned (and in progress) for one user, picked by name, email or ID. */
export function UserAchievementsLookup({ userId, onUserChange }: { userId: string; onUserChange: (id: string) => void }) {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["user-earned-achievements", userId],
        queryFn: () => achievementsService.userEarned(userId),
        enabled: !!userId,
        staleTime: 60 * 1000,
    });
    const rows = data ?? [];

    return (
        <div className="space-y-4">
            <Panel>
                <Field label="Person" htmlFor="achievements-user" hint="See what they earned and what's in progress." className="max-w-xl">
                    <EntityPicker id="achievements-user" type="user" label="Person" value={userId} onChange={(id) => onUserChange(id)} />
                </Field>
            </Panel>
            {userId && (
                <DataTable
                    label="User achievements"
                    rows={rows}
                    columns={COLUMNS}
                    rowKey={(ua) => ua._id}
                    isLoading={isLoading}
                    error={error}
                    onRetry={() => refetch()}
                    empty={{ icon: Award, title: "No achievement records for this person yet." }}
                    exportName="user-achievements"
                    summary={data ? `${rows.filter((r) => r.is_completed).length} earned · ${rows.filter((r) => !r.is_completed).length} in progress` : undefined}
                    card={{
                        title: (ua) => <IdLink kind="achievement" id={ua.achievement_id} />,
                        fields: ["progress", "status", "earned"],
                    }}
                />
            )}
        </div>
    );
}
