import { LayoutDashboard, Users, Video, Map, UserPlus } from "lucide-react";

export const NAV_ITEMS = [
    { icon: LayoutDashboard, label: "Dashboard", to: "/stats" },
    { icon: Users, label: "Users", to: "/users" },
    { icon: Video, label: "Creators", to: "/creators" },
    { icon: UserPlus, label: "Applications", to: "/creator-applications" },
    { icon: Map, label: "Quests", to: "/quests" },
];
