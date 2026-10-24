import { StatusPill } from "@/components/ui/StatusPill";
import type { NarrativeAudioStatus, NarrativeStatus } from "@/types";
import { AUDIO_STATUS, NARRATIVE_STATUS } from "./narrativeStatus";

export function NarrativeStatusPill({ status }: { status: NarrativeStatus | null | undefined }) {
    const s = status ? NARRATIVE_STATUS[status] : undefined;
    return <StatusPill status={status} label={s?.label} tone={s?.tone} />;
}

export function AudioStatusPill({ status }: { status: NarrativeAudioStatus | null | undefined }) {
    const s = status ? AUDIO_STATUS[status] : undefined;
    return <StatusPill status={status} label={s?.label} tone={s?.tone} />;
}
