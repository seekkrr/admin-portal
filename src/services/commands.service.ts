import type { AxiosRequestConfig } from "axios";
import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import { mediaService } from "@/services/media.service";
import type * as MockCommands from "@/features/command-chat/mock/mockCommands";
import type {
    CatalogCommand,
    CatalogResponse,
    CommandAttachment,
    CommandHistoryItem,
    CommandSuggestion,
    CommandSurface,
    CommandsErrorKind,
    DoneResult,
    HistoryResponse,
    RunResponse,
    SuggestResponse,
    UnderstandRequest,
    UnderstandResponse,
    UnderstandResult,
} from "./commands.types";

export type * from "./commands.types";

const C = API_ENDPOINTS.COMMANDS;

export const COMMANDS_UNAVAILABLE_MESSAGE = "The command chat isn't available on this server yet.";
const NETWORK_MESSAGE = "Couldn't reach the server. Check your connection and try again.";
const SERVER_MESSAGE = "Something went wrong on the server. Try again in a moment.";
const EXPIRED_MESSAGE = "This preview expired. Send the command again.";
const FORBIDDEN_MESSAGE = "You're not allowed to do that.";
const UNEXPECTED_MESSAGE = "The server sent a reply the chat doesn't understand.";

/** A failed command-chat call, classified so the UI can offer Retry / Send again. */
export class CommandsApiError extends Error {
    readonly kind: CommandsErrorKind;
    readonly status: number | null;

    constructor(kind: CommandsErrorKind, message: string, status: number | null = null) {
        super(message);
        this.name = "CommandsApiError";
        this.kind = kind;
        this.status = status;
    }

    /** Same request may succeed if simply repeated. */
    get retryable(): boolean {
        return this.kind === "network" || this.kind === "server";
    }
}

export function isCommandsApiError(e: unknown): e is CommandsApiError {
    return e instanceof CommandsApiError;
}

/** Normalise anything thrown into a CommandsApiError (unknown errors count as network trouble). */
export function toCommandsError(e: unknown): CommandsApiError {
    if (isCommandsApiError(e)) return e;
    return new CommandsApiError("network", NETWORK_MESSAGE);
}

// ── Mock layer (development / demos) ───────────────────────

const MOCK_FLAG_KEY = "seekkrr_commands_mock";

/**
 * The mock answers every endpoint locally (fake places, people, businesses).
 * On with VITE_COMMANDS_MOCK=true, or in `npm run dev` with
 * localStorage.seekkrr_commands_mock = "1" (see setCommandsMock).
 */
export function isCommandsMockEnabled(): boolean {
    if (import.meta.env.VITE_COMMANDS_MOCK === "true") return true;
    if (!import.meta.env.DEV) return false;
    try {
        return localStorage.getItem(MOCK_FLAG_KEY) === "1";
    } catch {
        return false;
    }
}

/** Dev only: turn the mock on/off for this browser (takes effect on the next call). */
export function setCommandsMock(on: boolean): void {
    try {
        if (on) localStorage.setItem(MOCK_FLAG_KEY, "1");
        else localStorage.removeItem(MOCK_FLAG_KEY);
    } catch {
        /* storage blocked — nothing to persist */
    }
}

type MockModule = typeof MockCommands;
let mockModule: Promise<MockModule> | null = null;
function loadMock(): Promise<MockModule> {
    mockModule ??= import("@/features/command-chat/mock/mockCommands");
    return mockModule;
}

// ── HTTP ───────────────────────────────────────────────────

function messageOf(data: unknown): string | null {
    if (!data || typeof data !== "object") return null;
    const d = data as Record<string, unknown>;
    for (const key of ["message", "detail", "error"]) {
        const v = d[key];
        if (typeof v === "string" && v.trim()) return v.trim();
        if (v && typeof v === "object" && !Array.isArray(v)) {
            const inner = (v as Record<string, unknown>).message;
            if (typeof inner === "string" && inner.trim()) return inner.trim();
        }
    }
    return null;
}

type CallKind = "read" | "understand" | "run";

