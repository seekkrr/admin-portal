import { useQuery } from "@tanstack/react-query";
import { platformConfigService } from "@/features/collabs/services/platform-config.service";
import { isCommandsMockEnabled } from "@/services/commands.service";

/** Shared by the Rollout page (which saves it) and every Chat link, so a save shows up at once. */
export const CHAT_SETTINGS_KEY = ["platform-chat-settings"] as const;

/** Who gets the chat. GET /config/chat is public, so every role can read it. */
export function useChatSettings() {
    return useQuery({
        queryKey: CHAT_SETTINGS_KEY,
        queryFn: platformConfigService.getChatSettings,
        staleTime: 5 * 60_000,
    });
}

/**
 * True once the server says the chat is on for the SeekKrr team (the `admin`
 * group). Hidden while loading or unknown, since every group starts off.
 * Demo data (commands mock) always shows it — nothing reaches the server then.
 */
export function useAdminChatOn(): boolean {
    const { data } = useChatSettings();
    return isCommandsMockEnabled() || data?.audiences.admin === true;
}
