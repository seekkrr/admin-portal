import { Link } from "react-router-dom";
import { Receipt } from "lucide-react";
import { Panel, DetailList, DetailRow } from "@/components/ui/Panel";
import { Tag } from "@/components/ui/StatusPill";
import { OverridePanel } from "../OverridePanel";
import { humanize } from "../../utils";
import type { AdminBusiness } from "../../types";

/** Plan and the admin plan override (existing Plans & Billing logic). */
export function BusinessBillingTab({ business, canEdit }: { business: AdminBusiness; canEdit: boolean }) {
    return (
        <div className="space-y-5">
            <Panel title="Plan" icon={Receipt}>
                <DetailList>
                    <DetailRow label="Profile plan" value={<Tag tone="brand">{humanize(business.plan_code ?? "free")}</Tag>} />
                    <DetailRow label="Legal name" value={business.billing?.legal_name || "—"} />
                    <DetailRow label="GSTIN" value={business.billing?.gstin ? <span className="font-mono">{business.billing.gstin}</span> : "—"} />
                    <DetailRow label="State code" value={business.billing?.state_code || "—"} />
                    <DetailRow label="Billing address" value={business.billing?.address || "—"} />
                    <DetailRow
                        label="Subscriptions"
                        value={
                            <Link to="/collabs/billing" className="text-accent-700 hover:underline">
                                Open Plans & Billing
                            </Link>
                        }
                    />
                </DetailList>
            </Panel>
            {canEdit && (
                <Panel title="Plan override" icon={Receipt} description="Give this business a different plan or limits for a while. Existing overrides are listed under Plans & Billing.">
                    <OverridePanel businessId={business.id} currentPlanCode={business.plan_code} />
                </Panel>
            )}
        </div>
    );
}