function errorFor(status: number, data: unknown, call: CallKind): CommandsApiError {
    const msg = messageOf(data);
    // FastAPI's unknown-route 404 is exactly {"detail": "Not Found"}; a domain 404 carries its own message.
    if ((status === 404 && (!msg || msg === "Not Found")) || status === 405) {
        return new CommandsApiError("unavailable", COMMANDS_UNAVAILABLE_MESSAGE, status);
    }
    if (status === 429) {
        return new CommandsApiError("server", msg || "Too many requests. Wait a moment and try again.", status);
    }
    if (status >= 500) return new CommandsApiError("server", SERVER_MESSAGE, status);
    if (status === 403) return new CommandsApiError("forbidden", msg || FORBIDDEN_MESSAGE, status);
    if (status === 400 && call === "run" && (!msg || /expir|token/i.test(msg))) {
        return new CommandsApiError("expired", msg || EXPIRED_MESSAGE, status);
    }
    if (status === 422) {
        // Validation detail is a list of field errors — not worth showing raw.
        return new CommandsApiError("invalid", msg || "That request wasn't valid.", status);
    }
    return new CommandsApiError("invalid", msg || "That didn't work.", status);
}

/**
 * Every status except 401 resolves (401 still goes through the shared client's
 * refresh-and-retry), so we can see 404/400/403 and classify them — the shared
 * interceptor would otherwise flatten them into a plain Error without a status.
 */
async function call<T>(config: AxiosRequestConfig, kind: CallKind): Promise<T> {
    let status: number;
    let data: unknown;
    try {
        const res = await api.request<unknown>({ ...config, validateStatus: (s) => s !== 401 });
        status = res.status;
        data = res.data;
    } catch {
        throw new CommandsApiError("network", NETWORK_MESSAGE);
    }
    if (status < 200 || status >= 300) throw errorFor(status, data, kind);
    if (data && typeof data === "object" && (data as { success?: unknown }).success === false) {
        throw new CommandsApiError("invalid", messageOf(data) || "That didn't work.", status);
    }
    return data as T;
}

// ── Response hygiene ───────────────────────────────────────

const str = (v: unknown): string => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Fill defaults so a slightly-off server reply can't crash the chat. Unknown kinds throw. */
export function normalizeResult(raw: unknown): UnderstandResult {
    if (!raw || typeof raw !== "object") throw new CommandsApiError("server", UNEXPECTED_MESSAGE);
    const r = raw as Record<string, unknown>;
    switch (r.kind) {
        case "choose":
            return {
                kind: "choose",
                slot: str(r.slot),
                prompt: str(r.prompt) || "Which one?",
                options: arr<Record<string, unknown>>(r.options).map((o) => ({
                    id: str(o.id),
                    label: str(o.label) || str(o.id),
                    sublabel: strOrNull(o.sublabel),
                    image_url: strOrNull(o.image_url),
                })),
            };
        case "need": {
            const input = ["text", "number", "date", "time", "images"].includes(str(r.input))
                ? (r.input as "text" | "number" | "date" | "time" | "images")
                : "text";
            return { kind: "need", slot: str(r.slot), prompt: str(r.prompt), input, placeholder: strOrNull(r.placeholder) };
        }
        case "preview":
            return {
                kind: "preview",
                command: str(r.command),
                title: str(r.title),
                summary: str(r.summary),
                changes: arr<Record<string, unknown>>(r.changes).map((c) => ({
                    label: str(c.label),
                    before: (c.before ?? null) as string | number | boolean | null,
                    after: (c.after ?? null) as string | number | boolean | null,
                })),
                confirm_label: str(r.confirm_label) || "Confirm",
                danger: r.danger === true,
                token: str(r.token),
            };
        case "answer":
            return {
                kind: "answer",
                title: str(r.title),
                text: strOrNull(r.text),
                items: arr<Record<string, unknown>>(r.items).map((i) => ({
                    label: str(i.label),
                    sublabel: strOrNull(i.sublabel),
                    url_path: strOrNull(i.url_path),
                    image_url: strOrNull(i.image_url),
                })),
            };
        case "denied":
            return { kind: "denied", message: str(r.message) || FORBIDDEN_MESSAGE };
        case "unknown":
            return {
                kind: "unknown",
                message: str(r.message) || "I didn't understand that.",
                examples: arr<unknown>(r.examples).filter((e): e is string => typeof e === "string"),
            };
        default:
            throw new CommandsApiError("server", UNEXPECTED_MESSAGE);
    }
}

