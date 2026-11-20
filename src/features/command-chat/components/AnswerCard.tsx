import { ArrowRight, ChevronRight } from "lucide-react";
import type { AnswerResult } from "@/services/commands.types";
import { isAdminPath, MAX_ANSWER_ITEMS } from "../chatModel";
import { botText, btnPill, focusRing, PathLink, Thumb } from "./chatUi";

/**
 * The chat's answer: its words (the title only when there's no text), the
 * records it found (up to eight rows, each opening its own screen), and one
 * small button to the admin screen with the rest. The button only opens admin
 * portal routes, in place (react-router).
 */
export function AnswerCard({ result }: { result: AnswerResult }) {
    const said = result.text?.trim() || result.title.trim();
    const items = result.items.slice(0, MAX_ANSWER_ITEMS);
    const hasThumbs = items.some((i) => i.image_url);
    const link = result.link && isAdminPath(result.link.url_path) ? result.link : null;
    return (
        <div>
            {said ? <p className={botText}>{said}</p> : !items.length && !link && <p className="text-sm text-neutral-500">Nothing to show.</p>}
            {items.length > 0 && (
                <ul className={`${said ? "mt-2.5" : ""} -mx-1 divide-y divide-neutral-100`}>
                    {items.map((item, i) => {
                        const body = (
                            <>
                                {hasThumbs && <Thumb src={item.image_url} size="sm" />}
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-medium text-neutral-900 truncate">{item.label}</span>
                                    {item.sublabel && <span className="block text-xs text-neutral-500 truncate">{item.sublabel}</span>}
                                </span>
                                {item.url_path && <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" aria-hidden="true" />}
                            </>
                        );
                        return (
                            <li key={`${item.label}-${i}`}>
                                {item.url_path ? (
                                    <PathLink
                                        to={item.url_path}
                                        className={`flex items-center gap-3 px-1 py-2 rounded-lg hover:bg-neutral-50 transition-colors ${focusRing}`}
                                    >
                                        {body}
                                    </PathLink>
                                ) : (
                                    <div className="flex items-center gap-3 px-1 py-2">{body}</div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            {link && (
                <div className={said || items.length ? "mt-2.5" : ""}>
                    <PathLink to={link.url_path.trim()} className={btnPill}>
                        {link.label}
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </PathLink>
                </div>
            )}
        </div>
    );
}
