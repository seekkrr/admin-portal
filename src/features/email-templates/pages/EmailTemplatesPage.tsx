import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Mail, PanelTop, ChevronRight } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { Card } from "@/components/ui/Card";
import { useCollabAccess } from "@/features/collabs/roles";
import { Chip, PageHeader, PanelState, SearchBox, Toolbar } from "@/features/collabs/components/CollabsUi";
import { fmtDateTime } from "@/features/collabs/utils";
import { emailTemplatesService, emailTemplatePath } from "../services/email-templates.service";
import { DeliveryBanner } from "../components/EmailUi";
import type { EmailTemplateListItem } from "../types";

const GROUP_ORDER = ["Layout", "Creators", "Support", "Places", "Quests", "Businesses", "Legacy (V1)"];

function TemplateRow({ t, onOpen }: { t: EmailTemplateListItem; onOpen: () => void }) {
    return (
        <button type="button" onClick={onOpen} className="w-full text-left px-5 py-3.5 flex items-center gap-4 hover:bg-neutral-50/80 transition-colors group">
            <span className="w-9 h-9 rounded-xl bg-neutral-100 text-neutral-500 flex items-center justify-center shrink-0 group-hover:bg-teal-50 group-hover:text-teal-600">
                {t.is_layout ? <PanelTop className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-neutral-900">{t.name}</span>
                    {t.has_override && <Chip tone="teal">Customized</Chip>}
                    {t.provider === "zeptomail" && <Chip tone="violet">ZeptoMail template</Chip>}
                    {t.source === "v1" && <Chip tone="amber">V1</Chip>}
                </span>
                <span className="block text-xs text-neutral-500 truncate">{t.description}</span>
                <span className="block text-[11px] font-mono text-neutral-400">{t.key}</span>
            </span>
            <span className="text-xs text-neutral-400 whitespace-nowrap hidden sm:block">
                {t.updated_at ? `Updated ${fmtDateTime(t.updated_at)}` : "Built-in design"}
                {t.version ? ` · v${t.version}` : ""}
            </span>
            <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-500" />
        </button>
    );
}

export function EmailTemplatesPage() {
    const { isAdmin } = useCollabAccess();
    const navigate = useNavigate();
    const [search, setSearch] = useState("");

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["email-templates"],
        queryFn: emailTemplatesService.list,
        enabled: isAdmin,
    });

    const groups = useMemo(() => {
        const q = search.trim().toLowerCase();
        const items = (data?.templates ?? []).filter(
            (t) => !q || t.name.toLowerCase().includes(q) || t.key.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
        );
        const map = new Map<string, EmailTemplateListItem[]>();
        items.forEach((t) => map.set(t.group, [...(map.get(t.group) ?? []), t]));
        return [...map.entries()].sort(([a], [b]) => {
            const ia = GROUP_ORDER.indexOf(a);
            const ib = GROUP_ORDER.indexOf(b);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
        });
    }, [data, search]);

    if (!isAdmin) return <AccessDenied message="Only admins can edit email templates." />;

    const total = data?.templates.length ?? 0;
    const customized = data?.templates.filter((t) => t.has_override).length ?? 0;

    return (
        <div className="p-6 max-w-[1200px] mx-auto space-y-5 animate-fade-in">
            <PageHeader
                icon={Mail}
                title="Email Templates"
                gradient="from-sky-500 to-sky-600"
                subtitle={data ? `${total} templates · ${customized} customized · changes reach sending within about a minute` : "Loading..."}
            />

            {data?.delivery && <DeliveryBanner delivery={data.delivery} />}

            <Toolbar>
                <SearchBox value={search} onChange={setSearch} placeholder="Search by name, key or description..." />
            </Toolbar>

            <PanelState isLoading={isLoading} error={error} isEmpty={groups.length === 0} emptyIcon={Mail} emptyText={search ? "No templates match your search" : "No templates found"} onRetry={() => refetch()}>
                <div className="space-y-4">
                    {groups.map(([group, items]) => (
                        <Card key={group} padding="none" className="overflow-hidden">
                            <div className="bg-neutral-50/50 border-b border-neutral-100 px-5 py-3 flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wider">{group}</h3>
                                <span className="text-xs text-neutral-400">{items.length}</span>
                            </div>
                            <div className="divide-y divide-neutral-100">
                                {items.map((t) => (
                                    <TemplateRow key={t.key} t={t} onOpen={() => navigate(emailTemplatePath(t.key))} />
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>
            </PanelState>
        </div>
    );
}
