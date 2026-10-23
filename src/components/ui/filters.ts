import type { FilterOption } from "./FilterBar";

/** Build a chip label like "Status: Active" from a select's options. */
export function chipLabel(name: string, value: string, options?: FilterOption[]): string {
    const opt = options?.find((o) => o.value === value);
    return `${name}: ${opt?.label ?? value}`;
}
