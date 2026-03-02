/**
 * API Client for LenderoHUB
 * 
 * Centralized HTTP client with:
 * - Authentication handling (JWT)
 * - Error handling
 * - Request/Response interceptors
 * - Retry logic
 */

import { env } from '@/config/env';

// ============================================
// Types
// ============================================
export interface ApiErrorData {
  message: string;
  code?: string;
  status: number;
  details?: Record<string, unknown>;
}

/**
 * Custom Error class for API errors
 * Extends native Error for proper serialization and stack traces
 */
export class ApiError extends Error {
  code?: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(data: ApiErrorData) {
    super(data.message);
    this.name = 'ApiError';
    this.code = data.code;
    this.status = data.status;
    this.details = data.details;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface RequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  timeout?: number;
}

// ============================================
// Token Management
// ============================================
const TOKEN_KEY = 'lenderohub_token';
const REFRESH_TOKEN_KEY = 'lenderohub_refresh_token';
const ACTIVE_PROFILE_ID_KEY = 'lenderohub_active_profile_id';

export const tokenManager = {
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },
  
  setToken: (token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, token);
  },
  
  getRefreshToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  
  setRefreshToken: (token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  },
  
  clearTokens: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(ACTIVE_PROFILE_ID_KEY);
  },

  isAuthenticated: (): boolean => {
    return !!tokenManager.getToken();
  },

  getActiveProfileId: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACTIVE_PROFILE_ID_KEY);
  },

  setActiveProfileId: (profileId: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ACTIVE_PROFILE_ID_KEY, profileId);
  },

  clearActiveProfileId: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ACTIVE_PROFILE_ID_KEY);
  },
};

// ============================================
// API Client Class
// ============================================
class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string) {
    console.log('API BASE URL REAL:', baseUrl); // ← línea de diagnóstico
  
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    
    return url.toString();
  }

  /**
   * Get headers with auth token and active profile
   */
  private getHeaders(): Record<string, string> {
    const headers = { ...this.defaultHeaders };
    const token = tokenManager.getToken();

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const activeProfileId = tokenManager.getActiveProfileId();
    if (activeProfileId) {
      headers['X-Profile-Id'] = activeProfileId;
    }

    return headers;
  }

  /**
   * Handle API errors
   */
  private async handleError(response: Response, endpoint?: string): Promise<never> {
    let errorData: ApiErrorData;

    try {
      const data = await response.json();
      errorData = {
        message: data.message || data.error || 'An error occurred',
        code: data.code,
        status: response.status,
        details: data.details,
      };
    } catch {
      errorData = {
        message: `HTTP Error: ${response.status} ${response.statusText}`,
        status: response.status,
      };
    }

    // Handle 401 - Unauthorized
    // No redirigir si es un error de login (credenciales incorrectas)
    const isAuthEndpoint = endpoint?.includes('/auth/login') || endpoint?.includes('/auth/verify-2fa');
    if (response.status === 401 && !isAuthEndpoint) {
      tokenManager.clearTokens();
      // Redirect to login if in browser
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }

    throw new ApiError(errorData);
  }

  /**
   * Make HTTP request
   */
  async request<T>(
    method: string,
    endpoint: string,
    options: RequestConfig = {}
  ): Promise<T> {
    const { params, timeout = 30000, body, headers: customHeaders, ...restOptions } = options;
    
    const url = this.buildUrl(endpoint, params);
    const headers: Record<string, string> = {
      ...this.getHeaders(),
      ...(customHeaders ? (customHeaders as Record<string, string>) : {})
    };
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (isFormData) {
      delete headers['Content-Type'];
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? (isFormData ? (body as BodyInit) : JSON.stringify(body)) : undefined,
        signal: controller.signal,
        ...restOptions,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleError(response, endpoint);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError({
          message: 'Request timeout',
          code: 'TIMEOUT',
          status: 408,
        });
      }
      
      throw error;
    }
  }

  // HTTP Methods
  async get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>('GET', endpoint, { params });
  }

  async post<T>(endpoint: string, data?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>('POST', endpoint, { body: data as BodyInit, params });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>('PUT', endpoint, { body: data as BodyInit });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>('PATCH', endpoint, { body: data as BodyInit });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>('DELETE', endpoint);
  }
}

// ============================================
// Export singleton instance
// ============================================
export const api = new ApiClient(`${env.apiUrl}/v1`);

// Export for custom instances
export { ApiClient };
