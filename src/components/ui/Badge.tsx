/**
 * Role/Status badge component for user table.
 */
export function Badge({ label, styles = "" }: { label?: string; styles?: string }) {
    if (!label) return null;
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize whitespace-nowrap shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${styles}`}>
            {label.replace(/_/g, " ")}
        </span>
    );
}
