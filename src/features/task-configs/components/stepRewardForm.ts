import type { BonusCondition, BonusOperator, StepReward, StepRewardContextType } from "@/types";
import type { EntityKind } from "@/utils/entity";
import type { SearchType } from "@/features/search/search.service";
import { humanizeStatus } from "@/components/ui/status";

export const CONTEXT_TYPES: StepRewardContextType[] = ["quest_completion", "marker_visit", "task_completion", "streak_bonus"];

export const CONTEXT_OPTIONS = CONTEXT_TYPES.map((c) => ({ value: c, label: humanizeStatus(c) }));

export const OPERATORS: BonusOperator[] = ["gte", "lte", "eq", "in"];

export const OPERATOR_LABELS: Record<BonusOperator, string> = { gte: "≥ at least", lte: "≤ at most", eq: "= equals", in: "in list" };

/** What a context id points at: quests and places can be searched; tasks link to their page. */
export function contextTarget(type: StepRewardContextType): { search: SearchType | null; kind: EntityKind | null; label: string } {
    switch (type) {
        case "quest_completion":
            return { search: "quest", kind: "quest", label: "Quest" };
        case "marker_visit":
            return { search: "place", kind: "place", label: "Place" };
        case "task_completion":
            return { search: null, kind: "task", label: "Task config ID" };
        default:
            return { search: null, kind: null, label: "Context ID" };
    }
}

export interface BonusRow {
    field: string;
    operator: BonusOperator;
    value: string;
    bonus_points: string;
}

export interface StepRewardForm {
    context_type: StepRewardContextType;
    context_id: string;
    base_points: string;
    bonus_conditions: BonusRow[];
    unlocked_badges: string;
    unlocked_content: string;
}

export const EMPTY_REWARD_FORM: StepRewardForm = {
    context_type: "quest_completion",
    context_id: "",
    base_points: "0",
    bonus_conditions: [],
    unlocked_badges: "",
    unlocked_content: "",
};

export function rewardToForm(r: StepReward): StepRewardForm {
    return {
        context_type: r.context_type,
        context_id: r.context_id,
        base_points: String(r.base_points),
        bonus_conditions: (r.bonus_conditions ?? []).map((c) => ({
            field: c.field,
            operator: c.operator,
            value: typeof c.value === "object" ? JSON.stringify(c.value) : String(c.value ?? ""),
            bonus_points: String(c.bonus_points),
        })),
        unlocked_badges: (r.unlocked_badges ?? []).join(", "),
        unlocked_content: (r.unlocked_content ?? []).join(", "),
    };
}

export function buildBonusConditions(rows: BonusRow[]): BonusCondition[] {
    return rows
        .filter((r) => r.field.trim())
        .map((r) => {
            let value: unknown = r.value;
            if (r.operator === "in") {
                value = r.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
            } else {
                const num = Number(r.value);
                if (r.value.trim() !== "" && !Number.isNaN(num)) value = num;
            }
            return {
                field: r.field.trim(),
                operator: r.operator,
                value,
                bonus_points: Number(r.bonus_points) || 0,
            };
        });
}

export function splitList(raw: string): string[] {
    return raw
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
}
