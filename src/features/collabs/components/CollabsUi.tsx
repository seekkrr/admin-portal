import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Check, Copy, Loader2, Search, X, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { LoadingFallback } from "@components/LoadingFallback";
import { Card } from "@/components/ui/Card";
import { featuresOf } from "../utils";
import type { AdminBusiness } from "../types";

/**
 * Shared building blocks for the Collabs admin pages. They reproduce the
 * portal's existing visual language (CreatorApplicationsPage header & table
 * card, ApplicationDetailModal / CouponCreateModal modal shells, Narratives
 * segmented tabs) so the new section looks native.
 */

export const inputClass =
    "w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-neutral-50 disabled:text-neutral-500";

export const btnPrimary =
    "inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export const btnSecondary =
    "inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export const btnDanger =
    "inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export const btnSmApprove =
    "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50";

export const btnSmReject =
    "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50";

export const btnSmNeutral =
    "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 transition-colors disabled:opacity-50";

export const thClass = "text-left px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider";

// ── Page header ────────────────────────────────────────────

export function PageHeader({
    icon: Icon,
    title,
    subtitle,
    badge,
    actions,
    gradient = "from-teal-500 to-teal-600",
}: {
    icon: LucideIcon;
    title: string;
    subtitle?: ReactNode;
    badge?: ReactNode;
    actions?: ReactNode;
    gradient?: string;
}) {
    return (
        <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-3 flex-wrap">
                        {title}
                        {badge}
                    </h1>
                    {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
                </div>
            </div>
            {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
        </div>
    );
}

export function CountBadge({ count, label, tone = "red" }: { count: number; label: string; tone?: "red" | "amber" }) {
    if (!count) return null;
    const cls = tone === "red" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
    return (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
            {count} {label}
        </span>
    );
}

// ── Status pill ────────────────────────────────────────────

type Tone = "amber" | "emerald" | "red" | "blue" | "violet" | "orange" | "neutral";

const STATUS_TONES: Record<Tone, { dot: string; bg: string }> = {
    amber: { dot: "bg-amber-500", bg: "bg-amber-50 text-amber-700 border-amber-200" },
    emerald: { dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    red: { dot: "bg-red-500", bg: "bg-red-50 text-red-700 border-red-200" },
    blue: { dot: "bg-blue-500", bg: "bg-blue-50 text-blue-700 border-blue-200" },
    violet: { dot: "bg-violet-500", bg: "bg-violet-50 text-violet-700 border-violet-200" },
    orange: { dot: "bg-orange-500", bg: "bg-orange-50 text-orange-700 border-orange-200" },
    neutral: { dot: "bg-neutral-400", bg: "bg-neutral-50 text-neutral-600 border-neutral-200" },
};

const STATUS_TONE_OF: Record<string, Tone> = {
    pending: "amber",
    requested: "amber",
    pending_claim: "amber",
    open: "amber",
    invited: "amber",
    approved: "emerald",
    active: "emerald",
    published: "emerald",
    verified: "emerald",
    completed: "emerald",
    redeemed: "emerald",
    resolved: "neutral",
    rejected: "red",
    declined: "red",
    suspended: "red",
    cancelled: "red",
    no_show: "red",
    halted: "red",
    delivered: "blue",
    trialing: "blue",
    actioned: "violet",
    overdue: "orange",
    expired: "neutral",
    archived: "neutral",
    paused: "neutral",
    draft: "neutral",
    dismissed: "neutral",
    free: "neutral",
};

const STATUS_LABELS: Record<string, string> = { pending_claim: "No owner yet" };

export function StatusPill({ status, label }: { status: string | null | undefined; label?: string }) {
    if (!status) return <span className="text-neutral-400">—</span>;
    label = label ?? STATUS_LABELS[status];
    const tone = STATUS_TONES[STATUS_TONE_OF[status] ?? "neutral"];
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${tone.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
            {label ?? status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
        </span>
    );
}

export function Chip({ children, tone = "neutral", title }: { children: ReactNode; tone?: "neutral" | "teal" | "amber" | "red" | "violet"; title?: string }) {
    const tones = {
        neutral: "bg-neutral-100 text-neutral-700 border-neutral-200",
        teal: "bg-teal-50 text-teal-700 border-teal-200",
        amber: "bg-amber-50 text-amber-700 border-amber-200",
        red: "bg-red-50 text-red-700 border-red-200",
        violet: "bg-violet-50 text-violet-700 border-violet-200",
    };
    return (
        <span title={title} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${tones[tone]}`}>
            {children}
        </span>
    );
}

/** Small chips for what a business can use (Collabs / Experiences). */
export function FeatureChips({ business }: { business: Pick<AdminBusiness, "features"> }) {
    const f = featuresOf(business);
    if (!f.collabs && !f.experiences) return <Chip title="Collabs and Experiences are off">No features</Chip>;
    return (
        <>
            {f.collabs && <Chip tone="teal">Collabs</Chip>}
            {f.experiences && <Chip tone="violet">Experiences</Chip>}
        </>
    );
}

// ── Segmented tabs (Narratives page style) ─────────────────

export function SegmentedTabs<T extends string>({
    tabs,
    value,
    onChange,
}: {
    tabs: { value: T; label: string; count?: number }[];
    value: T;
    onChange: (v: T) => void;
}) {
    return (
        <div className="flex flex-wrap gap-1 bg-neutral-100 rounded-xl p-1 w-fit">
            {tabs.map((t) => (
                <button
                    key={t.value}
                    type="button"
                    onClick={() => onChange(t.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        value === t.value ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
                    }`}
                >
                    {t.label}
                    {t.count !== undefined && t.count > 0 && (
                        <span className="text-[10px] font-semibold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{t.count}</span>
                    )}
                </button>
            ))}
        </div>
    );
}

