import type {
    CommandAttachment,
    CommandsErrorKind,
    CommandSurface,
    CommandTurn,
    DoneResult,
    NeedResult,
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

// ── Requests ───────────────────────────────────────────────

/** The understand request for a typed message: the text, the surface, any photos, and the chat so far (see chatHistory). */
export function buildRequest(
    text: string,
    surface: CommandSurface,
    attachments: CommandAttachment[] = [],
    history: CommandTurn[] = []
): UnderstandRequest {
    const request: UnderstandRequest = { text: text.trim(), surface };
    if (attachments.length) request.attachments = attachments;
    if (history.length) request.history = history;
    return request;
}

/**
 * The conversation entry for a server result. Every kind becomes a "result"
 * entry; only a preview carries a lifecycle (it starts "open").
 */
export function entryForResult(request: UnderstandRequest, result: UnderstandResult, id = newId("r"), at = nowIso()): ResultEntry {
    const entry: ResultEntry = { id, at, type: "result", request, result };
    if (result.kind === "preview") entry.status = "open";
    return entry;
}

// ── Conversation history ───────────────────────────────────

/** How many earlier messages go with each newly typed one, so the chat can follow along. */
export const HISTORY_TURNS = 8;

function spoken(result: UnderstandResult | DoneResult): string | null {
    switch (result.kind) {
        case "answer":
            return result.text?.trim() || result.title;
        case "preview":
            return [result.lead, result.title]
                .filter((s): s is string => Boolean(s && s.trim()))
                .map((s) => s.trim())
                .join(" ");
        case "need":
        case "choose":
            return result.prompt;
        case "denied":
        case "unknown":
        case "done":
            return result.message;
    }
}

/**
 * What the chat said in a reply, as plain words (null: nothing to remember).
 * answer: its text (the title when there's none); preview: lead + title;
 * need/choose: the question; denied/unknown/done: the message.
 */
export function replyWords(result: UnderstandResult | DoneResult): string | null {
    const said = spoken(result)?.trim();
    return said ? said : null;
}

/**
 * The chat so far as plain words, oldest first, the last `max` turns: every
 * user message's text and every reply's words. Errors and notes are left out.
 */
export function chatHistory(entries: ChatEntry[], max = HISTORY_TURNS): CommandTurn[] {
    const turns: CommandTurn[] = [];
    for (const e of entries) {
        if (e.type === "user") {
            if (e.text.trim()) turns.push({ role: "user", text: e.text.trim() });
        } else if (e.type === "result" || e.type === "done") {
            const said = replyWords(e.result);
            if (said) turns.push({ role: "assistant", text: said });
        }
    }
    return max > 0 ? turns.slice(-max) : [];
}

// ── Questions the message box answers ──────────────────────

export type OpenNeedEntry = ResultEntry & { result: NeedResult };

/**
 * The chat's last message when it's a question the message box answers (a
 * name, a number, a day, a time) and nobody answered it yet. Photos are picked
 * in the bubble instead.
 */
export function openQuestion(entries: ChatEntry[]): OpenNeedEntry | null {
    const last = entries[entries.length - 1];
    if (!last || last.type !== "result" || last.result.kind !== "need") return null;
    if (last.result.input === "images" || last.answered || last.superseded) return null;
    return last as OpenNeedEntry;
}

/** The need's request again with the typed value appended (the engine reads it as the rest of the command). */
export function answerRequest(request: UnderstandRequest, value: string): UnderstandRequest {
    const clean = value.trim();
    return clean ? { ...request, text: `${request.text.trim()} ${clean}` } : request;
}

export const MESSAGE_PLACEHOLDER = "Message SeekKrr";

/** The message box hint: the open question's placeholder, else the usual one. */
export function composerPlaceholder(question: OpenNeedEntry | null): string {
    if (!question) return MESSAGE_PLACEHOLDER;
    return question.result.placeholder?.trim() || "Type your answer";
}

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

/** The chat's first message: what it can help the team with. */
export const CHAT_GREETING =
    "Hi! I can help with places, quests, people, bookings and payouts. Just tell me what you need, and I'll check with you before changing anything.";

const sentence = (s: string) => (!s.trim() || /[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

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
                    return [r.lead, r.title, r.summary, "Confirm, or Not now."]
                        .filter((s): s is string => Boolean(s && s.trim()))
                        .map(sentence)
                        .join(" ");
                case "answer": {
                    const n = Math.min(r.items.length, MAX_ANSWER_ITEMS);
                    return [r.text?.trim() || r.title, n ? `${n} item${n === 1 ? "" : "s"}` : ""]
                        .filter((s): s is string => Boolean(s && s.trim()))
                        .map(sentence)
                        .join(" ");
                }
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

/** Most record rows shown under an answer (each opens its screen). */
export const MAX_ANSWER_ITEMS = 8;

/**
 * Screens an answer's link may open: admin portal routes only, i.e. a path in
 * this app ("/markers/…", "/collabs/reports"). Not a full or protocol-relative
 * URL, and not a Partner Portal area (/business, /creator).
 */
export function isAdminPath(path: string | null | undefined): path is string {
    if (typeof path !== "string") return false;
    const p = path.trim();
    return /^\/(?![/\\])\S*$/.test(p) && !/^\/(business|creator)(?=$|[/?#])/i.test(p);
}

/** Media category for photos picked for a command (quests have their own bucket). */
export function uploadCategoryFor(text: string): string {
    return /\bquests?\b/i.test(text) ? "quest" : "marker";
}
