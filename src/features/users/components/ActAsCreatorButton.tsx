import { useState } from "react";
import { UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAdminAccess } from "@/components/detail/useAdminAccess";
import { config } from "@/config/env";
import { impersonationApi } from "@/services/admin-detail.service";

/**
 * "Act as creator": opens the creator's Partner Portal in a new tab, signed in
 * as them for up to 30 minutes (admins only). Payouts and account settings stay
 * off there, and every change is logged in the creator's change history.
 */
export function ActAsCreatorButton({ userId, name }: { userId: string; name: string }) {
    const { isAdmin } = useAdminAccess();
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);
    if (!isAdmin) return null;

    const start = async (reason?: string) => {
        // Open the tab inside the click so pop-up blockers allow it, then point it at the portal.
        const tab = window.open("", "_blank");
        if (tab) tab.opener = null;
        setPending(true);
        try {
            const { code } = await impersonationApi.start(userId, reason);
            const url = `${config.partnerPortal.baseUrl}/creator/act-as#code=${encodeURIComponent(code)}`;
            if (tab) tab.location.href = url;
            else window.open(url, "_blank", "noopener,noreferrer");
            setOpen(false);
        } catch (e) {
            tab?.close();
            toast.error(e instanceof Error ? e.message : "Couldn't start acting as this creator");
        } finally {
            setPending(false);
        }
    };

    return (
        <>
            <Button variant="secondary" size="sm" icon={UserCog} onClick={() => setOpen(true)}>
                Act as creator
            </Button>
            <ConfirmDialog
                open={open}
                title={`Act as ${name}?`}
                description="Opens their Partner Portal in a new tab, signed in as them for up to 30 minutes. You can create and edit their quests, places and events. Payouts and account settings stay off, and every change is logged in their change history."
                confirmLabel="Open their portal"
                tone="warning"
                level="reason"
                reasonLabel="Why (optional)"
                reasonPlaceholder="e.g. Fixing the photos on their Bir quest"
                reasonMinLength={0}
                reasonMaxLength={300}
                isPending={pending}
                onConfirm={start}
                onCancel={() => setOpen(false)}
            />
        </>
    );
}