function normalizeDone(raw: unknown): DoneResult {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return { kind: "done", message: str(r.message) || "Done.", url_path: strOrNull(r.url_path) };
}

// ── Service ────────────────────────────────────────────────

export interface UploadImageOptions {
    /** Backend media category, e.g. "marker" for places or "quest". */
    category?: string;
    entityId?: string;
}

/**
 * /api/v2/commands/* — the command chat. Every method throws CommandsApiError.
 * When the mock is on (isCommandsMockEnabled), calls are answered locally.
 */
export const commandsService = {
    get isMock(): boolean {
        return isCommandsMockEnabled();
    },

    async suggest(q: string, surface: CommandSurface = "admin", signal?: AbortSignal): Promise<CommandSuggestion[]> {
        if (isCommandsMockEnabled()) return (await loadMock()).mockSuggest(q);
        const data = await call<SuggestResponse>({ method: "GET", url: C.SUGGEST, params: { q, surface }, signal }, "read");
        return arr<Record<string, unknown>>(data.suggestions).map((s) => ({
            text: str(s.text),
            label: str(s.label) || str(s.text),
            hint: strOrNull(s.hint),
        }));
    },

    async understand(request: UnderstandRequest): Promise<UnderstandResult> {
        if (isCommandsMockEnabled()) return normalizeResult(await (await loadMock()).mockUnderstand(request));
        const body: UnderstandRequest = { text: request.text, surface: request.surface };
        if (request.business_id) body.business_id = request.business_id;
        if (request.attachments?.length) body.attachments = request.attachments;
        if (request.picks && Object.keys(request.picks).length) body.picks = request.picks;
        const data = await call<UnderstandResponse>({ method: "POST", url: C.UNDERSTAND, data: body }, "understand");
        return normalizeResult(data.result);
    },

    async run(token: string): Promise<DoneResult> {
        if (isCommandsMockEnabled()) return normalizeDone(await (await loadMock()).mockRun(token));
        const data = await call<RunResponse>({ method: "POST", url: C.RUN, data: { token } }, "run");
        return normalizeDone(data.result);
    },

    async history(limit = 30): Promise<CommandHistoryItem[]> {
        if (isCommandsMockEnabled()) return (await loadMock()).mockHistory();
        const data = await call<HistoryResponse>({ method: "GET", url: C.HISTORY, params: { limit } }, "read");
        return arr<Record<string, unknown>>(data.items).map((i) => ({
            at: str(i.at),
            text: str(i.text),
            command: str(i.command),
            message: str(i.message),
            status: i.status === "failed" ? "failed" : "done",
        }));
    },

    async catalog(surface: CommandSurface = "admin"): Promise<CatalogCommand[]> {
        if (isCommandsMockEnabled()) return (await loadMock()).mockCatalog();
        const data = await call<CatalogResponse>({ method: "GET", url: C.CATALOG, params: { surface } }, "read");
        return arr<Record<string, unknown>>(data.commands).map((c) => ({
            id: str(c.id),
            label: str(c.label),
            examples: arr<unknown>(c.examples).filter((e): e is string => typeof e === "string"),
            area: str(c.area) || "Other",
        }));
    },

    /** Upload one photo through the portal's media broker; returns it as a command attachment. */
    async uploadImage(file: File, options: UploadImageOptions = {}): Promise<CommandAttachment> {
        if (isCommandsMockEnabled()) return (await loadMock()).mockUpload(file);
        const res = await mediaService.uploadImage(file, {
            category: options.category || "marker",
            ...(options.entityId ? { entity_id: options.entityId } : {}),
        });
        return { url: res.secure_url, kind: "image" };
    },
};
