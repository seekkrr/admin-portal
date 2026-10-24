import { useState, type ReactNode } from "react";
import { Check, Copy, Loader2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader as SharedPageHeader } from "@/components/ui/PageHeader";
import { Tag } from "@/components/ui/StatusPill";
import { SearchInput } from "@/components/ui/FilterBar";
import { Tabs } from "@/components/ui/Tabs";
import { Panel } from "@/components/ui/Panel";
import { Modal as SharedModal, Drawer as SharedDrawer } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Checkbox as SharedCheckbox, Field as SharedField, Switch as SharedSwitch } from "@/components/ui/Field";
import { featuresOf } from "../utils";
import type { AdminBusiness } from "../types";

/**
 * Collabs building blocks. They now delegate to the portal's shared
 * components (src/components/ui) so every page uses one design; the APIs are
 * unchanged so the Collabs pages keep working as they are.
 */

export { StatusPill } from "@/components/ui/StatusPill";
export { PanelState } from "@/components/ui/States";

export const inputClass =
    "w-full px-3 py-2.5 rounded-control border border-line-strong text-sm text-ink bg-surface placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent disabled:bg-surface-muted disabled:text-ink-faint";

// Same classes as <Button variant="primary" size="md"> (components/ui/buttonStyles.ts).
export const btnPrimary =
    "inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap select-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none bg-brand-900 text-white shadow-sm hover:bg-brand-700 active:bg-brand-950 h-10 px-4 text-sm";

// Same classes as <Button variant="secondary" size="md"> (components/ui/buttonStyles.ts).
export const btnSecondary =
    "inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap select-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none bg-surface text-ink border border-line-strong shadow-sm hover:bg-surface-muted hover:border-brand-200 h-10 px-4 text-sm";

// Same classes as <Button variant="danger" size="md"> (components/ui/buttonStyles.ts).
export const btnDanger =
    "inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap select-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none bg-bad text-white shadow-sm hover:bg-red-800 active:bg-red-900 h-10 px-4 text-sm";

export const btnSmApprove =
    "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-good bg-good-soft hover:bg-green-100 border border-good-line transition-colors disabled:opacity-50";

export const btnSmReject =
    "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-bad bg-bad-soft hover:bg-red-100 border border-bad-line transition-colors disabled:opacity-50";

export const btnSmNeutral =
    "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-ink bg-surface hover:bg-surface-muted border border-line-strong transition-colors disabled:opacity-50";

export const thClass = "text-left px-4 py-3 font-semibold text-ink-muted text-xs uppercase tracking-wide";

// ── Page header ────────────────────────────────────────────

export function PageHeader({
    icon,
    title,
    subtitle,
    badge,
    actions,
}: {
    icon: LucideIcon;
    title: string;
    subtitle?: ReactNode;
    badge?: ReactNode;
    actions?: ReactNode;
    /** @deprecated ignored — one heading style everywhere. */
    gradient?: string;
}) {
    return <SharedPageHeader icon={icon} title={title} description={subtitle} badge={badge} actions={actions} />;
}

export function CountBadge({ count, label, tone = "red" }: { count: number; label: string; tone?: "red" | "amber" }) {
    if (!count) return null;
    const cls = tone === "red" ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn";
    return (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
            {count} {label}
        </span>
    );
}

export function Chip({ children, tone = "neutral", title }: { children: ReactNode; tone?: "neutral" | "teal" | "amber" | "red" | "violet"; title?: string }) {
    const map = { neutral: "neutral", teal: "brand", amber: "warn", red: "bad", violet: "info" } as const;
    return (
        <Tag tone={map[tone]} title={title}>
            {children}
        </Tag>
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

// ── Segmented tabs ─────────────────────────────────────────

export function SegmentedTabs<T extends string>({
    tabs,
    value,
    onChange,
    label = "Views",
}: {
    tabs: { value: T; label: string; count?: number }[];
    value: T;
    onChange: (v: T) => void;
    label?: string;
}) {
    return <Tabs tabs={tabs} value={value} onChange={onChange} label={label} variant="pill" />;
}

// ── Search box (debounced by caller) ───────────────────────

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
    return <SearchInput value={value} onChange={onChange} placeholder={placeholder} className="min-w-[min(240px,100%)] flex-1" />;
}

export function Toolbar({ children }: { children: ReactNode }) {
    return <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-3 shadow-card sm:p-4">{children}</div>;
}

// ── Section card & rows ────────────────────────────────────

export function SectionCard({
    title,
    icon,
    actions,
    children,
    bodyClassName = "p-4 sm:p-6",
}: {
    title: ReactNode;
    icon?: LucideIcon;
    actions?: ReactNode;
    children: ReactNode;
    bodyClassName?: string;
}) {
    return (
        <Panel title={title} icon={icon} actions={actions} bodyClassName={bodyClassName}>
            {children}
        </Panel>
    );
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 text-sm">
            <span className="w-40 shrink-0 font-medium text-ink-muted">{label}</span>
            <span className="text-ink break-words min-w-0">{value ?? "—"}</span>
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
        <SharedField label={label} htmlFor={htmlFor} required={required} hint={hint}>
            {children}
        </SharedField>
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
    return <SharedCheckbox checked={checked} onChange={onChange} label={label} hint={hint} disabled={disabled} />;
}

export function Switch({ on, onToggle, label, disabled }: { on: boolean; onToggle: () => void; label: string; disabled?: boolean }) {
    return <SharedSwitch checked={on} onChange={() => onToggle()} label={label} hideLabel disabled={disabled} />;
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
    if (!id) return <span className="text-ink-faint">—</span>;
    const text = short && id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
    return (
        <span className="font-mono text-[11px] text-ink-muted" title={id}>
            {text}
        </span>
    );
}

// ── Modal & drawer shells ──────────────────────────────────

export function Modal({
    open,
    onClose,
    title,
    icon,
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
    return (
        <SharedModal open={open} onClose={onClose} title={title} icon={icon} footer={footer} size={size}>
            {children}
        </SharedModal>
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
    return (
        <SharedDrawer open={open} onClose={onClose} title={title} subtitle={subtitle} footer={footer}>
            {children}
        </SharedDrawer>
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
    return (
        <ConfirmDialog
            open={open}
            title={title}
            description={description}
            level="reason"
            reasonLabel={label}
            reasonPlaceholder={placeholder}
            reasonMinLength={minLength}
            reasonMaxLength={maxLength}
            confirmLabel={confirmLabel}
            tone={tone === "danger" ? "danger" : "primary"}
            isPending={isPending}
            onConfirm={(reason) => onConfirm(reason ?? "")}
            onCancel={onCancel}
        >
            {children}
        </ConfirmDialog>
    );
}

export function LoadingButtonIcon({ loading, icon: Icon }: { loading?: boolean; icon: LucideIcon }) {
    return loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />;
}
