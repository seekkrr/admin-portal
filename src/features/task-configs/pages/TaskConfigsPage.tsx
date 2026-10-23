import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Settings2 } from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { TaskConfigsTab } from "../components/TaskConfigsTab";
import { StepRewardsTab } from "../components/StepRewardsTab";

type Tab = "tasks" | "rewards";

/** Task configs (what people do at a place) and step rewards (the points they get). */
export function TaskConfigsPage() {
    const { user } = useAuthStore();
    const canManage = !!user?.role?.some((r) => ["admin", "super_admin"].includes(r));
    const [params, setParams] = useSearchParams();
    const tab: Tab = params.get("tab") === "rewards" ? "rewards" : "tasks";
    const [creating, setCreating] = useState(false);

    // Each tab has its own filters; switching tabs starts clean.
    const switchTab = (next: Tab) => {
        setCreating(false);
        setParams(next === "tasks" ? {} : { tab: next });
    };

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Settings2}
                title="Task configs"
                description="Tasks at places and quests, and the points awarded for completing them"
                primaryAction={
                    canManage && (
                        <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
                            {tab === "tasks" ? "New task config" : "New step reward"}
                        </Button>
                    )
                }
            />

            <Tabs<Tab>
                label="Task config views"
                value={tab}
                onChange={switchTab}
                tabs={[
                    { value: "tasks", label: "Task configs" },
                    { value: "rewards", label: "Step rewards" },
                ]}
            />

            {tab === "tasks" ? (
                <TaskConfigsTab canManage={canManage} createOpen={creating} onCloseCreate={() => setCreating(false)} />
            ) : (
                <StepRewardsTab canManage={canManage} createOpen={creating} onCloseCreate={() => setCreating(false)} />
            )}
        </div>
    );
}
