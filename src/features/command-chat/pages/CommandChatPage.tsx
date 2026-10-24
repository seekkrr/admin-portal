import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, FlaskConical, MessageSquareText, RotateCcw, ServerOff } from "lucide-react";
import {
    COMMANDS_UNAVAILABLE_MESSAGE,
    isCommandsApiError,
    isCommandsMockEnabled,
    setCommandsMock,
} from "@/services/commands.service";
import type { CommandAttachment } from "@/services/commands.types";
import { describeEntry } from "../chatModel";
import { useCommandChat } from "../hooks/useCommandChat";
import { useCommandCatalog, useCommandHistory } from "../hooks/useCommandQueries";
import { useSessionDraft } from "../hooks/useSessionDraft";
import { CatalogPanel, CatalogSheet } from "../components/CatalogPanel";
import { Composer } from "../components/Composer";
import { HistorySection } from "../components/HistorySection";
import { MessageItem, type MessageHandlers } from "../components/MessageItem";
import { BotAvatar, btnToolbar, exampleChip, focusRing } from "../components/chatUi";

const SURFACE = "admin" as const;

function prefersReducedMotion(): boolean {
    return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function isTouch(): boolean {
    return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
}

/**
 * Command chat (no AI): type what you want to do ("add images to Emaho Cafe"),
 * answer any follow-up (which place? which photos?), check the preview, confirm.
 *
 * Renders inside the app shell's scrolling <main>: the messages flow with the
 * page and the composer sticks to the bottom of the visible area.
 */
export default function CommandChatPage() {
    const queryClient = useQueryClient();
    const [serverMissing, setServerMissing] = useState(false);
    const [mockOn, setMockOn] = useState(isCommandsMockEnabled);
    const catalog = useCommandCatalog(SURFACE);
    const history = useCommandHistory();
    const chat = useCommandChat({ surface: SURFACE, onUnavailable: () => setServerMissing(true) });
    const [draft, setDraft] = useSessionDraft();
    const [lastSent, setLastSent] = useState<string | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [announcement, setAnnouncement] = useState("");

    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const endRef = useRef<HTMLDivElement>(null);

    const unavailable =
        serverMissing || (isCommandsApiError(catalog.error) && catalog.error.kind === "unavailable");

    const { entries, busy, event, startedAt } = chat;
    // Confirming shows its own spinner on the preview's button — no typing dots then.
    const running = entries.some((e) => e.type === "result" && e.status === "running");

    // Earlier commands = history from before this conversation began (later runs are already on screen).
    const earlier = useMemo(() => {
        const start = Date.parse(startedAt);
        return (history.data ?? []).filter((i) => {
            const t = Date.parse(i.at);
            return Number.isNaN(t) || Number.isNaN(start) || t < start;
        });
    }, [history.data, startedAt]);

    const welcomeExamples = useMemo(() => {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const c of catalog.data ?? []) {
            const ex = c.examples[0];
            if (ex && !seen.has(c.area)) {
                seen.add(c.area);
                out.push(ex);
            }
        }
        return out.slice(0, 4);
    }, [catalog.data]);

    const focusComposer = useCallback(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus({ preventScroll: true });
        el.setSelectionRange(el.value.length, el.value.length);
    }, []);

    /** Put text in the composer (examples, history, "edit and send again") and move there. */
    const insert = useCallback(
        (text: string) => {
            setDraft(text);
            setSheetOpen(false);
            // After the sheet closes (it hands focus back on close).
            requestAnimationFrame(() => requestAnimationFrame(focusComposer));
        },
        [setDraft, focusComposer]
    );

    const sendCommand = chat.send;
    const send = useCallback(
        (text: string, attachments: CommandAttachment[]) => {
            const ok = sendCommand(text, attachments);
            if (ok) {
                setLastSent(text.trim());
                setDraft("");
            }
            return ok;
        },
        [sendCommand, setDraft]
    );

    const { choose, provideValue, provideImages, confirm, cancel, retry } = chat;
    const handlers: MessageHandlers = useMemo(
        () => ({
            choose,
            provideValue,
            provideImages,
            confirm: (id: string) => void confirm(id),
            cancel,
            retry,
            insert,
        }),
        [choose, provideValue, provideImages, confirm, cancel, retry, insert]
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
        const takesFocus =
            entry.type === "result" &&
            entry.status !== "failed" &&
            (entry.result.kind === "choose" || entry.result.kind === "need" || entry.result.kind === "preview");
        if (takesFocus || isTouch()) return;
        const active = document.activeElement;
        if (!active || active === document.body || rootRef.current?.contains(active)) focusComposer();
        // Only when a new event arrives — entries changing on their own must not steal focus.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event]);

    const startOver = () => {
        chat.reset();
        setAnnouncement("Started a new chat.");
        void queryClient.invalidateQueries({ queryKey: ["commands", "history"] });
        focusComposer();
    };

    const toggleMock = (on: boolean) => {
        setCommandsMock(on);
        setMockOn(on);
        setServerMissing(false);
        void queryClient.invalidateQueries({ queryKey: ["commands"] });
    };

    const closeSheet = useCallback(() => setSheetOpen(false), []);
    const catalogPanel = (
        <CatalogPanel
            commands={catalog.data}
            isLoading={catalog.isLoading}
            error={Boolean(catalog.error) && !unavailable}
            unavailable={unavailable}
            onRetry={() => void catalog.refetch()}
            onInsert={insert}
        />
    );

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
                            <p className="mt-0.5 text-sm text-neutral-500">Type what you want to do. Nothing changes until you confirm.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button type="button" onClick={() => setSheetOpen(true)} className={`${btnToolbar} lg:hidden`} aria-haspopup="dialog">
                            <BookOpen className="w-4 h-4" aria-hidden="true" />
                            <span className="sr-only sm:not-sr-only">What can I do?</span>
                        </button>
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
                                    <button type="button" onClick={() => toggleMock(true)} className={`${exampleChip} mt-3`}>
                                        <FlaskConical className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" /> Try it with demo data
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {entries.length === 0 && !unavailable && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-2">
                            <span className="w-12 h-12 rounded-2xl bg-[#003634] flex items-center justify-center shadow-sm" aria-hidden="true">
                                <MessageSquareText className="w-6 h-6 text-[#FECD36]" />
                            </span>
                            <h2 className="mt-4 text-lg font-semibold text-neutral-900">What do you want to do?</h2>
                            <p className="mt-1 max-w-sm text-sm text-neutral-500">
                                Say it the way you would to a colleague. You&apos;ll see exactly what changes before anything happens.
                            </p>
                            {welcomeExamples.length > 0 && (
                                <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-lg" role="group" aria-label="Examples">
                                    {welcomeExamples.map((ex) => (
                                        <button key={ex} type="button" onClick={() => insert(ex)} className={exampleChip}>
                                            {ex}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {entries.length > 0 && (
                        <ol className="space-y-4 pb-2" aria-label="Conversation">
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

                    {busy && !running && (
                        <div className="mt-4 flex items-start gap-2.5" role="status">
                            <BotAvatar />
                            <span className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md border border-neutral-200 bg-white px-4 py-3.5 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:-0.3s]" aria-hidden="true" />
                                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:-0.15s]" aria-hidden="true" />
                                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" aria-hidden="true" />
                                <span className="sr-only">Working on it…</span>
                            </span>
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
                        surface={SURFACE}
                    />
                </div>
                <div ref={endRef} aria-hidden="true" />

                <div aria-live="polite" aria-atomic="true" className="sr-only">
                    {announcement}
                </div>
            </div>

            <aside className="hidden lg:block w-72 xl:w-80 shrink-0" aria-labelledby="command-catalog-rail-title">
                <div className="sticky top-[calc(var(--app-header-h)+1rem)] max-h-[calc(100dvh-var(--app-header-h)-2rem)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                    <h2 id="command-catalog-rail-title" className="text-sm font-semibold text-neutral-900 mb-4">
                        What you can do
                    </h2>
                    {catalogPanel}
                    {import.meta.env.DEV && mockOn && import.meta.env.VITE_COMMANDS_MOCK !== "true" && (
                        <button type="button" onClick={() => toggleMock(false)} className={`mt-6 text-xs text-neutral-400 hover:text-neutral-700 underline underline-offset-2 rounded ${focusRing}`}>
                            Turn off demo data
                        </button>
                    )}
                </div>
            </aside>

            <CatalogSheet open={sheetOpen} onClose={closeSheet}>
                {catalogPanel}
            </CatalogSheet>
        </div>
    );
}
