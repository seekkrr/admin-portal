import { useEffect, useState } from "react";
import { InfinityIcon } from "lucide-react";
import { ENTITLEMENT_FIELDS } from "../utils";
import type { EntitlementKey, Entitlements } from "../types";

const smallInput =
    "w-24 px-3 py-1.5 rounded-lg border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-neutral-50 disabled:text-neutral-400";

/**
 * Non-negative integer input that keeps its own text while typing; an empty
 * field reverts to the last committed value on blur.
 */
function IntInput({
    value,
    onChange,
    disabled,
    ariaLabel,
}: {
    value: number;
    onChange: (n: number) => void;
    disabled?: boolean;
    ariaLabel: string;
}) {
    const [text, setText] = useState(String(value));
    useEffect(() => setText(String(value)), [value]);
    return (
        <input
            type="number"
            min={0}
            step={1}
            value={text}
            disabled={disabled}
            aria-label={ariaLabel}
            onChange={(e) => {
                setText(e.target.value);
                const n = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(n) && n >= 0) onChange(n);
            }}
            onBlur={() => setText(String(value))}
            className={smallInput}
        />
    );
}

function LimitControl({
    value,
    onChange,
    label,
}: {
    value: number | null;
    onChange: (v: number | null) => void;
    label: string;
}) {
    const unlimited = value === null;
    return (
        <div className="flex items-center gap-3">
            <IntInput value={value ?? 0} onChange={onChange} disabled={unlimited} ariaLabel={label} />
            <label className="flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={unlimited}
                    onChange={(e) => onChange(e.target.checked ? null : 0)}
                    className="w-4 h-4 rounded border-neutral-300 accent-teal-600"
                />
                <InfinityIcon className="w-3.5 h-3.5" /> Unlimited
            </label>
        </div>
    );
}

/** Full entitlements for a plan: every key has a value; `null` limit = unlimited. */
export function PlanEntitlementsEditor({
    value,
    onChange,
}: {
    value: Entitlements;
    onChange: (next: Entitlements) => void;
}) {
    const set = <K extends EntitlementKey>(key: K, v: Entitlements[K]) => onChange({ ...value, [key]: v });
    return (
        <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl">
            {ENTITLEMENT_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-800">{f.label}</p>
                        <p className="text-[11px] text-neutral-400 font-mono">
                            {f.key}
                            {f.hint ? ` · ${f.hint}` : ""}
                        </p>
                    </div>
                    {f.kind === "limit" ? (
                        <LimitControl
                            label={f.label}
                            value={(value[f.key] as number | null | undefined) ?? null}
                            onChange={(v) => set(f.key, v as never)}
                        />
                    ) : (
                        <input
                            type="checkbox"
                            aria-label={f.label}
                            checked={!!value[f.key]}
                            onChange={(e) => set(f.key, e.target.checked as never)}
                            className="w-4 h-4 rounded border-neutral-300 accent-teal-600"
                        />
                    )}
                </div>
            ))}
        </div>
    );
}

/**
 * Override entitlements: each key is either inherited from the plan (absent
 * from the object) or explicitly set.
 */
export function OverrideEntitlementsEditor({
    value,
    onChange,
    base,
}: {
    value: Partial<Entitlements>;
    onChange: (next: Partial<Entitlements>) => void;
    /** Plan entitlements shown as the "inherited" hint. */
    base?: Entitlements;
}) {
    const setKey = (key: EntitlementKey, v: number | null | boolean | undefined) => {
        const next = Object.fromEntries(Object.entries(value).filter(([k]) => k !== key)) as Partial<Entitlements>;
        if (v !== undefined) (next as Record<string, unknown>)[key] = v;
        onChange(next);
    };
    const describe = (key: EntitlementKey): string => {
        if (!base) return "plan default";
        const v = base[key];
        if (typeof v === "boolean") return v ? "on" : "off";
        return v === null ? "unlimited" : String(v);
    };
    return (
        <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl">
            {ENTITLEMENT_FIELDS.map((f) => {
                const overridden = f.key in value;
                const current = value[f.key];
                return (
                    <div key={f.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-neutral-800">{f.label}</p>
                            <p className="text-[11px] text-neutral-400">Plan: {describe(f.key)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {f.kind === "limit" ? (
                                <>
                                    <select
                                        aria-label={`${f.label} mode`}
                                        value={!overridden ? "inherit" : current === null ? "unlimited" : "limit"}
                                        onChange={(e) => {
                                            const mode = e.target.value;
                                            setKey(f.key, mode === "inherit" ? undefined : mode === "unlimited" ? null : 0);
                                        }}
                                        className="px-3 py-1.5 rounded-lg border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    >
                                        <option value="inherit">Inherit</option>
                                        <option value="limit">Set limit</option>
                                        <option value="unlimited">Unlimited</option>
                                    </select>
                                    {overridden && current !== null && (
                                        <IntInput
                                            value={typeof current === "number" ? current : 0}
                                            onChange={(n) => setKey(f.key, n)}
                                            ariaLabel={f.label}
                                        />
                                    )}
                                </>
                            ) : (
                                <select
                                    aria-label={f.label}
                                    value={!overridden ? "inherit" : current ? "on" : "off"}
                                    onChange={(e) => {
                                        const mode = e.target.value;
                                        setKey(f.key, mode === "inherit" ? undefined : mode === "on");
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="inherit">Inherit</option>
                                    <option value="on">On</option>
                                    <option value="off">Off</option>
                                </select>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/** Compact read-only rendering of an entitlements object. */
export function EntitlementsSummary({ value }: { value: Partial<Entitlements> }) {
    const keys = ENTITLEMENT_FIELDS.filter((f) => f.key in value);
    if (keys.length === 0) return <span className="text-neutral-400 text-xs">None</span>;
    return (
        <div className="flex flex-wrap gap-1.5">
            {keys.map((f) => {
                const v = value[f.key];
                const text = typeof v === "boolean" ? (v ? "on" : "off") : v === null ? "∞" : String(v);
                return (
                    <span
                        key={f.key}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border ${
                            v === false ? "bg-neutral-50 text-neutral-400 border-neutral-200" : "bg-teal-50 text-teal-800 border-teal-200"
                        }`}
                    >
                        {f.label}: <span className="font-semibold">{text}</span>
                    </span>
                );
            })}
        </div>
    );
}
