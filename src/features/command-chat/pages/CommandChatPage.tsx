import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FlaskConical, MessageSquareText, RotateCcw, ServerOff } from "lucide-react";
import {
    COMMANDS_UNAVAILABLE_MESSAGE,
    isCommandsApiError,
    isCommandsMockEnabled,
    setCommandsMock,
} from "@/services/commands.service";
import type { CommandAttachment } from "@/services/commands.types";
import { CHAT_GREETING, composerPlaceholder, describeEntry, openQuestion } from "../chatModel";
import { useCommandChat } from "../hooks/useCommandChat";
import { commandQueryKeys, useCommandCatalog, useCommandHistory } from "../hooks/useCommandQueries";
import { CHAT_SETTINGS_KEY } from "../hooks/useChatSettings";
import { useSessionDraft } from "../hooks/useSessionDraft";
import { ChatOff } from "../components/ChatOff";
import { Composer } from "../components/Composer";
import { HistorySection } from "../components/HistorySection";
import { BotMessage, MessageItem, type MessageHandlers } from "../components/MessageItem";
import { btnPill, btnToolbar, focusRing, TypingIndicator } from "../components/chatUi";

const SURFACE = "admin" as const;

function prefersReducedMotion(): boolean {
    return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function isTouch(): boolean {
    return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
}

/**
 * The chat: a conversation with SeekKrr. The team says what they need in
 * their own words; the chat answers, asks when something's missing (the
 * message box answers it), and shows a confirm card before anything changes.
 *
 * Renders inside the app shell's scrolling <main>: the messages flow with the
 * page and the composer sticks to the bottom of the visible area.
 */
export default function CommandChatPage() {
    const queryClient = useQueryClient();
    const [serverMissing, setServerMissing] = useState(false);
    const [turnedOff, setTurnedOff] = useState(false);
    const [mockOn, setMockOn] = useState(isCommandsMockEnabled);
    // Not listed anywhere: it only tells whether this server has the chat and whether it's on for the team.
    const availability = useCommandCatalog(SURFACE);
    const history = useCommandHistory();
    const chat = useCommandChat({ surface: SURFACE, onUnavailable: () => setServerMissing(true), onDisabled: () => setTurnedOff(true) });
    const [draft, setDraft] = useSessionDraft();
    const [lastSent, setLastSent] = useState<string | null>(null);
    const [announcement, setAnnouncement] = useState("");

    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const endRef = useRef<HTMLDivElement>(null);

    const probeError = isCommandsApiError(availability.error) ? availability.error.kind : null;
    const unavailable = serverMissing || probeError === "unavailable";
    // 403 CHAT_DISABLED: an admin turned the chat off for the team since the menu last checked.
    const chatOff = turnedOff || probeError === "disabled";

    // Re-read the switch so the menu and header drop Chat too.
    useEffect(() => {
        if (chatOff) void queryClient.invalidateQueries({ queryKey: CHAT_SETTINGS_KEY });
    }, [chatOff, queryClient]);

    const { entries, busy, event, startedAt } = chat;
    // The chat's open question: the message box answers it, with its placeholder as the hint.
    const question = openQuestion(entries);

    // Earlier commands = history from before this conversation began (later runs are already on screen).
    const earlier = useMemo(() => {
        const start = Date.parse(startedAt);
        return (history.data ?? []).filter((i) => {
            const t = Date.parse(i.at);
            return Number.isNaN(t) || Number.isNaN(start) || t < start;
        });
    }, [history.data, startedAt]);

    const focusComposer = useCallback(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus({ preventScroll: true });
        el.setSelectionRange(el.value.length, el.value.length);
    }, []);

    /** Put text in the composer (history, "edit and send again", a picked day or time) and move there. */
    const insert = useCallback(
        (text: string) => {
            setDraft(text);
            requestAnimationFrame(() => requestAnimationFrame(focusComposer));
        },
        [setDraft, focusComposer]
    );

    const sendMessage = chat.send;
    const send = useCallback(
        (text: string, attachments: CommandAttachment[]) => {
            const ok = sendMessage(text, attachments);
            if (ok) {
                setLastSent(text.trim());
                setDraft("");
            }
            return ok;
        },
        [sendMessage, setDraft]
    );

    const { choose, provideImages, confirm, cancel, retry } = chat;
    const handlers: MessageHandlers = useMemo(
        () => ({
            choose,
            provideImages,
            confirm: (id: string) => void confirm(id),
            cancel,
            retry,
            insert,
        }),
        [choose, provideImages, confirm, cancel, retry, insert]
    );

    // Keep the newest message in view (the end marker sits below the sticky composer).
    const firstScroll = useRef(true);
    useEffect(() => {
        const behavior: "auto" | "smooth" = firstScroll.current || prefersReducedMotion() ? "auto" : "smooth";
        firstScroll.current = false;
        endRef.current?.scrollIntoView({ block: "end", behavior });
    }, [entries.length, busy]);

    // A bot message arrived: announce it, and if it doesn't take focus itself, return focus to the composer.
    useEffect(() => {
        if (!event) return;
        const entry = entries.find((e) => e.id === event.entryId);
        if (!entry) return;
        const alerts = entry.type === "error" || (entry.type === "result" && entry.status === "failed");
        if (!alerts) setAnnouncement(describeEntry(entry));
        // Options, photos and confirm cards take focus; a question is answered in the message box.
        const takesFocus =
            entry.type === "result" &&
            entry.status !== "failed" &&
            (entry.result.kind === "choose" ||
                entry.result.kind === "preview" ||
                (entry.result.kind === "need" && entry.result.input === "images"));
        if (takesFocus || isTouch()) return;
        const active = document.activeElement;
        if (!active || active === document.body || rootRef.current?.contains(active)) focusComposer();
        // Only when a new event arrives — entries changing on their own must not steal focus.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event]);

    const startOver = () => {
        chat.reset();
        setAnnouncement("Started a new chat.");
        void queryClient.invalidateQueries({ queryKey: commandQueryKeys.history() });
        focusComposer();
    };

    const toggleMock = (on: boolean) => {
        setCommandsMock(on);
        setMockOn(on);
        setServerMissing(false);
        void queryClient.invalidateQueries({ queryKey: ["commands"] });
    };

    if (chatOff) return <ChatOff />;

    return (
        <div ref={rootRef} className="mx-auto w-full max-w-6xl flex gap-8 min-h-[calc(100dvh-9rem)]">
            <div className="flex-1 min-w-0 w-full max-w-3xl mx-auto flex flex-col">
                <header className="flex items-start justify-between gap-3 pb-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <span className="mt-0.5 hidden sm:flex w-10 h-10 shrink-0 items-center justify-center rounded-[14px] bg-[#003634] text-white shadow-sm">
                            <MessageSquareText className="w-5 h-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900 flex items-center gap-2 flex-wrap">
                                Chat
                                {mockOn && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FECD36]/30 text-[#6b4f00]">
                                        <FlaskConical className="w-3 h-3" aria-hidden="true" /> Demo data
                                    </span>
                                )}
                            </h1>
                            <p className="mt-0.5 text-sm text-neutral-500">
                                Tell SeekKrr what you need. Nothing changes until you confirm.
                                {import.meta.env.DEV && mockOn && import.meta.env.VITE_COMMANDS_MOCK !== "true" && (
                                    <>
                                        {" "}
                                        <button
                                            type="button"
                                            onClick={() => toggleMock(false)}
                                            className={`text-xs text-neutral-400 hover:text-neutral-700 underline underline-offset-2 rounded ${focusRing}`}
                                        >
                                            Turn off demo data
                                        </button>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {entries.length > 0 && (
                            <button type="button" onClick={startOver} disabled={busy} className={btnToolbar} title="Start a new chat">
                                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                                <span className="sr-only sm:not-sr-only">New chat</span>
                            </button>
                        )}
                    </div>
                </header>

                <div className="flex-1 flex flex-col">
                    {earlier.length > 0 && <HistorySection items={earlier} onUse={insert} />}

                    {unavailable && (
                        <div className="my-4 rounded-2xl border border-neutral-200 bg-white p-5 flex items-start gap-3" role="status">
                            <ServerOff className="w-5 h-5 mt-0.5 text-neutral-400 shrink-0" aria-hidden="true" />
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-neutral-900">{COMMANDS_UNAVAILABLE_MESSAGE}</p>
                                <p className="mt-0.5 text-sm text-neutral-500">Everything else in the portal works as usual.</p>
                                {import.meta.env.DEV && !mockOn && (
                                    <button type="button" onClick={() => toggleMock(true)} className={`${btnPill} mt-3`}>
                                        <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" /> Try it with demo data
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {(!unavailable || entries.length > 0) && (
                        <ol className="space-y-4 pb-2" aria-label="Conversation">
                            {/* The chat says hello first. */}
                            {!unavailable && (
                                <li>
                                    <BotMessage text={CHAT_GREETING} />
                                </li>
                            )}
                            {entries.map((entry) => (
                                <li key={entry.id}>
                                    <MessageItem
                                        entry={entry}
                                        busy={busy}
                                        autoFocus={event?.entryId === entry.id}
                                        handlers={handlers}
                                    />
                                </li>
                            ))}
                        </ol>
                    )}

                    {busy && (
                        <div className="mt-4">
                            <TypingIndicator />
                        </div>
                    )}
                </div>

                <div className="sticky bottom-0 z-10 -mx-1 px-1 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[var(--color-canvas,#f4f7f7)] from-70% to-transparent">
                    <Composer
                        value={draft}
                        onChange={setDraft}
                        onSend={send}
                        busy={busy}
                        unavailable={unavailable}
                        inputRef={inputRef}
                        lastSent={lastSent}
                        placeholder={composerPlaceholder(question)}
                    />
                </div>
                <div ref={endRef} aria-hidden="true" />

                <div aria-live="polite" aria-atomic="true" className="sr-only">
                    {announcement}
                </div>
            </div>
        </div>
    );
}
