import { api, ApiResponse } from '@/lib/api';

// ============================================
// Types
// ============================================
export interface TwoFactorStatus {
  twoFactorEnabled: boolean;
  hasSecret: boolean;
  hasBackupCodes: boolean;
  backupCodesCount: number;
}

export interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  manualEntry?: string;
  alreadyEnabled?: boolean;
}

export interface TwoFactorEnableResponse {
  backupCodes: string[];
  warning: string;
}

// ============================================
// Service
// ============================================
export const twoFactorService = {
  /**
   * Obtener estado de 2FA del usuario actual
   */
  async getStatus(): Promise<TwoFactorStatus> {
    const response = await api.get<ApiResponse<TwoFactorStatus>>('/auth/2fa/status');
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Error al obtener estado de 2FA');
    }
    return response.data;
  },

  /**
   * Obtener configuración de 2FA (QR code)
   * No regenera si ya tiene 2FA habilitado
   */
  async getSetup(): Promise<TwoFactorSetup> {
    const response = await api.get<ApiResponse<TwoFactorSetup>>('/auth/setup-2fa');
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Error al obtener configuración de 2FA');
    }
    return response.data;
  },

  /**
   * Habilitar 2FA verificando el código
   */
  async enable(code: string): Promise<TwoFactorEnableResponse> {
    const response = await api.post<ApiResponse<TwoFactorEnableResponse>>('/auth/verify-setup-2fa', { code });
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Código inválido');
    }
    return response.data;
  },

  /**
   * Deshabilitar 2FA (solo staging)
   */
  async disable(password: string, code?: string): Promise<void> {
    const response = await api.post<ApiResponse<null>>('/auth/2fa/disable', { password, code });
    if (!response.success) {
      throw new Error(response.message || 'Error al deshabilitar 2FA');
    }
  },

  /**
   * Resetear 2FA (generar nuevo QR)
   */
  async reset(password: string): Promise<TwoFactorSetup> {
    const response = await api.post<ApiResponse<TwoFactorSetup>>('/auth/2fa/reset', { password });
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Error al resetear 2FA');
    }
    return response.data;
  },

  /**
   * Cambiar contraseña del usuario actual
   */
  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<void> {
    const response = await api.post<ApiResponse<null>>('/auth/change-password', {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (!response.success) {
      throw new Error(response.message || 'Error al cambiar contraseña');
    }
  },
};
