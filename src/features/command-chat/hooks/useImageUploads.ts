import { useCallback, useEffect, useRef, useState } from "react";
import { commandsService } from "@/services/commands.service";
import type { CommandAttachment } from "@/services/commands.types";

export interface PendingImage {
    id: string;
    file: File;
    /** Local preview (object URL) — shown until and after upload. */
    preview: string;
    status: "uploading" | "done" | "error";
    attachment?: CommandAttachment;
    error?: string;
}

export const MAX_IMAGES = 10;

let counter = 0;

/**
 * Photos picked in the chat: upload right away through the portal's media
 * broker, show thumbnails, allow remove / retry. `attachments` holds only the
 * finished uploads.
 */
export function useImageUploads(options: { category: () => string; entityId?: string }) {
    const [items, setItems] = useState<PendingImage[]>([]);
    const itemsRef = useRef(items);
    itemsRef.current = items;
    const optionsRef = useRef(options);
    optionsRef.current = options;

    // Free object URLs on unmount.
    useEffect(
        () => () => {
            itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview));
        },
        []
    );

    const upload = useCallback((item: PendingImage) => {
        const { category, entityId } = optionsRef.current;
        commandsService
            .uploadImage(item.file, { category: category(), ...(entityId ? { entityId } : {}) })
            .then((attachment) => {
                setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "done", attachment, error: undefined } : i)));
            })
            .catch((e: unknown) => {
                const message = e instanceof Error ? e.message : "Upload failed";
                setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "error", error: message } : i)));
            });
    }, []);

    /** Returns how many files were skipped (not images / over the limit). */
    const add = useCallback(
        (files: FileList | File[]): number => {
            const room = MAX_IMAGES - itemsRef.current.length;
            const images = Array.from(files).filter((f) => f.type.startsWith("image/") && f.type !== "image/svg+xml");
            const accepted = images.slice(0, Math.max(0, room));
            const fresh: PendingImage[] = accepted.map((file) => {
                counter += 1;
                return { id: `img_${counter}`, file, preview: URL.createObjectURL(file), status: "uploading" };
            });
            if (fresh.length) {
                setItems((prev) => [...prev, ...fresh]);
                fresh.forEach(upload);
            }
            return Array.from(files).length - fresh.length;
        },
        [upload]
    );

    const remove = useCallback((id: string) => {
        setItems((prev) => {
            const gone = prev.find((i) => i.id === id);
            if (gone) URL.revokeObjectURL(gone.preview);
            return prev.filter((i) => i.id !== id);
        });
    }, []);

    const retry = useCallback(
        (id: string) => {
            const item = itemsRef.current.find((i) => i.id === id);
            if (!item || item.status !== "error") return;
            setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "uploading", error: undefined } : i)));
            upload(item);
        },
        [upload]
    );

    /** Empty the list (after sending — the conversation shows the uploaded URLs, not these previews). */
    const clear = useCallback(() => {
        itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview));
        setItems([]);
    }, []);

    const attachments = items.flatMap((i) => (i.status === "done" && i.attachment ? [i.attachment] : []));
    return {
        items,
        attachments,
        uploading: items.some((i) => i.status === "uploading"),
        failed: items.some((i) => i.status === "error"),
        add,
        remove,
        retry,
        clear,
    };
}
