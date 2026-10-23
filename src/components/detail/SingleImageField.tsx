import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { mediaService } from "@/services/media.service";
import { IconButton } from "@/components/ui/Button";
import { buttonClass } from "@/components/ui/buttonStyles";
import { cx } from "@/utils/cx";

/** One optional photo (curator portrait, itinerary step): upload, preview, remove. */
export function SingleImageField({
    value,
    onChange,
    category,
    entityId,
    disabled,
    label = "Photo",
}: {
    value: string;
    onChange: (url: string) => void;
    category: string;
    entityId?: string;
    disabled?: boolean;
    label?: string;
}) {
    const ref = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);

    const upload = async (file: File | undefined) => {
        if (!file) return;
        setBusy(true);
        try {
            const res = await mediaService.uploadImage(file, { category, entity_id: entityId });
            onChange(res.secure_url);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Upload failed");
        } finally {
            setBusy(false);
            if (ref.current) ref.current.value = "";
        }
    };

    return (
        <div className="flex items-center gap-3">
            {value ? (
                <img src={value} alt={label} className="h-14 w-14 shrink-0 rounded-control border border-line object-cover" />
            ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-control border border-dashed border-line-strong text-ink-faint">
                    <ImagePlus className="h-5 w-5" aria-hidden />
                </span>
            )}
            {!disabled && (
                <div className="flex items-center gap-1.5">
                    <label className={cx(buttonClass("secondary", "sm"), "cursor-pointer", busy && "pointer-events-none opacity-50")}>
                        {busy ? "Uploading…" : value ? "Replace" : "Upload"}
                        <input ref={ref} type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
                    </label>
                    {value && <IconButton icon={Trash2} size="sm" label={`Remove ${label.toLowerCase()}`} onClick={() => onChange("")} />}
                </div>
            )}
        </div>
    );
}
