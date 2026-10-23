/**
 * Command chat (no AI) — wire types for /api/v2/commands/*.
 *
 * The server reads plain text ("add images to Emaho Cafe"), resolves names to
 * records, and answers with exactly one Result. Nothing changes until the user
 * confirms a "preview" (POST run with its short-lived token).
 */

export type CommandSurface = "admin" | "partner" | "app";

export interface CommandAttachment {
    url: string;
    kind: "image";
}

export interface UnderstandRequest {
    text: string;
    surface: CommandSurface;
    business_id?: string;
    attachments?: CommandAttachment[];
    /** Answers to earlier "choose" results: slot name → chosen option id. */
    picks?: Record<string, string>;
}

export interface ChooseOption {
    id: string;
    label: string;
    sublabel: string | null;
    image_url: string | null;
}

/** Several (or no) records match a name — the client re-sends the same text with picks[slot] = id. */
export interface ChooseResult {
    kind: "choose";
    slot: string;
    prompt: string;
    options: ChooseOption[];
}

export type NeedInputType = "text" | "number" | "date" | "time" | "images";

/** A value is missing — the client appends it to the text (images go as attachments). */
export interface NeedResult {
    kind: "need";
    slot: string;
    prompt: string;
    input: NeedInputType;
    placeholder: string | null;
}

/** Before/after values are normally strings; numbers and flags are formatted for display. */
export type ChangeValue = string | number | boolean | null;

export interface PreviewChange {
    label: string;
    before: ChangeValue;
    after: ChangeValue;
}

/** Ready to run. `token` is signed and expires after about 10 minutes. */
export interface PreviewResult {
    kind: "preview";
    command: string;
    title: string;
    summary: string;
    changes: PreviewChange[];
    confirm_label: string;
    danger: boolean;
    token: string;
}

export interface AnswerItem {
    label: string;
    sublabel: string | null;
    url_path: string | null;
    image_url: string | null;
}

/** Read-only commands ("what needs me", "show …") answer directly, no confirm. */
export interface AnswerResult {
    kind: "answer";
    title: string;
    text: string | null;
    items: AnswerItem[];
}

/** Recognised but not allowed, with a plain reason. */
export interface DeniedResult {
    kind: "denied";
    message: string;
}

export interface UnknownResult {
    kind: "unknown";
    message: string;
    examples: string[];
}

export type UnderstandResult =
    | ChooseResult
    | NeedResult
    | PreviewResult
    | AnswerResult
    | DeniedResult
    | UnknownResult;

export interface DoneResult {
    kind: "done";
    message: string;
    url_path: string | null;
}

export interface CommandSuggestion {
    /** What goes into the composer when accepted. */
    text: string;
    /** What the list shows (may add context, e.g. "Emaho Cafe · Bir"). */
    label: string;
    hint: string | null;
}

export interface CommandHistoryItem {
    at: string;
    text: string;
    command: string;
    message: string;
    status: "done" | "failed";
}

export interface CatalogCommand {
    id: string;
    label: string;
    examples: string[];
    area: string;
}

// ── Response envelopes ─────────────────────────────────────

export interface SuggestResponse {
    success?: boolean;
    suggestions: CommandSuggestion[];
}

export interface UnderstandResponse {
    success?: boolean;
    result: UnderstandResult;
}

export interface RunResponse {
    success?: boolean;
    result: DoneResult;
}

export interface HistoryResponse {
    success?: boolean;
    items: CommandHistoryItem[];
}

export interface CatalogResponse {
    success?: boolean;
    commands: CatalogCommand[];
}

// ── Errors ─────────────────────────────────────────────────

/**
 * - unavailable: the endpoints don't exist on this server (404 route / 405).
 * - network: no response (offline, timeout). Retry.
 * - server: 5xx / 429. Retry.
 * - expired: run token expired or invalid (400). Send the command again.
 * - forbidden: 403 — not (or no longer) allowed.
 * - invalid: any other 4xx; the server's message is shown as-is.
 */
export type CommandsErrorKind = "unavailable" | "network" | "server" | "expired" | "forbidden" | "invalid";
