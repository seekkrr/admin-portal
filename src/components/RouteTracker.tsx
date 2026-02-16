import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { track } from "@vercel/analytics";

export function RouteTracker() {
    const location = useLocation();

    useEffect(() => {
        track("pageview", {
            path: location.pathname,
        });
    }, [location]);

    return null;
}
