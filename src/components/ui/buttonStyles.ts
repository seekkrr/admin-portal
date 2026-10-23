import { cx } from "@/utils/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BASE =
    "inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap select-none transition-colors " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 " +
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

const VARIANTS: Record<ButtonVariant, string> = {
    primary: "bg-brand-900 text-white shadow-sm hover:bg-brand-700 active:bg-brand-950",
    secondary: "bg-surface text-ink border border-line-strong shadow-sm hover:bg-surface-muted hover:border-brand-200",
    ghost: "text-ink-muted hover:bg-brand-50 hover:text-ink",
    danger: "bg-bad text-white shadow-sm hover:bg-red-800 active:bg-red-900",
};

export const SIZES: Record<ButtonSize, { text: string; icon: string; iconOnly: string }> = {
    sm: { text: "h-8 px-3 text-[13px]", icon: "w-3.5 h-3.5", iconOnly: "h-8 w-8" },
    md: { text: "h-10 px-4 text-sm", icon: "w-4 h-4", iconOnly: "h-10 w-10" },
};

/** Button classes for anything that should look like a button (links, labels). */
export function buttonClass(
    variant: ButtonVariant = "secondary",
    size: ButtonSize = "md",
    opts: { block?: boolean; iconOnly?: boolean; className?: string } = {}
): string {
    return cx(
        BASE,
        VARIANTS[variant],
        opts.iconOnly ? SIZES[size].iconOnly : SIZES[size].text,
        opts.block && "w-full",
        opts.className
    );
}
