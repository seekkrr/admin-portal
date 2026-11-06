import { cx } from "@/utils/cx";
import type { ChatMessage } from "../services/held-messages.service";

/** A collab chat message's text and photo. */
export function ChatMessageBody({ m, clamp }: { m: ChatMessage; clamp?: boolean }) {
    return (
        <div className="min-w-0 space-y-1.5">
            {m.body ? (
                <p className={cx("whitespace-pre-wrap break-words text-ink", clamp && "line-clamp-3")}>{m.body}</p>
            ) : (
                !m.media_url && <p className="italic text-ink-faint">{m.type === "location" ? "Shared a location" : "No text"}</p>
            )}
            {m.media_url && (
                <a href={m.media_url} target="_blank" rel="noreferrer" className="block w-fit">
                    <img src={m.media_url} alt="Attached photo" className="h-20 w-20 rounded-lg border border-line object-cover" />
                </a>
            )}
        </div>
    );
}
