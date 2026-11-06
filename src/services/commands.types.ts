/**
 * Command chat — wire types for /api/v2/commands/*.
 *
 * The chat is a conversation: the server reads each message with the chat so
 * far (`history`), runs the team's commands quietly and writes every reply
 * itself, as exactly one Result. Nothing changes until the user confirms a
 * "preview" (POST run with its short-lived token).
 */

export type CommandSurface = "admin" | "partner" | "app";

export interface CommandAttachment {
    url: string;
    kind: "image";
}

/** One earlier message of the chat, as plain words. */
export interface CommandTurn {
    role: "user" | "assistant";
    text: string;
}

export interface UnderstandRequest {
    text: string;
    surface: CommandSurface;
    business_id?: string;
    attachments?: CommandAttachment[];
    /** Answers to earlier "choose" results: slot name → chosen option id. */
    picks?: Record<string, string>;
    /**
     * The chat before this message, oldest first (the server takes at most 20),
     * so a reply like "tomorrow" is read in context. Older servers ignore it.
     */
    history?: CommandTurn[];
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
    /** What the chat says above the card ("Here it is, look right?"). */
    lead: string | null;
}

export interface AnswerItem {
    label: string;
    sublabel: string | null;
    url_path: string | null;
    image_url: string | null;
}

/** An admin portal screen an answer opens, with its button text ("Open reports"). */
export interface AnswerLink {
    url_path: string;
    label: string;
}

/**
 * The chat's own words (`text`; `title` only when there's no text), read-only
 * commands included ("what needs me", "show …"), with the records it found
 * and a link to the screen with the rest.
 */
export interface AnswerResult {
    kind: "answer";
    title: string;
    text: string | null;
    items: AnswerItem[];
    link: AnswerLink | null;
}

/** Recognised but not allowed, with a plain reason. */
export interface DeniedResult {
    kind: "denied";
    message: string;
}

export interface UnknownResult {
    kind: "unknown";
    message: string;
    /** Sent by the server; the chat doesn't show them (no suggestion chips). */
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
 * - disabled: 403 CHAT_DISABLED — an admin turned the chat off for this group (Rollout → Chat).
 * - forbidden: 403 — not (or no longer) allowed.
 * - invalid: any other 4xx; the server's message is shown as-is.
 */
export type CommandsErrorKind = "unavailable" | "network" | "server" | "expired" | "disabled" | "forbidden" | "invalid";
