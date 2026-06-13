import { NavLink } from "react-router-dom";
import { ChevronLeft, Menu } from "lucide-react";
import { NAV_ITEMS } from "@/config/navigation";
import { useRef, useState, useEffect } from "react";

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [scrollState, setScrollState] = useState<"top" | "middle" | "bottom">("top");

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        if (scrollTop === 0) {
            setScrollState("top");
        } else if (scrollTop + clientHeight >= scrollHeight - 1) {
            setScrollState("bottom");
        } else {
            setScrollState("middle");
        }
    };

    useEffect(() => {
        handleScroll(); // Initial check
        window.addEventListener('resize', handleScroll);
        return () => window.removeEventListener('resize', handleScroll);
    }, []);

    // Determine the mask based on scroll position
    const getMaskStyle = () => {
        if (scrollState === "top") return "linear-gradient(to bottom, black calc(100% - 24px), transparent)";
        if (scrollState === "bottom") return "linear-gradient(to bottom, transparent, black 24px, black)";
        return "linear-gradient(to bottom, transparent, black 24px, black calc(100% - 24px), transparent)";
    };

    return (
        <aside
            className={`
                bg-white/80 backdrop-blur-md border-r border-white/20 h-[calc(100vh-4rem)]
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

            <div 
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto sidebar-scroll-mask py-4 px-3 space-y-1"
                style={{ 
                    WebkitMaskImage: getMaskStyle(),
                    maskImage: getMaskStyle(),
                }}
            >
                {NAV_ITEMS.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        title={collapsed ? item.label : undefined}
                        className={({ isActive }) => `
                            flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative outline-none
                            focus-visible:ring-2 focus-visible:ring-indigo-500/40
                            ${isActive
                                ? "bg-neutral-900 text-white shadow-md shadow-neutral-900/15"
                                : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 hover:translate-x-0.5"
                            }
                            ${collapsed ? "justify-center" : ""}
                        `}
                    >
                        {({ isActive }) => (
                            <>
                                {/* Active accent bar in the gutter */}
                                <span
                                    className={`absolute -left-3 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-indigo-500 transition-all duration-200 ${isActive ? "h-6 opacity-100" : "h-0 opacity-0"}`}
                                />
                                <item.icon
                                    className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${collapsed ? "w-6 h-6" : "w-5 h-5"} ${isActive ? "text-indigo-300" : ""}`}
                                />
                                <span
                                    className={`
                                        font-medium whitespace-nowrap overflow-hidden transition-all duration-300 origin-left
                                        ${collapsed ? "w-0 opacity-0 absolute" : "w-auto opacity-100 relative"}
                                    `}
                                >
                                    {item.label}
                                </span>
                            </>
                        )}
                    </NavLink>
                ))}
            </div>
        </aside>
    );
}
