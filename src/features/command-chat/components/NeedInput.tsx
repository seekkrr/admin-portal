import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowUp, ImagePlus, Loader2 } from "lucide-react";
import type { CommandAttachment, NeedResult, UnderstandRequest } from "@/services/commands.types";
import { formatNeedValue, uploadCategoryFor } from "../chatModel";
import { MAX_IMAGES, useImageUploads } from "../hooks/useImageUploads";
import { ImageThumbs } from "./ImageThumbs";
import { btnIconPrimary, btnPrimary, btnSecondary, exampleChip, inputClass } from "./chatUi";

/** A missing value: an inline input of the requested type, or a photo picker. */
export function NeedInput({
    result,
    request,
    answered,
    superseded,
    busy,
    autoFocus,
    onValue,
    onImages,
}: {
    result: NeedResult;
    request: UnderstandRequest;
    answered?: boolean;
    superseded?: boolean;
    busy: boolean;
    autoFocus: boolean;
    onValue: (value: string, display: string) => void;
    onImages: (attachments: CommandAttachment[]) => void;
}) {
    const done = Boolean(answered) || Boolean(superseded);
    return (
        <div>
            <p className="text-sm text-neutral-800">{result.prompt}</p>
            {!done &&
                (result.input === "images" ? (
                    <ImageNeed request={request} busy={busy} autoFocus={autoFocus} onImages={onImages} />
                ) : (
                    <ValueNeed result={result} busy={busy} autoFocus={autoFocus} onValue={onValue} />
                ))}
            {superseded && !answered && <p className="mt-2 text-xs text-neutral-400">Skipped</p>}
        </div>
    );
}

function ValueNeed({
    result,
    busy,
    autoFocus,
    onValue,
}: {
    result: NeedResult;
    busy: boolean;
    autoFocus: boolean;
    onValue: (value: string, display: string) => void;
}) {
    const id = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (autoFocus) inputRef.current?.focus({ preventScroll: true });
    }, [autoFocus]);

    const submit = (e?: FormEvent) => {
        e?.preventDefault();
        const clean = value.trim();
        if (!clean) {
            setError("Type a value first.");
            inputRef.current?.focus();
            return;
        }
        if (result.input === "number" && Number.isNaN(Number(clean))) {
            setError("That isn't a number.");
            inputRef.current?.focus();
            return;
        }
        setError(null);
        onValue(clean, formatNeedValue(result.input, clean));
    };

    const type = result.input === "number" ? "text" : result.input;
    return (
        <form onSubmit={submit} className="mt-3" noValidate>
            <label htmlFor={id} className="sr-only">
                {result.prompt}
            </label>
            <div className="flex items-center gap-2">
                <input
                    ref={inputRef}
                    id={id}
                    type={type}
                    inputMode={result.input === "number" ? "decimal" : undefined}
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        if (error) setError(null);
                    }}
                    placeholder={result.placeholder ?? undefined}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-err` : undefined}
                    readOnly={busy}
                    className={`${inputClass} flex-1 min-w-0`}
                />
                <button type="submit" disabled={busy} className={btnIconPrimary} aria-label="Send">
                    <ArrowUp className="w-4 h-4" aria-hidden="true" />
                </button>
            </div>
            {result.input === "date" && (
                <div className="mt-2 flex flex-wrap gap-2">
                    {(["today", "tomorrow"] as const).map((word) => (
                        <button
                            key={word}
                            type="button"
                            disabled={busy}
                            onClick={() => onValue(word, word.replace(/^\w/, (c) => c.toUpperCase()))}
                            className={exampleChip}
                        >
                            {word.replace(/^\w/, (c) => c.toUpperCase())}
                        </button>
                    ))}
                </div>
            )}
            {error && (
                <p id={`${id}-err`} className="mt-1.5 text-xs text-red-600">
                    {error}
                </p>
            )}
        </form>
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
