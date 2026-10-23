import { StatusPill } from "@/components/ui/StatusPill";
import type { MarkerApplicationStatus } from "@/types";

/** Place request status. "Under review" isn't in the shared map; it's still waiting on us. */
export function PlaceRequestStatus({ status }: { status: MarkerApplicationStatus }) {
    return <StatusPill status={status} tone={status === "under_review" ? "info" : undefined} />;
}
