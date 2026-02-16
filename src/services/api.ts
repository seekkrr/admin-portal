import axios, {
    type AxiosError,
    type AxiosInstance,
    type InternalAxiosRequestConfig,
} from "axios";
import { config } from "@config/env";
import type { ApiError } from "@/types";

const AUTH_TOKEN_KEY = "seekkrr_admin_access_token"; // Distinct key for admin
const REFRESH_TOKEN_KEY = "seekkrr_admin_refresh_token";

function getStoredToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

function setStoredTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function clearStoredTokens(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function createApiClient(): AxiosInstance {
    const client = axios.create({
        baseURL: config.api.baseUrl,
        timeout: config.api.timeout,
        headers: {
            "Content-Type": "application/json",
        },
    });

    // Request interceptor - add auth token
    client.interceptors.request.use(
        (requestConfig: InternalAxiosRequestConfig) => {
            const token = getStoredToken();
            if (token && requestConfig.headers) {
                requestConfig.headers.Authorization = `Bearer ${token}`;
            }
            return requestConfig;
        },
        (error: AxiosError) => {
            return Promise.reject(error);
        }
    );

    // Response interceptor - handle errors
    client.interceptors.response.use(
        (response) => response,
        async (error: AxiosError<ApiError>) => {
            const status = error.response?.status;
            console.log("[API] Response error:", status, error.response?.data);

            // Handle 401 - Unauthorized
            if (status === 401) {
                console.warn("[API] 401 Unauthorized - Clearing tokens");
                clearStoredTokens();
                // Redirect to login if not already there
                const isLoginPage = window.location.pathname.includes("/login");
                const isCallbackPage = window.location.pathname.includes("/auth/callback");

                if (!isLoginPage && !isCallbackPage) {
                    window.location.href = "/login";
                }
            }

            // Extract error message
            const errorMessage =
                error.response?.data?.error ||
                error.response?.data?.details ||
                error.message ||
                "An unexpected error occurred";

            return Promise.reject(new Error(errorMessage));
        }
    );

    return client;
}

export const api = createApiClient();

export const authStorage = {
    getToken: getStoredToken,
    setTokens: setStoredTokens,
    clearTokens: clearStoredTokens,
    getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
};
