import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

// ============================================
// Types
// ============================================
export interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string; // Data URL (base64 PNG) - 100% escaneable
  manualEntry: string;
  backupCodes?: string[];
}

// ============================================
// 2FA Service
// ============================================
export class TwoFactorService {
  /**
   * Generate a new 2FA secret
   */
  static generateSecret(userEmail: string): { secret: string; otpauthUrl: string } {
    const secret = speakeasy.generateSecret({
      name: `LenderoHUB (${userEmail})`,
      issuer: 'LenderoHUB',
      length: 32,
    });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url || '',
    };
  }

  /**
   * Generate QR code as Data URL (PNG base64)
   * ✅ 100% escaneable por todas las apps
   */
  static async generateQRCode(otpauthUrl: string): Promise<string> {
    try {
      // Genera QR como Data URL (PNG en base64)
      const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300, // Aumentado de 256 a 300
        margin: 4, // Quiet zone (margen blanco requerido)
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      return qrDataUrl; // data:image/png;base64,...
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Verify TOTP code
   * window: 2 = permite códigos de hasta 60 segundos antes/después (2 x 30seg)
   */
  static verifyCode(secret: string, code: string): boolean {
    // Limpiar el código (solo dígitos)
    const cleanCode = code.replace(/\D/g, '');

    if (cleanCode.length !== 6) {
      console.log(`❌ Código TOTP debe tener 6 dígitos, recibido: ${cleanCode.length}`);
      return false;
    }

    const result = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: cleanCode,
      window: 2, // 2 pasos antes/después = 60 segundos de tolerancia
    });

    // Debug: mostrar el código esperado actual (solo en desarrollo)
    if (process.env.NODE_ENV !== 'production' && !result) {
      const expected = speakeasy.totp({
        secret,
        encoding: 'base32',
      });
      console.log(`🔍 Debug TOTP: recibido=${cleanCode}, esperado=${expected}`);
    }

    return result;
  }

  /**
   * Generate backup codes (for when user loses access to authenticator)
   */
  static generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }

    return codes;
  }

  /**
   * Complete 2FA setup (secret + QR code)
   */
  static async setupTwoFactor(userEmail: string): Promise<TwoFactorSetup> {
    const { secret, otpauthUrl } = this.generateSecret(userEmail);
    const qrCodeUrl = await this.generateQRCode(otpauthUrl);

    return {
      secret,
      qrCodeUrl, // Data URL escaneable
      manualEntry: secret,
    };
  }
}
