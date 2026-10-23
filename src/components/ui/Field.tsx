import {
    cloneElement,
    forwardRef,
    isValidElement,
    useId,
    type InputHTMLAttributes,
    type ReactElement,
    type ReactNode,
    type SelectHTMLAttributes,
    type TextareaHTMLAttributes,
} from "react";
import { cx } from "@/utils/cx";

/** Base classes for every text-like control. */
export const controlClass =
    "w-full rounded-control border bg-surface px-3 text-sm text-ink placeholder:text-ink-faint transition-colors " +
    "focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent " +
    "disabled:bg-surface-muted disabled:text-ink-faint disabled:cursor-not-allowed";

function borderOf(invalid?: boolean) {
    return invalid ? "border-bad focus:ring-bad/40" : "border-line-strong";
}

export interface FieldProps {
    label: ReactNode;
    /** id of the control; generated when omitted and passed to a single child. */
    htmlFor?: string;
    required?: boolean;
    hint?: ReactNode;
    error?: ReactNode;
    /** Hide the label visually (still read by screen readers). */
    hideLabel?: boolean;
    className?: string;
    children: ReactNode;
}

/**
 * Label + control + hint/error. When `children` is a single element the field
 * wires `id`, `aria-describedby` and `aria-invalid` onto it.
 */
export function Field({ label, htmlFor, required, hint, error, hideLabel, className, children }: FieldProps) {
    const autoId = useId();
    const id = htmlFor ?? autoId;
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

    let control = children;
    const wired = isValidElement(children) && isFormControl(children);
    if (wired && isValidElement(children)) {
        const el = children as ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean; invalid?: boolean }>;
        control = cloneElement(el, {
            id: el.props.id ?? id,
            "aria-describedby": el.props["aria-describedby"] ?? describedBy,
            "aria-invalid": error ? true : el.props["aria-invalid"],
        });
    }

    return (
        <div className={className}>
            <label htmlFor={htmlFor ?? (wired ? id : undefined)} className={cx("mb-1.5 block text-sm font-medium text-ink", hideLabel && "sr-only")}>
                {label}
                {required && (
                    <span className="ml-0.5 text-bad" aria-hidden>
                        *
                    </span>
                )}
            </label>
            {control}
            {error ? (
                <p id={errorId} className="mt-1 text-xs font-medium text-bad">
                    {error}
                </p>
            ) : (
                hint && (
                    <p id={hintId} className="mt-1 text-xs text-ink-faint">
                        {hint}
                    </p>
                )
            )}
        </div>
    );
}

/** Only wire ids onto real form controls (not wrappers or custom pickers). */
function isFormControl(el: ReactElement): boolean {
    if (typeof el.type === "string") return el.type === "input" || el.type === "select" || el.type === "textarea";
    return el.type === TextInput || el.type === SelectInput || el.type === TextArea;
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
    invalid?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput({ invalid, className, ...rest }, ref) {
    const isInvalid = invalid || rest["aria-invalid"] === true || rest["aria-invalid"] === "true";
    return <input ref={ref} className={cx(controlClass, "h-10", borderOf(isInvalid), className)} {...rest} />;
});

export interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
    invalid?: boolean;
    options?: { value: string; label: string; disabled?: boolean }[];
}

export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(function SelectInput(
    { invalid, className, options, children, ...rest },
    ref
) {
    const isInvalid = invalid || rest["aria-invalid"] === true || rest["aria-invalid"] === "true";
    return (
        <select ref={ref} className={cx(controlClass, "h-10 pr-8", borderOf(isInvalid), className)} {...rest}>
            {options?.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                    {o.label}
                </option>
            ))}
            {children}
        </select>
    );
});

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    invalid?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea({ invalid, className, rows = 3, ...rest }, ref) {
    const isInvalid = invalid || rest["aria-invalid"] === true || rest["aria-invalid"] === "true";
    return <textarea ref={ref} rows={rows} className={cx(controlClass, "py-2.5 leading-relaxed", borderOf(isInvalid), className)} {...rest} />;
});

export interface SwitchProps {
    checked: boolean;
    onChange: (next: boolean) => void;
    /** Accessible name. Shown next to the switch unless `hideLabel`. */
    label: ReactNode;
    description?: ReactNode;
    hideLabel?: boolean;
    disabled?: boolean;
    size?: "sm" | "md";
    id?: string;
    className?: string;
}

/** On/off switch (role="switch"). */
export function Switch({ checked, onChange, label, description, hideLabel, disabled, size = "md", id, className }: SwitchProps) {
    const autoId = useId();
    const switchId = id ?? autoId;
    const descId = `${switchId}-desc`;
    const track = size === "sm" ? "h-5 w-9" : "h-6 w-11";
    const knob = size === "sm" ? "h-4 w-4" : "h-5 w-5";
    const shift = size === "sm" ? (checked ? "translate-x-4" : "translate-x-0.5") : checked ? "translate-x-5" : "translate-x-0.5";
    const button = (
        <button
            id={switchId}
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={hideLabel && typeof label === "string" ? label : undefined}
            aria-describedby={description ? descId : undefined}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={cx(
                "relative inline-flex shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
                track,
                checked ? "bg-accent-600" : "bg-line-strong"
            )}
        >
            <span className={cx("inline-block rounded-full bg-white shadow transition-transform", knob, shift)} />
        </button>
    );
    if (hideLabel) return <span className={className}>{button}</span>;
    return (
        <div className={cx("flex items-start gap-3", className)}>
            {button}
            <div className="min-w-0">
                <label htmlFor={switchId} className={cx("text-sm font-medium text-ink", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
                    {label}
                </label>
                {description && (
                    <p id={descId} className="text-xs text-ink-muted">
                        {description}
                    </p>
                )}
            </div>
        </div>
    );
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
    checked: boolean;
    onChange: (next: boolean) => void;
    label?: ReactNode;
    hint?: ReactNode;
    indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
    { checked, onChange, label, hint, indeterminate, disabled, className, ...rest },
    ref
) {
    const input = (
        <input
            ref={(el) => {
                if (el) el.indeterminate = !!indeterminate && !checked;
                if (typeof ref === "function") ref(el);
                else if (ref) ref.current = el;
            }}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            className={cx("h-4 w-4 shrink-0 cursor-pointer rounded border-line-strong accent-accent-600 disabled:cursor-not-allowed", !label && className)}
            {...rest}
        />
    );
    if (!label) return input;
    return (
        <label className={cx("flex select-none items-start gap-2", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer", className)}>
            <span className="mt-0.5 flex">{input}</span>
            <span>
                <span className="text-sm font-medium text-ink">{label}</span>
                {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
            </span>
        </label>
    );
});
