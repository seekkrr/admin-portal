/** Lets any page open the header search palette without prop drilling. */
const EVENT = "seekkrr:open-search";

export function openSearchPalette() {
    window.dispatchEvent(new Event(EVENT));
}

export function onOpenSearchPalette(handler: () => void): () => void {
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
}
