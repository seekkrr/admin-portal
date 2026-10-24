export type StatusTone = "good" | "warn" | "bad" | "info" | "neutral" | "brand";

/** One status → colour map for the whole portal. Unknown statuses are neutral. */
const TONE_OF: Record<string, StatusTone> = {
    // waiting on someone
    pending: "warn",
    requested: "warn",
    pending_claim: "warn",
    open: "warn",
    invited: "warn",
    initiated: "warn",
    processing: "warn",
    verifying: "warn",
    in_review: "warn",
    changes_requested: "warn",
    overdue: "warn",
    // fine / done
    approved: "good",
    active: "good",
    published: "good",
    verified: "good",
    completed: "good",
    redeemed: "good",
    captured: "good",
    success: "good",
    succeeded: "good",
    paid: "good",
    visible: "good",
    // stopped / failed
    rejected: "bad",
    declined: "bad",
    suspended: "bad",
    cancelled: "bad",
    canceled: "bad",
    no_show: "bad",
    halted: "bad",
    failed: "bad",
    deleted: "bad",
    banned: "bad",
    // informational
    delivered: "info",
    trialing: "info",
    actioned: "info",
    scheduled: "info",
    // quiet
    resolved: "neutral",
    expired: "neutral",
    archived: "neutral",
    paused: "neutral",
    draft: "neutral",
    dismissed: "neutral",
    hidden: "neutral",
    free: "neutral",
};

const LABELS: Record<string, string> = { pending_claim: "No owner yet", no_show: "No-show" };

export function statusTone(status: string | null | undefined): StatusTone {
    return (status && TONE_OF[status.toLowerCase()]) || "neutral";
}

export function humanizeStatus(status: string): string {
    return LABELS[status] ?? status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
