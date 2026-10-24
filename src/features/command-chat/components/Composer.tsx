import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { ArrowUp, ImagePlus, Loader2 } from "lucide-react";
import type { CommandAttachment, CommandSurface } from "@/services/commands.types";
import { uploadCategoryFor } from "../chatModel";
import { useCommandSuggestions } from "../hooks/useCommandQueries";
import { MAX_IMAGES, useImageUploads } from "../hooks/useImageUploads";
import { ImageThumbs } from "./ImageThumbs";
import { btnIconPrimary, focusRing } from "./chatUi";

const LIST_ID = "command-chat-suggestions";
const MAX_HEIGHT = 160;

function fitHeight(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
}

/**
 * Message box: Enter sends, Shift+Enter adds a line, ↑/↓ + Enter/Tab pick a
 * suggestion, Esc closes the list, ↑ in an empty box recalls the last command.
 * Photos upload as soon as they're picked and go with the next message.
 * While a request is in flight the box is read-only (focus stays put).
 */
export function Composer({
    value,
    onChange,
    onSend,
    busy,
    unavailable,
    inputRef,
    lastSent,
    surface = "admin",
}: {
    value: string;
    onChange: (v: string) => void;
    onSend: (text: string, attachments: CommandAttachment[]) => boolean;
    busy: boolean;
    unavailable: boolean;
    inputRef: RefObject<HTMLTextAreaElement>;
    lastSent: string | null;
    surface?: CommandSurface;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const valueRef = useRef(value);
    valueRef.current = value;
    const uploads = useImageUploads({ category: () => uploadCategoryFor(valueRef.current) });
    const [note, setNote] = useState<string | null>(null);

    const [listOpen, setListOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const { suggestions } = useCommandSuggestions(value, listOpen && !unavailable, surface);
    const showList = listOpen && suggestions.length > 0;

    // New suggestions → nothing highlighted until the user moves.
    const suggestionKey = suggestions.map((s) => s.text).join("\n");
    useEffect(() => {
        setActive(-1);
    }, [suggestionKey]);

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
            setListOpen(false);
        }
    };

    const accept = (index: number) => {
        const s = suggestions[index];
        if (!s) return;
        onChange(s.text);
        setActive(-1);
        // Keep the list open: accepting "add images to " should offer place names next.
        setListOpen(true);
        requestAnimationFrame(() => {
            const el = inputRef.current;
            if (el) el.setSelectionRange(el.value.length, el.value.length);
        });
    };

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.nativeEvent.isComposing) return;
        if (showList) {
            const n = suggestions.length;
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => (a + 1) % n);
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => (a <= 0 ? n - 1 : a - 1));
                return;
            }
            if (e.key === "Tab" && !e.shiftKey) {
                e.preventDefault();
                accept(active >= 0 ? active : 0);
                return;
            }
            if (e.key === "Enter" && !e.shiftKey && active >= 0) {
                e.preventDefault();
                accept(active);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                setListOpen(false);
                return;
            }
        }
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

    const activeId = showList && active >= 0 ? `${LIST_ID}-${active}` : undefined;
    const placeholder = unavailable ? "Chat isn't available on this server yet" : "Type what you want to do…";

    return (
        <div className="relative">
            {showList && (
                <div className="absolute bottom-full left-0 right-0 mb-2 z-20 rounded-2xl border border-neutral-200 bg-white shadow-lg overflow-hidden">
                    <ul id={LIST_ID} role="listbox" aria-label="Suggestions" className="max-h-72 overflow-y-auto py-1">
                        {suggestions.map((s, i) => (
                            <li
                                key={`${s.text}-${i}`}
                                id={`${LIST_ID}-${i}`}
                                role="option"
                                aria-selected={i === active}
                                // Keep focus in the textarea.
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => accept(i)}
                                onMouseEnter={() => setActive(i)}
                                className={`flex items-center gap-3 px-4 py-2 cursor-pointer text-sm ${
                                    i === active ? "bg-[#00A49E]/10" : ""
                                }`}
                            >
                                <span className="flex-1 min-w-0 truncate text-neutral-900">{s.label}</span>
                                {s.hint && <span className="shrink-0 max-w-[45%] truncate text-xs text-neutral-500">{s.hint}</span>}
                            </li>
                        ))}
                    </ul>
                    <p className="hidden sm:block px-4 py-1.5 border-t border-neutral-100 text-[11px] text-neutral-400">
                        ↑ ↓ to move · Tab or Enter to complete · Esc to close
                    </p>
                </div>
            )}

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
                        Command
                    </label>
                    <textarea
                        ref={inputRef}
                        id="command-chat-input"
                        rows={1}
                        value={value}
                        onChange={(e) => {
                            onChange(e.target.value);
                            setListOpen(true);
                        }}
                        onKeyDown={onKeyDown}
                        onBlur={() => setListOpen(false)}
                        onFocus={() => value && setListOpen(true)}
                        readOnly={disabled}
                        aria-disabled={disabled || undefined}
                        aria-busy={busy || undefined}
                        placeholder={placeholder}
                        role="combobox"
                        aria-expanded={showList}
                        aria-controls={showList ? LIST_ID : undefined}
                        aria-autocomplete="list"
                        aria-activedescendant={activeId}
                        aria-describedby="command-chat-hint"
                        enterKeyHint="send"
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        // The box around it shows focus; skip the global outline on the bare textarea.
                        style={{ outline: "none" }}
                        className="flex-1 min-w-0 resize-none bg-transparent px-1.5 py-2.5 text-[15px] sm:text-sm leading-5 text-neutral-900 placeholder:text-neutral-400 read-only:cursor-default"
                    />
                    <button type="button" onClick={submit} disabled={!canSend} aria-label={busy ? "Working…" : "Send"} className={btnIconPrimary}>
                        {busy || uploads.uploading ? (
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
