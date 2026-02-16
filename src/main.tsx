import { StrictMode } from "react";
import { Analytics } from "@vercel/analytics/react"
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@styles/index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
    throw new Error("Root element not found");
}

createRoot(rootElement).render(
    <StrictMode>
        <App />
        <Analytics />
    </StrictMode>
);
