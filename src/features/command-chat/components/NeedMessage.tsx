import { useEffect, useRef, useState } from "react";
import { CalendarDays, Clock, ImagePlus, Loader2 } from "lucide-react";
import type { CommandAttachment, NeedResult, UnderstandRequest } from "@/services/commands.types";
import { uploadCategoryFor } from "../chatModel";
import { MAX_IMAGES, useImageUploads } from "../hooks/useImageUploads";
import { ImageThumbs } from "./ImageThumbs";
import { botText, btnPill, btnPrimary, btnSecondary } from "./chatUi";

/**
 * A missing value, asked as a plain chat message: the message box answers it.
 * A day or time can also be picked ("Pick a date" puts it in the message box);
 * photos are picked right here.
 */
export function NeedMessage({
    result,
    request,
    open,
    busy,
    autoFocus,
    onPicked,
    onImages,
}: {
    result: NeedResult;
    request: UnderstandRequest;
    /** Not answered yet, and nothing newer was typed. */
    open: boolean;
    busy: boolean;
    autoFocus: boolean;
    /** A picked day or time, for the message box. */
    onPicked: (value: string) => void;
    onImages: (attachments: CommandAttachment[]) => void;
}) {
    return (
        <div>
            <p className={botText}>{result.prompt}</p>
            {open && (result.input === "date" || result.input === "time") && (
                <PickValue input={result.input} busy={busy} onPicked={onPicked} />
            )}
            {open && result.input === "images" && <ImageNeed request={request} busy={busy} autoFocus={autoFocus} onImages={onImages} />}
        </div>
    );
}

/** "Pick a date" / "Pick a time": the browser's own picker; the value goes to the message box to send. */
function PickValue({ input, busy, onPicked }: { input: "date" | "time"; busy: boolean; onPicked: (value: string) => void }) {
    const pickerRef = useRef<HTMLInputElement>(null);
    const open = () => {
        const el = pickerRef.current;
        if (!el) return;
        try {
            el.showPicker();
        } catch {
            // Older browsers: focusing the field opens (or lets them type into) it.
            el.focus();
        }
    };
    const Icon = input === "date" ? CalendarDays : Clock;
    return (
        <span className="relative mt-2.5 inline-flex">
            <button type="button" onClick={open} disabled={busy} className={btnPill}>
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                {input === "date" ? "Pick a date" : "Pick a time"}
            </button>
            <input
                ref={pickerRef}
                type={input}
                tabIndex={-1}
                aria-hidden="true"
                className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                onChange={(e) => {
                    const v = e.target.value;
                    if (v) onPicked(v);
                }}
            />
        </span>
    );
}

function ImageNeed({
    request,
    busy,
    autoFocus,
    onImages,
}: {
    request: UnderstandRequest;
    busy: boolean;
    autoFocus: boolean;
    onImages: (attachments: CommandAttachment[]) => void;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const pickRef = useRef<HTMLButtonElement>(null);
    const [note, setNote] = useState<string | null>(null);
    const picks = request.picks ?? {};
    const uploads = useImageUploads({
        category: () => uploadCategoryFor(request.text),
        entityId: picks.quest ?? picks.place,
    });

    useEffect(() => {
        if (autoFocus) pickRef.current?.focus({ preventScroll: true });
    }, [autoFocus]);

    const count = uploads.attachments.length;
    const canSend = count > 0 && !uploads.uploading && !busy;
    return (
        <div className="mt-3 space-y-3">
            <ImageThumbs items={uploads.items} onRemove={uploads.remove} onRetry={uploads.retry} disabled={busy} />
            <div className="flex flex-wrap items-center gap-2">
                <button
                    ref={pickRef}
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={busy || uploads.items.length >= MAX_IMAGES}
                    className={btnSecondary}
                >
                    <ImagePlus className="w-4 h-4" aria-hidden="true" />
                    {uploads.items.length ? "Add more" : "Choose photos"}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        onImages(uploads.attachments);
                        uploads.clear();
                    }}
                    disabled={!canSend}
                    className={btnPrimary}
                >
                    {uploads.uploading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                    {uploads.uploading ? "Uploading…" : count ? `Use ${count} photo${count === 1 ? "" : "s"}` : "Use photos"}
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
                    }}
                />
            </div>
            {note && <p className="text-xs text-neutral-500">{note}</p>}
        </div>
    );
}
