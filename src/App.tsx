import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { config } from "@config/env";

import { AppRoutes } from "@/routes/AppRoutes";

const queryClient = new QueryClient();

export const App = () => {
    return (
        <GoogleOAuthProvider clientId={config.googleClientId}>
            <QueryClientProvider client={queryClient}>
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <AppRoutes />
                    <Toaster position="top-right" />
                </BrowserRouter>
            </QueryClientProvider>
        </GoogleOAuthProvider>
    );
};
