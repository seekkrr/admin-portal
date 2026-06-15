import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Wallet, Plus, Star, Banknote, Smartphone, Lock } from "lucide-react";
import { payoutAccountsService } from "../services/payout-accounts.service";
import { PayoutAccountStatusBadge } from "../components/PayoutAccountStatusBadge";
import { PayoutAccountFormModal } from "../components/PayoutAccountFormModal";
import { FilterDropdown } from "@/components/FilterDropdown";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingFallback } from "@components/LoadingFallback";
import { useAuthStore } from "@/store/auth.store";
import { shortId, formatDateTime, orDash } from "@/utils/format";
import type { PayoutAccountStatus, PayoutAccountMethod } from "@/types";

const CAN_FINANCE = ["admin", "super_admin", "finance"];
const IS_SUPER = ["super_admin"];

const STATUS_OPTIONS: { value: "" | PayoutAccountStatus; label: string }[] = [
    { value: "", label: "All statuses" },
    { value: "pending_verification", label: "Pending verification" },
    { value: "verified", label: "Verified" },
    { value: "rejected", label: "Rejected" },
    { value: "disabled", label: "Disabled" },
];

const METHOD_OPTIONS: { value: "" | PayoutAccountMethod; label: string }[] = [
    { value: "", label: "All methods" },
    { value: "bank_transfer", label: "Bank transfer" },
    { value: "upi", label: "UPI" },
];

const PER_PAGE = 20;

function maskedDetail(account: {
    method: PayoutAccountMethod;
    bank_details: { account_number_masked: string | null } | null;
    upi_id: string | null;
}): string {
    if (account.method === "bank_transfer") {
        return account.bank_details?.account_number_masked ?? "—";
    }
    return account.upi_id ?? "—";
}

export function PayoutAccountsPage() {
    const roles = useAuthStore((s) => s.user?.role);
    const canView = roles?.some((r) => CAN_FINANCE.includes(r));
    const canCreate = roles?.some((r) => IS_SUPER.includes(r));

    const [status, setStatus] = useState<"" | PayoutAccountStatus>("");
    const [method, setMethod] = useState<"" | PayoutAccountMethod>("");
    const [page, setPage] = useState(1);
    const [showCreate, setShowCreate] = useState(false);

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-payout-accounts", { status, method, page }],
        queryFn: () =>
            payoutAccountsService.list({
                status: status || undefined,
                method: method || undefined,
                page,
                page_size: PER_PAGE,
            }),
        enabled: !!canView,
        staleTime: 5 * 60 * 1000,
    });

    if (!canView) {
        return (
            <div className="animate-fade-in max-w-md mx-auto mt-16">
                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 text-center">
                    <Lock className="w-10 h-10 text-neutral-300 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-neutral-900">Access denied</h2>
                    <p className="text-sm text-neutral-500 mt-1">
                        You need a finance, admin, or super-admin role to view payout accounts.
                    </p>
                </div>
            </div>
        );
    }

    if (isLoading) return <LoadingFallback message="Loading payout accounts..." />;
    if (error) {
        return <div className="p-6 text-center text-red-500">Failed to load payout accounts.</div>;
    }

    const accounts = data?.accounts ?? [];

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
                        <Wallet className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900">Payout Accounts</h1>
                        <p className="text-sm text-neutral-500">
                            Creator bank / UPI accounts for disbursements
                            {data && (
                                <span className="ml-2 text-neutral-400">· {data.total} total</span>
                            )}
                        </p>
                    </div>
                </div>
                {canCreate && (
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Account
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
                <div className="flex flex-wrap items-center gap-3">
                    <FilterDropdown
                        value={status}
                        onChange={(val) => {
                            setStatus(val as "" | PayoutAccountStatus);
                            setPage(1);
                        }}
                        options={STATUS_OPTIONS}
                        theme="emerald"
                        placeholder="All Statuses"
                    />
                    <FilterDropdown
                        value={method}
                        onChange={(val) => {
                            setMethod(val as "" | PayoutAccountMethod);
                            setPage(1);
                        }}
                        options={METHOD_OPTIONS}
                        theme="emerald"
                        placeholder="All Methods"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                        <thead className="border-b border-neutral-200/60 bg-neutral-50/80">
                            <tr className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">
                                <th className="px-4 py-4 text-left">Creator</th>
                                <th className="px-4 py-4 text-left">Method</th>
                                <th className="px-4 py-4 text-left">Status</th>
                                <th className="px-4 py-4 text-left">Holder</th>
                                <th className="px-4 py-4 text-left">Masked Detail</th>
                                <th className="px-4 py-4 text-left">Created</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-neutral-200">
                            {accounts.map((a) => (
                                <tr
                                    key={a.id}
                                    className="group hover:bg-neutral-50/80 transition-all duration-200"
                                >
                                    <td className="px-4 py-4">
                                        <Link
                                            to={`/payout-accounts/${a.id}`}
                                            className="flex items-center gap-2 font-medium text-neutral-900 hover:text-emerald-600"
                                        >
                                            {a.is_primary && (
                                                <Star
                                                    className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0"
                                                    aria-label="Primary account"
                                                />
                                            )}
                                            <span className="font-mono text-xs">
                                                {shortId(a.creator_id)}
                                            </span>
                                        </Link>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="inline-flex items-center gap-1.5 text-neutral-700">
                                            {a.method === "bank_transfer" ? (
                                                <Banknote className="w-4 h-4 text-neutral-400" />
                                            ) : (
                                                <Smartphone className="w-4 h-4 text-neutral-400" />
                                            )}
                                            {a.method === "bank_transfer" ? "Bank" : "UPI"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <PayoutAccountStatusBadge status={a.status} />
                                    </td>
                                    <td className="px-4 py-4 text-neutral-700">
                                        {orDash(a.account_holder_name)}
                                    </td>
                                    <td className="px-4 py-4 font-mono text-xs text-neutral-500">
                                        {maskedDetail(a)}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-neutral-500">
                                        {formatDateTime(a.created_at)}
                                    </td>
                                </tr>
                            ))}
                            {accounts.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-4 py-12 text-center text-neutral-500"
                                    >
                                        <div className="flex flex-col items-center justify-center">
                                            <Wallet className="w-12 h-12 text-neutral-300 mb-4" />
                                            <p>No payout accounts found matching your criteria.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination
                    page={data?.page ?? page}
                    totalPages={data?.total_pages ?? 1}
                    total={data?.total ?? 0}
                    onPageChange={setPage}
                />
            </div>

            <PayoutAccountFormModal open={showCreate} onClose={() => setShowCreate(false)} />
        </div>
    );
}
