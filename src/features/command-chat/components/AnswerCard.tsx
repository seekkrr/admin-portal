import { ChevronRight } from "lucide-react";
import type { AnswerResult } from "@/services/commands.types";
import { focusRing, PathLink, Thumb } from "./chatUi";

/** Read-only answer ("what needs me", "show …"): title, text and a list with links. */
export function AnswerCard({ result }: { result: AnswerResult }) {
    const hasThumbs = result.items.some((i) => i.image_url);
    return (
        <div>
            {result.title && <h3 className="text-[15px] font-semibold text-neutral-900">{result.title}</h3>}
            {result.text && <p className="mt-0.5 text-sm text-neutral-600 whitespace-pre-line">{result.text}</p>}
            {result.items.length > 0 && (
                <ul className="mt-3 -mx-1 divide-y divide-neutral-100">
                    {result.items.map((item, i) => {
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
            {!result.text && result.items.length === 0 && <p className="mt-1 text-sm text-neutral-500">Nothing to show.</p>}
        </div>
    );
}
