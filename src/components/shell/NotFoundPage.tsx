import { useLocation } from "react-router-dom";
import { Compass, Search, Sun } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { usePageTitle } from "@/hooks/usePageTitle";
import { openSearchPalette } from "./searchEvents";

/** Shown for any address the portal doesn't know. */
export function NotFoundPage() {
    usePageTitle("Page not found");
    const { pathname } = useLocation();
    return (
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center sm:py-24">
            <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <Compass className="h-7 w-7" aria-hidden />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Page not found</h1>
            <p className="mt-2 max-w-md text-sm text-ink-muted">
                There's nothing at <span className="break-all font-mono text-ink">{pathname}</span>. The link may be old, or the page moved in the new menu.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <ButtonLink to="/today" variant="primary" icon={Sun}>
                    Go to Today
                </ButtonLink>
                <Button variant="secondary" icon={Search} onClick={openSearchPalette}>
                    Search
                </Button>
            </div>
        </div>
    );
}
