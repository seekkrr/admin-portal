/** Admin routes of records: one place for "this id → that page". */

/** Things that have an admin page. */
export type EntityKind =
    | "user"
    | "creator"
    | "quest"
    | "place"
    | "place_request"
    | "region"
    | "business"
    | "business_application"
    | "experience"
    | "event"
    | "narrative"
    | "review"
    | "task"
    | "achievement"
    | "transaction"
    | "refund"
    | "payout"
    | "payout_account"
    | "coupon"
    | "support_query";

const PATHS: Record<EntityKind, (id: string) => string> = {
    user: (id) => `/users/${id}`,
    creator: (id) => `/creators/${id}`,
    quest: (id) => `/quests/${id}`,
    place: (id) => `/markers/${id}`,
    place_request: (id) => `/markers/applications/${id}`,
    region: (id) => `/regions/${id}`,
    business: (id) => `/collabs/businesses/${id}`,
    business_application: () => `/collabs/business-applications`,
    experience: (id) => `/collabs/experiences/${id}`,
    event: (id) => `/events/${id}/edit`,
    narrative: (id) => `/narratives/${id}`,
    review: (id) => `/reviews/${id}`,
    task: (id) => `/task-configs/${id}`,
    achievement: (id) => `/achievements/${id}`,
    transaction: (id) => `/transactions/${id}`,
    refund: (id) => `/refunds/${id}`,
    payout: (id) => `/payouts/${id}`,
    payout_account: (id) => `/payout-accounts/${id}`,
    coupon: (id) => `/coupons/${id}`,
    support_query: (id) => `/support-queries/${id}`,
};

/** Admin route of one record, or null without an id. */
export function entityPath(kind: EntityKind, id: string | null | undefined): string | null {
    if (!id) return null;
    return PATHS[kind](encodeURIComponent(id));
}

/** Map backend entity type names (audit log, search) onto portal kinds. */
export function kindOf(type: string | null | undefined): EntityKind | null {
    switch ((type ?? "").toLowerCase()) {
        case "user":
        case "users":
            return "user";
        case "creator":
            return "creator";
        case "quest":
        case "quests":
            return "quest";
        case "place":
        case "marker":
        case "markers":
            return "place";
        case "region":
        case "regions":
            return "region";
        case "business":
        case "business_profiles":
            return "business";
        case "experience":
        case "experiences":
            return "experience";
        case "event":
        case "events":
            return "event";
        case "narrative":
            return "narrative";
        case "review":
            return "review";
        case "transaction":
            return "transaction";
        case "refund":
            return "refund";
        case "payout":
            return "payout";
        case "coupon":
            return "coupon";
        default:
            return null;
    }
}

/** `65f1c2…9a4b` — short form of a long id for tables. */
export function shortIdOf(id: string, lead = 6, tail = 4): string {
    return id.length <= lead + tail + 1 ? id : `${id.slice(0, lead)}…${id.slice(-tail)}`;
}
