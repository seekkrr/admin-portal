import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { SingleImageField } from "@/components/detail/SingleImageField";

export interface RepeatField<T> {
    key: keyof T & string;
    label: string;
    kind?: "text" | "textarea" | "number" | "image";
    maxLength?: number;
    placeholder?: string;
    required?: boolean;
    /** Spans both columns on wider screens. */
    wide?: boolean;
}

/**
 * Ordered list of small records (highlights, itinerary, FAQs, options): add,
 * edit, move up/down, remove. Every value is edited as text; the parent
 * converts on save. Keys not listed in `fields` are kept as they are.
 */
export function RepeatableList<T extends Record<string, string>>({
    items,
    onChange,
    fields,
    blank,
    itemLabel,
    addLabel = "Add",
    max = 20,
    disabled,
    upload,
}: {
    items: T[];
    onChange: (next: T[]) => void;
    fields: RepeatField<T>[];
    blank: () => T;
    itemLabel: string;
    addLabel?: string;
    max?: number;
    disabled?: boolean;
    upload?: { category: string; entityId?: string };
}) {
    const update = (i: number, key: keyof T, value: string) => onChange(items.map((it, j) => (j === i ? { ...it, [key]: value } : it)));
    const move = (i: number, to: number) => {
        if (to < 0 || to >= items.length) return;
        const next = [...items];
        const [it] = next.splice(i, 1);
        if (it === undefined) return;
        next.splice(to, 0, it);
        onChange(next);
    };

    return (
        <div className="space-y-3">
            {items.length === 0 && <p className="text-sm text-ink-faint">None yet.</p>}
            {items.map((item, i) => (
                <div key={i} className="rounded-control border border-line bg-surface-muted/60 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            {itemLabel} {i + 1}
                        </span>
                        {!disabled && (
                            <div className="flex gap-0.5">
                                <IconButton icon={ArrowUp} size="sm" label={`Move ${itemLabel.toLowerCase()} ${i + 1} up`} disabled={i === 0} onClick={() => move(i, i - 1)} />
                                <IconButton
                                    icon={ArrowDown}
                                    size="sm"
                                    label={`Move ${itemLabel.toLowerCase()} ${i + 1} down`}
                                    disabled={i === items.length - 1}
                                    onClick={() => move(i, i + 1)}
                                />
                                <IconButton
                                    icon={Trash2}
                                    size="sm"
                                    label={`Remove ${itemLabel.toLowerCase()} ${i + 1}`}
                                    className="hover:bg-bad-soft hover:text-bad"
                                    onClick={() => onChange(items.filter((_, j) => j !== i))}
                                />
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {fields.map((f) => {
                            const value = item[f.key] ?? "";
                            const missing = f.required && !value.trim();
                            return (
                                <Field
                                    key={f.key}
                                    label={f.label}
                                    required={f.required}
                                    error={missing && fields.some((x) => (item[x.key] ?? "").trim()) ? `Add a ${f.label.toLowerCase()} or remove this ${itemLabel.toLowerCase()}.` : undefined}
                                    className={f.wide || f.kind === "textarea" ? "sm:col-span-2" : undefined}
                                >
                                    {f.kind === "textarea" ? (
                                        <TextArea value={value} onChange={(e) => update(i, f.key, e.target.value)} maxLength={f.maxLength} placeholder={f.placeholder} rows={2} disabled={disabled} />
                                    ) : f.kind === "image" ? (
                                        <SingleImageField
                                            value={value}
                                            onChange={(url) => update(i, f.key, url)}
                                            category={upload?.category ?? "website"}
                                            entityId={upload?.entityId}
                                            disabled={disabled}
                                        />
                                    ) : (
                                        <TextInput
                                            type={f.kind === "number" ? "number" : "text"}
                                            inputMode={f.kind === "number" ? "decimal" : undefined}
                                            min={f.kind === "number" ? 0 : undefined}
                                            value={value}
                                            onChange={(e) => update(i, f.key, e.target.value)}
                                            maxLength={f.maxLength}
                                            placeholder={f.placeholder}
                                            disabled={disabled}
                                        />
                                    )}
                                </Field>
                            );
                        })}
                    </div>
                </div>
            ))}
            {!disabled && items.length < max && (
                <Button size="sm" variant="secondary" icon={Plus} onClick={() => onChange([...items, blank()])}>
                    {addLabel}
                </Button>
            )}
        </div>
    );
}
