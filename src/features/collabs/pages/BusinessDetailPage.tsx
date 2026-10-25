import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, ExternalLink, Store } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { buttonClass } from "@/components/ui/buttonStyles";
import { ChangeHistoryPanel } from "@/components/detail/ChangeHistoryPanel";
import { useDetailTab } from "@/components/detail/useDetailTab";
import { usePageTitle } from "@/hooks/usePageTitle";
import { businessesService } from "../services/businesses.service";
import { useCollabAccess } from "../roles";
import { featuresOf, humanize, partnerPortalBusinessUrl } from "../utils";
import { BusinessOverviewTab } from "../components/business-detail/BusinessOverviewTab";
import { BusinessProfileTab } from "../components/business-detail/BusinessProfileTab";
import { BusinessPlacesTab } from "../components/business-detail/BusinessPlacesTab";
import { BusinessTeamTab } from "../components/business-detail/BusinessTeamTab";
import { BusinessCollabsTab } from "../components/business-detail/BusinessCollabsTab";
import { BusinessExperiencesTab } from "../components/business-detail/BusinessExperiencesTab";
import { BusinessOffersTab } from "../components/business-detail/BusinessOffersTab";
import { BusinessBillingTab } from "../components/business-detail/BusinessBillingTab";
import { BusinessEarningsTab } from "../components/business-detail/BusinessEarningsTab";
import { Notice } from "@/components/detail/DetailStates";

const TABS = ["overview", "profile", "places", "team", "collabs", "experiences", "earnings", "offers", "billing", "history"] as const;
type Tab = (typeof TABS)[number];

/** One business: switches, profile, places, team, collabs, experiences, earnings, offers, plan and history. */
export function BusinessDetailPage() {
    const { businessId = "" } = useParams<{ businessId: string }>();
    const { isStaff, isAdmin } = useCollabAccess();
    const [tab, setTab] = useDetailTab<Tab>(TABS, "overview");

    const { data: business, isLoading, error, refetch } = useQuery({
        queryKey: ["collabs-business", businessId],
        queryFn: () => businessesService.getById(businessId),
        enabled: isStaff && !!businessId,
    });
    usePageTitle(business?.name);

    if (!isStaff) return <AccessDenied message="You need an admin or moderator role to view businesses." />;
    if (isLoading) return <LoadingState label="Loading business…" />;
    if (error || !business) {
        return <ErrorState title="Couldn't load this business" error={error ?? new Error("Business not found.")} onRetry={() => refetch()} />;
    }

    const features = featuresOf(business);
    const publicPage = business.show_on_website && business.verified && business.status === "active";

    return (
        <div className="space-y-5">
            <div className="flex items-start gap-4">
                {business.logo_url ? (
                    <img src={business.logo_url} alt="" className="h-14 w-14 shrink-0 rounded-card border border-line object-cover" />
                ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-card bg-brand-900 text-white">
                        <Store className="h-6 w-6" aria-hidden />
                    </span>
                )}
                <PageHeader
                    className="min-w-0 flex-1"
                    title={
                        <span className="inline-flex items-center gap-2">
                            {business.name}
                            {business.verified && <BadgeCheck className="h-5 w-5 text-accent-600" aria-label="Verified" />}
                        </span>
                    }
                    badge={<StatusPill status={business.status} />}
                    description={
                        <span className="flex flex-col gap-1.5">
                            {business.tagline && <span>{business.tagline}</span>}
                            <span className="flex flex-wrap gap-1.5">
                                <Tag tone="brand">Plan: {humanize(business.plan_code ?? "free")}</Tag>
                                <Tag tone={features.collabs ? "good" : "neutral"}>Collabs {features.collabs ? "on" : "off"}</Tag>
                                <Tag tone={features.experiences ? "good" : "neutral"}>Experiences {features.experiences ? "on" : "off"}</Tag>
                                {business.website_featured && <Tag tone="warn">Featured</Tag>}
                            </span>
                        </span>
                    }
                    actions={
                        <span className="flex flex-wrap gap-2">
                            {publicPage && (
                                <a href={`https://seekkrr.com/places/${business.slug}`} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "sm")}>
                                    <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Public page
                                </a>
                            )}
                            {/* Work on the business as its owner (admin view) in a new tab. */}
                            <a
                                href={partnerPortalBusinessUrl(business.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={buttonClass("secondary", "sm")}
                                title="Opens this business in the Partner Portal as its owner. Sign in there with your admin account."
                            >
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open in Partner Portal
                            </a>
                        </span>
                    }
                />
            </div>

            <Tabs<Tab>
                label="Business sections"
                idPrefix="business"
                value={tab}
                onChange={setTab}
                tabs={[
                    { value: "overview", label: "Overview" },
                    { value: "profile", label: "Profile" },
                    { value: "places", label: "Places", count: business.marker_ids.length },
                    { value: "team", label: "Team", count: business.members.length },
                    { value: "collabs", label: "Collabs" },
                    { value: "experiences", label: "Experiences" },
                    // Money: admins only (moderators hold no financial permissions).
                    ...(isAdmin ? [{ value: "earnings" as const, label: "Earnings & payouts" }] : []),
                    { value: "offers", label: "Check-in offers" },
                    { value: "billing", label: "Billing" },
                    { value: "history", label: "Change history" },
                ]}
            />

            <div role="tabpanel" id={`business-panel-${tab}`} aria-labelledby={`business-tab-${tab}`}>
                {tab === "overview" && <BusinessOverviewTab business={business} isAdmin={isAdmin} isStaff={isStaff} />}
                {tab === "profile" && <BusinessProfileTab business={business} canEdit={isAdmin} />}
                {tab === "places" && <BusinessPlacesTab business={business} canEdit={isAdmin} />}
                {tab === "team" && <BusinessTeamTab business={business} canEdit={isAdmin} />}
                {tab === "collabs" && <BusinessCollabsTab business={business} canEdit={isAdmin} />}
                {tab === "experiences" && <BusinessExperiencesTab business={business} canEdit={isAdmin} />}
                {tab === "earnings" &&
                    (isAdmin ? (
                        <BusinessEarningsTab business={business} canEdit={isAdmin} />
                    ) : (
                        <Notice tone="warn" title="Only admins can see earnings and payouts" />
                    ))}
                {tab === "offers" && <BusinessOffersTab business={business} canEdit={isAdmin} />}
                {tab === "billing" && <BusinessBillingTab business={business} canEdit={isAdmin} />}
                {tab === "history" && <ChangeHistoryPanel entityType="business" entityId={business.id} />}
            </div>
        </div>
    );
}

export default BusinessDetailPage;
