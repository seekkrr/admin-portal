import { useEffect, useId, useRef, type RefObject } from "react";

/**
 * Shared behaviour for every pop-up layer (modal, side panel, menu drawer,
 * search palette):
 *  - Escape closes the TOP layer only (stacked pop-ups close one at a time)
 *  - Tab / Shift+Tab stay inside the layer (focus trap)
 *  - focus moves into the layer on open and back to the opener on close
 *  - the page behind does not scroll while a layer is open
 */

const FOCUSABLE =
    'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

const layerStack: string[] = [];
let scrollLocks = 0;
let savedOverflow = "";

function lockScroll() {
    if (scrollLocks === 0) {
        savedOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
    }
    scrollLocks += 1;
}

function unlockScroll() {
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks === 0) document.body.style.overflow = savedOverflow;
}

export function getFocusable(root: HTMLElement): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true" && el.offsetParent !== null
    );
}

export interface UseOverlayOptions {
    onClose: () => void;
    /** Element to focus on open (defaults to the first focusable, else the layer). */
    initialFocusRef?: RefObject<HTMLElement | null>;
    /** Lock page scroll while open (default true). */
    lockScroll?: boolean;
}

export function useOverlay(open: boolean, containerRef: RefObject<HTMLElement | null>, options: UseOverlayOptions) {
    const id = useId();
    const onCloseRef = useRef(options.onClose);
    const initialFocusRef = options.initialFocusRef;
    const shouldLock = options.lockScroll ?? true;

    useEffect(() => {
        onCloseRef.current = options.onClose;
    }, [options.onClose]);

    useEffect(() => {
        if (!open) return;
        const opener = document.activeElement as HTMLElement | null;
        layerStack.push(id);
        if (shouldLock) lockScroll();

        // Focus after paint so the layer is in the DOM and visible.
        const raf = window.requestAnimationFrame(() => {
            const root = containerRef.current;
            if (!root) return;
            if (root.contains(document.activeElement)) return; // autoFocus already placed it
            const target = initialFocusRef?.current ?? getFocusable(root)[0] ?? root;
            target.focus({ preventScroll: true });
        });

        const onKeyDown = (e: KeyboardEvent) => {
            if (layerStack[layerStack.length - 1] !== id) return;
            if (e.key === "Escape") {
                e.stopPropagation();
                onCloseRef.current();
                return;
            }
            if (e.key !== "Tab") return;
            const root = containerRef.current;
            if (!root) return;
            const items = getFocusable(root);
            if (items.length === 0) {
                e.preventDefault();
                root.focus();
                return;
            }
            const first = items[0];
            const last = items[items.length - 1];
            if (!first || !last) return;
            const active = document.activeElement as HTMLElement | null;
            if (e.shiftKey && (active === first || !root.contains(active))) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (active === last || !root.contains(active))) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown);

        return () => {
            window.cancelAnimationFrame(raf);
            document.removeEventListener("keydown", onKeyDown);
            const idx = layerStack.lastIndexOf(id);
            if (idx >= 0) layerStack.splice(idx, 1);
            if (shouldLock) unlockScroll();
            if (opener && typeof opener.focus === "function" && document.contains(opener)) {
                opener.focus({ preventScroll: true });
            }
        };
    }, [open, id, containerRef, initialFocusRef, shouldLock]);
}
