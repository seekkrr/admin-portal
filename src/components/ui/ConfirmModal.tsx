import { type ReactNode, useState, useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export interface ConfirmModalProps {
    open: boolean;
    title: string;
    message: ReactNode;
    confirmLabel: string;
    confirmStyle: string;
    onConfirm: () => void;
    onCancel: () => void;
    isPending?: boolean;
    children?: ReactNode;
    theme?: "danger" | "warning" | "info";
    disabledConfirm?: boolean;
}

/**
 * Double-confirmation modal that requires typing "CONFIRM" to proceed.
 * Supports Escape key and backdrop click to cancel.
 */
export function ConfirmModal({
    open, title, message, confirmLabel, confirmStyle,
    onConfirm, onCancel, isPending, children, theme = "danger", disabledConfirm,
}: ConfirmModalProps) {
    const [typed, setTyped] = useState("");
    const confirmWord = "CONFIRM";

    // Theme configuration
    const themeConfig = {
        danger: { icon: AlertTriangle, bg: "bg-gradient-to-br from-red-50 to-red-100 ring-red-200/70", text: "text-red-600", border: "focus:ring-red-400/50" },
        warning: { icon: AlertTriangle, bg: "bg-gradient-to-br from-amber-50 to-amber-100 ring-amber-200/70", text: "text-amber-600", border: "focus:ring-amber-400/50" },
        info: { icon: RefreshCw, bg: "bg-gradient-to-br from-blue-50 to-blue-100 ring-blue-200/70", text: "text-blue-600", border: "focus:ring-blue-400/50" },
    };
    const currentTheme = themeConfig[theme];
    const Icon = currentTheme.icon;

    // Reset typed input when modal opens or closes
    useEffect(() => {
        setTyped("");
    }, [open]);

    // Close on Escape key
    useEffect(() => {
        if (!open) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [open, onCancel]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 backdrop-blur-[3px] animate-fade-in p-4" onClick={onCancel}>
            <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-neutral-900/5 p-6 w-full max-w-sm animate-scale-in" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ring-1 ${currentTheme.bg}`}>
                        <Icon className={`w-5 h-5 ${currentTheme.text}`} />
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900 tracking-tight">{title}</h3>
                </div>
                <p className="text-sm text-neutral-600 mb-3 leading-relaxed">{message}</p>
                {children}
                <div className="mb-5 mt-3">
                    <label className="text-xs text-neutral-500 mb-1.5 block">
                        Type <span className="font-mono font-bold text-neutral-700">{confirmWord}</span> to proceed
                    </label>
                    <input
                        type="text"
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        placeholder={confirmWord}
                        className={`w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/60 text-sm font-mono tracking-wide transition-all focus:outline-none focus:ring-2 focus:bg-white ${currentTheme.border} focus:border-transparent`}
                        autoFocus
                    />
                </div>
                <div className="flex gap-2.5">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 active:scale-[0.98] transition-all flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={typed !== confirmWord || isPending || disabledConfirm}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-105 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100 flex-1 flex items-center justify-center ${confirmStyle}`}
                    >
                        {isPending ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
