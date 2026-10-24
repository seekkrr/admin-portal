import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { APP_NAME, useRouteMeta } from "./routeMeta";

/** Keeps document.title in sync with the current page. */
export function DocumentTitle() {
    const { title } = useRouteMeta();
    useEffect(() => {
        document.title = `${title} · ${APP_NAME}`;
    }, [title]);
    return null;
}

export function Breadcrumbs() {
    const { crumbs } = useRouteMeta();
    if (crumbs.length < 2) return null;
    const parent = crumbs.length > 2 ? crumbs[crumbs.length - 2] : undefined;

    return (
        <nav aria-label="Breadcrumb" className="mb-3 text-[13px]">
            {/* Phone: one "back to list" link on detail pages, the section name otherwise */}
            <div className="md:hidden">
                {parent?.to ? (
                    <Link to={parent.to} className="-ml-1 inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-medium text-accent-700 hover:underline">
                        <ChevronLeft className="h-4 w-4" aria-hidden />
                        {parent.label}
                    </Link>
                ) : (
                    <span className="text-ink-faint">{crumbs[0]?.label}</span>
                )}
            </div>
            <ol className="hidden flex-wrap items-center gap-1 md:flex">
                {crumbs.map((c, i) => {
                    const last = i === crumbs.length - 1;
                    return (
                        <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
                            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />}
                            {last ? (
                                <span aria-current="page" className="max-w-[24rem] truncate font-medium text-ink-muted">
                                    {c.label}
                                </span>
                            ) : c.to ? (
                                <Link to={c.to} className="truncate text-ink-faint hover:text-accent-700 hover:underline">
                                    {c.label}
                                </Link>
                            ) : (
                                <span className="truncate text-ink-faint">{c.label}</span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
