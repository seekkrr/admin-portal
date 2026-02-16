import { NavLink } from "react-router-dom";
import { ChevronLeft, Menu } from "lucide-react";
import { NAV_ITEMS } from "@/config/navigation";

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
    return (
        <aside
            className={`
                bg-white border-r border-neutral-200 h-[calc(100vh-4rem)]
                flex flex-col transition-all duration-300 ease-in-out z-30
                ${collapsed ? "w-20" : "w-64"}
                hidden md:flex
            `}
        >
            <div className="flex items-center p-4 h-16 border-b border-neutral-100">
                <button
                    onClick={onToggle}
                    className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                >
                    {collapsed ? <Menu className="w-6 h-6" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
            </div>

            <div className="flex-1 py-6 px-3 space-y-2">
                {NAV_ITEMS.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) => `
                            flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative
                            ${isActive
                                ? "bg-neutral-900 text-white shadow-md shadow-neutral-200"
                                : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                            }
                            ${collapsed ? "justify-center" : ""}
                        `}
                    >
                        <item.icon className={`w-5 h-5 shrink-0 ${collapsed ? "w-6 h-6" : ""}`} />
                        <span
                            className={`
                                font-medium whitespace-nowrap overflow-hidden transition-all duration-300 origin-left
                                ${collapsed ? "w-0 opacity-0 absolute" : "w-auto opacity-100 relative"}
                            `}
                        >
                            {item.label}
                        </span>

                        {/* Tooltip for collapsed state */}
                        {collapsed && (
                            <div className="absolute left-14 bg-neutral-900 text-white text-xs px-2 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg">
                                {item.label}
                            </div>
                        )}
                    </NavLink>
                ))}
            </div>
        </aside>
    );
}
