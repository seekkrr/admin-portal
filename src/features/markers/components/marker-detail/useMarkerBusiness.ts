import { useQuery } from "@tanstack/react-query";
import { placeDetailApi } from "@/services/admin-detail.service";

export interface MarkerBusinessRef {
    id: string;
    name: string | null;
}

/**
 * The business that runs a place. There's no admin lookup by place yet, so
 * this reads the place's collabs card (which names its business) and falls
 * back to its public experiences. A hidden or switched-off business isn't
 * found this way — it can still be linked by ID.
 */
export function useMarkerBusiness(markerId: string) {
    const collabs = useQuery({
        queryKey: ["marker-collabs", markerId],
        queryFn: () => placeDetailApi.collabs(markerId),
        staleTime: 60_000,
        retry: false,
    });
    const experiences = useQuery({
        queryKey: ["marker-experiences", markerId],
        queryFn: () => placeDetailApi.experiences(markerId),
        staleTime: 60_000,
        retry: false,
    });
    const fromCollabs = collabs.data?.business ? { id: collabs.data.business.id, name: collabs.data.business.name } : null;
    const card = experiences.data?.find((e) => e.business?.id);
    const fromExperiences = card?.business?.id ? { id: card.business.id, name: card.business.name } : null;
    return {
        business: (fromCollabs ?? fromExperiences) as MarkerBusinessRef | null,
        collabs,
        experiences,
        isLoading: collabs.isLoading || experiences.isLoading,
    };
}
