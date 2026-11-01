import { MessageSquareOff, Settings2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { useCollabAccess } from "@/features/collabs/roles";

/**
 * Shown instead of the chat while it's off for the SeekKrr team (the `admin`
 * group under Rollout → Chat). Admins get a button to the switch.
 */
export function ChatOff() {
    const { isAdmin } = useCollabAccess();
    return (
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center sm:py-24">
            <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <MessageSquareOff className="h-7 w-7" aria-hidden />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">The chat is off for the SeekKrr team</h1>
            <p className="mt-2 max-w-md text-sm text-ink-muted">
                {isAdmin ? "Turn it on in Settings, under Rollout → Chat." : "An admin can turn it on in Settings."}
            </p>
            {isAdmin && (
                <div className="mt-6">
                    <ButtonLink to="/collabs/rollout" variant="primary" icon={Settings2}>
                        Open chat settings
                    </ButtonLink>
                </div>
            )}
        </div>
    );
}
