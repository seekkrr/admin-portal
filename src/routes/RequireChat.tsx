import type { ReactNode } from "react";
import { LoadingFallback } from "@components/LoadingFallback";
import { ErrorState } from "@/components/ui/States";
import { ChatOff } from "@/features/command-chat/components/ChatOff";
import { useAdminChatOn, useChatSettings } from "@/features/command-chat/hooks/useChatSettings";

/**
 * Shows the chat only while it's on for the SeekKrr team (Rollout → Chat);
 * otherwise says where to turn it on. Mirrors the menu's Chat gate.
 */
export function RequireChat({ children }: { children: ReactNode }) {
    const settings = useChatSettings();
    const on = useAdminChatOn();
    if (on) return <>{children}</>;
    if (settings.isLoading) return <LoadingFallback message="Loading chat..." />;
    if (settings.error) return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;
    return <ChatOff />;
}
