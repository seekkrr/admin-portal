import { LayoutDashboard, Users, Video, Map, UserPlus, MessageSquare, BarChart3, MapPin, BookOpen, Star, Globe, Trophy, ListOrdered, Settings2, Activity } from "lucide-react";

export const NAV_ITEMS = [
    { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" },
    { icon: BarChart3, label: "Analytics", to: "/analytics" },
    { icon: Users, label: "Users", to: "/users" },
    { icon: UserPlus, label: "Creator Applications", to: "/creator-applications" },
    { icon: Video, label: "Creators", to: "/creators" },
    { icon: MapPin, label: "Markers", to: "/markers" },
    { icon: Globe, label: "Regions", to: "/regions" },
    { icon: Map, label: "Quests", to: "/quests" },
    { icon: Settings2, label: "Task Configs", to: "/task-configs" },
    { icon: BookOpen, label: "Narratives", to: "/narratives" },
    { icon: Star, label: "Reviews", to: "/reviews" },
    { icon: Trophy, label: "Achievements", to: "/achievements" },
    { icon: ListOrdered, label: "Leaderboards", to: "/leaderboards" },
    { icon: Activity, label: "Progress", to: "/progress" },
    { icon: MessageSquare, label: "Support Queries", to: "/support-queries" },
];
