import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { commandsService, toCommandsError, type CommandsApiError } from "@/services/commands.service";
import type {
    ChooseOption,
    CommandAttachment,
    CommandSurface,
    UnderstandRequest,
} from "@/services/commands.types";
import {
    chatReducer,
    loadChatState,
    newId,
    nowIso,
    saveChatState,
    type ChatEntry,
    type EntryError,
    type ErrorAction,
    type ResultEntry,
} from "../chatModel";

/** The latest bot entry that arrived (or changed) in this session — drives focus and the live region. */
export interface ChatEvent {
    entryId: string;
    seq: number;
}

function entryError(err: CommandsApiError, fallback: ErrorAction): EntryError {
    let action: ErrorAction = fallback;
    if (err.retryable) action = "retry";
    else if (err.kind === "unavailable") action = null;
    return { kind: err.kind, message: err.message, action };
}

/**
 * Conversation state + the four moves: send text, pick an option, give a
 * missing value (text or photos), confirm/cancel a preview. One request at a
 * time; everything else is ignored while `busy`.
 */
export function useCommandChat({ surface = "admin" as CommandSurface, onUnavailable }: { surface?: CommandSurface; onUnavailable?: () => void } = {}) {
    const [state, dispatch] = useReducer(chatReducer, undefined, loadChatState);
    const [busy, setBusy] = useState(false);
    const [event, setEvent] = useState<ChatEvent | null>(null);
    const busyRef = useRef(false);
    const seqRef = useRef(0);
    const entriesRef = useRef<ChatEntry[]>(state.entries);
    entriesRef.current = state.entries;
    const onUnavailableRef = useRef(onUnavailable);
    onUnavailableRef.current = onUnavailable;

    useEffect(() => {
        saveChatState(state);
    }, [state]);

    const emit = useCallback((entryId: string) => {
        seqRef.current += 1;
        setEvent({ entryId, seq: seqRef.current });
    }, []);

    /** Claim the single request slot; false while another request is in flight. */
    const begin = useCallback(() => {
        if (busyRef.current) return false;
        busyRef.current = true;
        setBusy(true);
        return true;
    }, []);
    const end = useCallback(() => {
        busyRef.current = false;
        setBusy(false);
    }, []);

    const findResult = useCallback((id: string): ResultEntry | null => {
        const e = entriesRef.current.find((x) => x.id === id);
        return e && e.type === "result" ? e : null;
    }, []);

    const addBot = useCallback(
        (entry: ChatEntry) => {
            dispatch({ type: "add", entry });
            emit(entry.id);
        },
        [emit]
    );

    /** POST understand and append whatever comes back. Caller has already called begin(). */
    const understand = useCallback(
        async (request: UnderstandRequest) => {
            try {
                const result = await commandsService.understand(request);
                const entry: ResultEntry = { id: newId("r"), at: nowIso(), type: "result", request, result };
                if (result.kind === "preview") entry.status = "open";
                addBot(entry);
            } catch (e) {
                const err = toCommandsError(e);
                if (err.kind === "unavailable") onUnavailableRef.current?.();
                addBot({
                    id: newId("e"),
                    at: nowIso(),
                    type: "error",
                    request,
                    error: entryError(err, err.kind === "expired" ? "resend" : "edit"),
                });
            } finally {
                end();
            }
        },
        [addBot, end]
    );

    const send = useCallback(
        (text: string, attachments: CommandAttachment[] = []) => {
            const clean = text.trim();
            if (!clean || !begin()) return false;
            dispatch({ type: "supersede" });
            dispatch({ type: "add", entry: { id: newId("u"), at: nowIso(), type: "user", text: clean, attachments } });
            const request: UnderstandRequest = { text: clean, surface };
            if (attachments.length) request.attachments = attachments;
            void understand(request);
            return true;
        },
        [begin, surface, understand]
    );

    /** choose → re-send the same text with picks[slot] = option id. */
    const choose = useCallback(
        (entryId: string, option: ChooseOption) => {
            const entry = findResult(entryId);
            if (!entry || entry.result.kind !== "choose" || entry.pickedId || entry.superseded || !begin()) return;
            const { slot } = entry.result;
            dispatch({ type: "patch", id: entryId, patch: { pickedId: option.id } });
            dispatch({
                type: "add",
                entry: { id: newId("u"), at: nowIso(), type: "user", text: option.sublabel ? `${option.label} · ${option.sublabel}` : option.label, attachments: [] },
            });
            void understand({ ...entry.request, picks: { ...(entry.request.picks ?? {}), [slot]: option.id } });
        },
        [begin, findResult, understand]
    );

    /** need (text/number/date/time) → append the value to the text and send again. */
    const provideValue = useCallback(
        (entryId: string, value: string, display: string) => {
            const entry = findResult(entryId);
            const clean = value.trim();
            if (!entry || entry.result.kind !== "need" || entry.answered || entry.superseded || !clean || !begin()) return;
            dispatch({ type: "patch", id: entryId, patch: { answered: true } });
            dispatch({ type: "add", entry: { id: newId("u"), at: nowIso(), type: "user", text: display || clean, attachments: [] } });
            void understand({ ...entry.request, text: `${entry.request.text.trim()} ${clean}` });
        },
        [begin, findResult, understand]
    );

    /** need (images) → same text, photos added as attachments. */
    const provideImages = useCallback(
        (entryId: string, attachments: CommandAttachment[]) => {
            const entry = findResult(entryId);
            if (!entry || entry.result.kind !== "need" || entry.answered || entry.superseded || !attachments.length || !begin()) return;
            dispatch({ type: "patch", id: entryId, patch: { answered: true } });
            const n = attachments.length;
            dispatch({
                type: "add",
                entry: { id: newId("u"), at: nowIso(), type: "user", text: `${n} photo${n === 1 ? "" : "s"}`, attachments },
            });
            void understand({ ...entry.request, attachments: [...(entry.request.attachments ?? []), ...attachments] });
        },
        [begin, findResult, understand]
    );

    /** preview → POST run with its token. */
    const confirm = useCallback(
        async (entryId: string) => {
            const entry = findResult(entryId);
            if (!entry || entry.result.kind !== "preview") return;
            if (entry.status === "running" || entry.status === "confirmed" || entry.status === "cancelled") return;
            if (!begin()) return;
            dispatch({ type: "patch", id: entryId, patch: { status: "running", error: undefined } });
            try {
                const done = await commandsService.run(entry.result.token);
                dispatch({ type: "patch", id: entryId, patch: { status: "confirmed" } });
                addBot({ id: newId("d"), at: nowIso(), type: "done", result: done });
            } catch (e) {
                const err = toCommandsError(e);
                if (err.kind === "unavailable") onUnavailableRef.current?.();
                dispatch({ type: "patch", id: entryId, patch: { status: "failed", error: entryError(err, "resend") } });
                emit(entryId);
            } finally {
                end();
            }
        },
        [addBot, begin, emit, end, findResult]
    );

    const cancel = useCallback(
        (entryId: string) => {
            const entry = findResult(entryId);
            if (!entry || entry.result.kind !== "preview" || entry.status === "running" || entry.status === "confirmed") return;
            if (busyRef.current) return;
            dispatch({ type: "patch", id: entryId, patch: { status: "cancelled", error: undefined } });
            addBot({ id: newId("n"), at: nowIso(), type: "note", text: "Okay, nothing was changed." });
        },
        [addBot, findResult]
    );

    /**
     * Repeat the request behind an error entry or a failed preview.
     * "retry" repeats it exactly; "resend" sends the original text again (fresh picks and preview).
     */
    const retry = useCallback(
        (entryId: string) => {
            const entry = entriesRef.current.find((x) => x.id === entryId);
            if (!entry || busyRef.current) return;
            if (entry.type === "result" && entry.result.kind === "preview" && entry.status === "failed") {
                if (entry.error?.action === "retry") {
                    void confirm(entryId);
                    return;
                }
                if (!begin()) return;
                dispatch({ type: "patch", id: entryId, patch: { error: { ...(entry.error as EntryError), action: null } } });
                void understand(entry.request);
                return;
            }
            if (entry.type === "error" && !entry.resolved && entry.error.action && entry.error.action !== "edit") {
                if (!begin()) return;
                dispatch({ type: "patch", id: entryId, patch: { resolved: true } });
                void understand(entry.request);
            }
        },
        [begin, confirm, understand]
    );

    const reset = useCallback(() => {
        if (busyRef.current) return;
        dispatch({ type: "reset", startedAt: nowIso() });
        setEvent(null);
    }, []);

    return {
        entries: state.entries,
        startedAt: state.startedAt,
        busy,
        event,
        send,
        choose,
        provideValue,
        provideImages,
        confirm,
        cancel,
        retry,
        reset,
    };
}

export type CommandChat = ReturnType<typeof useCommandChat>;
