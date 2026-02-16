import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

/**
 * 🔐 Módulo de Autenticación de Dos Factores (2FA)
 * Usando TOTP (Time-based One-Time Password)
 */

export interface TwoFactorSecret {
  base32: string;      // Secret en formato Base32
  otpauth_url: string; // URL para generar QR code
  qr_code_url: string; // Data URL del QR code (imagen)
}

/**
 * Genera un nuevo secret de 2FA y su QR code
 * @param userEmail - Email del usuario
 * @param issuer - Nombre de la aplicación (default: LenderoHUB)
 * @returns Secret y QR code
 */
export async function generate2FASecret(
  userEmail: string,
  issuer: string = 'LenderoHUB'
): Promise<TwoFactorSecret> {
  try {
    // Generar secret con speakeasy
    const secret = speakeasy.generateSecret({
      name: `${issuer} (${userEmail})`,
      issuer: issuer,
      length: 32
    });
    
    if (!secret.otpauth_url) {
      throw new Error('No se pudo generar otpauth_url');
    }
    
    // Generar QR code como data URL
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    
    return {
      base32: secret.base32,
      otpauth_url: secret.otpauth_url,
      qr_code_url: qrCodeUrl
    };
  } catch (error: any) {
    console.error('Error generando 2FA secret:', error.message);
    throw new Error('Error al generar código 2FA');
  }
}

/**
 * Verifica un código TOTP
 * @param secret - Secret en formato Base32
 * @param token - Código de 6 dígitos ingresado por el usuario
 * @param window - Ventana de tiempo (default: 2 = ±60 segundos)
 * @returns true si el código es válido
 */
export function verify2FAToken(
  secret: string,
  token: string,
  window: number = 2
): boolean {
  try {
    // Validar formato del token
    if (!/^\d{6}$/.test(token)) {
      return false;
    }
    
    // Verificar con speakeasy
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: window
    });
    
    return verified;
  } catch (error: any) {
    console.error('Error verificando 2FA token:', error.message);
    return false;
  }
}

/**
 * Genera un código TOTP (útil para testing)
 * @param secret - Secret en formato Base32
 * @returns Código TOTP de 6 dígitos
 */
export function generate2FAToken(secret: string): string {
  try {
    return speakeasy.totp({
      secret: secret,
      encoding: 'base32'
    });
  } catch (error: any) {
    console.error('Error generando 2FA token:', error.message);
    throw new Error('Error al generar token 2FA');
  }
}

/**
 * Genera códigos de respaldo (backup codes)
 * Útiles si el usuario pierde acceso a su dispositivo de autenticación
 * @param count - Cantidad de códigos a generar (default: 10)
 * @returns Array de códigos de respaldo
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    // Generar código de 8 caracteres alfanuméricos
    const code = Array.from({ length: 8 }, () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin O, 0, I, 1, L
      return chars[Math.floor(Math.random() * chars.length)];
    }).join('');
    
    // Formatear: XXXX-XXXX
    const formatted = `${code.slice(0, 4)}-${code.slice(4)}`;
    codes.push(formatted);
  }
  
  return codes;
}

// Testing
if (require.main === module) {
  (async () => {
    console.log('🔐 Testing 2FA Module\n');
    
    // 1. Generar secret
    console.log('1. Generando 2FA secret...');
    const email = 'test@lenderocapital.com';
    const { base32, otpauth_url, qr_code_url } = await generate2FASecret(email);
    
    console.log(`   Email: ${email}`);
    console.log(`   Secret: ${base32}`);
    console.log(`   OTPAuth URL: ${otpauth_url}`);
    console.log(`   QR Code: ${qr_code_url.substring(0, 50)}...\n`);
    
    // 2. Generar token
    console.log('2. Generando token actual...');
    const currentToken = generate2FAToken(base32);
    console.log(`   Token: ${currentToken}\n`);
    
    // 3. Verificar token
    console.log('3. Verificando token...');
    const isValid = verify2FAToken(base32, currentToken);
    console.log(`   ¿Válido? ${isValid ? '✅ Sí' : '❌ No'}\n`);
    
    // 4. Verificar token inválido
    console.log('4. Verificando token inválido...');
    const isInvalid = verify2FAToken(base32, '000000');
    console.log(`   ¿Válido? ${isInvalid ? '❌ Sí (ERROR!)' : '✅ No (correcto)'}\n`);
    
    // 5. Generar backup codes
    console.log('5. Generando backup codes...');
    const backupCodes = generateBackupCodes(10);
    console.log(`   Códigos generados: ${backupCodes.length}`);
    backupCodes.forEach((code, i) => {
      console.log(`   ${i + 1}. ${code}`);
    });
    
    console.log('\n✅ Testing completado\n');
  })();
}
