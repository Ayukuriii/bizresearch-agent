import axios, { AxiosError } from 'axios';

export interface ApiSuccessResponse<T> {
    success: true;
    data: T;
}

export interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
    };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// Helper type guard
export function isApiError(res: ApiResponse<unknown>): res is ApiErrorResponse {
    return res.success === false;
}

const baseURL = import.meta.env.VITE_API_URL as string | undefined;

if (!baseURL) {
    throw new Error('[api] VITE_API_URL is not defined. Check your .env file.');
}

export const apiClient = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10_000,
});

// Response interceptor — normalize error shape
apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ApiErrorResponse>) => {
        // Error yang datang dari backend (ada response body)
        if (error.response?.data) {
            return Promise.reject(error.response.data);
        }

        // Network error / timeout / no response
        const fallback: ApiErrorResponse = {
            success: false,
            error: {
                code: 'NETWORK_ERROR',
                message: error.message ?? 'Network error. Pastikan backend berjalan.',
            },
        };

        return Promise.reject(fallback);
    }
);