// ── Search box (debounced by caller) ───────────────────────

export function SearchBox({
    value,
    onChange,
    placeholder,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
}) {
    return (
        <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
            />
            {value && (
                <button
                    type="button"
                    onClick={() => onChange("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    aria-label="Clear search"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}

export function Toolbar({ children }: { children: ReactNode }) {
    return <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 flex flex-wrap items-center gap-3">{children}</div>;
}

// ── Loading / error / empty block ──────────────────────────

export function PanelState({
    isLoading,
    error,
    isEmpty,
    emptyIcon: EmptyIcon,
    emptyText,
    onRetry,
    children,
}: {
    isLoading: boolean;
    error: unknown;
    isEmpty: boolean;
    emptyIcon: LucideIcon;
    emptyText: string;
    onRetry?: () => void;
    children: ReactNode;
}) {
    if (isLoading) return <LoadingFallback />;
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-red-500 gap-2">
                <AlertTriangle className="w-8 h-8" />
                <p className="text-sm">{error instanceof Error ? error.message : "Failed to load"}</p>
                {onRetry && (
                    <button type="button" onClick={onRetry} className="text-teal-600 text-sm font-medium hover:underline">
                        Retry
                    </button>
                )}
            </div>
        );
    }
    if (isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-400 gap-2">
                <EmptyIcon className="w-8 h-8 opacity-50" />
                <p className="text-sm">{emptyText}</p>
            </div>
        );
    }
    return <>{children}</>;
}

// ── Section card & rows ────────────────────────────────────

export function SectionCard({
    title,
    icon: Icon,
    actions,
    children,
    bodyClassName = "p-6",
}: {
    title: ReactNode;
    icon?: LucideIcon;
    actions?: ReactNode;
    children: ReactNode;
    bodyClassName?: string;
}) {
    return (
        <Card padding="none" className="overflow-hidden">
            <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6 flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-base font-semibold flex items-center gap-2 text-neutral-900">
                    {Icon && <Icon className="w-4 h-4 text-teal-600" />}
                    {title}
                </h3>
                {actions}
            </div>
            <div className={bodyClassName}>{children}</div>
        </Card>
    );
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 text-sm">
            <span className="w-40 shrink-0 font-medium text-neutral-500">{label}</span>
            <span className="text-neutral-800 break-words min-w-0">{value ?? "—"}</span>
        </div>
    );
}

export function Field({
    label,
    htmlFor,
    required,
    hint,
    children,
}: {
    label: string;
    htmlFor?: string;
    required?: boolean;
    hint?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div>
            <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-700 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {children}
            {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
        </div>
    );
}

export function Checkbox({
    checked,
    onChange,
    label,
    disabled,
    hint,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    disabled?: boolean;
    hint?: string;
}) {
    return (
        <label className={`flex items-start gap-2 select-none ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}>
            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-neutral-300 accent-teal-600"
            />
            <span>
                <span className="text-sm text-neutral-700 font-medium">{label}</span>
                {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
            </span>
        </label>
    );
}

export function Switch({ on, onToggle, label, disabled }: { on: boolean; onToggle: () => void; label: string; disabled?: boolean }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={label}
            disabled={disabled}
            onClick={onToggle}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 disabled:opacity-50 ${
                on ? "bg-teal-600" : "bg-neutral-300"
            }`}
        >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
    );
}

// ── Ids & copy ─────────────────────────────────────────────

export function CopyButton({ value, label = "Copy", className = btnSmNeutral }: { value: string; label?: string; className?: string }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error("Couldn't copy to clipboard");
        }
    };
    return (
        <button type="button" onClick={copy} className={className}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : label}
        </button>
    );
}

