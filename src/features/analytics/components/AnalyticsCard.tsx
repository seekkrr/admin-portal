import { Card, CardContent } from "@components/ui";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface AnalyticsCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: { value: number; isPositive: boolean };
    icon?: LucideIcon;
    colorClass?: string;
    isLoading?: boolean;
}

export function AnalyticsCard({ title, value, subtitle, trend, icon: Icon, colorClass = "ring-indigo-100 text-indigo-600", isLoading }: AnalyticsCardProps) {
    if (isLoading) {
        return (
            <Card className="animate-pulse shadow-sm border-neutral-100">
                <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-4">
                        <div className="h-4 bg-neutral-200 rounded w-2/3" />
                        <div className="w-10 h-10 bg-neutral-200 rounded-xl shrink-0" />
                    </div>
                    <div className="h-8 bg-neutral-200 rounded w-1/2 mt-4" />
                </CardContent>
            </Card>
        );
    }

    // Process colorClass to get background color for the top border accent
    const bgAccentClass = colorClass.includes('text-') 
        ? colorClass.split(' ').find(c => c.startsWith('text-'))?.replace('text-', 'bg-') || 'bg-indigo-500'
        : 'bg-indigo-500';

    return (
        <Card className="hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 ease-out border-neutral-100 shadow-sm overflow-hidden relative group bg-white/70 backdrop-blur-xl">
            <div className={`absolute top-0 left-0 w-full h-1 opacity-50 group-hover:opacity-100 transition-opacity ${bgAccentClass}`} />
            <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4 gap-2">
                    <div className="flex flex-col">
                        <p className="uppercase text-xs tracking-wider font-bold text-neutral-500 leading-snug">{title}</p>
                        {subtitle && <p className="text-[10px] font-medium tracking-wide text-neutral-400 mt-0.5">{subtitle}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className={`p-2.5 bg-white shadow-sm ring-1 ${colorClass} rounded-xl transition-transform duration-300 group-hover:scale-110`}>
                            {Icon ? <Icon className="w-5 h-5" /> : <div className="w-5 h-5" />}
                        </div>
                        {trend && (
                            <div className={`flex items-center gap-0.5 text-xs font-bold ${trend.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {trend.isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                {trend.value}%
                            </div>
                        )}
                    </div>
                </div>
                <h3 className="text-3xl font-extrabold text-neutral-900 tracking-tight leading-none">{value}</h3>
            </CardContent>
        </Card>
    );
}
