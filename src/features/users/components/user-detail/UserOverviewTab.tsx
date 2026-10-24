import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, CalendarCheck, Compass, MapPin, MapPinPlus, Sparkles, Star, Store, Ticket, UserRound } from "lucide-react";
import { Panel, DetailList, DetailRow } from "@/components/ui/Panel";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { Switch } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/States";
import { StatTiles } from "@/components/detail/StatTiles";
import { NotAvailableNotice } from "@/components/detail/DetailStates";
import { count } from "@/components/detail/detailFormat";
import { businessesService } from "@/features/collabs/services/businesses.service";
import { formatDate, formatRelative } from "@/utils/date";
import type { UserBusinessLink, UserOverview } from "@/types/admin-detail";

const FEATURE_LABEL = { collabs: "Collabs", experiences: "Experiences" } as const;

function BusinessRow({ b, canEdit, onChanged }: { b: UserBusinessLink; canEdit: boolean; onChanged: () => void }) {
    const save = useMutation({
        mutationFn: (patch: { collabs?: boolean; experiences?: boolean }) => businessesService.update(b.id, { features: patch }),
        onSuccess: (_, patch) => {
            const [key, on] = Object.entries(patch)[0] ?? [];
            toast.success(`${FEATURE_LABEL[key as keyof typeof FEATURE_LABEL] ?? "Feature"} turned ${on ? "on" : "off"} for ${b.name}`);
            onChanged();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const f = b.features ?? {};
    return (
        <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="min-w-0">
                <Link to={`/collabs/businesses/${b.id}`} className="font-medium text-ink hover:text-accent-700 hover:underline">
                    {b.name}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Tag tone={b.role === "owner" ? "brand" : "neutral"}>{b.role.charAt(0).toUpperCase() + b.role.slice(1)}</Tag>
                    <StatusPill status={b.status} />
                </div>
            </div>
            <div className="flex flex-wrap gap-4">
                {(["collabs", "experiences"] as const).map((key) => (
                    <Switch
                        key={key}
                        size="sm"
                        checked={!!f[key]}
                        label={FEATURE_LABEL[key]}
                        disabled={!canEdit || save.isPending}
                        onChange={(on) => save.mutate({ [key]: on })}
                    />
                ))}
            </div>
        </li>
    );
}

export function UserOverviewTab({
    data,
    full,
    canEdit,
    onChanged,
}: {
    data: UserOverview;
    full: boolean;
    canEdit: boolean;
    onChanged: () => void;
}) {
    const { user, stats, creator, businesses } = data;
    return (
        <div className="space-y-5">
            {full ? (
                <StatTiles
                    items={[
                        { label: "Check-ins", value: count(stats.checkins), icon: MapPin },
                        { label: "Experience bookings", value: count(stats.experience_bookings), icon: Ticket },
                        { label: "Quest bookings", value: count(stats.quest_bookings), icon: Compass },
                        { label: "Reviews", value: count(stats.reviews), icon: Star },
                        { label: "Collab requests", value: count(stats.collab_applications), icon: Sparkles },
                        { label: "Places added", value: count(stats.markers_created), icon: MapPinPlus },
                    ]}
                />
            ) : (
                <Panel>
                    <NotAvailableNotice what="Activity numbers, businesses and creator details" />
                </Panel>
            )}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Panel title="Account" icon={UserRound}>
                    <DetailList>
                        <DetailRow label="Status" value={<StatusPill status={user.status} />} />
                        <DetailRow label="Joined" value={formatDate(user.created_at)} />
                        <DetailRow label="Last active" value={user.last_active_at ? formatRelative(user.last_active_at) : "—"} />
                        <DetailRow label="Points" value={<span className="tabular-nums">{count(user.points)}</span>} />
                        <DetailRow label="Username" value={user.username ? `@${user.username}` : "—"} />
                        <DetailRow
                            label="Hobbies"
                            value={
                                user.hobbies.length ? (
                                    <span className="flex flex-wrap gap-1">
                                        {user.hobbies.map((h) => (
                                            <Tag key={h}>{h}</Tag>
                                        ))}
                                    </span>
                                ) : (
                                    "—"
                                )
                            }
                        />
                    </DetailList>
                </Panel>

                <Panel title="Creator" icon={BadgeCheck}>
                    {creator ? (
                        <DetailList>
                            <DetailRow label="Status" value={<StatusPill status={creator.status} />} />
                            <DetailRow label="Verified" value={creator.verified ? <Tag tone="good">Verified</Tag> : "Not verified"} />
                            <DetailRow
                                label="Handles"
                                value={
                                    creator.handles.length ? (
                                        <span className="flex flex-wrap gap-1">
                                            {creator.handles.map((h, i) => {
                                                const text = typeof h === "string" ? h : [h.platform, h.handle].filter(Boolean).join(": ");
                                                const verified = typeof h !== "string" && !!h.verified;
                                                return (
                                                    <Tag key={`${text}-${i}`} tone={verified ? "good" : "neutral"}>
                                                        {text}
                                                    </Tag>
                                                );
                                            })}
                                        </span>
                                    ) : (
                                        "—"
                                    )
                                }
                            />
                            <DetailRow label="Profile" value={<Link to="/creators" className="text-accent-700 hover:underline">Open creators</Link>} />
                        </DetailList>
                    ) : (
                        <EmptyState
                            compact
                            icon={BadgeCheck}
                            title={user.is_creator ? "Creator access is on" : "Not a creator"}
                            description={full ? "Turn creator access on or off in the Access tab." : "Creator details show once the server update is live."}
                        />
                    )}
                </Panel>
            </div>

            <Panel title="Businesses" icon={Store} description="Where this person is on the team" bodyClassName="p-0">
                {!full ? (
                    <NotAvailableNotice what="Their businesses" />
                ) : businesses.length === 0 ? (
                    <EmptyState compact icon={Store} title="Not on any business team" />
                ) : (
                    <ul className="divide-y divide-line">
                        {businesses.map((b) => (
                            <BusinessRow key={b.id} b={b} canEdit={canEdit} onChanged={onChanged} />
                        ))}
                    </ul>
                )}
            </Panel>

            {full && stats.experience_bookings > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-ink-faint">
                    <CalendarCheck className="h-3.5 w-3.5" aria-hidden /> See the Activity tab for their latest bookings, check-ins and reviews.
                </p>
            )}
        </div>
    );
}
