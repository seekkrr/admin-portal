import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Store } from "lucide-react";
import { api } from "@/services/api";
import { API_ENDPOINTS } from "@/config/api";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
import { LoadingFallback } from "@/components/LoadingFallback";

interface BusinessOffer {
    _id: string;
    marker_id: string;
    rule_type: string;
    trigger_n: number;
    reward_type: string;
    flat_discount_value: number;
    product_name: string;
    is_active: boolean;
    created_at: string;
}

export function BusinessOffersPage() {
    const [page, setPage] = useState(1);
    const pageSize = 20;

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-business-offers", page],
        queryFn: async () => {
            const res = await api.get<{ offers: BusinessOffer[], total: number }>(`${API_ENDPOINTS.OFFERS.ADMIN_LIST}?skip=${(page - 1) * pageSize}&limit=${pageSize}`);
            return res.data;
        }
    });

    if (isLoading) return <LoadingFallback message="Loading offers..." />;
    if (error) return <div className="p-6 text-red-500">Failed to load offers.</div>;

    const offers = data?.offers || [];
    const totalPages = Math.ceil((data?.total || 0) / pageSize);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                    <Store className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Platform Offers</h1>
                    <p className="text-sm text-neutral-500">Global view of all business offers</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-neutral-50/60 border-b border-neutral-100 text-neutral-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">Offer Rule</th>
                                <th className="px-6 py-4">Reward</th>
                                <th className="px-6 py-4">Marker ID</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {offers.map((offer) => (
                                <tr key={offer._id} className="hover:bg-neutral-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <span className="font-medium text-neutral-900 capitalize">
                                            {offer.rule_type} 
                                        </span>
                                        <div className="text-neutral-500 text-xs mt-1">
                                            Trigger: Every {offer.trigger_n} check-in(s)
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-neutral-900">
                                            {offer.reward_type === "flat" ? `₹${offer.flat_discount_value} OFF` : offer.product_name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-neutral-500">
                                        {offer.marker_id}
                                    </td>
                                    <td className="px-6 py-4">
                                        {offer.is_active ? (
                                            <Badge label="Active" styles="bg-emerald-50 text-emerald-700 border-emerald-200" />
                                        ) : (
                                            <Badge label="Paused" styles="bg-amber-50 text-amber-700 border-amber-200" />
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-neutral-500">
                                        {new Date(offer.created_at).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-neutral-100">
                        <Pagination page={page} totalPages={totalPages} total={data?.total || 0} onPageChange={setPage} />
                    </div>
                )}
            </div>
        </div>
    );
}
