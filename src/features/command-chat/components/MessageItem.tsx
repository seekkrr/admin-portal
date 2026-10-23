import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, HelpCircle, Pencil, RotateCw, ShieldAlert } from "lucide-react";
import type { ChooseOption, CommandAttachment } from "@/services/commands.types";
import type { ChatEntry, ResultEntry } from "../chatModel";
import { AnswerCard } from "./AnswerCard";
import { ChooseOptions } from "./ChooseOptions";
import { NeedInput } from "./NeedInput";
import { PreviewCard } from "./PreviewCard";
import { BotAvatar, btnLink, exampleChip, focusRing, PathLink, Thumb } from "./chatUi";

export interface MessageHandlers {
    choose: (entryId: string, option: ChooseOption) => void;
    provideValue: (entryId: string, value: string, display: string) => void;
    provideImages: (entryId: string, attachments: CommandAttachment[]) => void;
    confirm: (entryId: string) => void;
    cancel: (entryId: string) => void;
    retry: (entryId: string) => void;
    /** Put text into the composer (examples, "edit and send again"). */
    insert: (text: string) => void;
}

const timeOf = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

function BotRow({ children, at, wide }: { children: ReactNode; at: string; wide?: boolean }) {
    return (
        <div className="flex items-start gap-2.5" title={timeOf(at)}>
            <BotAvatar />
            <div className={`min-w-0 flex-1 ${wide ? "max-w-[36rem]" : "max-w-[32rem]"}`}>
                <span className="sr-only">Chat says: </span>
                {children}
            </div>
        </div>
    );
}

const bubble = "rounded-2xl rounded-tl-md border px-4 py-3 shadow-sm";

function ExampleChips({ examples, onInsert }: { examples: string[]; onInsert: (t: string) => void }) {
    if (!examples.length) return null;
    return (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Examples">
            {examples.slice(0, 6).map((ex) => (
                <button key={ex} type="button" onClick={() => onInsert(ex)} className={exampleChip}>
                    {ex}
                </button>
            ))}
        </div>
    );
}

function ResultMessage({ entry, busy, autoFocus, h }: { entry: ResultEntry; busy: boolean; autoFocus: boolean; h: MessageHandlers }) {
    const r = entry.result;
    switch (r.kind) {
        case "choose":
            return (
                <BotRow at={entry.at} wide>
                    <div className={`${bubble} bg-white border-neutral-200`}>
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
                    <div className={`${bubble} bg-white border-neutral-200`}>
                        <NeedInput
                            result={r}
                            request={entry.request}
                            answered={entry.answered}
                            superseded={entry.superseded}
                            busy={busy}
                            autoFocus={autoFocus}
                            onValue={(v, d) => h.provideValue(entry.id, v, d)}
                            onImages={(a) => h.provideImages(entry.id, a)}
                        />
                    </div>
                </BotRow>
            );
        case "preview":
            return (
                <BotRow at={entry.at} wide>
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
                    <div className={`${bubble} bg-white border-neutral-200`}>
                        <AnswerCard result={r} />
                    </div>
                </BotRow>
            );
        case "denied":
            return (
                <BotRow at={entry.at}>
                    <div className={`${bubble} bg-amber-50/70 border-amber-200 flex items-start gap-2.5`}>
                        <ShieldAlert className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" aria-hidden="true" />
                        <p className="text-sm text-neutral-800">{r.message}</p>
                    </div>
                </BotRow>
            );
        case "unknown":
            return (
                <BotRow at={entry.at}>
                    <div className={`${bubble} bg-white border-neutral-200`}>
                        <div className="flex items-start gap-2.5">
                            <HelpCircle className="w-4 h-4 mt-0.5 text-neutral-400 shrink-0" aria-hidden="true" />
                            <p className="text-sm text-neutral-800">{r.message}</p>
                        </div>
                        <ExampleChips examples={r.examples} onInsert={h.insert} />
                    </div>
                </BotRow>
            );
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
                    <div className={`${bubble} bg-emerald-50/70 border-emerald-200`}>
                        <div className="flex items-start gap-2.5">
                            <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" aria-hidden="true" />
                            <div className="min-w-0">
                                <p className="text-sm text-neutral-900">{entry.result.message}</p>
                                {entry.result.url_path && (
                                    <PathLink to={entry.result.url_path} className={`${btnLink} mt-1.5`}>
                                        Open <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                                    </PathLink>
                                )}
                            </div>
                        </div>
                    </div>
                </BotRow>
            );
        case "error": {
            const { error } = entry;
            return (
                <BotRow at={entry.at}>
                    <div className={`${bubble} bg-red-50/70 border-red-200`} role="alert">
                        <div className="flex items-start gap-2.5">
                            <AlertTriangle className="w-4 h-4 mt-0.5 text-red-600 shrink-0" aria-hidden="true" />
                            <div className="min-w-0">
                                <p className="text-sm text-neutral-900">{error.message}</p>
                                {error.action && !entry.resolved && (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                            error.action === "edit" ? handlers.insert(entry.request.text) : handlers.retry(entry.id)
                                        }
                                        className={`mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-red-700 hover:text-red-900 hover:underline underline-offset-2 disabled:opacity-50 rounded ${focusRing}`}
                                    >
                                        {error.action === "edit" ? (
                                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                                        ) : (
                                            <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
                                        )}
                                        {error.action === "retry" ? "Retry" : error.action === "resend" ? "Send again" : "Edit and send again"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </BotRow>
            );
        }
        case "note":
            return (
                <BotRow at={entry.at}>
                    <p className="px-1 py-1.5 text-sm text-neutral-500">{entry.text}</p>
                </BotRow>
            );
    }
}
