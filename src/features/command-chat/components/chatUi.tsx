import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ImageOff } from "lucide-react";

/**
 * Small shared pieces for the command chat. Same visual language as the rest
 * of the portal (rounded-xl controls, neutral borders, teal focus rings) with
 * the SeekKrr brand: dark teal #003634 for primary actions, teal #00A49E for
 * accents, yellow #FECD36 for highlights.
 */

/** Keyboard focus: the portal-wide teal outline (matches the shared Button). */
export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A49E]";

export const btnPrimary = `inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#003634] hover:bg-[#04423f] rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${focusRing}`;

/** Square icon-only primary button (send). */
export const btnIconPrimary = `inline-flex items-center justify-center w-10 h-10 shrink-0 text-white bg-[#003634] hover:bg-[#04423f] rounded-xl shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${focusRing}`;

export const btnDanger = `inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${focusRing}`;

export const btnSecondary = `inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${focusRing}`;

/** Compact secondary button for page-header actions. */
export const btnToolbar = `inline-flex items-center justify-center gap-2 h-9 px-3 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${focusRing}`;

export const btnLink = `inline-flex items-center gap-1 text-sm font-medium text-[#00716d] hover:text-[#003634] hover:underline underline-offset-2 disabled:opacity-50 disabled:no-underline ${focusRing} rounded`;

/** Tappable example phrase / suggestion chip. */
export const exampleChip = `inline-flex items-center max-w-full px-3 py-1.5 rounded-full border border-neutral-200 bg-white text-xs text-neutral-700 hover:border-[#00A49E] hover:bg-[#00A49E]/5 hover:text-[#003634] transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed ${focusRing}`;

export const inputClass =
    "w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00A49E] focus:border-transparent disabled:bg-neutral-50 disabled:text-neutral-500";

/** Internal portal path → router Link; absolute URL → new tab. */
export function PathLink({ to, className, children, ariaLabel }: { to: string; className?: string; children: ReactNode; ariaLabel?: string }) {
    if (/^https?:\/\//i.test(to)) {
        return (
            <a href={to} target="_blank" rel="noreferrer" className={className} aria-label={ariaLabel}>
                {children}
            </a>
        );
    }
    return (
        <Link to={to.startsWith("/") ? to : `/${to}`} className={className} aria-label={ariaLabel}>
            {children}
        </Link>
    );
}

/** Square thumbnail with a quiet fallback (no image, or it failed to load). */
export function Thumb({ src, alt = "", size = "md" }: { src: string | null | undefined; alt?: string; size?: "sm" | "md" | "lg" }) {
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    const box = { sm: "w-8 h-8 rounded-lg", md: "w-10 h-10 rounded-xl", lg: "w-16 h-16 rounded-xl border border-neutral-200" }[size];
    if (!src || failedSrc === src) {
        return (
            <span
                className={`${box} shrink-0 bg-neutral-100 text-neutral-300 flex items-center justify-center`}
                role={alt ? "img" : undefined}
                aria-label={alt || undefined}
                aria-hidden={alt ? undefined : true}
            >
                <ImageOff className="w-4 h-4" aria-hidden="true" />
            </span>
        );
    }
    return (
        <img
            src={src}
            alt={alt}
            loading="lazy"
            onError={() => setFailedSrc(src)}
            className={`${box} shrink-0 object-cover bg-neutral-100`}
        />
    );
}

/** The chat's avatar next to bot messages. */
export function BotAvatar() {
    return (
        <span
            className="w-8 h-8 shrink-0 rounded-xl bg-[#003634] flex items-center justify-center shadow-sm"
            aria-hidden="true"
        >
            <span className="font-bold text-[13px] leading-none text-[#FECD36]">S</span>
        </span>
    );
}
