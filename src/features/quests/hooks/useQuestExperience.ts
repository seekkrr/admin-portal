import { useQueries, useQuery } from "@tanstack/react-query";
import { markersService } from "@features/markers/services/markers.service";
import { taskConfigsService } from "@features/task-configs/services/task-configs.service";
import { narrativesService } from "@features/content/services/narratives.service";
import { regionsService } from "@features/regions/services/regions.service";
import type {
    V2QuestDetail,
    MarkerSummary,
    Marker,
    TaskConfig,
    AdminNarrative,
    Region,
} from "@/types";

export interface MarkerWithCoords extends MarkerSummary {
    realLng: number | null;
    realLat: number | null;
    tasks: TaskConfig[];
}

export interface QuestExperience {
    markers: MarkerWithCoords[];
    narratives: AdminNarrative[];
    region: Region | null;
    // loading state per layer
    isMarkersLoading: boolean;
    isTasksLoading: boolean;
    isNarrativesLoading: boolean;
    isRegionLoading: boolean;
    // error state per layer (partial failure = graceful degradation)
    markersError: Error | null;
    tasksError: Error | null;
    narrativesError: Error | null;
    regionError: Error | null;
}

export function useQuestExperience(
    questId: string,
    detail: V2QuestDetail | undefined,
    enabled = true
): QuestExperience {
    const markerIds = detail?.marker_summaries?.map((m) => m.marker_id) ?? [];
    const regionId = detail?.region_summary?.id;

    // Fetch each marker's real coordinates independently (parallel)
    const markerQueries = useQueries({
        queries: markerIds.map((markerId) => ({
            queryKey: ["marker-detail", markerId],
            queryFn: () => markersService.getById(markerId),
            enabled: enabled && !!detail,
            staleTime: 5 * 60 * 1000,
        })),
    });

    // Task configs for the quest
    const {
        data: tasksData,
        isLoading: isTasksLoading,
        error: tasksError,
    } = useQuery({
        queryKey: ["task-configs-by-quest", questId],
        queryFn: () => taskConfigsService.byQuest(questId),
        enabled: enabled && !!detail,
        staleTime: 5 * 60 * 1000,
    });

    // Narratives for the quest (using list() with attach_type filter)
    const {
        data: narrativesData,
        isLoading: isNarrativesLoading,
        error: narrativesError,
    } = useQuery({
        queryKey: ["narratives-by-quest", questId],
        queryFn: () =>
            narrativesService.list({
                attach_type: "quest",
                attach_id: questId,
                page_size: 100,
            }),
        enabled: enabled && !!detail,
        staleTime: 5 * 60 * 1000,
    });

    // Region boundary + crowd meter
    const {
        data: regionData,
        isLoading: isRegionLoading,
        error: regionError,
    } = useQuery({
        queryKey: ["region-detail", regionId],
        queryFn: () => regionsService.getById(regionId as string),
        enabled: enabled && !!regionId,
        staleTime: 5 * 60 * 1000,
    });

    // Merge task configs into markers by marker_id
    const allTasks: TaskConfig[] = tasksData ?? [];

    const markers: MarkerWithCoords[] = (detail?.marker_summaries ?? []).map(
        (summary: MarkerSummary, i: number) => {
            const fetched = markerQueries[i]?.data as Marker | undefined;
            // GeoJSON: coordinates = [lng, lat]
            const coords = fetched?.location?.coordinates;
            const markerTasks = allTasks.filter(
                (t) => t.marker_id === summary.marker_id
            );
            return {
                ...summary,
                realLng: coords ? coords[0] : null,
                realLat: coords ? coords[1] : null,
                tasks: markerTasks,
            };
        }
    );

    const isMarkersLoading = markerQueries.some((q) => q.isLoading);
    const markersError =
        (markerQueries.find((q) => q.error)?.error as Error | null) ?? null;

    return {
        markers,
        narratives: narrativesData?.narratives ?? [],
        region: regionData ?? null,
        isMarkersLoading,
        isTasksLoading,
        isNarrativesLoading,
        isRegionLoading,
        markersError,
        tasksError: tasksError as Error | null,
        narrativesError: narrativesError as Error | null,
        regionError: regionError as Error | null,
    };
}
