/**
 * Role/Status badge component for user table.
 */
export function Badge({ label, styles = "" }: { label?: string; styles?: string }) {
    if (!label) return null;
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${styles}`}>
            {label.replace(/_/g, " ")}
        </span>
    );
}
