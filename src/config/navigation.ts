import { LayoutDashboard, Users, Video, Map } from "lucide-react";

export const NAV_ITEMS = [
    { icon: LayoutDashboard, label: "Dashboard", to: "/stats" },
    { icon: Users, label: "Users", to: "/users" },
    { icon: Video, label: "Creators", to: "/creators" },
    { icon: Map, label: "Quests", to: "/quests" },
];
