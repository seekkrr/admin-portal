import { NavLink } from "react-router-dom";
import { MessageSquareText } from "lucide-react";

/**
 * Header button that opens the command chat (/chat). On narrow screens only
 * the icon shows; the label stays available to screen readers.
 */
export function ChatLauncherButton({ className = "" }: { className?: string }) {
    return (
        <NavLink
            to="/chat"
            title="Chat — type what you want to do"
            className={({ isActive }) =>
                `inline-flex items-center gap-2 h-9 px-2.5 sm:px-3 rounded-xl text-sm font-medium border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A49E] ${
                    isActive
                        ? "bg-[#003634] border-[#003634] text-white"
                        : "bg-white border-neutral-200 text-[#003634] hover:border-[#00A49E] hover:bg-[#00A49E]/5"
                } ${className}`
            }
        >
            {({ isActive }) => (
                <>
                    <MessageSquareText className={`w-4 h-4 ${isActive ? "text-[#FECD36]" : "text-[#00A49E]"}`} aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only">Chat</span>
                </>
            )}
        </NavLink>
    );
}

export default ChatLauncherButton;
