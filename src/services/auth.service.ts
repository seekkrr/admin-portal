import { api, authStorage } from "./api";
import { API_ENDPOINTS } from "@config/api";
import type { AuthTokens, User } from "@/types";

export interface AuthMeResponse {
    user: User;
}

export const authService = {
    /**
     * Login with Google Credential from GIS SDK
     */
    async loginWithGoogleCredential(credential: string): Promise<AuthTokens> {
        const response = await api.post<AuthTokens>(API_ENDPOINTS.AUTH.OAUTH_LOGIN, {
            provider: "google",
            token: credential,
        });
        return response.data;
    },

    /**
     * Get current authenticated user
     */
    async getCurrentUser(): Promise<AuthMeResponse> {
        // Get user_id from token or storage
        const tokens = authStorage.getToken();
        if (!tokens) throw new Error("No token found");

        // The /auth/verify endpoint uses to_self_dict() which includes 'role' and other private fields
        // that are stripped from the public /users/:id endpoint.
        const response = await api.get<{ user: User }>(API_ENDPOINTS.AUTH.VERIFY);

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
