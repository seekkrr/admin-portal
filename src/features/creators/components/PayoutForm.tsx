import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import type { PayoutAccount } from "@/types";
import type { PayoutAccountRequest } from "../services/creators.service";

// ---- Validation patterns (derived from backend schema) ----
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;      // 11 chars, 5th is always 0
const UPI_RE = /^[\w.+-]+@[\w.-]+$/;                // name@provider
const ACCT_MIN = 6;
const ACCT_MAX = 16;

interface PayoutFormProps {
    existingPayout: PayoutAccount | null;
    isPending: boolean;
    onSubmit: (data: PayoutAccountRequest) => void;
    onCancel: () => void;
}

type FieldErrors = Record<string, string>;

/**
 * Payout account form — bank / UPI / wallet.
 * Validates locally before submit; sends account_number as int (backend schema).
 */
export function PayoutForm({ existingPayout, isPending, onSubmit, onCancel }: PayoutFormProps) {
    const [method, setMethod] = useState<"bank" | "upi" | "wallet">(existingPayout?.method ?? "upi");
    const [upiId, setUpiId] = useState(existingPayout?.upi_id ?? "");
    const [accountNumber, setAccountNumber] = useState(
        existingPayout?.bank_details?.account_number != null
            ? String(existingPayout.bank_details.account_number)
            : ""
    );
    const [ifscCode, setIfscCode] = useState(existingPayout?.bank_details?.ifsc_code ?? "");
    const [accountHolder, setAccountHolder] = useState(existingPayout?.bank_details?.account_holder ?? "");
    const [currency, setCurrency] = useState(existingPayout?.currency ?? "INR");

    const [errors, setErrors] = useState<FieldErrors>({});
    const [touched, setTouched] = useState<Set<string>>(new Set());

    // Reset irrelevant fields when method changes
    useEffect(() => {
        if (method === "upi") {
            setAccountNumber("");
            setIfscCode("");
            setAccountHolder("");
        } else if (method === "bank") {
            setUpiId("");
        }
        setErrors({});
        setTouched(new Set());
    }, [method]);

    // ---- Validation ----
    const validate = useCallback((): FieldErrors => {
        const errs: FieldErrors = {};

        if (method === "upi") {
            const trimmed = upiId.trim();
            if (!trimmed) {
                errs.upiId = "UPI ID is required";
            } else if (!UPI_RE.test(trimmed)) {
                errs.upiId = "Invalid UPI ID (e.g. name@upi)";
            }
        }

        if (method === "bank") {
            // Account holder
            if (!accountHolder.trim()) {
                errs.accountHolder = "Account holder name is required";
            } else if (accountHolder.trim().length < 2) {
                errs.accountHolder = "Name must be at least 2 characters";
            }

            // Account number — must be digits only (backend stores as int)
            const acctTrimmed = accountNumber.trim();
            if (!acctTrimmed) {
                errs.accountNumber = "Account number is required";
            } else if (!/^\d+$/.test(acctTrimmed)) {
                errs.accountNumber = "Account number must contain only digits";
            } else if (acctTrimmed.length < ACCT_MIN || acctTrimmed.length > ACCT_MAX) {
                errs.accountNumber = `Must be ${ACCT_MIN}–${ACCT_MAX} digits`;
            }

            // IFSC code
            const ifsc = ifscCode.trim().toUpperCase();
            if (!ifsc) {
                errs.ifscCode = "IFSC code is required";
            } else if (ifsc.length !== 11) {
                errs.ifscCode = "IFSC code must be exactly 11 characters";
            } else if (!IFSC_RE.test(ifsc)) {
                errs.ifscCode = "Invalid IFSC format (e.g. SBIN0001234)";
            }
        }

        return errs;
    }, [method, upiId, accountHolder, accountNumber, ifscCode]);

    // Re-validate on each keystroke for touched fields
    useEffect(() => {
        if (touched.size === 0) return;
        const all = validate();
        // Only show errors for fields user has interacted with
        const visible: FieldErrors = {};
        for (const key of touched) {
            if (all[key]) visible[key] = all[key];
        }
        setErrors(visible);
    }, [validate, touched]);

    const markTouched = (field: string) => {
        setTouched((prev) => new Set(prev).add(field));
    };

    const isValid = Object.keys(validate()).length === 0 && method !== "wallet";

    const handleSubmit = () => {
        // Run full validation
        const errs = validate();
        if (Object.keys(errs).length > 0) {
            // Mark all as touched so errors show
            setTouched(new Set(Object.keys(errs)));
            setErrors(errs);
            return;
        }

        const payload: PayoutAccountRequest = { method, currency };
        if (method === "bank") {
            payload.bank_details = {
                account_number: Number(accountNumber.trim()),
                ifsc_code: ifscCode.trim().toUpperCase(),
                account_holder: accountHolder.trim(),
            };
        } else if (method === "upi") {
            payload.upi_id = upiId.trim();
        }
        onSubmit(payload);
    };

    const inputClassName = (field: string) =>
        `w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all ${errors[field]
            ? "border-red-300 focus:ring-red-400 bg-red-50/30"
            : "border-neutral-200 focus:ring-teal-500 focus:border-transparent"
        }`;

    return (
        <div className="space-y-4">
            {/* Method Selector */}
            <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Payment Method</label>
                <div className="flex gap-2">
                    {(["upi", "bank", "wallet"] as const).map((m) => (
                        <button
                            key={m}
                            onClick={() => setMethod(m)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-medium capitalize border transition-all
                                ${method === m
                                    ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                                    : "bg-white text-neutral-600 border-neutral-200 hover:border-teal-300 hover:bg-teal-50/50"
                                }`}
                        >
                            {m === "upi" ? "UPI" : m}
                        </button>
                    ))}
                </div>
            </div>

            {/* UPI Fields */}
            {method === "upi" && (
                <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">UPI ID</label>
                    <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        onBlur={() => markTouched("upiId")}
                        placeholder="name@upi"
                        className={inputClassName("upiId")}
                    />
                    <FieldError message={errors.upiId} />
                </div>
            )}

            {/* Bank Fields */}
            {method === "bank" && (
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Account Holder Name</label>
                        <input
                            type="text"
                            value={accountHolder}
                            onChange={(e) => setAccountHolder(e.target.value)}
                            onBlur={() => markTouched("accountHolder")}
                            placeholder="Full name as per bank records"
                            className={inputClassName("accountHolder")}
                        />
                        <FieldError message={errors.accountHolder} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Account Number</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={accountNumber}
                            onChange={(e) => {
                                // Only allow digits
                                const val = e.target.value.replace(/\D/g, "");
                                setAccountNumber(val);
                            }}
                            onBlur={() => markTouched("accountNumber")}
                            placeholder="e.g. 12345678901234"
                            className={inputClassName("accountNumber")}
                        />
                        <FieldError message={errors.accountNumber} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">IFSC Code</label>
                        <input
                            type="text"
                            value={ifscCode}
                            onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                            onBlur={() => markTouched("ifscCode")}
                            placeholder="e.g. SBIN0001234"
                            maxLength={11}
                            className={`${inputClassName("ifscCode")} uppercase`}
                        />
                        <FieldError message={errors.ifscCode} />
                    </div>
                </div>
            )}

            {/* Wallet placeholder */}
            {method === "wallet" && (
                <p className="text-sm text-neutral-400 italic py-4 text-center">Wallet payouts coming soon</p>
            )}

            {/* Currency */}
            <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Currency</label>
                <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                </select>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
                <button
                    onClick={onCancel}
                    className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={!isValid || isPending}
                    className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                    {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : (existingPayout ? "Update Payout" : "Add Payout")}
                </button>
            </div>
        </div>
    );
}

// ---- Inline error label ----
function FieldError({ message }: { message?: string }) {
    if (!message) return null;
    return <p className="mt-1 text-xs text-red-500 font-medium animate-fade-in">{message}</p>;
}
