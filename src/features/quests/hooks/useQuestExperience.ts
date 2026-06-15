import { useQuery } from "@tanstack/react-query";
import { questsService } from "../services/quests.service";
import type {
    V2QuestDetail,
    AdminQuestExperience,
    ExperienceMarker,
    ExperienceNarrative,
    ExperienceRegion,
    ExperienceTask,
} from "@/types";

export type { ExperienceMarker, ExperienceNarrative } from "@/types";

export interface QuestExperience {
    markers: ExperienceMarker[];
    narratives: ExperienceNarrative[];
    region: ExperienceRegion | null;
    orphanTasks: ExperienceTask[];
    achievement: AdminQuestExperience["achievement"];
    startPoint: AdminQuestExperience["start_point"];
    isLoading: boolean;
    error: Error | null;
}

/**
 * Single source of truth for the immersive map: one staff-only call returns
 * markers (with real coordinates), tasks grouped per marker, narratives,
 * region boundary and the linked achievement.
 */
export function useQuestExperience(
    questId: string,
    detail: V2QuestDetail | undefined,
    enabled = true
): QuestExperience {
    const { data, isLoading, error } = useQuery({
        queryKey: ["quest-experience", questId],
        queryFn: () => questsService.getExperience(questId),
        enabled: enabled && !!questId && !!detail,
        staleTime: 5 * 60 * 1000,
        retry: false,
    });

    return {
        markers: data?.markers ?? [],
        narratives: data?.narratives ?? [],
        region: data?.region ?? null,
        orphanTasks: data?.orphan_tasks ?? [],
        achievement: data?.achievement ?? null,
        startPoint: data?.start_point ?? null,
        isLoading,
        error: (error as Error) ?? null,
    };
}
