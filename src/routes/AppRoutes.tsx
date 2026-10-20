import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { AccessDeniedPage } from "@/features/auth/pages/AccessDeniedPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { LoadingFallback } from "@components/LoadingFallback";

// Lazy-loaded page components
const DashboardPage = lazy(() => import("@/features/dashboard/pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const UsersPage = lazy(() => import("@/features/users/pages/UsersPage").then(m => ({ default: m.UsersPage })));
const CreatorsPage = lazy(() => import("@/features/creators/pages/CreatorsPage").then(m => ({ default: m.CreatorsPage })));
const CreatorEditPage = lazy(() => import("@/features/creators/pages/CreatorEditPage").then(m => ({ default: m.CreatorEditPage })));
const CreatorApplicationsPage = lazy(() => import("@/features/creator-applications/pages/CreatorApplicationsPage").then(m => ({ default: m.CreatorApplicationsPage })));
const QuestsPage = lazy(() => import("@/features/quests/pages/QuestsPage").then(m => ({ default: m.QuestsPage })));
const QuestDetailPage = lazy(() => import("@/features/quests/pages/QuestDetailPage").then(m => ({ default: m.QuestDetailPage })));
const EventsPage = lazy(() => import("@/features/events/pages/EventsPage").then(m => ({ default: m.EventsPage })));
const TimelineFiltersPage = lazy(() => import("@/features/timeline-filters/pages/TimelineFiltersPage").then(m => ({ default: m.TimelineFiltersPage })));
const NotificationAccessPage = lazy(() => import("@/features/notification-access/pages/NotificationAccessPage").then(m => ({ default: m.NotificationAccessPage })));
const SupportQueriesPage = lazy(() => import("@/features/support-queries/pages/SupportQueriesPage").then(m => ({ default: m.SupportQueriesPage })));
const SupportQueryDetailPage = lazy(() => import("@/features/support-queries/pages/SupportQueryDetailPage").then(m => ({ default: m.SupportQueryDetailPage })));
const AnalyticsPage = lazy(() => import("@/features/analytics/pages/AnalyticsPage").then(m => ({ default: m.AnalyticsPage })));
// Section 8 — Markers
const MarkersPage = lazy(() => import("@/features/markers/pages/MarkersPage").then(m => ({ default: m.MarkersPage })));
const MarkerDetailPage = lazy(() => import("@/features/markers/pages/MarkerDetailPage").then(m => ({ default: m.MarkerDetailPage })));
const MarkerApplicationsPage = lazy(() => import("@/features/markers/pages/MarkerApplicationsPage").then(m => ({ default: m.MarkerApplicationsPage })));
const MarkerApplicationDetailPage = lazy(() => import("@/features/markers/pages/MarkerApplicationDetailPage").then(m => ({ default: m.MarkerApplicationDetailPage })));
// Section 9 — Narratives & Reviews
const NarrativesPage = lazy(() => import("@/features/content/pages/NarrativesPage").then(m => ({ default: m.NarrativesPage })));
const NarrativeDetailPage = lazy(() => import("@/features/content/pages/NarrativeDetailPage").then(m => ({ default: m.NarrativeDetailPage })));
const ReviewsPage = lazy(() => import("@/features/content/pages/ReviewsPage").then(m => ({ default: m.ReviewsPage })));
const ReviewDetailPage = lazy(() => import("@/features/content/pages/ReviewDetailPage").then(m => ({ default: m.ReviewDetailPage })));
// Section 11 — Regions
const RegionsPage = lazy(() => import("@/features/regions/pages/RegionsPage").then(m => ({ default: m.RegionsPage })));
const RegionDetailPage = lazy(() => import("@/features/regions/pages/RegionDetailPage").then(m => ({ default: m.RegionDetailPage })));
const ExploreMapPage = lazy(() => import("@/features/explore-map/pages/ExploreMapPage").then(m => ({ default: m.ExploreMapPage })));
// Section 10 — Achievements & Leaderboards
const AchievementsPage = lazy(() => import("@/features/achievements/pages/AchievementsPage").then(m => ({ default: m.AchievementsPage })));
const AchievementDetailPage = lazy(() => import("@/features/achievements/pages/AchievementDetailPage").then(m => ({ default: m.AchievementDetailPage })));
const LeaderboardsPage = lazy(() => import("@/features/achievements/pages/LeaderboardsPage").then(m => ({ default: m.LeaderboardsPage })));
// Section 12 — Task Configs & Step Rewards
const TaskConfigsPage = lazy(() => import("@/features/task-configs/pages/TaskConfigsPage").then(m => ({ default: m.TaskConfigsPage })));
const TaskConfigDetailPage = lazy(() => import("@/features/task-configs/pages/TaskConfigDetailPage").then(m => ({ default: m.TaskConfigDetailPage })));
// Section 14 — Progress Tracking
const ProgressPage = lazy(() => import("@/features/progress/pages/ProgressPage").then(m => ({ default: m.ProgressPage })));
// Section 6 — Financial: Transactions & Refunds
// Section 6 — Financial: Transactions & Refunds
const BusinessOffersPage = lazy(() =>
    import("@features/business-offers/pages/BusinessOffersPage").then((m) => ({ default: m.BusinessOffersPage }))
);
const TransactionsPage = lazy(() => import("@/features/financial/pages/TransactionsPage").then(m => ({ default: m.TransactionsPage })));
const TransactionDetailPage = lazy(() => import("@/features/financial/pages/TransactionDetailPage").then(m => ({ default: m.TransactionDetailPage })));
const RefundsPage = lazy(() => import("@/features/financial/pages/RefundsPage").then(m => ({ default: m.RefundsPage })));
const RefundDetailPage = lazy(() => import("@/features/financial/pages/RefundDetailPage").then(m => ({ default: m.RefundDetailPage })));
const PaymentEventsPage = lazy(() => import("@/features/financial/pages/PaymentEventsPage").then(m => ({ default: m.PaymentEventsPage })));
// Section 7 — Financial: Payout Accounts & Payouts
const PayoutAccountsPage = lazy(() => import("@/features/payouts/pages/PayoutAccountsPage").then(m => ({ default: m.PayoutAccountsPage })));
const PayoutAccountDetailPage = lazy(() => import("@/features/payouts/pages/PayoutAccountDetailPage").then(m => ({ default: m.PayoutAccountDetailPage })));
const PayoutsPage = lazy(() => import("@/features/payouts/pages/PayoutsPage").then(m => ({ default: m.PayoutsPage })));
const PayoutDetailPage = lazy(() => import("@/features/payouts/pages/PayoutDetailPage").then(m => ({ default: m.PayoutDetailPage })));
// Coupons — discount codes
const CouponsPage = lazy(() => import("@/features/coupons/pages/CouponsPage").then(m => ({ default: m.CouponsPage })));
const CouponDetailPage = lazy(() => import("@/features/coupons/pages/CouponDetailPage").then(m => ({ default: m.CouponDetailPage })));
// Collabs — creator × business
const CollabsOverviewPage = lazy(() => import("@/features/collabs/pages/CollabsOverviewPage").then(m => ({ default: m.CollabsOverviewPage })));
const BusinessApplicationsPage = lazy(() => import("@/features/collabs/pages/BusinessApplicationsPage").then(m => ({ default: m.BusinessApplicationsPage })));
const BusinessesPage = lazy(() => import("@/features/collabs/pages/BusinessesPage").then(m => ({ default: m.BusinessesPage })));
const BusinessDetailPage = lazy(() => import("@/features/collabs/pages/BusinessDetailPage").then(m => ({ default: m.BusinessDetailPage })));
const CollabModerationPage = lazy(() => import("@/features/collabs/pages/ModerationPage").then(m => ({ default: m.ModerationPage })));
const CollabReportsPage = lazy(() => import("@/features/collabs/pages/ReportsPage").then(m => ({ default: m.ReportsPage })));
const FraudFlagsPage = lazy(() => import("@/features/collabs/pages/FraudFlagsPage").then(m => ({ default: m.FraudFlagsPage })));
const CollabApplicationsPage = lazy(() => import("@/features/collabs/pages/CollabApplicationsPage").then(m => ({ default: m.CollabApplicationsPage })));
const CollabCreatorsPage = lazy(() => import("@/features/collabs/pages/CollabCreatorsPage").then(m => ({ default: m.CollabCreatorsPage })));
const PlansBillingPage = lazy(() => import("@/features/collabs/pages/PlansBillingPage").then(m => ({ default: m.PlansBillingPage })));
const MatchTuningPage = lazy(() => import("@/features/collabs/pages/MatchTuningPage").then(m => ({ default: m.MatchTuningPage })));
const RolloutPage = lazy(() => import("@/features/collabs/pages/RolloutPage").then(m => ({ default: m.RolloutPage })));
// Platform — email templates
const EmailTemplatesPage = lazy(() => import("@/features/email-templates/pages/EmailTemplatesPage").then(m => ({ default: m.EmailTemplatesPage })));
const EmailTemplateEditorPage = lazy(() => import("@/features/email-templates/pages/EmailTemplateEditorPage").then(m => ({ default: m.EmailTemplateEditorPage })));

export const AppRoutes = () => {
    return (
        <Routes>
            {/* Public Auth Routes */}
            <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/access-denied" element={<AccessDeniedPage />} />
            </Route>

            {/* Protected Routes */}
            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <DashboardLayout />
                    </ProtectedRoute>
                }
            >
                <Route
                    path="business-offers"
                    element={
                        <ProtectedRoute>
                            <BusinessOffersPage />
                        </ProtectedRoute>
                    }
                />
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={
                    <Suspense fallback={<LoadingFallback message="Loading dashboard..." />}>
                        <DashboardPage />
                    </Suspense>
                } />
                {/* Legacy /stats page removed (depended on V1-only interest endpoint); redirect to dashboard */}
                <Route path="stats" element={<Navigate to="/dashboard" replace />} />
                <Route path="users" element={
                    <Suspense fallback={<LoadingFallback message="Loading users..." />}>
                        <UsersPage />
                    </Suspense>
                } />
                <Route path="creators" element={
                    <Suspense fallback={<LoadingFallback message="Loading creators..." />}>
                        <CreatorsPage />
                    </Suspense>
                } />
                <Route path="creators/:creatorId" element={
                    <Suspense fallback={<LoadingFallback message="Loading creator..." />}>
                        <CreatorEditPage />
                    </Suspense>
                } />
                <Route path="creator-applications" element={
                    <Suspense fallback={<LoadingFallback message="Loading applications..." />}>
                        <CreatorApplicationsPage />
                    </Suspense>
                } />
                <Route path="quests" element={
                    <Suspense fallback={<LoadingFallback message="Loading quests..." />}>
                        <QuestsPage />
                    </Suspense>
                } />
                <Route path="quests/:questId" element={
                    <Suspense fallback={<LoadingFallback message="Loading quest..." />}>
                        <QuestDetailPage />
                    </Suspense>
                } />
                <Route path="events" element={
                    <Suspense fallback={<LoadingFallback message="Loading events..." />}>
                        <EventsPage />
                    </Suspense>
                } />
                <Route path="notification-access" element={
                    <Suspense fallback={<LoadingFallback message="Loading notification access..." />}>
                        <NotificationAccessPage />
                    </Suspense>
                } />
                <Route path="timeline-filters" element={
                    <Suspense fallback={<LoadingFallback message="Loading timeline filters..." />}>
                        <TimelineFiltersPage />
                    </Suspense>
                } />
                <Route path="support-queries" element={
                    <Suspense fallback={<LoadingFallback message="Loading support queries..." />}>
                        <SupportQueriesPage />
                    </Suspense>
                } />
                <Route path="support-queries/:queryId" element={
                    <Suspense fallback={<LoadingFallback message="Loading query details..." />}>
                        <SupportQueryDetailPage />
                    </Suspense>
                } />
                <Route path="analytics" element={
                    <Suspense fallback={<LoadingFallback message="Loading analytics..." />}>
                        <AnalyticsPage />
                    </Suspense>
                } />

                {/* Section 8 — Markers (static paths before :markerId) */}
                <Route path="markers" element={
                    <Suspense fallback={<LoadingFallback message="Loading markers..." />}>
                        <MarkersPage />
                    </Suspense>
                } />
                <Route path="markers/applications" element={
                    <Suspense fallback={<LoadingFallback message="Loading applications..." />}>
                        <MarkerApplicationsPage />
                    </Suspense>
                } />
                <Route path="markers/applications/:appId" element={
                    <Suspense fallback={<LoadingFallback message="Loading application..." />}>
                        <MarkerApplicationDetailPage />
                    </Suspense>
                } />
                <Route path="markers/:markerId" element={
                    <Suspense fallback={<LoadingFallback message="Loading marker..." />}>
                        <MarkerDetailPage />
                    </Suspense>
                } />

                {/* Section 9 — Narratives & Reviews */}
                <Route path="narratives" element={
                    <Suspense fallback={<LoadingFallback message="Loading narratives..." />}>
                        <NarrativesPage />
                    </Suspense>
                } />
                <Route path="narratives/:narrativeId" element={
                    <Suspense fallback={<LoadingFallback message="Loading narrative..." />}>
                        <NarrativeDetailPage />
                    </Suspense>
                } />
                <Route path="reviews" element={
                    <Suspense fallback={<LoadingFallback message="Loading reviews..." />}>
                        <ReviewsPage />
                    </Suspense>
                } />
                <Route path="reviews/:reviewId" element={
                    <Suspense fallback={<LoadingFallback message="Loading review..." />}>
                        <ReviewDetailPage />
                    </Suspense>
                } />

                {/* Section 11 — Regions */}
                <Route path="regions" element={
                    <Suspense fallback={<LoadingFallback message="Loading regions..." />}>
                        <RegionsPage />
                    </Suspense>
                } />
                <Route path="regions/:regionId" element={
                    <Suspense fallback={<LoadingFallback message="Loading region..." />}>
                        <RegionDetailPage />
                    </Suspense>
                } />
                {/* Explore map — admin-only region order & presentation */}
                <Route path="explore-map" element={
                    <Suspense fallback={<LoadingFallback message="Loading explore map..." />}>
                        <ExploreMapPage />
                    </Suspense>
                } />

                {/* Section 12 — Task Configs (static before :taskId) */}
                <Route path="task-configs" element={
                    <Suspense fallback={<LoadingFallback message="Loading task configs..." />}>
                        <TaskConfigsPage />
                    </Suspense>
                } />
                <Route path="task-configs/:taskId" element={
                    <Suspense fallback={<LoadingFallback message="Loading task config..." />}>
                        <TaskConfigDetailPage />
                    </Suspense>
                } />

                {/* Section 10 — Achievements & Leaderboards */}
                <Route path="achievements" element={
                    <Suspense fallback={<LoadingFallback message="Loading achievements..." />}>
                        <AchievementsPage />
                    </Suspense>
                } />
                <Route path="achievements/:achievementId" element={
                    <Suspense fallback={<LoadingFallback message="Loading achievement..." />}>
                        <AchievementDetailPage />
                    </Suspense>
                } />
                <Route path="leaderboards" element={
                    <Suspense fallback={<LoadingFallback message="Loading leaderboards..." />}>
                        <LeaderboardsPage />
                    </Suspense>
                } />

                {/* Section 14 — Progress Tracking (read-only) */}
                <Route path="progress" element={
                    <Suspense fallback={<LoadingFallback message="Loading progress..." />}>
                        <ProgressPage />
                    </Suspense>
                } />

                {/* Section 6 — Financial: Transactions & Refunds (static before :id) */}
                <Route path="transactions" element={
                    <Suspense fallback={<LoadingFallback message="Loading transactions..." />}>
                        <TransactionsPage />
                    </Suspense>
                } />
                <Route path="transactions/:transactionId" element={
                    <Suspense fallback={<LoadingFallback message="Loading transaction..." />}>
                        <TransactionDetailPage />
                    </Suspense>
                } />
                <Route path="refunds" element={
                    <Suspense fallback={<LoadingFallback message="Loading refunds..." />}>
                        <RefundsPage />
                    </Suspense>
                } />
                <Route path="refunds/:refundId" element={
                    <Suspense fallback={<LoadingFallback message="Loading refund..." />}>
                        <RefundDetailPage />
                    </Suspense>
                } />
                <Route path="payment-events" element={
                    <Suspense fallback={<LoadingFallback message="Loading payment events..." />}>
                        <PaymentEventsPage />
                    </Suspense>
                } />

                {/* Section 7 — Financial: Payout Accounts & Payouts (static before :id) */}
                <Route path="payout-accounts" element={
                    <Suspense fallback={<LoadingFallback message="Loading payout accounts..." />}>
                        <PayoutAccountsPage />
                    </Suspense>
                } />
                <Route path="payout-accounts/:accountId" element={
                    <Suspense fallback={<LoadingFallback message="Loading payout account..." />}>
                        <PayoutAccountDetailPage />
                    </Suspense>
                } />
                <Route path="payouts" element={
                    <Suspense fallback={<LoadingFallback message="Loading payouts..." />}>
                        <PayoutsPage />
                    </Suspense>
                } />
                <Route path="payouts/:payoutId" element={
                    <Suspense fallback={<LoadingFallback message="Loading payout..." />}>
                        <PayoutDetailPage />
                    </Suspense>
                } />

                {/* Coupons — discount codes (static before :couponId) */}
                <Route path="coupons" element={
                    <Suspense fallback={<LoadingFallback message="Loading coupons..." />}>
                        <CouponsPage />
                    </Suspense>
                } />
                <Route path="coupons/:couponId" element={
                    <Suspense fallback={<LoadingFallback message="Loading coupon..." />}>
                        <CouponDetailPage />
                    </Suspense>
                } />

                {/* Collabs — creator × business (static paths before :businessId) */}
                <Route path="collabs" element={<Navigate to="/collabs/overview" replace />} />
                <Route path="collabs/overview" element={
                    <Suspense fallback={<LoadingFallback message="Loading collabs overview..." />}>
                        <CollabsOverviewPage />
                    </Suspense>
                } />
                <Route path="collabs/business-applications" element={
                    <Suspense fallback={<LoadingFallback message="Loading business applications..." />}>
                        <BusinessApplicationsPage />
                    </Suspense>
                } />
                <Route path="collabs/businesses" element={
                    <Suspense fallback={<LoadingFallback message="Loading businesses..." />}>
                        <BusinessesPage />
                    </Suspense>
                } />
                <Route path="collabs/businesses/:businessId" element={
                    <Suspense fallback={<LoadingFallback message="Loading business..." />}>
                        <BusinessDetailPage />
                    </Suspense>
                } />
                <Route path="collabs/moderation" element={
                    <Suspense fallback={<LoadingFallback message="Loading moderation queue..." />}>
                        <CollabModerationPage />
                    </Suspense>
                } />
                <Route path="collabs/reports" element={
                    <Suspense fallback={<LoadingFallback message="Loading reports..." />}>
                        <CollabReportsPage />
                    </Suspense>
                } />
                <Route path="collabs/fraud-flags" element={
                    <Suspense fallback={<LoadingFallback message="Loading fraud flags..." />}>
                        <FraudFlagsPage />
                    </Suspense>
                } />
                <Route path="collabs/applications" element={
                    <Suspense fallback={<LoadingFallback message="Loading collab requests..." />}>
                        <CollabApplicationsPage />
                    </Suspense>
                } />
                <Route path="collabs/creators" element={
                    <Suspense fallback={<LoadingFallback message="Loading collab creators..." />}>
                        <CollabCreatorsPage />
                    </Suspense>
                } />
                <Route path="collabs/billing" element={
                    <Suspense fallback={<LoadingFallback message="Loading plans & billing..." />}>
                        <PlansBillingPage />
                    </Suspense>
                } />
                <Route path="collabs/match" element={
                    <Suspense fallback={<LoadingFallback message="Loading match tuning..." />}>
                        <MatchTuningPage />
                    </Suspense>
                } />
                <Route path="collabs/rollout" element={
                    <Suspense fallback={<LoadingFallback message="Loading rollout..." />}>
                        <RolloutPage />
                    </Suspense>
                } />

                {/* Platform — email templates (keys contain dots; links encode them) */}
                <Route path="email-templates" element={
                    <Suspense fallback={<LoadingFallback message="Loading email templates..." />}>
                        <EmailTemplatesPage />
                    </Suspense>
                } />
                <Route path="email-templates/:key" element={
                    <Suspense fallback={<LoadingFallback message="Loading template..." />}>
                        <EmailTemplateEditorPage />
                    </Suspense>
                } />
            </Route>
        </Routes>
    );
};
