import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { ChooseOption, CommandAttachment } from "@/services/commands.types";
import type { ChatEntry, ResultEntry } from "../chatModel";
import { AnswerCard } from "./AnswerCard";
import { ChooseOptions } from "./ChooseOptions";
import { NeedMessage } from "./NeedMessage";
import { PreviewCard } from "./PreviewCard";
import { BotAvatar, botBubble, botText, btnPill, focusRing, PathLink, Thumb } from "./chatUi";

export interface MessageHandlers {
    choose: (entryId: string, option: ChooseOption) => void;
    provideImages: (entryId: string, attachments: CommandAttachment[]) => void;
    confirm: (entryId: string) => void;
    cancel: (entryId: string) => void;
    retry: (entryId: string) => void;
    /** Put text into the message box ("edit and send again", a picked day or time). */
    insert: (text: string) => void;
}

const timeOf = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

/** The chat's side of the conversation: its avatar, then the message. */
export function BotRow({ children, at, wide }: { children: ReactNode; at?: string; wide?: boolean }) {
    return (
        <div className="flex items-start gap-2.5" title={at ? timeOf(at) : undefined}>
            <BotAvatar />
            <div className={`min-w-0 flex-1 ${wide ? "max-w-[36rem]" : "max-w-[32rem]"}`}>
                <span className="sr-only">SeekKrr says: </span>
                {children}
            </div>
        </div>
    );
}

/** A plain chat message from SeekKrr. */
export function BotMessage({ text, at }: { text: string; at?: string }) {
    return (
        <BotRow at={at}>
            <div className={botBubble}>
                <p className={botText}>{text}</p>
            </div>
        </BotRow>
    );
}

function ResultMessage({ entry, busy, autoFocus, h }: { entry: ResultEntry; busy: boolean; autoFocus: boolean; h: MessageHandlers }) {
    const r = entry.result;
    switch (r.kind) {
        case "choose":
            return (
                <BotRow at={entry.at} wide>
                    <div className={botBubble}>
                        <ChooseOptions
                            result={r}
                            pickedId={entry.pickedId}
                            superseded={entry.superseded}
                            busy={busy}
                            autoFocus={autoFocus}
                            onChoose={(o) => h.choose(entry.id, o)}
                        />
                    </div>
                </BotRow>
            );
        case "need":
            return (
                <BotRow at={entry.at}>
                    <div className={botBubble}>
                        <NeedMessage
                            result={r}
                            request={entry.request}
                            open={!entry.answered && !entry.superseded}
                            busy={busy}
                            autoFocus={autoFocus}
                            onPicked={h.insert}
                            onImages={(a) => h.provideImages(entry.id, a)}
                        />
                    </div>
                </BotRow>
            );
        case "preview":
            return (
                <BotRow at={entry.at} wide>
                    {r.lead && (
                        <div className={`${botBubble} mb-2 w-fit max-w-full`}>
                            <p className={botText}>{r.lead}</p>
                        </div>
                    )}
                    <PreviewCard
                        result={r}
                        status={entry.status}
                        error={entry.error}
                        busy={busy}
                        autoFocus={autoFocus}
                        onConfirm={() => h.confirm(entry.id)}
                        onCancel={() => h.cancel(entry.id)}
                        onRetry={() => h.retry(entry.id)}
                    />
                </BotRow>
            );
        case "answer":
            return (
                <BotRow at={entry.at} wide>
                    <div className={botBubble}>
                        <AnswerCard result={r} />
                    </div>
                </BotRow>
            );
        case "denied":
        case "unknown":
            // Just the message: the team answers in their own words.
            return <BotMessage text={r.message} at={entry.at} />;
    }
}

/** One conversation entry. */
export function MessageItem({
    entry,
    busy,
    autoFocus,
    handlers,
}: {
    entry: ChatEntry;
    busy: boolean;
    /** This entry just arrived — move focus into it if it asks for input. */
    autoFocus: boolean;
    handlers: MessageHandlers;
}) {
    switch (entry.type) {
        case "user":
            return (
                <div className="flex flex-col items-end gap-1.5" title={timeOf(entry.at)}>
                    {entry.attachments.length > 0 && (
                        <div className="flex flex-wrap justify-end gap-1.5 max-w-[80%]">
                            {entry.attachments.map((a, i) => (
                                <Thumb key={`${a.url}-${i}`} src={a.url} alt={`Attached photo ${i + 1}`} size="lg" />
                            ))}
                        </div>
                    )}
                    <p className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-md bg-[#003634] text-white px-4 py-2.5 text-sm whitespace-pre-wrap break-words shadow-sm">
                        <span className="sr-only">You said: </span>
                        {entry.text}
                    </p>
                </div>
            );
        case "result":
            return <ResultMessage entry={entry} busy={busy} autoFocus={autoFocus} h={handlers} />;
        case "done":
            return (
                <BotRow at={entry.at}>
                    <div className={botBubble}>
                        <p className={botText}>{entry.result.message}</p>
                        {entry.result.url_path && (
                            <div className="mt-2.5">
                                <PathLink to={entry.result.url_path} className={btnPill}>
                                    Open <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                                </PathLink>
                            </div>
                        )}
                    </div>
                </BotRow>
            );
        case "error": {
            const { error } = entry;
            return (
                <BotRow at={entry.at}>
                    <div className="rounded-2xl rounded-tl-md border border-red-200 bg-red-50/60 px-4 py-3 shadow-sm" role="alert">
                        <p className={botText}>{error.message}</p>
                        {error.action && !entry.resolved && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => (error.action === "edit" ? handlers.insert(entry.request.text) : handlers.retry(entry.id))}
                                className={`mt-1.5 text-sm font-medium text-red-700 hover:text-red-900 hover:underline underline-offset-2 disabled:opacity-50 rounded ${focusRing}`}
                            >
                                {error.action === "retry" ? "Retry" : error.action === "resend" ? "Send again" : "Edit and send again"}
                            </button>
                        )}
                    </div>
                </BotRow>
            );
        }
        case "note":
            return <BotMessage text={entry.text} at={entry.at} />;
    }
}
