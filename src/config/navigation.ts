import { LayoutDashboard, Users, Video, Map, UserPlus, MessageSquare, BarChart3 } from "lucide-react";

export const NAV_ITEMS = [
    { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" },
    { icon: BarChart3, label: "Analytics", to: "/analytics" },
    { icon: Users, label: "Users", to: "/users" },
    { icon: UserPlus, label: "Applications", to: "/creator-applications" },
    { icon: Video, label: "Creators", to: "/creators" },
    { icon: Map, label: "Quests", to: "/quests" },
    { icon: MessageSquare, label: "Support Queries", to: "/support-queries" },
];
