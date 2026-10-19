import { forwardRef, useRef, type KeyboardEvent, type TextareaHTMLAttributes } from "react";
import { AlertTriangle, CheckCircle2, Send, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { EmailDeliveryStatus } from "../types";

function ConfigFlag({ ok, label, detail }: { ok: boolean; label: string; detail?: string | null }) {
    return (
        <span className={`inline-flex items-center gap-1.5 text-sm ${ok ? "text-emerald-700" : "text-neutral-500"}`}>
            {ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4 text-neutral-400" />}
            {label}
            {detail && <span className="text-xs text-neutral-400 font-mono">{detail}</span>}
        </span>
    );
}

/** Which transport is live, who emails come from, and whether anything can send at all. */
export function DeliveryBanner({ delivery, compact }: { delivery: EmailDeliveryStatus; compact?: boolean }) {
    const nothing = !delivery.smtp_configured && !delivery.zeptomail_configured;
    return (
        <Card padding="none" className={`overflow-hidden ${nothing ? "border-red-200" : ""}`}>
            <div className={`${compact ? "p-3 sm:px-4" : "p-4 sm:px-6"} flex flex-wrap items-center gap-x-8 gap-y-3`}>
                <div className="flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${nothing ? "bg-red-100 text-red-600" : "bg-teal-100 text-teal-600"}`}>
                        <Send className="w-5 h-5" />
                    </span>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Sending via</p>
                        <p className="text-base font-bold text-neutral-900">{delivery.transport === "zeptomail" ? "ZeptoMail API" : "SMTP (Zoho)"}</p>
                    </div>
                </div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">From</p>
                    <p className="text-sm text-neutral-800">
                        {delivery.from?.name ? `${delivery.from.name} ` : ""}
                        <span className="font-mono text-neutral-600">&lt;{delivery.from?.address ?? "—"}&gt;</span>
                    </p>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                    <ConfigFlag ok={delivery.smtp_configured} label="Zoho SMTP" detail={delivery.smtp_configured ? delivery.smtp_host : null} />
                    <ConfigFlag ok={delivery.zeptomail_configured} label="ZeptoMail" />
                </div>
            </div>
            {nothing && (
                <div className="px-4 sm:px-6 py-3 bg-red-50 border-t border-red-200 text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Neither Zoho SMTP nor ZeptoMail is configured on the server — emails won't send.
                </div>
            )}
        </Card>
    );
}

type CodeTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
    value: string;
    onValueChange: (value: string) => void;
};

/**
 * Monospace textarea for HTML. Tab inserts two spaces (no heavy editor
 * dependency). Press Esc first to let Tab move focus out of the field.
 */
export const CodeTextarea = forwardRef<HTMLTextAreaElement, CodeTextareaProps>(function CodeTextarea(
    { value, onValueChange, className = "", onKeyDown, ...rest },
    ref
) {
    const escaped = useRef(false);

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        if (e.key === "Escape") {
            escaped.current = true;
            return;
        }
        if (e.key === "Tab" && !escaped.current && !e.shiftKey) {
            e.preventDefault();
            const el = e.currentTarget;
            const { selectionStart: s, selectionEnd: end } = el;
            const next = `${value.slice(0, s)}  ${value.slice(end)}`;
            onValueChange(next);
            requestAnimationFrame(() => {
                el.selectionStart = el.selectionEnd = s + 2;
            });
            return;
        }
        escaped.current = false;
    };

    return (
        <textarea
            ref={ref}
            value={value}
            spellCheck={false}
            onChange={(e) => onValueChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-950 text-neutral-100 font-mono text-[12.5px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y ${className}`}
            {...rest}
        />
    );
});
