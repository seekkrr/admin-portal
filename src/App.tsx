import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";

import { AppRoutes } from "@/routes/AppRoutes";

export const App = () => {
    return (
        <BrowserRouter>
            <AppRoutes />
            <Toaster position="top-right" />
        </BrowserRouter>
    );
};
