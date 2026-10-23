import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { AccessDeniedPage } from "@/features/auth/pages/AccessDeniedPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { RequireRole } from "./RequireRole";
import { LoadingFallback } from "@components/LoadingFallback";
import { NotFoundPage } from "@/components/shell/NotFoundPage";
import { ADMIN_NAV_ROLES, FINANCE_ROLES } from "@/config/navigation";

// Lazy-loaded page components
// Today — the to-do inbox (default page after login)
const TodayPage = lazy(() => import("@/features/today/pages/TodayPage").then(m => ({ default: m.TodayPage })));
// Command chat (no AI) — built in src/features/command-chat
const CommandChatPage = lazy(() => import("@/features/command-chat/pages/CommandChatPage"));
const DashboardPage = lazy(() => import("@/features/dashboard/pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const UsersPage = lazy(() => import("@/features/users/pages/UsersPage").then(m => ({ default: m.UsersPage })));
const UserDetailPage = lazy(() => import("@/features/users/pages/UserDetailPage"));
const CreatorsPage = lazy(() => import("@/features/creators/pages/CreatorsPage").then(m => ({ default: m.CreatorsPage })));
const CreatorEditPage = lazy(() => import("@/features/creators/pages/CreatorEditPage").then(m => ({ default: m.CreatorEditPage })));
const CreatorApplicationsPage = lazy(() => import("@/features/creator-applications/pages/CreatorApplicationsPage").then(m => ({ default: m.CreatorApplicationsPage })));
const QuestsPage = lazy(() => import("@/features/quests/pages/QuestsPage").then(m => ({ default: m.QuestsPage })));
const QuestDetailPage = lazy(() => import("@/features/quests/pages/QuestDetailPage").then(m => ({ default: m.QuestDetailPage })));
const EventsPage = lazy(() => import("@/features/events/pages/EventsPage").then(m => ({ default: m.EventsPage })));
const EventEditorPage = lazy(() => import("@/features/events/pages/EventEditorPage"));
const TimelineFiltersPage = lazy(() => import("@/features/timeline-filters/pages/TimelineFiltersPage").then(m => ({ default: m.TimelineFiltersPage })));
const NotificationAccessPage = lazy(() => import("@/features/notification-access/pages/NotificationAccessPage").then(m => ({ default: m.NotificationAccessPage })));
const SupportQueriesPage = lazy(() => import("@/features/support-queries/pages/SupportQueriesPage").then(m => ({ default: m.SupportQueriesPage })));
const SupportQueryDetailPage = lazy(() => import("@/features/support-queries/pages/SupportQueryDetailPage").then(m => ({ default: m.SupportQueryDetailPage })));
const AnalyticsPage = lazy(() => import("@/features/analytics/pages/AnalyticsPage").then(m => ({ default: m.AnalyticsPage })));
// Places and map
const MarkersPage = lazy(() => import("@/features/markers/pages/MarkersPage").then(m => ({ default: m.MarkersPage })));
const MarkerDetailPage = lazy(() => import("@/features/markers/pages/MarkerDetailPage").then(m => ({ default: m.MarkerDetailPage })));
const MarkerApplicationsPage = lazy(() => import("@/features/markers/pages/MarkerApplicationsPage").then(m => ({ default: m.MarkerApplicationsPage })));
const MarkerApplicationDetailPage = lazy(() => import("@/features/markers/pages/MarkerApplicationDetailPage").then(m => ({ default: m.MarkerApplicationDetailPage })));
const RegionsPage = lazy(() => import("@/features/regions/pages/RegionsPage").then(m => ({ default: m.RegionsPage })));
const RegionDetailPage = lazy(() => import("@/features/regions/pages/RegionDetailPage").then(m => ({ default: m.RegionDetailPage })));
const ExploreMapPage = lazy(() => import("@/features/explore-map/pages/ExploreMapPage").then(m => ({ default: m.ExploreMapPage })));
const PlaceCategoriesPage = lazy(() => import("@/features/place-categories/pages/PlaceCategoriesPage").then(m => ({ default: m.PlaceCategoriesPage })));
// Content
const NarrativesPage = lazy(() => import("@/features/content/pages/NarrativesPage").then(m => ({ default: m.NarrativesPage })));
const NarrativeDetailPage = lazy(() => import("@/features/content/pages/NarrativeDetailPage").then(m => ({ default: m.NarrativeDetailPage })));
const ReviewsPage = lazy(() => import("@/features/content/pages/ReviewsPage").then(m => ({ default: m.ReviewsPage })));
const ReviewDetailPage = lazy(() => import("@/features/content/pages/ReviewDetailPage").then(m => ({ default: m.ReviewDetailPage })));
const AchievementsPage = lazy(() => import("@/features/achievements/pages/AchievementsPage").then(m => ({ default: m.AchievementsPage })));
const AchievementDetailPage = lazy(() => import("@/features/achievements/pages/AchievementDetailPage").then(m => ({ default: m.AchievementDetailPage })));
const LeaderboardsPage = lazy(() => import("@/features/achievements/pages/LeaderboardsPage").then(m => ({ default: m.LeaderboardsPage })));
const TaskConfigsPage = lazy(() => import("@/features/task-configs/pages/TaskConfigsPage").then(m => ({ default: m.TaskConfigsPage })));
const TaskConfigDetailPage = lazy(() => import("@/features/task-configs/pages/TaskConfigDetailPage").then(m => ({ default: m.TaskConfigDetailPage })));
const ProgressPage = lazy(() => import("@/features/progress/pages/ProgressPage").then(m => ({ default: m.ProgressPage })));
// Money
const TransactionsPage = lazy(() => import("@/features/financial/pages/TransactionsPage").then(m => ({ default: m.TransactionsPage })));
const TransactionDetailPage = lazy(() => import("@/features/financial/pages/TransactionDetailPage").then(m => ({ default: m.TransactionDetailPage })));
const QuestBookingsPage = lazy(() => import("@/features/quest-bookings/pages/QuestBookingsPage").then(m => ({ default: m.QuestBookingsPage })));
const RefundsPage = lazy(() => import("@/features/financial/pages/RefundsPage").then(m => ({ default: m.RefundsPage })));
const RefundDetailPage = lazy(() => import("@/features/financial/pages/RefundDetailPage").then(m => ({ default: m.RefundDetailPage })));
const PaymentEventsPage = lazy(() => import("@/features/financial/pages/PaymentEventsPage").then(m => ({ default: m.PaymentEventsPage })));
const PayoutAccountsPage = lazy(() => import("@/features/payouts/pages/PayoutAccountsPage").then(m => ({ default: m.PayoutAccountsPage })));
const PayoutAccountDetailPage = lazy(() => import("@/features/payouts/pages/PayoutAccountDetailPage").then(m => ({ default: m.PayoutAccountDetailPage })));
const PayoutsPage = lazy(() => import("@/features/payouts/pages/PayoutsPage").then(m => ({ default: m.PayoutsPage })));
const PayoutDetailPage = lazy(() => import("@/features/payouts/pages/PayoutDetailPage").then(m => ({ default: m.PayoutDetailPage })));
const ExperiencePaymentsPage = lazy(() => import("@/features/experience-payments/pages/ExperiencePaymentsPage"));
const CouponsPage = lazy(() => import("@/features/coupons/pages/CouponsPage").then(m => ({ default: m.CouponsPage })));
const CouponDetailPage = lazy(() => import("@/features/coupons/pages/CouponDetailPage").then(m => ({ default: m.CouponDetailPage })));
// Businesses — collabs (creator × business), experiences, check-in offers
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
const ExperiencesAdminPage = lazy(() => import("@/features/collabs/pages/ExperiencesAdminPage").then(m => ({ default: m.ExperiencesAdminPage })));
const ExperienceAdminDetailPage = lazy(() => import("@/features/collabs/pages/ExperienceAdminDetailPage"));
const BusinessOffersPage = lazy(() => import("@/features/business-offers/pages/BusinessOffersPage").then(m => ({ default: m.BusinessOffersPage })));
// Trust and safety
const HeldMessagesPage = lazy(() => import("@/features/held-messages/pages/HeldMessagesPage").then(m => ({ default: m.HeldMessagesPage })));
const ChangeHistoryPage = lazy(() => import("@/features/change-history/pages/ChangeHistoryPage").then(m => ({ default: m.ChangeHistoryPage })));
// Settings
const PushMessagesPage = lazy(() => import("@/features/push-messages/pages/PushMessagesPage").then(m => ({ default: m.PushMessagesPage })));
const EmailTemplatesPage = lazy(() => import("@/features/email-templates/pages/EmailTemplatesPage").then(m => ({ default: m.EmailTemplatesPage })));
const EmailTemplateEditorPage = lazy(() => import("@/features/email-templates/pages/EmailTemplateEditorPage").then(m => ({ default: m.EmailTemplateEditorPage })));

/** A lazy page with its own loading message. */
function page(element: ReactNode, message: string) {
    return <Suspense fallback={<LoadingFallback message={message} />}>{element}</Suspense>;
}

/** `/events/<id>` (links from search, change history) opens the event editor. */
function EventEditRedirect() {
    const { eventId } = useParams();
    return <Navigate to={`/events/${eventId ?? ""}/edit`} replace />;
}

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
                <Route index element={<Navigate to="/today" replace />} />
                <Route path="today" element={page(<TodayPage />, "Loading today...")} />
                <Route path="chat" element={page(<CommandChatPage />, "Loading chat...")} />
                <Route path="dashboard" element={page(<DashboardPage />, "Loading dashboard...")} />
                {/* Legacy /stats page removed (depended on V1-only interest endpoint); redirect to dashboard */}
                <Route path="stats" element={<Navigate to="/dashboard" replace />} />
                <Route path="analytics" element={page(<AnalyticsPage />, "Loading analytics...")} />

                {/* People */}
                <Route path="users" element={page(<UsersPage />, "Loading users...")} />
                <Route path="users/:userId" element={page(<UserDetailPage />, "Loading user...")} />
                <Route path="creators" element={page(<CreatorsPage />, "Loading creators...")} />
                <Route path="creators/:creatorId" element={page(<CreatorEditPage />, "Loading creator...")} />
                <Route path="creator-applications" element={page(<CreatorApplicationsPage />, "Loading applications...")} />
                <Route path="notification-access" element={page(<NotificationAccessPage />, "Loading notification access...")} />
                <Route path="support-queries" element={page(<SupportQueriesPage />, "Loading support queries...")} />
                <Route path="support-queries/:queryId" element={page(<SupportQueryDetailPage />, "Loading query details...")} />

                {/* Places and map (static paths before :markerId) */}
                <Route path="markers" element={page(<MarkersPage />, "Loading places...")} />
                <Route path="markers/applications" element={page(<MarkerApplicationsPage />, "Loading place requests...")} />
                <Route path="markers/applications/:appId" element={page(<MarkerApplicationDetailPage />, "Loading place request...")} />
                <Route path="markers/:markerId" element={page(<MarkerDetailPage />, "Loading place...")} />
                <Route path="regions" element={page(<RegionsPage />, "Loading regions...")} />
                <Route path="regions/:regionId" element={page(<RegionDetailPage />, "Loading region...")} />
                {/* Explore map — admin-only region order & presentation */}
                <Route path="explore-map" element={page(<ExploreMapPage />, "Loading explore map...")} />
                <Route
                    path="place-categories"
                    element={page(
                        <RequireRole roles={ADMIN_NAV_ROLES} message="Only admins can manage place categories.">
                            <PlaceCategoriesPage />
                        </RequireRole>,
                        "Loading categories..."
                    )}
                />

                {/* Content */}
                <Route path="quests" element={page(<QuestsPage />, "Loading quests...")} />
                <Route path="quests/:questId" element={page(<QuestDetailPage />, "Loading quest...")} />
                <Route path="narratives" element={page(<NarrativesPage />, "Loading narratives...")} />
                <Route path="narratives/:narrativeId" element={page(<NarrativeDetailPage />, "Loading narrative...")} />
                <Route path="events" element={page(<EventsPage />, "Loading events...")} />
                <Route path="events/new" element={page(<EventEditorPage />, "Loading event editor...")} />
                <Route path="events/:eventId/edit" element={page(<EventEditorPage />, "Loading event...")} />
                <Route path="events/:eventId" element={<EventEditRedirect />} />
                <Route path="timeline-filters" element={page(<TimelineFiltersPage />, "Loading timeline filters...")} />
                <Route path="task-configs" element={page(<TaskConfigsPage />, "Loading task configs...")} />
                <Route path="task-configs/:taskId" element={page(<TaskConfigDetailPage />, "Loading task config...")} />
                <Route path="achievements" element={page(<AchievementsPage />, "Loading achievements...")} />
                <Route path="achievements/:achievementId" element={page(<AchievementDetailPage />, "Loading achievement...")} />
                <Route path="leaderboards" element={page(<LeaderboardsPage />, "Loading leaderboards...")} />
                <Route path="progress" element={page(<ProgressPage />, "Loading progress...")} />

                {/* Businesses (static collabs paths before :businessId / :experienceId) */}
                <Route path="collabs" element={<Navigate to="/collabs/overview" replace />} />
                <Route path="collabs/overview" element={page(<CollabsOverviewPage />, "Loading collabs overview...")} />
                <Route path="collabs/business-applications" element={page(<BusinessApplicationsPage />, "Loading business applications...")} />
                <Route path="collabs/businesses" element={page(<BusinessesPage />, "Loading businesses...")} />
                <Route path="collabs/businesses/:businessId" element={page(<BusinessDetailPage />, "Loading business...")} />
                <Route path="collabs/experiences" element={page(<ExperiencesAdminPage />, "Loading experiences...")} />
                <Route path="collabs/experiences/:experienceId" element={page(<ExperienceAdminDetailPage />, "Loading experience...")} />
                <Route path="collabs/applications" element={page(<CollabApplicationsPage />, "Loading collab requests...")} />
                <Route path="collabs/creators" element={page(<CollabCreatorsPage />, "Loading collab creators...")} />
                <Route
                    path="business-offers"
                    element={page(
                        <RequireRole roles={ADMIN_NAV_ROLES} message="Only admins can view check-in offers.">
                            <BusinessOffersPage />
                        </RequireRole>,
                        "Loading check-in offers..."
                    )}
                />

                {/* Trust and safety */}
                <Route path="collabs/moderation" element={page(<CollabModerationPage />, "Loading moderation queue...")} />
                <Route path="reviews" element={page(<ReviewsPage />, "Loading reviews...")} />
                <Route path="reviews/:reviewId" element={page(<ReviewDetailPage />, "Loading review...")} />
                <Route path="collabs/reports" element={page(<CollabReportsPage />, "Loading reports...")} />
                <Route path="collabs/fraud-flags" element={page(<FraudFlagsPage />, "Loading fraud flags...")} />
                <Route path="held-messages" element={page(<HeldMessagesPage />, "Loading held messages...")} />
                <Route path="change-history" element={page(<ChangeHistoryPage />, "Loading change history...")} />

                {/* Money (static before :id) */}
                <Route path="transactions" element={page(<TransactionsPage />, "Loading transactions...")} />
                <Route path="transactions/:transactionId" element={page(<TransactionDetailPage />, "Loading transaction...")} />
                <Route path="quest-bookings" element={page(<QuestBookingsPage />, "Loading quest bookings...")} />
                <Route
                    path="experience-payments"
                    element={page(
                        <RequireRole roles={FINANCE_ROLES} message="You need an admin or finance role to see experience payments.">
                            <ExperiencePaymentsPage />
                        </RequireRole>,
                        "Loading experience payments..."
                    )}
                />
                <Route path="refunds" element={page(<RefundsPage />, "Loading refunds...")} />
                <Route path="refunds/:refundId" element={page(<RefundDetailPage />, "Loading refund...")} />
                <Route path="payment-events" element={page(<PaymentEventsPage />, "Loading payment events...")} />
                <Route path="payouts" element={page(<PayoutsPage />, "Loading payouts...")} />
                <Route path="payouts/:payoutId" element={page(<PayoutDetailPage />, "Loading payout...")} />
                <Route path="payout-accounts" element={page(<PayoutAccountsPage />, "Loading payout accounts...")} />
                <Route path="payout-accounts/:accountId" element={page(<PayoutAccountDetailPage />, "Loading payout account...")} />
                <Route path="coupons" element={page(<CouponsPage />, "Loading coupons...")} />
                <Route path="coupons/:couponId" element={page(<CouponDetailPage />, "Loading coupon...")} />
                <Route path="collabs/billing" element={page(<PlansBillingPage />, "Loading plans & billing...")} />

                {/* Settings */}
                <Route path="push-messages" element={page(<PushMessagesPage />, "Loading push messages...")} />
                {/* Email template keys contain dots; links encode them */}
                <Route path="email-templates" element={page(<EmailTemplatesPage />, "Loading email templates...")} />
                <Route path="email-templates/:key" element={page(<EmailTemplateEditorPage />, "Loading template...")} />
                <Route path="collabs/rollout" element={page(<RolloutPage />, "Loading rollout...")} />
                <Route path="collabs/match" element={page(<MatchTuningPage />, "Loading match tuning...")} />

                {/* Anything else: a proper "page not found" inside the app frame */}
                <Route path="*" element={<NotFoundPage />} />
            </Route>
        </Routes>
    );
};
