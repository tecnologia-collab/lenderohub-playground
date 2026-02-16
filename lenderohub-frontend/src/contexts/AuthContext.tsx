'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, tokenManager } from '@/lib/api';

// ============================================
// Types
// ============================================
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  secondLastName?: string;
  fullName: string;
  profileType: string;
  phone?: string;
  twoFactorEnabled?: boolean;
  permissions?: string[];
  readOnly?: boolean;
}

export interface UserProfileSummary {
  id: string;
  type: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  profiles: UserProfileSummary[];
  activeProfileId: string | null;
  hasPermission: (permission: string | string[]) => boolean;
  login: (email: string, password: string) => Promise<{
    requires2FA: boolean;
    tempToken?: string;
    profiles?: UserProfileSummary[];
  }>;
  verify2FA: (tempToken: string, code: string) => Promise<{
    profiles?: UserProfileSummary[];
  }>;
  switchProfile: (profileId: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// API Response Types
interface AuthMeResponse {
  success: boolean;
  user?: User;
  profiles?: UserProfileSummary[];
}

interface LoginResponse {
  requires2FA?: boolean;
  tempToken?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: User;
  profiles?: UserProfileSummary[];
}

interface Verify2FAResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  profiles?: UserProfileSummary[];
}

interface SwitchProfileResponse {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  user: User;
  activeProfile: { id: string; type: string };
  profiles?: UserProfileSummary[];
}

// ============================================
// Constants
// ============================================
const PROFILES_KEY = 'lenderohub_profiles';
const ACTIVE_PROFILE_ID_KEY = 'lenderohub_active_profile_id';

// ============================================
// Context
// ============================================
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// Provider
// ============================================
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<UserProfileSummary[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Restore profiles from localStorage on mount
  useEffect(() => {
    try {
      const savedProfiles = localStorage.getItem(PROFILES_KEY);
      if (savedProfiles) {
        setProfiles(JSON.parse(savedProfiles));
      }
      const savedActiveProfileId = localStorage.getItem(ACTIVE_PROFILE_ID_KEY);
      if (savedActiveProfileId) {
        setActiveProfileId(savedActiveProfileId);
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Verificar si hay sesion al cargar
  useEffect(() => {
    checkAuth();
  }, []);

  // Redirigir segun estado de autenticacion y 2FA
  useEffect(() => {
    if (!loading) {
      const isLoginPage = pathname === '/login';
      const isSetup2FAPage = pathname === '/setup-2fa';
      const isSetupPasswordPage = pathname === '/setup-password';
      const isResetPasswordPage = pathname === '/reset-password';
      const isPublicPage = isLoginPage || isSetup2FAPage || isSetupPasswordPage || isResetPasswordPage;

      if (!user && !isPublicPage) {
        // No autenticado y en pagina privada -> redirect a login
        router.push('/login');
      } else if (user) {
        // Usuario autenticado - verificar estado de 2FA directamente del usuario
        const has2FAEnabled = user.twoFactorEnabled === true;

        if (!has2FAEnabled && !isSetup2FAPage) {
          // Usuario SIN 2FA configurado -> forzar setup
          router.push('/setup-2fa');
        } else if (has2FAEnabled && (isLoginPage || isSetup2FAPage)) {
          // Usuario CON 2FA completo en pagina publica -> redirect a dashboard
          router.push('/hub');
        }
      }
    }
  }, [user, loading, pathname, router]);

  const persistProfiles = useCallback((newProfiles: UserProfileSummary[]) => {
    setProfiles(newProfiles);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(newProfiles));
  }, []);

  const persistActiveProfileId = useCallback((profileId: string | null) => {
    setActiveProfileId(profileId);
    if (profileId) {
      tokenManager.setActiveProfileId(profileId);
    } else {
      tokenManager.clearActiveProfileId();
    }
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('lenderohub_token');

      if (!token) {
        setLoading(false);
        return;
      }

      // Verificar token con el backend
      const response = await api.get<AuthMeResponse>('/auth/me');

      if (response.success && response.user) {
        setUser(response.user);
        if (response.profiles) {
          persistProfiles(response.profiles);
        }
      } else {
        // Token invalido
        tokenManager.clearTokens();
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      tokenManager.clearTokens();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post<LoginResponse>('/auth/login', { email, password });

      if (response.requires2FA) {
        // Usuario tiene 2FA habilitado
        return {
          requires2FA: true,
          tempToken: response.tempToken,
        };
      } else {
        // Login exitoso sin 2FA
        if (response.accessToken) {
          tokenManager.setToken(response.accessToken);
        }
        if (response.refreshToken) {
          tokenManager.setRefreshToken(response.refreshToken);
        }
        if (response.user) {
          setUser(response.user);
        }

        const loginProfiles = response.profiles || [];
        persistProfiles(loginProfiles);

        // If only 1 profile (or 0), auto-select it and redirect
        if (loginProfiles.length <= 1) {
          if (loginProfiles.length === 1) {
            persistActiveProfileId(loginProfiles[0].id);
          }

          // Redirigir segun si tiene 2FA configurado
          if (response.user?.twoFactorEnabled === false) {
            router.push('/setup-2fa');
          } else {
            router.push('/hub');
          }
        }
        // If multiple profiles, do NOT redirect - let login page show profile selector

        return { requires2FA: false, profiles: loginProfiles };
      }
    } catch (error: any) {
      throw new Error(error.message || 'Error al iniciar sesion');
    }
  };

  const verify2FA = async (tempToken: string, code: string) => {
    try {
      const response = await api.post<Verify2FAResponse>('/auth/verify-2fa', {
        tempToken,
        code,
      });

      tokenManager.setToken(response.accessToken);
      tokenManager.setRefreshToken(response.refreshToken);
      setUser(response.user);

      const verifyProfiles = response.profiles || [];
      persistProfiles(verifyProfiles);

      // If only 1 profile (or 0), auto-select and redirect
      if (verifyProfiles.length <= 1) {
        if (verifyProfiles.length === 1) {
          persistActiveProfileId(verifyProfiles[0].id);
        }
        router.push('/hub');
      }
      // If multiple profiles, do NOT redirect - let login page show profile selector

      return { profiles: verifyProfiles };
    } catch (error: any) {
      throw new Error(error.message || 'Codigo 2FA invalido');
    }
  };

  const switchProfile = async (profileId: string) => {
    try {
      const response = await api.post<SwitchProfileResponse>('/auth/switch-profile', { profileId });

      if (response.success) {
        // Update tokens
        tokenManager.setToken(response.accessToken);
        tokenManager.setRefreshToken(response.refreshToken);

        // Update user state
        setUser(response.user);

        // Update active profile
        persistActiveProfileId(response.activeProfile.id);

        if (response.profiles) {
          persistProfiles(response.profiles);
        }
      }
    } catch (error: any) {
      throw new Error(error.message || 'Error al cambiar perfil');
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('lenderohub_refresh_token');

      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      tokenManager.clearTokens();
      setUser(null);
      setProfiles([]);
      setActiveProfileId(null);
      localStorage.removeItem(PROFILES_KEY);
      router.push('/login');
    }
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    profiles,
    activeProfileId,
    hasPermission: (permission: string | string[]) => {
      // Si no hay usuario o no tiene permisos definidos, no permitir
      if (!user?.permissions || user.permissions.length === 0) return false;
      if (Array.isArray(permission)) {
        return permission.some((perm) => user.permissions?.includes(perm));
      }
      return user.permissions.includes(permission);
    },
    login,
    verify2FA,
    switchProfile,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================
// Hook
// ============================================
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
