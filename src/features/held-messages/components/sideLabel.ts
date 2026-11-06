const SIDE_LABEL: Record<string, string> = { creator: "Creator", business: "Business", system: "SeekKrr" };

/** Who wrote a chat message, as a label. */
export function sideLabel(side: string | null): string {
    return (side && SIDE_LABEL[side]) || "Member";
}
