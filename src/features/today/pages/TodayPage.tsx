import { Link } from "react-router-dom";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { ArrowRight, BarChart3, CheckCircle2, LayoutDashboard, MessagesSquare, RefreshCw, Sun } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { cx } from "@/utils/cx";
import { useTodayItems, type TodayItem } from "../useTodayItems";

function greeting(now = new Date()): string {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
}

function TodayCard({ item }: { item: TodayItem }) {
    const Icon = item.icon;
    return (
        <Link
            to={item.to}
            className="group flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card transition-colors hover:border-accent-300 hover:bg-accent-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
            <div className="flex items-start justify-between gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-control bg-brand-50 text-brand-700">
                    <Icon className="h-4.5 w-4.5" aria-hidden />
                </span>
                <span className="rounded-full bg-highlight px-2.5 py-0.5 text-sm font-semibold tabular-nums text-highlight-ink">
                    {(item.count ?? 0).toLocaleString("en-IN")}
                </span>
            </div>
            <div className="min-w-0">
                <p className="font-medium text-ink">{item.label}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{item.description}</p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-accent-700">
                Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
        </Link>
    );
}

function SkeletonCard() {
    return (
        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card" aria-hidden>
            <div className="flex items-start justify-between">
                <div className="h-9 w-9 animate-pulse rounded-control bg-brand-50" />
                <div className="h-6 w-10 animate-pulse rounded-full bg-brand-50" />
            </div>
            <div className="h-4 w-1/2 animate-pulse rounded bg-brand-50" />
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-brand-50" />
        </div>
    );
}

/** The to-do inbox: what needs an admin today, with counts and links. */
export function TodayPage() {
    const user = useAuthStore((s) => s.user);
    const queryClient = useQueryClient();
    const fetching = useIsFetching({ queryKey: ["today"] }) > 0;
    const items = useTodayItems();

    // A card whose call fails hides itself.
    const shown = items.filter((i) => !i.isError);
    const loading = shown.filter((i) => i.isLoading);
    const needs = shown.filter((i) => !i.isLoading && (i.count ?? 0) > 0);
    const clear = shown.filter((i) => !i.isLoading && (i.count ?? 0) === 0);

    const firstName = user?.first_name?.trim();

    return (
        <div className="space-y-6">
            <PageHeader
                icon={Sun}
                title="Today"
                description={`${greeting()}${firstName ? `, ${firstName}` : ""}. Here's what needs you.`}
                actions={
                    <>
                        <Button
                            variant="secondary"
                            icon={RefreshCw}
                            loading={fetching}
                            onClick={() => queryClient.invalidateQueries({ queryKey: ["today"] })}
                        >
                            Refresh
                        </Button>
                        <ButtonLink to="/chat" variant="primary" icon={MessagesSquare}>
                            Open chat
                        </ButtonLink>
                    </>
                }
            />

            <section aria-labelledby="today-needs" className="space-y-3">
                <h2 id="today-needs" className="text-base font-semibold text-ink">
                    Needs you
                </h2>
                {needs.length === 0 && loading.length === 0 ? (
                    <div className="rounded-card border border-line bg-surface shadow-card">
                        <EmptyState
                            icon={CheckCircle2}
                            title={shown.length > 0 ? "You're up to date." : "Nothing to show yet."}
                            description={shown.length > 0 ? "No queues are waiting on you right now." : "None of the queues could be loaded. Try Refresh."}
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {needs.map((item) => (
                            <TodayCard key={item.key} item={item} />
                        ))}
                        {loading.map((item) => (
                            <SkeletonCard key={item.key} />
                        ))}
                    </div>
                )}
            </section>

            {clear.length > 0 && (
                <section aria-labelledby="today-clear" className="space-y-3">
                    <h2 id="today-clear" className="text-base font-semibold text-ink">
                        All clear
                    </h2>
                    <ul className="flex flex-wrap gap-2">
                        {clear.map((item) => (
                            <li key={item.key}>
                                <Link
                                    to={item.to}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-accent-300 hover:text-ink"
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5 text-good" aria-hidden />
                                    {item.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section aria-labelledby="today-more" className="space-y-3">
                <h2 id="today-more" className="text-base font-semibold text-ink">
                    More
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                        { to: "/dashboard", label: "Dashboard", text: "Platform numbers at a glance", icon: LayoutDashboard },
                        { to: "/analytics", label: "Analytics", text: "Growth, revenue and content trends", icon: BarChart3 },
                    ].map((l) => (
                        <Link
                            key={l.to}
                            to={l.to}
                            className={cx(
                                "flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card transition-colors hover:border-accent-300",
                                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
                            )}
                        >
                            <span className="flex h-9 w-9 items-center justify-center rounded-control bg-brand-50 text-brand-700">
                                <l.icon className="h-4.5 w-4.5" aria-hidden />
                            </span>
                            <span className="min-w-0">
                                <span className="block font-medium text-ink">{l.label}</span>
                                <span className="block text-sm text-ink-muted">{l.text}</span>
                            </span>
                            <ArrowRight className="ml-auto h-4 w-4 text-ink-faint" aria-hidden />
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}
