import { useCallback, useState } from "react";

const DRAFT_KEY = "seekkrr_admin_command_chat_draft";

/** The composer's unsent text, kept for this browser tab session. */
export function useSessionDraft() {
    const [draft, setDraftState] = useState<string>(() => {
        try {
            return sessionStorage.getItem(DRAFT_KEY) ?? "";
        } catch {
            return "";
        }
    });

    const setDraft = useCallback((value: string) => {
        setDraftState(value);
        try {
            if (value) sessionStorage.setItem(DRAFT_KEY, value);
            else sessionStorage.removeItem(DRAFT_KEY);
        } catch {
            /* storage blocked */
        }
    }, []);

    return [draft, setDraft] as const;
}
