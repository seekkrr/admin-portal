import { useId } from "react";
import { Plus, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { SelectInput, TextInput } from "@/components/ui/Field";
import type { BonusOperator } from "@/types";
import { OPERATORS, OPERATOR_LABELS, type BonusRow } from "./stepRewardForm";

/** Rows of "field operator value → bonus points". Stacks into two lines per row on phones. */
export function BonusConditionsEditor({ rows, onChange }: { rows: BonusRow[]; onChange: (rows: BonusRow[]) => void }) {
    const setRow = (idx: number, patch: Partial<BonusRow>) => onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    const addRow = () => onChange([...rows, { field: "", operator: "gte", value: "", bonus_points: "0" }]);
    const removeRow = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
    const headingId = useId();

    return (
        <div role="group" aria-labelledby={headingId} className="space-y-3 rounded-card border border-line bg-surface-muted p-4">
            <div className="flex items-center justify-between gap-2">
                <p id={headingId} className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Bonus conditions
                </p>
                <Button size="sm" variant="ghost" icon={Plus} onClick={addRow}>
                    Add condition
                </Button>
            </div>
            {rows.length === 0 && <p className="text-xs text-ink-faint">No bonus conditions — the reward is the base points.</p>}
            {rows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-6 items-center gap-2 sm:grid-cols-12">
                    <TextInput
                        type="text"
                        placeholder="Field (e.g. time_taken)"
                        aria-label={`Condition ${idx + 1} field`}
                        className="col-span-6 sm:col-span-4"
                        value={row.field}
                        onChange={(e) => setRow(idx, { field: e.target.value })}
                    />
                    <SelectInput
                        aria-label={`Condition ${idx + 1} operator`}
                        className="col-span-3 sm:col-span-3"
                        value={row.operator}
                        onChange={(e) => setRow(idx, { operator: e.target.value as BonusOperator })}
                        options={OPERATORS.map((op) => ({ value: op, label: OPERATOR_LABELS[op] }))}
                    />
                    <TextInput
                        type="text"
                        placeholder={row.operator === "in" ? "a, b, c" : "Value"}
                        aria-label={`Condition ${idx + 1} value`}
                        className="col-span-3 sm:col-span-2"
                        value={row.value}
                        onChange={(e) => setRow(idx, { value: e.target.value })}
                    />
                    <TextInput
                        type="number"
                        inputMode="numeric"
                        placeholder="Points"
                        aria-label={`Condition ${idx + 1} bonus points`}
                        className="col-span-5 sm:col-span-2"
                        value={row.bonus_points}
                        onChange={(e) => setRow(idx, { bonus_points: e.target.value })}
                    />
                    <IconButton icon={X} size="sm" label={`Remove condition ${idx + 1}`} className="col-span-1 justify-self-end hover:bg-bad-soft hover:text-bad" onClick={() => removeRow(idx)} />
                </div>
            ))}
        </div>
    );
}
