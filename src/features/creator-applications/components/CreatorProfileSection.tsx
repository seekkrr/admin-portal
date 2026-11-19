import { BadgeCheck, Clock, ExternalLink } from "lucide-react";
import { SectionHeading } from "@/components/ui/PageHeader";
import { DetailList, DetailRow } from "@/components/ui/Panel";
import { Tag } from "@/components/ui/StatusPill";
import { humanizeStatus } from "@/components/ui/status";
import type { CollabCreatorProfile } from "@/types";

const n = (value: number | null | undefined) => (value ?? 0).toLocaleString("en-IN");

function Tags({ items, empty }: { items: string[]; empty: string }) {
    if (items.length === 0) return <span className="text-ink-faint">{empty}</span>;
    return (
        <span className="flex flex-wrap gap-1.5">
            {items.map((item) => (
                <Tag key={item}>{item}</Tag>
            ))}
        </span>
    );
}

function HandleState({ verified, pending }: { verified: boolean; pending: boolean }) {
    if (verified) {
        return (
            <Tag tone="good">
                <BadgeCheck className="h-3 w-3" aria-hidden /> Verified
            </Tag>
        );
    }
    if (pending) {
        return (
            <Tag tone="warn">
                <Clock className="h-3 w-3" aria-hidden /> Awaiting review
            </Tag>
        );
    }
    return <Tag>Unverified</Tag>;
}

/**
 * What the applicant filled in on the app's "Know Your Creator" form.
 *
 * The application record itself carries only a name, the handles as plain
 * links and an email — thin ground for an approval. Everything here is read
 * from `collab_profiles` and is read-only: it is the applicant's own writing,
 * not something staff edit from this screen. Tier and suspension are changed
 * on Collab creators instead.
 */
export function CreatorProfileSection({ profile }: { profile: CollabCreatorProfile }) {
    const stats = profile.stats ?? {};
    const hasHistory = Boolean((stats.redeemed ?? 0) || (stats.completed ?? 0) || (stats.rating_count ?? 0));

    return (
        <section className="space-y-3">
            <SectionHeading>Creator profile</SectionHeading>

            <DetailList>
                <DetailRow
                    label="18 or older"
                    value={profile.is_adult_confirmed ? <Tag tone="good">Confirmed</Tag> : <Tag tone="warn">Not confirmed</Tag>}
                />
                <DetailRow
                    label="Tier"
                    value={
                        <Tag tone={profile.tier === "verified" ? "good" : "neutral"}>
                            {humanizeStatus(profile.tier ?? "community")}
                        </Tag>
                    }
                />
                <DetailRow label="Open to collabs" value={profile.open_to_collab ? "Yes" : "No — hidden from businesses"} />
                <DetailRow label="Travel styles" value={<Tags items={profile.travel_styles} empty="None chosen" />} />
                <DetailRow label="Niches" value={<Tags items={profile.niches} empty="None chosen" />} />
                <DetailRow label="Languages" value={<Tags items={profile.languages} empty="None chosen" />} />
                {profile.public_slug && (
                    <DetailRow
                        label="Public page"
                        value={
                            <a
                                href={`https://seekkrr.com/c/${profile.public_slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-accent-700 hover:underline"
                            >
                                /c/{profile.public_slug} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            </a>
                        }
                    />
                )}
            </DetailList>

            {profile.bio && (
                <div className="rounded-control border border-line bg-surface-muted/40 px-3 py-2.5">
                    <p className="whitespace-pre-line text-sm text-ink">{profile.bio}</p>
                </div>
            )}

            {profile.socials.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Handles ({profile.socials.length})</p>
                    <ul className="space-y-2">
                        {profile.socials.map((social) => (
                            <li
                                key={`${social.platform}-${social.handle}`}
                                className="flex flex-wrap items-center gap-2 rounded-control border border-line px-3 py-2.5 text-sm"
                            >
                                <span className="text-ink-muted">{humanizeStatus(social.platform)}</span>
                                <span className="font-medium text-ink">{social.handle}</span>
                                <HandleState verified={social.verified} pending={social.verification_pending} />
                                {typeof social.followers_self_reported === "number" && (
                                    <span className="ml-auto text-xs text-ink-muted" title="Typed in by the creator. Nobody has checked it.">
                                        {n(social.followers_self_reported)} followers, self-reported
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {profile.portfolio.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Portfolio ({profile.portfolio.length})</p>
                    <ul className="space-y-2">
                        {profile.portfolio.map((item) => (
                            <li key={item.url}>
                                <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 rounded-control border border-line px-3 py-2.5 text-sm text-ink transition-colors hover:border-accent-300 hover:bg-accent-50/40"
                                >
                                    <ExternalLink className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                                    <span className="min-w-0 flex-1 truncate font-medium">
                                        {item.caption || item.url.replace(/^https?:\/\/(www\.)?/, "")}
                                    </span>
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {hasHistory && (
                <DetailList>
                    <DetailRow label="Redeemed" value={n(stats.redeemed)} />
                    <DetailRow label="Completed" value={n(stats.completed)} />
                    <DetailRow label="No-shows" value={n(stats.no_shows)} />
                    <DetailRow
                        label="Rating"
                        value={stats.avg_rating ? `${stats.avg_rating.toFixed(1)}★ from ${n(stats.rating_count)}` : "No ratings yet"}
                    />
                </DetailList>
            )}
        </section>
    );
}
