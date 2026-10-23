import type { StatusTone } from "@/components/ui/status";
import type { NarrativeAudioStatus, NarrativeStatus } from "@/types";

export const NARRATIVE_STATUS: Record<NarrativeStatus, { label: string; tone: StatusTone }> = {
    draft: { label: "Draft", tone: "neutral" },
    under_review: { label: "Under review", tone: "warn" },
    approved: { label: "Approved", tone: "good" },
    rejected: { label: "Rejected", tone: "bad" },
    archived: { label: "Archived", tone: "neutral" },
};

export const AUDIO_STATUS: Record<NarrativeAudioStatus, { label: string; tone: StatusTone }> = {
    pending: { label: "No audio", tone: "neutral" },
    generating: { label: "Generating", tone: "info" },
    ready: { label: "Ready", tone: "good" },
    failed: { label: "Failed", tone: "bad" },
    quota_exceeded: { label: "Quota exceeded", tone: "warn" },
};

export function narrativeStatusLabel(status: NarrativeStatus): string {
    return NARRATIVE_STATUS[status]?.label ?? status;
}

export function audioStatusLabel(status: NarrativeAudioStatus): string {
    return AUDIO_STATUS[status]?.label ?? status;
}
