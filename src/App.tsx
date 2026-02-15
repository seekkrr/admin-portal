import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "@/routes/AppRoutes";
import { Toaster } from "sonner";

export const App = () => {
    return (
        <BrowserRouter>
            <AppRoutes />
            <Toaster position="top-right" />
        </BrowserRouter>
    );
};
