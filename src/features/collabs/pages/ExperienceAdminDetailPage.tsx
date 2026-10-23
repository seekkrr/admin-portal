import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, ExternalLink, EyeOff } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { buttonClass } from "@/components/ui/buttonStyles";
import { ChangeHistoryPanel } from "@/components/detail/ChangeHistoryPanel";
import { Notice } from "@/components/detail/DetailStates";
import { useAdminAccess } from "@/components/detail/useAdminAccess";
import { useDetailTab } from "@/components/detail/useDetailTab";
import { calendarDate, count, rupees } from "@/components/detail/detailFormat";
import { gstTag } from "@/features/experience-payments/money";
import { usePageTitle } from "@/hooks/usePageTitle";
import { experienceDetailApi } from "@/services/admin-detail.service";
import type { ExperienceDetail } from "@/types/admin-detail";
import { businessesService } from "../services/businesses.service";
import { featuresOf, partnerPortalUrl } from "../utils";
import { ExperienceContentTab } from "../components/experience-detail/ExperienceContentTab";
import { ExperiencePricingTab } from "../components/experience-detail/ExperiencePricingTab";
import { ExperienceSlotsTab } from "../components/experience-detail/ExperienceSlotsTab";
import { ExperienceBookingsTab } from "../components/experience-detail/ExperienceBookingsTab";
import { ExperienceStatusTab } from "../components/experience-detail/ExperienceStatusTab";

const TABS = ["content", "pricing", "slots", "bookings", "status", "history"] as const;
type Tab = (typeof TABS)[number];

/** One experience, edited with the business's own routes (admins pass the role check). */
export function ExperienceAdminDetailPage() {
    const { experienceId = "" } = useParams<{ experienceId: string }>();
    const { isStaff, isAdmin } = useAdminAccess();
    const queryClient = useQueryClient();
    const [tab, setTab] = useDetailTab<Tab>(TABS, "content");

    const key = ["experience-detail", experienceId] as const;
    const { data: exp, isLoading, error, refetch } = useQuery({
        queryKey: key,
        queryFn: () => experienceDetailApi.get(experienceId),
        enabled: isStaff && !!experienceId,
        retry: false,
    });
    const business = useQuery({
        queryKey: ["collabs-business", exp?.business_id],
        queryFn: () => businessesService.getById(exp?.business_id ?? ""),
        enabled: !!exp?.business_id,
        staleTime: 60_000,
    });
    usePageTitle(exp?.title);

    if (!isStaff) return <AccessDenied message="You need an admin or moderator role to view experiences." />;
    if (isLoading) return <LoadingState label="Loading experience…" />;
    if (error || !exp) return <ErrorState title="Couldn't load this experience" error={error ?? new Error("Experience not found.")} onRetry={() => refetch()} />;

    const saved = (next: ExperienceDetail) => {
        queryClient.setQueryData(key, next);
        queryClient.invalidateQueries({ queryKey: key });
        queryClient.invalidateQueries({ queryKey: ["admin-experiences"] });
        queryClient.invalidateQueries({ queryKey: ["admin-audit", "experience", exp.id] });
        // Slot prices are computed from the experience / option prices.
        queryClient.invalidateQueries({ queryKey: ["experience-slots", exp.id] });
    };
    const experiencesOff = business.data ? !featuresOf(business.data).experiences : false;
    const businessName = exp.business?.name ?? business.data?.name ?? "Business";

    return (
        <div className="space-y-5">
            <div className="flex items-start gap-4">
                {exp.cover_url ? (
                    <img src={exp.cover_url} alt="" className="h-16 w-20 shrink-0 rounded-card border border-line object-cover" />
                ) : (
                    <span className="flex h-16 w-20 shrink-0 items-center justify-center rounded-card bg-brand-900 text-white">
                        <CalendarRange className="h-6 w-6" aria-hidden />
                    </span>
                )}
                <PageHeader
                    className="min-w-0 flex-1"
                    title={exp.title}
                    badge={<StatusPill status={exp.status} />}
                    description={
                        <span className="flex flex-col gap-1.5">
                            <span>
                                <Link to={`/collabs/businesses/${exp.business_id}`} className="font-medium text-accent-700 hover:underline">
                                    {businessName}
                                </Link>
                                {exp.region_name ? ` · ${exp.region_name}` : ""}
                            </span>
                            <span className="flex flex-wrap gap-1.5">
                                {exp.hidden_by_admin && (
                                    <Tag tone="bad">
                                        <EyeOff className="h-3 w-3" aria-hidden /> Hidden
                                    </Tag>
                                )}
                                <Tag>From {rupees(exp.price_from)}</Tag>
                                {exp.gst?.enabled && <Tag>{gstTag(exp.gst)}</Tag>}
                                <Tag>Next: {calendarDate(exp.next_date)}</Tag>
                                <Tag>{count(exp.stats?.bookings)} bookings</Tag>
                            </span>
                        </span>
                    }
                    actions={
                        <a href={partnerPortalUrl(exp.business_id, exp.id)} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "sm")}>
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Partner Portal
                        </a>
                    }
                />
            </div>

            {experiencesOff && (
                <Notice tone="warn" title={`Experiences are turned off for ${businessName}`}>
                    Editing, slots and bookings use the business's routes, which are closed while the switch is off.{" "}
                    <Link to={`/collabs/businesses/${exp.business_id}`} className="font-medium text-accent-700 hover:underline">
                        Turn it on
                    </Link>
                </Notice>
            )}

            <Tabs<Tab>
                label="Experience sections"
                idPrefix="experience"
                value={tab}
                onChange={setTab}
                tabs={[
                    { value: "content", label: "Content" },
                    { value: "pricing", label: "Pricing" },
                    { value: "slots", label: "Slots" },
                    { value: "bookings", label: "Bookings" },
                    { value: "status", label: "Status" },
                    { value: "history", label: "Change history" },
                ]}
            />

            <div role="tabpanel" id={`experience-panel-${tab}`} aria-labelledby={`experience-tab-${tab}`}>
                {tab === "content" && <ExperienceContentTab experience={exp} canEdit={isAdmin} onSaved={saved} />}
                {tab === "pricing" && <ExperiencePricingTab experience={exp} canEdit={isAdmin} onSaved={saved} />}
                {tab === "slots" && <ExperienceSlotsTab experience={exp} canEdit={isAdmin} />}
                {tab === "bookings" && <ExperienceBookingsTab experience={exp} canEdit={isAdmin} />}
                {tab === "status" && <ExperienceStatusTab experience={exp} canEdit={isAdmin} onChanged={saved} />}
                {tab === "history" && <ChangeHistoryPanel entityType="experience" entityId={exp.id} />}
            </div>
        </div>
    );
}

export default ExperienceAdminDetailPage;
