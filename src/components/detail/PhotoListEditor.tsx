import { useRef, useState, type DragEvent } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { mediaService } from "@/services/media.service";
import { IconButton } from "@/components/ui/Button";
import { buttonClass } from "@/components/ui/buttonStyles";
import { cx } from "@/utils/cx";

export interface PhotoUploadTarget {
    /** Backend media category (marker, quest, website, …). */
    category: string;
    entityId?: string;
}

/**
 * Photos in order: upload (several at once), drag to reorder on a computer,
 * arrow buttons on phones, remove. The first photo can be labelled as the cover.
 * Controlled: the parent saves `value` when it wants.
 */
export function PhotoListEditor({
    value,
    onChange,
    upload,
    max = 20,
    disabled,
    coverLabel = "Cover",
    label = "Photos",
}: {
    value: string[];
    onChange: (next: string[]) => void;
    upload: PhotoUploadTarget;
    max?: number;
    disabled?: boolean;
    /** Badge on the first photo; pass null for none. */
    coverLabel?: string | null;
    /** Accessible name of the list. */
    label?: string;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(0);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [overIndex, setOverIndex] = useState<number | null>(null);

    const move = (from: number, to: number) => {
        if (to < 0 || to >= value.length || from === to) return;
        const next = [...value];
        const [item] = next.splice(from, 1);
        if (item === undefined) return;
        next.splice(to, 0, item);
        onChange(next);
    };

    const onFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const room = Math.max(0, max - value.length);
        const picked = Array.from(files).slice(0, room);
        if (picked.length < files.length) toast.info(`Only ${max} photos fit; ${files.length - picked.length} were left out.`);
        if (!picked.length) return;
        setUploading(picked.length);
        try {
            const urls = await Promise.all(
                picked.map(async (f) => (await mediaService.uploadImage(f, { category: upload.category, entity_id: upload.entityId })).secure_url)
            );
            onChange([...value, ...urls.filter((u) => !value.includes(u))]);
            toast.success(`${urls.length} photo${urls.length === 1 ? "" : "s"} uploaded. Save to keep ${urls.length === 1 ? "it" : "them"}.`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Upload failed");
        } finally {
            setUploading(0);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const dragProps = (i: number) =>
        disabled
            ? {}
            : {
                  draggable: true,
                  onDragStart: (e: DragEvent) => {
                      setDragIndex(i);
                      e.dataTransfer.effectAllowed = "move";
                  },
                  onDragOver: (e: DragEvent) => {
                      e.preventDefault();
                      setOverIndex(i);
                  },
                  onDragLeave: () => setOverIndex((o) => (o === i ? null : o)),
                  onDrop: (e: DragEvent) => {
                      e.preventDefault();
                      if (dragIndex !== null) move(dragIndex, i);
                      setDragIndex(null);
                      setOverIndex(null);
                  },
                  onDragEnd: () => {
                      setDragIndex(null);
                      setOverIndex(null);
                  },
              };

    return (
        <div className="space-y-3">
            {value.length > 0 ? (
                <ul aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {value.map((url, i) => (
                        <li
                            key={url}
                            {...dragProps(i)}
                            className={cx(
                                "group relative overflow-hidden rounded-control border bg-surface-muted",
                                overIndex === i && dragIndex !== i ? "border-accent-500 ring-2 ring-accent-500/40" : "border-line",
                                dragIndex === i && "opacity-50"
                            )}
                        >
                            <a href={url} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3]">
                                <img src={url} alt={`Photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
                            </a>
                            {i === 0 && coverLabel && (
                                <span className="absolute left-2 top-2 rounded-md bg-brand-900/85 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                                    {coverLabel}
                                </span>
                            )}
                            {!disabled && (
                                <>
                                    <span className="absolute right-2 top-2 hidden rounded-md bg-surface/90 p-1 text-ink-muted md:block" aria-hidden title="Drag to reorder">
                                        <GripVertical className="h-3.5 w-3.5" />
                                    </span>
                                    <div className="flex items-center justify-between gap-1 border-t border-line bg-surface px-1.5 py-1">
                                        <div className="flex gap-0.5">
                                            <IconButton icon={ChevronLeft} size="sm" label={`Move photo ${i + 1} earlier`} onClick={() => move(i, i - 1)} disabled={i === 0} />
                                            <IconButton
                                                icon={ChevronRight}
                                                size="sm"
                                                label={`Move photo ${i + 1} later`}
                                                onClick={() => move(i, i + 1)}
                                                disabled={i === value.length - 1}
                                            />
                                        </div>
                                        <IconButton
                                            icon={Trash2}
                                            size="sm"
                                            label={`Remove photo ${i + 1}`}
                                            className="hover:bg-bad-soft hover:text-bad"
                                            onClick={() => onChange(value.filter((_, j) => j !== i))}
                                        />
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-ink-faint">No photos yet.</p>
            )}
            {!disabled && (
                <div className="flex flex-wrap items-center gap-3">
                    <label
                        className={cx(
                            buttonClass("secondary", "md"),
                            "cursor-pointer",
                            (uploading > 0 || value.length >= max) && "pointer-events-none opacity-50"
                        )}
                    >
                        <ImagePlus className="h-4 w-4" aria-hidden />
                        {uploading > 0 ? `Uploading ${uploading}…` : "Add photos"}
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="sr-only"
                            disabled={uploading > 0 || value.length >= max}
                            onChange={(e) => onFiles(e.target.files)}
                        />
                    </label>
                    <span className="text-xs text-ink-faint">
                        {value.length}/{max} · drag or use the arrows to reorder
                    </span>
                </div>
            )}
        </div>
    );
}
