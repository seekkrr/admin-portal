import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    X, ExternalLink, CheckCircle, XCircle, Link as LinkIcon,
    Calendar, Phone, Mail, User
} from "lucide-react";
import { toast } from "sonner";
import { creatorApplicationsService } from "../services/creator-applications.service";
import type { CreatorApplication } from "@/types";

interface ApplicationDetailModalProps {
    open: boolean;
    application: CreatorApplication | null;
    onClose: () => void;
}

export function ApplicationDetailModal({
    open,
    application,
    onClose,
}: ApplicationDetailModalProps) {
    const queryClient = useQueryClient();
    const [rejectReason, setRejectReason] = useState("");
    const [showRejectInput, setShowRejectInput] = useState(false);

    // Close on Escape key
    useEffect(() => {
        if (!open) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [open, onClose]);

    // Reset state on open/close
    useEffect(() => {
        if (!open) {
            setShowRejectInput(false);
            setRejectReason("");
        }
    }, [open]);

    // ---- Mutations ----
    const approveMutation = useMutation({
        mutationFn: (id: string) => creatorApplicationsService.approveApplication(id),
        onSuccess: (data) => {
            toast.success(data.message || "Application approved!");
            queryClient.invalidateQueries({ queryKey: ["admin-creator-applications"] });
            onClose();
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to approve application");
        },
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            creatorApplicationsService.rejectApplication(id, reason),
        onSuccess: (data) => {
            toast.success(data.message || "Application rejected.");
            queryClient.invalidateQueries({ queryKey: ["admin-creator-applications"] });
            onClose();
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to reject application");
        },
    });

    if (!open || !application) return null;

    const isPending = application.status === "pending";
    const isBusy = approveMutation.isPending || rejectMutation.isPending;

    const handleReject = () => {
        if (!showRejectInput) {
            setShowRejectInput(true);
            return;
        }
        if (!rejectReason.trim()) {
            toast.error("Please enter a reason for rejection");
            return;
        }
        rejectMutation.mutate({ id: application._id, reason: rejectReason.trim() });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-auto animate-slide-up overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-neutral-900 border-none m-0 p-0 leading-tight">Review Application</h3>
                        <p className="text-xs text-neutral-500 mt-1 font-mono">{application._id}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                        disabled={isBusy}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 overflow-y-auto flex-1 space-y-6">

                    {/* Status Banner */}
                    {application.status === "approved" && (
                        <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-medium">
                            <CheckCircle className="w-5 h-5" /> Application Approved
                        </div>
                    )}
                    {application.status === "rejected" && (
                        <div className="flex flex-col gap-1.5 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium">
                            <div className="flex items-center gap-2">
                                <XCircle className="w-5 h-5" /> Application Rejected
                            </div>
                            {application.rejection_reason && (
                                <p className="text-red-600 font-normal pl-7 text-xs">
                                    Reason: {application.rejection_reason}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-2 border-b border-neutral-100 pb-2">
                            <User className="w-4 h-4" /> Applicant Details
                        </h4>

                        <div className="grid gap-3 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-neutral-500 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Name</span>
                                <span className="font-medium text-neutral-900">{application.name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-neutral-500 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</span>
                                <span className="font-medium text-neutral-900">{application.email}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-neutral-500 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone</span>
                                <span className="font-medium text-neutral-900">{application.phone || "Not provided"}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-neutral-500 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Applied</span>
                                <span className="font-medium text-neutral-900">
                                    {new Date(application.applied_at).toLocaleDateString("en-IN", {
                                        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                                    })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Social Links */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-2 border-b border-neutral-100 pb-2">
                            <LinkIcon className="w-4 h-4" /> Social Links ({application.social_links?.length || 0})
                        </h4>

                        <div className="grid gap-2">
                            {application.social_links?.map((link, idx) => (
                                <a
                                    key={idx}
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-3 bg-neutral-50 border border-neutral-200 rounded-xl hover:bg-neutral-100 hover:border-neutral-300 transition-colors group"
                                >
                                    <div className="w-8 h-8 rounded-full bg-white border border-neutral-200 flex items-center justify-center shrink-0">
                                        <ExternalLink className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600" />
                                    </div>
                                    <span className="text-sm text-neutral-700 truncate font-medium flex-1">
                                        {link.replace(/^https?:\/\/(www\.)?/, '')}
                                    </span>
                                </a>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Footer Actions */}
                {isPending && (
                    <div className="border-t border-neutral-100 bg-neutral-50/50 p-4 shrink-0">
                        {showRejectInput ? (
                            <div className="space-y-3 animate-slide-up">
                                <label className="block text-sm font-medium text-neutral-700">
                                    Reason for rejection <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="e.g. Does not meet minimum follower requirement..."
                                    className="w-full p-3 rounded-lg border border-neutral-200 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none resize-none min-h-[80px]"
                                    disabled={isBusy}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setShowRejectInput(false);
                                            setRejectReason("");
                                        }}
                                        disabled={isBusy}
                                        className="flex-1 py-2 rounded-xl text-neutral-600 font-medium hover:bg-neutral-200/50 transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleReject}
                                        disabled={isBusy || !rejectReason.trim()}
                                        className="flex-1 py-2 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                <button
                                    onClick={handleReject}
                                    disabled={isBusy}
                                    className="flex-1 py-2.5 rounded-xl border-2 border-red-100 text-red-600 font-semibold hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <XCircle className="w-4 h-4" /> Reject
                                </button>
                                <button
                                    onClick={() => approveMutation.mutate(application._id)}
                                    disabled={isBusy}
                                    className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                                >
                                    {approveMutation.isPending ? (
                                        "Approving..."
                                    ) : (
                                        <><CheckCircle className="w-4 h-4" /> Approve</>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