export function MonoId({ id, short = true }: { id: string | null | undefined; short?: boolean }) {
    if (!id) return <span className="text-neutral-400">—</span>;
    const text = short && id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
    return (
        <span className="font-mono text-[11px] text-neutral-500" title={id}>
            {text}
        </span>
    );
}

// ── Modal & drawer shells ──────────────────────────────────

function useEscape(open: boolean, onClose: () => void) {
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, onClose]);
}

export function Modal({
    open,
    onClose,
    title,
    icon: Icon,
    children,
    footer,
    size = "lg",
}: {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    icon?: LucideIcon;
    children: ReactNode;
    footer?: ReactNode;
    size?: "md" | "lg" | "xl" | "2xl";
}) {
    useEscape(open, onClose);
    if (!open) return null;
    const width = { md: "max-w-md", lg: "max-w-lg", xl: "max-w-xl", "2xl": "max-w-2xl" }[size];
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in p-4" onClick={onClose}>
            <div
                className={`bg-white rounded-2xl shadow-xl w-full ${width} mx-auto animate-slide-up overflow-hidden flex flex-col max-h-[90vh]`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white shrink-0">
                    <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                        {Icon && (
                            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-teal-100 text-teal-600">
                                <Icon className="w-4 h-4" />
                            </span>
                        )}
                        {title}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="px-5 py-5 overflow-y-auto flex-1 space-y-4">{children}</div>
                {footer && <div className="border-t border-neutral-100 bg-neutral-50/50 p-4 shrink-0 flex justify-end gap-3">{footer}</div>}
            </div>
        </div>
    );
}

export function Drawer({
    open,
    onClose,
    title,
    subtitle,
    children,
    footer,
}: {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    subtitle?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
}) {
    useEscape(open, onClose);
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 animate-fade-in" onClick={onClose}>
            <aside
                className="bg-white h-full w-full max-w-xl shadow-2xl flex flex-col animate-slide-up"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className="flex items-start justify-between px-6 py-4 border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white shrink-0">
                    <div className="min-w-0">
                        <h3 className="text-lg font-bold text-neutral-900 leading-tight truncate">{title}</h3>
                        {subtitle && <div className="text-xs text-neutral-500 mt-1">{subtitle}</div>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="px-6 py-5 overflow-y-auto flex-1 space-y-6">{children}</div>
                {footer && <div className="border-t border-neutral-100 bg-neutral-50/50 p-4 shrink-0">{footer}</div>}
            </aside>
        </div>
    );
}

/**
 * Reason prompt (reject / resolve). `minLength > 0` makes the reason required.
 * Resets its text every time it opens.
 */
export function ReasonModal({
    open,
    title,
    description,
    label = "Reason",
    placeholder,
    minLength = 0,
    maxLength = 500,
    confirmLabel,
    tone = "danger",
    isPending,
    onConfirm,
    onCancel,
    children,
}: {
    open: boolean;
    title: string;
    description?: ReactNode;
    label?: string;
    placeholder?: string;
    minLength?: number;
    maxLength?: number;
    confirmLabel: string;
    tone?: "danger" | "primary";
    isPending?: boolean;
    onConfirm: (reason: string) => void;
    onCancel: () => void;
    children?: ReactNode;
}) {
    const [reason, setReason] = useState("");
    useEffect(() => {
        if (open) setReason("");
    }, [open]);
    const trimmed = reason.trim();
    const invalid = trimmed.length < minLength;
    return (
        <Modal
            open={open}
            onClose={onCancel}
            title={title}
            size="md"
            footer={
                <>
                    <button type="button" onClick={onCancel} disabled={isPending} className={btnSecondary}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm(trimmed)}
                        disabled={isPending || invalid}
                        className={tone === "danger" ? btnDanger : btnPrimary}
                    >
                        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        {confirmLabel}
                    </button>
                </>
            }
        >
            {description && <div className="text-sm text-neutral-600 leading-relaxed">{description}</div>}
            {children}
            <Field
                label={label}
                required={minLength > 0}
                hint={minLength > 0 ? `At least ${minLength} characters.` : "Optional."}
            >
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={maxLength}
                    placeholder={placeholder}
                    className={`${inputClass} resize-none min-h-[90px]`}
                    disabled={isPending}
                    autoFocus
                />
            </Field>
        </Modal>
    );
}

export function LoadingButtonIcon({ loading, icon: Icon }: { loading?: boolean; icon: LucideIcon }) {
    return loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />;
}
