import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AppRoutes } from "@/routes/AppRoutes";

const queryClient = new QueryClient();

export const App = () => {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <AppRoutes />
                <Toaster position="top-right" />
            </BrowserRouter>
        </QueryClientProvider>
    );
};
