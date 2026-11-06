import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { ArrowUp, ImagePlus, Loader2 } from "lucide-react";
import type { CommandAttachment } from "@/services/commands.types";
import { MESSAGE_PLACEHOLDER, uploadCategoryFor } from "../chatModel";
import { MAX_IMAGES, useImageUploads } from "../hooks/useImageUploads";
import { ImageThumbs } from "./ImageThumbs";
import { btnIconPrimary, focusRing } from "./chatUi";

const MAX_HEIGHT = 160;

function fitHeight(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
}

/**
 * Message box: Enter sends, Shift+Enter adds a line, ↑ in an empty box recalls
 * the last message. It also answers the chat's open question (the hint then
 * says what's asked). Photos upload as soon as they're picked and go with the
 * next message. While a request is in flight the box is read-only (focus
 * stays put).
 */
export function Composer({
    value,
    onChange,
    onSend,
    busy,
    unavailable,
    inputRef,
    lastSent,
    placeholder = MESSAGE_PLACEHOLDER,
}: {
    value: string;
    onChange: (v: string) => void;
    onSend: (text: string, attachments: CommandAttachment[]) => boolean;
    busy: boolean;
    unavailable: boolean;
    inputRef: RefObject<HTMLTextAreaElement>;
    lastSent: string | null;
    /** The hint in the empty box: "Message SeekKrr", or the open question's placeholder. */
    placeholder?: string;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const valueRef = useRef(value);
    valueRef.current = value;
    const uploads = useImageUploads({ category: () => uploadCategoryFor(valueRef.current) });
    const [note, setNote] = useState<string | null>(null);

    // Grow with the text, up to a limit — re-measured when the text or the box width changes.
    useLayoutEffect(() => {
        const el = inputRef.current;
        if (el) fitHeight(el);
    }, [value, inputRef]);
    useEffect(() => {
        const el = inputRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;
        let width = -1;
        const ro = new ResizeObserver(() => {
            if (el.clientWidth === width) return;
            width = el.clientWidth;
            fitHeight(el);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [inputRef]);

    const disabled = busy || unavailable;
    const canSend = !disabled && value.trim().length > 0 && !uploads.uploading;

    const submit = () => {
        if (!canSend) return;
        if (onSend(value, uploads.attachments)) {
            uploads.clear();
            setNote(null);
        }
    };

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === "ArrowUp" && !value && lastSent) {
            e.preventDefault();
            onChange(lastSent);
            return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
        }
    };

    const hint = unavailable ? "Chat isn't available on this server yet" : placeholder;

    return (
        <div className="relative">
            <div
                className={`rounded-2xl border bg-white shadow-sm transition-colors ${
                    unavailable ? "border-neutral-200 bg-neutral-50" : "border-neutral-200 focus-within:border-[#00A49E] focus-within:ring-2 focus-within:ring-[#00A49E]/20"
                }`}
            >
                {uploads.items.length > 0 && (
                    <div className="px-3 pt-3">
                        <ImageThumbs items={uploads.items} onRemove={uploads.remove} onRetry={uploads.retry} disabled={busy} />
                    </div>
                )}
                <div className="flex items-end gap-1.5 p-1.5">
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={disabled || uploads.items.length >= MAX_IMAGES}
                        aria-label="Attach photos"
                        title="Attach photos"
                        className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-neutral-500 hover:text-[#003634] hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors ${focusRing}`}
                    >
                        <ImagePlus className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        tabIndex={-1}
                        aria-hidden="true"
                        onChange={(e) => {
                            const files = e.target.files;
                            if (files?.length) {
                                const skipped = uploads.add(files);
                                setNote(skipped ? `${skipped} file${skipped === 1 ? " was" : "s were"} skipped (photos only, up to ${MAX_IMAGES}).` : null);
                            }
                            e.target.value = "";
                            inputRef.current?.focus();
                        }}
                    />
                    <label htmlFor="command-chat-input" className="sr-only">
                        Message
                    </label>
                    <textarea
                        ref={inputRef}
                        id="command-chat-input"
                        rows={1}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={onKeyDown}
                        readOnly={disabled}
                        aria-disabled={disabled || undefined}
                        aria-busy={busy || undefined}
                        placeholder={hint}
                        aria-describedby="command-chat-hint"
                        enterKeyHint="send"
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        // The box around it shows focus; skip the global outline on the bare textarea.
                        style={{ outline: "none" }}
                        className="flex-1 min-w-0 resize-none bg-transparent px-1.5 py-2.5 text-[15px] sm:text-sm leading-5 text-neutral-900 placeholder:text-neutral-400 read-only:cursor-default"
                    />
                    <button type="button" onClick={submit} disabled={!canSend} aria-label="Send" className={btnIconPrimary}>
                        {uploads.uploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <ArrowUp className="w-4 h-4" aria-hidden="true" />
                        )}
                    </button>
                </div>
            </div>
            <p id="command-chat-hint" className="mt-1.5 px-2 text-[11px] text-neutral-400 flex flex-wrap gap-x-3">
                {note ? (
                    <span className="text-amber-700">{note}</span>
                ) : uploads.uploading ? (
                    <span>Uploading photos…</span>
                ) : (
                    <>
                        <span>Nothing changes until you confirm.</span>
                        <span className="hidden sm:inline">Enter to send · Shift+Enter for a new line</span>
                    </>
                )}
            </p>
        </div>
    );
}
