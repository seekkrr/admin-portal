import { AlertCircle, Loader2, RotateCw, X } from "lucide-react";
import type { PendingImage } from "../hooks/useImageUploads";
import { focusRing } from "./chatUi";

/** Thumbnails of photos being attached, with remove and retry. */
export function ImageThumbs({
    items,
    onRemove,
    onRetry,
    disabled,
}: {
    items: PendingImage[];
    onRemove: (id: string) => void;
    onRetry: (id: string) => void;
    disabled?: boolean;
}) {
    if (!items.length) return null;
    return (
        <ul className="flex flex-wrap gap-2" aria-label="Attached photos">
            {items.map((item, i) => (
                <li key={item.id} className="relative w-16 h-16">
                    <img
                        src={item.preview}
                        alt={`Photo ${i + 1}: ${item.file.name}`}
                        className={`w-16 h-16 rounded-xl object-cover border ${
                            item.status === "error" ? "border-red-300 opacity-60" : "border-neutral-200"
                        }`}
                    />
                    {item.status === "uploading" && (
                        <span className="absolute inset-0 rounded-xl bg-white/60 flex items-center justify-center" role="status">
                            <Loader2 className="w-5 h-5 animate-spin text-[#003634]" aria-hidden="true" />
                            <span className="sr-only">Uploading {item.file.name}</span>
                        </span>
                    )}
                    {item.status === "error" && (
                        <button
                            type="button"
                            onClick={() => onRetry(item.id)}
                            disabled={disabled}
                            title={item.error ?? "Upload failed"}
                            aria-label={`Upload of ${item.file.name} failed${item.error ? `: ${item.error}` : ""}. Try again`}
                            className={`absolute inset-0 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-red-700 bg-red-50/80 ${focusRing}`}
                        >
                            <AlertCircle className="w-4 h-4" aria-hidden="true" />
                            <span className="flex items-center gap-0.5">
                                <RotateCw className="w-3 h-3" aria-hidden="true" /> Retry
                            </span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        disabled={disabled}
                        aria-label={`Remove ${item.file.name}`}
                        className={`absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-white border border-neutral-200 shadow-sm flex items-center justify-center text-neutral-500 hover:text-neutral-900 disabled:opacity-50 ${focusRing}`}
                    >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                </li>
            ))}
        </ul>
    );
}
