import { Link } from "react-router-dom";
import { ChevronRight, Compass, MapPin, MapPinPlus, Sparkles, Star, Ticket, type LucideIcon } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/States";
import { NotAvailableNotice } from "@/components/detail/DetailStates";
import { count } from "@/components/detail/detailFormat";
import { formatDateTime, formatRelative } from "@/utils/date";
import type { UserOverview, UserRecentItem, UserRecentKey } from "@/types/admin-detail";

const SECTIONS: { key: UserRecentKey; title: string; icon: LucideIcon; empty: string }[] = [
    { key: "checkins", title: "Check-ins", icon: MapPin, empty: "No check-ins yet" },
    { key: "experience_bookings", title: "Experience bookings", icon: Ticket, empty: "No experience bookings" },
    { key: "quest_bookings", title: "Quest bookings", icon: Compass, empty: "No quest bookings" },
    { key: "reviews", title: "Reviews", icon: Star, empty: "No reviews written" },
    { key: "collab_applications", title: "Collab requests", icon: Sparkles, empty: "No collab requests" },
    { key: "markers_created", title: "Places added", icon: MapPinPlus, empty: "No places added" },
];

function Row({ item }: { item: UserRecentItem }) {
    const body = (
        <>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                {item.subtitle && <p className="truncate text-xs text-ink-muted">{item.subtitle}</p>}
            </div>
            <time className="shrink-0 text-xs text-ink-faint" dateTime={item.at ?? undefined} title={formatDateTime(item.at)}>
                {formatRelative(item.at)}
            </time>
            {item.url_path && <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />}
        </>
    );
    const cls = "flex items-center gap-3 px-4 py-3 sm:px-5";
    return (
        <li>
            {item.url_path ? (
                <Link to={item.url_path} className={`${cls} transition-colors hover:bg-surface-muted`}>
                    {body}
                </Link>
            ) : (
                <div className={cls}>{body}</div>
            )}
        </li>
    );
}

/** Their latest check-ins, bookings, reviews, collab requests and places — each links to the record. */
export function UserActivityTab({ data, full }: { data: UserOverview; full: boolean }) {
    if (!full) {
        return (
            <Panel>
                <NotAvailableNotice what="Recent activity" />
            </Panel>
        );
    }
    return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {SECTIONS.map((s) => {
                const items = data.recent[s.key] ?? [];
                const total = data.stats[s.key] ?? 0;
                return (
                    <Panel
                        key={s.key}
                        title={s.title}
                        icon={s.icon}
                        description={total > items.length ? `Latest ${items.length} of ${count(total)}` : undefined}
                        bodyClassName="p-0"
                    >
                        {items.length === 0 ? (
                            <EmptyState compact icon={s.icon} title={s.empty} />
                        ) : (
                            <ul className="divide-y divide-line">
                                {items.map((item) => (
                                    <Row key={item.id} item={item} />
                                ))}
                            </ul>
                        )}
                    </Panel>
                );
            })}
        </div>
    );
}
