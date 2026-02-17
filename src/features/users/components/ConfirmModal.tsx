import { type ReactNode, useState, useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export interface ConfirmModalProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    confirmStyle: string;
    onConfirm: () => void;
    onCancel: () => void;
    isPending?: boolean;
    children?: ReactNode;
    theme?: "danger" | "warning" | "info";
}

/**
 * Double-confirmation modal that requires typing "CONFIRM" to proceed.
 * Supports Escape key and backdrop click to cancel.
 */
export function ConfirmModal({
    open, title, message, confirmLabel, confirmStyle,
    onConfirm, onCancel, isPending, children, theme = "danger",
}: ConfirmModalProps) {
    const [typed, setTyped] = useState("");
    const confirmWord = "CONFIRM";

    // Theme configuration
    const themeConfig = {
        danger: { icon: AlertTriangle, bg: "bg-red-100", text: "text-red-600", border: "focus:ring-red-400" },
        warning: { icon: AlertTriangle, bg: "bg-amber-100", text: "text-amber-600", border: "focus:ring-amber-400" },
        info: { icon: RefreshCw, bg: "bg-blue-100", text: "text-blue-600", border: "focus:ring-blue-400" },
    };
    const currentTheme = themeConfig[theme];
    const Icon = currentTheme.icon;

    // Reset typed input when modal opens
    useEffect(() => { if (open) setTyped(""); }, [open]);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in" onClick={onCancel}>
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 animate-slide-up" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${currentTheme.bg}`}>
                        <Icon className={`w-5 h-5 ${currentTheme.text}`} />
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900">{title}</h3>
                </div>
                <p className="text-sm text-neutral-600 mb-3">{message}</p>
                {children}
                <div className="mb-4 mt-3">
                    <label className="text-xs text-neutral-500 mb-1 block">
                        Type <span className="font-mono font-bold text-neutral-700">{confirmWord}</span> to proceed
                    </label>
                    <input
                        type="text"
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        placeholder={confirmWord}
                        className={`w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 ${currentTheme.border} focus:border-transparent`}
                        autoFocus
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={typed !== confirmWord || isPending}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${confirmStyle}`}
                    >
                        {isPending ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
