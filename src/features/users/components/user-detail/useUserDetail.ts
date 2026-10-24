import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isNotAvailable, userDetailApi } from "@/services/admin-detail.service";
import type { AdminUserProfile, RawAdminUser, UserOverview } from "@/types/admin-detail";

export interface UserDetailData {
    overview: UserOverview;
    /** False while GET /admin/users/{id}/overview isn't live (only basics are known). */
    full: boolean;
}

function roleList(raw: RawAdminUser["role"]): string[] {
    if (Array.isArray(raw)) return raw;
    return raw ? [raw] : [];
}

function avatarOf(raw: RawAdminUser["profile_image"]): string | null {
    if (!raw) return null;
    if (typeof raw === "string") return raw;
    return raw.secure_url || raw.url || null;
}

/** The older admin user record, shaped like the overview's `user`. */
export function profileFromRaw(u: RawAdminUser): AdminUserProfile {
    return {
        id: u._id,
        first_name: u.first_name ?? "",
        last_name: u.last_name ?? "",
        username: u.username ?? null,
        email: u.email ?? null,
        phone: u.phone ?? u.phone_number ?? null,
        bio: u.bio ?? u.user_bio ?? null,
        avatar_url: avatarOf(u.profile_image),
        roles: roleList(u.role),
        status: u.status ?? "active",
        is_creator: !!u.is_creator,
        created_at: u.created_at ?? null,
        last_active_at: u.last_active_at ?? u.last_login_at ?? null,
        points: u.points_earned ?? 0,
        hobbies: u.hobbies ?? [],
    };
}

async function load(userId: string): Promise<UserDetailData> {
    try {
        const overview = await userDetailApi.overview(userId);
        return { overview: { ...overview, businesses: overview.businesses ?? [], recent: overview.recent ?? {} }, full: true };
    } catch (e) {
        if (!isNotAvailable(e)) throw e;
    }
    const raw = await userDetailApi.raw(userId);
    return {
        full: false,
        overview: {
            user: profileFromRaw(raw),
            creator: null,
            businesses: [],
            stats: { checkins: 0, experience_bookings: 0, quest_bookings: 0, reviews: 0, collab_applications: 0, markers_created: 0 },
            recent: {},
        },
    };
}

export const userDetailKey = (userId: string) => ["user-detail", userId] as const;

export function useUserDetail(userId: string, enabled: boolean) {
    const queryClient = useQueryClient();
    const query = useQuery({
        queryKey: userDetailKey(userId),
        queryFn: () => load(userId),
        enabled: enabled && !!userId,
        retry: false,
    });
    /** Refresh this page, the Users list and the change history after a save. */
    const refresh = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: userDetailKey(userId) });
        queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        queryClient.invalidateQueries({ queryKey: ["admin-user-stats"] });
        queryClient.invalidateQueries({ queryKey: ["admin-audit", "user", userId] });
    }, [queryClient, userId]);
    return { ...query, refresh };
}
