import type { Achievement, AchievementRarity, AchievementTriggerType, CreateAchievementPayload, UpdateAchievementPayload } from "@/types";
import type { StatusTone } from "@/components/ui/status";
import { humanizeStatus } from "@/components/ui/status";

export const TRIGGER_TYPES: AchievementTriggerType[] = ["xp_threshold", "quests_completed", "markers_visited", "streak_days", "tasks_completed", "manual"];

/** "markers_visited" is shown as places visited. */
export function triggerLabel(t: AchievementTriggerType | string): string {
    if (t === "markers_visited") return "Places visited";
    if (t === "xp_threshold") return "XP threshold";
    return humanizeStatus(t);
}

export const TRIGGER_OPTIONS = TRIGGER_TYPES.map((t) => ({ value: t, label: triggerLabel(t) }));

export const RARITIES: AchievementRarity[] = ["common", "rare", "epic", "legendary"];

export const RARITY_OPTIONS = RARITIES.map((r) => ({ value: r, label: humanizeStatus(r) }));

export const RARITY_TONE: Record<AchievementRarity, StatusTone> = {
    common: "neutral",
    rare: "info",
    epic: "brand",
    legendary: "warn",
};

export interface AchievementForm {
    title: string;
    description: string;
    trigger_type: AchievementTriggerType;
    trigger_threshold: string;
    rewards_points: string;
    rarity: AchievementRarity;
    icon_url: string;
    perks: string;
    is_active: boolean;
}

export const EMPTY_ACHIEVEMENT_FORM: AchievementForm = {
    title: "",
    description: "",
    trigger_type: "quests_completed",
    trigger_threshold: "1",
    rewards_points: "0",
    rarity: "common",
    icon_url: "",
    perks: "",
    is_active: true,
};

export function toAchievementForm(a: Achievement): AchievementForm {
    return {
        title: a.title,
        description: a.description ?? "",
        trigger_type: a.trigger_type,
        trigger_threshold: String(a.trigger_threshold),
        rewards_points: String(a.rewards_points),
        rarity: a.rarity,
        icon_url: a.icon_url ?? "",
        perks: a.perks.join(", "),
        is_active: a.is_active,
    };
}

export function parsePerks(raw: string): string[] {
    return raw
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
}

/** Validates numbers; returns an error message or the payload pieces. */
export function readNumbers(form: AchievementForm): { error: string } | { threshold: number; points: number } {
    const threshold = Number(form.trigger_threshold);
    if (!Number.isFinite(threshold)) return { error: "Trigger threshold must be a number" };
    const points = form.rewards_points === "" ? 0 : Number(form.rewards_points);
    if (!Number.isFinite(points)) return { error: "Rewards points must be a number" };
    return { threshold, points };
}

export function buildAchievementUpdate(form: AchievementForm, threshold: number, points: number): UpdateAchievementPayload {
    return {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        trigger_threshold: threshold,
        rewards_points: points,
        rarity: form.rarity,
        icon_url: form.icon_url.trim() || undefined,
        perks: parsePerks(form.perks),
        is_active: form.is_active,
    };
}

export function buildAchievementCreate(form: AchievementForm, threshold: number, points: number): CreateAchievementPayload {
    return { ...buildAchievementUpdate(form, threshold, points), title: form.title.trim(), trigger_type: form.trigger_type, trigger_threshold: threshold };
}
