import type {
    CommandAttachment,
    CommandsErrorKind,
    DoneResult,
    UnderstandRequest,
    UnderstandResult,
} from "@/services/commands.types";

/**
 * Conversation model for the command chat. Pure data + a reducer so the hook
 * stays small and the whole thing can live in sessionStorage.
 */

/** What an error offers: repeat the same call, re-send the text fresh, put the text back in the composer, or nothing. */
export type ErrorAction = "retry" | "resend" | "edit" | null;

export interface EntryError {
    kind: CommandsErrorKind;
    message: string;
    action: ErrorAction;
}

export type PreviewStatus = "open" | "running" | "confirmed" | "cancelled" | "failed";

interface Base {
    id: string;
    at: string;
}

export interface UserEntry extends Base {
    type: "user";
    text: string;
    attachments: CommandAttachment[];
}

export interface ResultEntry extends Base {
    type: "result";
    /** The request that produced this result — follow-ups (picks, values, images) build on it. */
    request: UnderstandRequest;
    result: UnderstandResult;
    /** choose: the option the user picked. */
    pickedId?: string;
    /** need: answered already. */
    answered?: boolean;
    /** choose/need left unanswered when the user typed something else. */
    superseded?: boolean;
    /** preview lifecycle. */
    status?: PreviewStatus;
    /** preview: why Confirm failed. */
    error?: EntryError;
}

export interface DoneEntry extends Base {
    type: "done";
    result: DoneResult;
}

export interface ErrorEntry extends Base {
    type: "error";
    error: EntryError;
    request: UnderstandRequest;
    /** Retry / Send again already used. */
    resolved?: boolean;
}

export interface NoteEntry extends Base {
    type: "note";
    text: string;
}

export type ChatEntry = UserEntry | ResultEntry | DoneEntry | ErrorEntry | NoteEntry;

export type BotEntry = Exclude<ChatEntry, UserEntry>;

export interface ChatState {
    entries: ChatEntry[];
    /** When this conversation began — history before it is shown as "Earlier". */
    startedAt: string;
}

export type ChatAction =
    | { type: "add"; entry: ChatEntry }
    | { type: "patch"; id: string; patch: Partial<ResultEntry> & Partial<ErrorEntry> }
    /** A new message makes open choose/need prompts stale. */
    | { type: "supersede" }
    | { type: "reset"; startedAt: string };

const MAX_ENTRIES = 80;

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
    switch (action.type) {
        case "add": {
            const entries = [...state.entries, action.entry];
            return { ...state, entries: entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries };
        }
        case "patch":
            return {
                ...state,
                entries: state.entries.map((e) => (e.id === action.id ? ({ ...e, ...action.patch } as ChatEntry) : e)),
            };
        case "supersede":
            return {
                ...state,
                entries: state.entries.map((e) =>
                    e.type === "result" &&
                    (e.result.kind === "choose" || e.result.kind === "need") &&
                    !e.pickedId &&
                    !e.answered &&
                    !e.superseded
                        ? { ...e, superseded: true }
                        : e
                ),
            };
        case "reset":
            return { entries: [], startedAt: action.startedAt };
    }
}

let seq = 0;
export function newId(prefix = "m"): string {
    seq += 1;
    return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}`;
}

export const nowIso = () => new Date().toISOString();

// ── Session persistence ────────────────────────────────────

const STORAGE_KEY = "seekkrr_admin_command_chat_v1";

export function loadChatState(): ChatState {
    const fresh: ChatState = { entries: [], startedAt: nowIso() };
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return fresh;
        const parsed = JSON.parse(raw) as Partial<ChatState>;
        if (!Array.isArray(parsed.entries) || typeof parsed.startedAt !== "string") return fresh;
        // A reload mid-request leaves nothing in flight.
        const entries = parsed.entries.map((e) =>
            e.type === "result" && e.status === "running" ? { ...e, status: "open" as const } : e
        );
        return { entries, startedAt: parsed.startedAt };
    } catch {
        return fresh;
    }
}

export function saveChatState(state: ChatState): void {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        /* storage full / blocked — the conversation just won't survive a reload */
    }
}

// ── Display helpers ────────────────────────────────────────

/** One plain sentence for screen readers when a bot entry arrives. */
export function describeEntry(entry: ChatEntry): string {
    switch (entry.type) {
        case "user":
            return "";
        case "note":
            return entry.text;
        case "done":
            return entry.result.message;
        case "error":
            return entry.error.message;
        case "result": {
            const r = entry.result;
            if (entry.status === "failed" && entry.error) return entry.error.message;
            switch (r.kind) {
                case "choose":
                    return `${r.prompt} ${r.options.length} option${r.options.length === 1 ? "" : "s"}.`;
                case "need":
                    return r.prompt;
                case "preview":
                    return `${r.title}. ${r.summary} Confirm or cancel.`;
                case "answer":
                    return [r.title, r.text, r.items.length ? `${r.items.length} item${r.items.length === 1 ? "" : "s"}` : ""]
                        .filter((s): s is string => Boolean(s && s.trim()))
                        .map((s) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`))
                        .join(" ");
                case "denied":
                case "unknown":
                    return r.message;
            }
        }
    }
}

/** Format a "need" value the way the user would say it (the raw value is what gets sent). */
export function formatNeedValue(input: string, value: string): string {
    if (input === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const d = new Date(`${value}T00:00:00`);
        if (!Number.isNaN(d.getTime())) return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    }
    if (input === "time" && /^\d{2}:\d{2}$/.test(value)) {
        const [h, m] = value.split(":").map(Number);
        const d = new Date();
        d.setHours(h ?? 0, m ?? 0, 0, 0);
        return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    }
    return value;
}

/** Media category for photos picked for a command (quests have their own bucket). */
export function uploadCategoryFor(text: string): string {
    return /\bquests?\b/i.test(text) ? "quest" : "marker";
}
