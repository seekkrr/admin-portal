import { StatusPill } from "@/components/ui/StatusPill";
import type { StatusTone } from "@/components/ui/status";

/** Quest statuses are title-cased words ("Under Review"); map them onto the one status chip. */
const QUEST_TONES: Record<string, StatusTone> = {
    Draft: "neutral",
    "Under Review": "warn",
    "Changes Requested": "warn",
    Approved: "info",
    Published: "good",
    Paused: "neutral",
    Rejected: "bad",
    Archived: "neutral",
};

export function QuestStatusPill({ status }: { status: string | null | undefined }) {
    if (!status) return <StatusPill status={null} />;
    return <StatusPill status={status} label={status} tone={QUEST_TONES[status] ?? "neutral"} />;
}
