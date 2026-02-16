import { BrowserRouter } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "sonner";

import { AppRoutes } from "@/routes/AppRoutes";
import { RouteTracker } from "@/components/RouteTracker";

export const App = () => {
    return (
        <BrowserRouter>
            <RouteTracker />
            <AppRoutes />
            <Analytics />
            <Toaster position="top-right" />
        </BrowserRouter>
    );
};
