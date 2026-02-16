import { NavLink } from "react-router-dom";
import {
    Users,
    Video,
    Map,
    ChevronLeft,
    ChevronRight,
    LayoutDashboard
} from "lucide-react";
import { useState } from "react";

const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", to: "/stats" },
    { icon: Users, label: "Users", to: "/users" },
    { icon: Video, label: "Creators", to: "/creators" },
    { icon: Map, label: "Quests", to: "/quests" },
];

export function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={`
                bg-white border-r border-neutral-200 h-[calc(100vh-5rem)] sticky top-20
                flex flex-col transition-all duration-300 ease-in-out z-30
                ${collapsed ? "w-20" : "w-64"}
                hidden md:flex
            `}
        >
            <div className="flex-1 py-6 px-3 space-y-2">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) => `
                            flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group
                            ${isActive
                                ? "bg-neutral-900 text-white shadow-md shadow-neutral-200"
                                : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                            }
                            ${collapsed ? "justify-center" : ""}
                        `}
                    >
                        <item.icon className={`w-5 h-5 ${collapsed ? "w-6 h-6" : ""}`} />
                        <span
                            className={`
                                font-medium whitespace-nowrap overflow-hidden transition-all duration-300 origin-left
                                ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}
                            `}
                        >
                            {item.label}
                        </span>

                        {/* Tooltip for collapsed state */}
                        {collapsed && (
                            <div className="absolute left-16 bg-neutral-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                {item.label}
                            </div>
                        )}
                    </NavLink>
                ))}
            </div>

            <div className="p-4 border-t border-neutral-100">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="w-full flex items-center justify-center p-2 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
                >
                    {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
            </div>
        </aside>
    );
}
