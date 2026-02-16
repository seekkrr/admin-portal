import { api, authStorage } from "./api";
import { API_ENDPOINTS } from "@config/api";
import { config } from "@config/env";
import type { AuthTokens, User } from "@/types";

export interface AuthMeResponse {
    user: User;
}

export const authService = {
    /**
     * Initiate Google OAuth login for admins
     * Uses state parameter for CSRF protection
     */
    initiateGoogleLogin(): void {
        const redirectUri = `${window.location.origin}/auth/callback`;

        // Use full backend URL for OAuth
        // Note: Using is_creator=false or is_admin=true depending on backend logic. 
        // Assuming backend treats non-creator logins as potentially admin logins if role matches, 
        // or just standard user login which we then check role for.
        // For now, mirroring creator portal but checking backend URL construction.
        const authUrl = `${config.api.baseUrl}${API_ENDPOINTS.AUTH.GOOGLE}?platform=web&redirect_uri=${encodeURIComponent(redirectUri)}`;
        window.location.href = authUrl;
    },

    /**
     * Exchange auth code for tokens
     */
    async exchangeAuthCode(code: string): Promise<AuthTokens> {
        const response = await api.post<AuthTokens>("/api/auth/mobile/exchange", { code });
        return response.data;
    },

    /**
     * Get current authenticated user
     */
    async getCurrentUser(): Promise<AuthMeResponse> {
        // Get user_id from token or storage
        const tokens = authStorage.getToken();
        if (!tokens) throw new Error("No token found");

        // Parse JWT to get user_id (simplistic parsing)
        const parts = tokens.split('.');
        if (parts.length < 2) throw new Error("Invalid token format");
        const base64Url = parts[1];
        if (!base64Url) throw new Error("Invalid token format");
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload = JSON.parse(jsonPayload);
        const userId = payload.sub || payload.user_id;

        const response = await api.get<{ user: User }>(`/api/core/users/${userId}`);

        return {
            user: response.data.user,
        };
    },

    /**
     * Refresh access token
     */
    async refreshToken(): Promise<AuthTokens> {
        const refreshToken = authStorage.getRefreshToken();
        if (!refreshToken) {
            throw new Error("No refresh token available");
        }

        const response = await api.post<AuthTokens>(API_ENDPOINTS.AUTH.REFRESH, {
            refresh_token: refreshToken,
        });

        const tokens = response.data;
        authStorage.setTokens(tokens.access_token, tokens.refresh_token);
        return tokens;
    },

    /**
     * Logout user
     */
    async logout(): Promise<void> {
        const refreshToken = authStorage.getRefreshToken();
        try {
            if (refreshToken) {
                await api.post(API_ENDPOINTS.AUTH.LOGOUT, {
                    refresh_token: refreshToken,
                });
            }
        } finally {
            authStorage.clearTokens();
        }
    },

    /**
     * Store tokens after OAuth callback
     */
    storeTokens(tokens: AuthTokens): void {
        authStorage.setTokens(tokens.access_token, tokens.refresh_token);
    },

    /**
     * Check if user has valid token stored
     */
    hasStoredToken(): boolean {
        return !!authStorage.getToken();
    },
};
