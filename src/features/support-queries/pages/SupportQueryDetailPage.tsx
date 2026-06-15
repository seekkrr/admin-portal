import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supportQueriesService } from "../services/support-queries.service";
import { Card, CardHeader, CardTitle, CardContent } from "@components/ui";
import { ArrowLeft, User, Clock, Trash2, Mail, Phone } from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { toast } from "sonner";
import { LoadingFallback } from "@components/LoadingFallback";

export function SupportQueryDetailPage() {
    const { queryId: queryIdParam } = useParams<{ queryId: string }>();
    const queryId = queryIdParam ?? "";
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    
    const CAN_DELETE = user?.role?.some(r => ["admin", "super_admin"].includes(r));

    const { data: query, isLoading, error } = useQuery({
        queryKey: ["support-query-detail", queryId],
        queryFn: () => supportQueriesService.getById(queryId),
        enabled: !!queryId,
        staleTime: 5 * 60 * 1000,
    });

    const deleteMutation = useMutation({
        mutationFn: () => supportQueriesService.deleteQuery(queryId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-support-queries"] });
            toast.success("Query deleted");
            navigate("/support-queries", { replace: true });
        },
        onError: () => {
            toast.error("Failed to delete query");
        }
    });

    if (isLoading) return <LoadingFallback message="Loading query details..." />;

    if (error || !query) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-500 mb-4">Failed to load support query or it does not exist.</p>
                <Link to="/support-queries" className="text-indigo-600 hover:underline">
                    Back to Support Queries
                </Link>
            </div>
        );
    }

    return (
        <div className="animate-fade-in max-w-4xl mx-auto space-y-6">
            {/* Header & Back */}
            <div className="flex items-center justify-between">
                <Link 
                    to="/support-queries" 
                    className="flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Queries
                </Link>
                
                {CAN_DELETE && (
                    <button
                        onClick={() => {
                            if (window.confirm("Are you sure you want to delete this query?")) {
                                deleteMutation.mutate();
                            }
                        }}
                        disabled={deleteMutation.isPending}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete Query
                    </button>
                )}
            </div>

            {/* Title Card */}
            <Card>
                <CardContent className="p-6 sm:p-8">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-neutral-900 mt-2">
                                Support Query
                            </h1>
                            <div className="mt-4 flex flex-col gap-2 text-sm text-neutral-500">
                                <div className="flex items-center gap-1.5">
                                    <User className="w-4 h-4 text-neutral-400" />
                                    <span className="font-medium text-neutral-900">{query.name || "Anonymous User"}</span>
                                </div>
                                {query.email && (
                                    <div className="flex items-center gap-1.5">
                                        <Mail className="w-4 h-4 text-neutral-400" />
                                        <a href={`mailto:${query.email}`} className="text-indigo-600 hover:underline">{query.email}</a>
                                    </div>
                                )}
                                {query.phone && (
                                    <div className="flex items-center gap-1.5">
                                        <Phone className="w-4 h-4 text-neutral-400" />
                                        <a href={`tel:${query.phone}`} className="text-indigo-600 hover:underline">{query.phone}</a>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5 mt-2">
                                    <Clock className="w-4 h-4 text-neutral-400" />
                                    Submitted {query.created_at ? new Date(query.created_at).toLocaleString() : "Unknown date"}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Message Content Layout */}
            <div className="grid grid-cols-1 gap-6">
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="bg-neutral-50/50 border-b border-neutral-100 pb-4">
                            <CardTitle className="text-base flex items-center gap-2">
                                Message Content
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="prose prose-sm prose-neutral max-w-none whitespace-pre-wrap text-neutral-700">
                                {query.message || "No message provided."}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
