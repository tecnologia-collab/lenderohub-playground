/// <reference path="../types/express.d.ts" />
import { Request, Response } from 'express';
import { UserModel } from '../models/user.model';
import { generate2FASecret, verify2FAToken, generateBackupCodes } from '../utils/twoFactor';
import { encrypt, decrypt } from '../utils/encryption';

/**
 * 🔐 Controlador de Autenticación de Dos Factores (2FA)
 */

/**
 * GET /api/auth/setup-2fa
 * Genera un nuevo secret de 2FA y QR code
 * Requiere autenticación JWT
 */
export async function setup2FA(req: Request, res: Response) {
  try {
    const userId = req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado'
      });
    }
    
    // Buscar usuario
    const user = await UserModel.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }
    
    // Si ya tiene 2FA habilitado, no permitir generar nuevo secret
    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        error: '2FA ya está configurado. Desactívalo primero si deseas reconfigurar.'
      });
    }
    
    // Generar nuevo secret
    const { base32, qr_code_url } = await generate2FASecret(
      user.email,
      'LenderoHUB'
    );
    
    // Encriptar secret antes de guardarlo
    const encryptedSecret = encrypt(base32);
    
    // Guardar secret TEMPORAL (no activar 2FA todavía)
    user.twoFactorSecret = encryptedSecret;
    await user.save();
    
    // Log de auditoría
    console.log(`[2FA] Setup iniciado para usuario ${user.email} (${userId})`);
    
    // Retornar QR code (NO retornar el secret en texto plano)
    return res.status(200).json({
      success: true,
      data: {
        qrCodeUrl: qr_code_url,
        // Secret solo para uso manual (por si no puede escanear)
        secret: base32 // SOLO en desarrollo, en producción omitir esto
      }
    });
    
  } catch (error: any) {
    console.error('[2FA] Error en setup:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al configurar 2FA'
    });
  }
}

/**
 * POST /api/auth/verify-setup-2fa
 * Verifica el código y activa 2FA permanentemente
 * Body: { code: string }
 */
export async function verifySetup2FA(req: Request, res: Response) {
  try {
    const userId = req.user?._id;
    const { code } = req.body;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado'
      });
    }
    
    // Validar código
    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        error: 'Código inválido. Debe ser de 6 dígitos.'
      });
    }
    
    // Buscar usuario (incluir twoFactorSecret)
    const user = await UserModel.findById(userId).select('+twoFactorSecret');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }
    
    // Verificar que tenga secret temporal
    if (!user.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        error: 'No hay configuración de 2FA pendiente. Inicia el proceso primero.'
      });
    }
    
    // Si ya está habilitado, no permitir reconfigurar
    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        error: '2FA ya está habilitado'
      });
    }
    
    // Desencriptar secret
    let secret: string;
    try {
      secret = decrypt(user.twoFactorSecret);
    } catch (error) {
      console.error('[2FA] Error al desencriptar secret:', error);
      return res.status(500).json({
        success: false,
        error: 'Error al verificar código'
      });
    }
    
    // Verificar código TOTP
    const isValid = verify2FAToken(secret, code, 2);
    
    if (!isValid) {
      // Log de intento fallido
      console.warn(`[2FA] Código inválido para usuario ${user.email} (${userId})`);
      
      return res.status(401).json({
        success: false,
        error: 'Código incorrecto. Asegúrate de usar el código actual de tu app.'
      });
    }
    
    // ✅ Código válido - Activar 2FA permanentemente
    
    // Generar códigos de respaldo
    const backupCodes = generateBackupCodes(10);
    
    // Guardar configuración
    user.twoFactorEnabled = true;
    user.twoFactorBackupCodes = backupCodes.map(code => encrypt(code));
    await user.save();
    
    // Log de auditoría
    console.log(`[2FA] Activado exitosamente para usuario ${user.email} (${userId})`);
    
    // Retornar éxito + backup codes
    return res.status(200).json({
      success: true,
      message: '2FA activado exitosamente',
      data: {
        twoFactorEnabled: true,
        backupCodes // IMPORTANTE: El usuario debe guardar estos códigos
      }
    });
    
  } catch (error: any) {
    console.error('[2FA] Error en verify-setup:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al verificar código 2FA'
    });
  }
}

/**
 * POST /api/auth/verify-2fa
 * Verifica código 2FA durante el login
 * Body: { code: string, tempToken: string }
 */
export async function verify2FALogin(req: Request, res: Response) {
  try {
    const { code, tempToken } = req.body;
    
    // Validar código
    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        error: 'Código inválido. Debe ser de 6 dígitos.'
      });
    }
    
    // Validar tempToken (JWT temporal que se genera en login)
    // TODO: Implementar validación de tempToken
    
    // Por ahora retornar error
    return res.status(501).json({
      success: false,
      error: 'Endpoint en construcción'
    });
    
  } catch (error: any) {
    console.error('[2FA] Error en verify-login:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al verificar código 2FA'
    });
  }
}

/**
 * POST /api/auth/disable-2fa
 * Desactiva 2FA (requiere confirmación con código)
 * Body: { code: string }
 */
export async function disable2FA(req: Request, res: Response) {
  try {
    const userId = req.user?._id;
    const { code } = req.body;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado'
      });
    }
    
    // Validar código
    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        error: 'Código inválido. Debe ser de 6 dígitos.'
      });
    }
    
    // Buscar usuario
    const user = await UserModel.findById(userId).select('+twoFactorSecret');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }
    
    // Verificar que tenga 2FA habilitado
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        error: '2FA no está habilitado'
      });
    }
    
    // Desencriptar secret
    let secret: string;
    try {
      secret = decrypt(user.twoFactorSecret);
    } catch (error) {
      console.error('[2FA] Error al desencriptar secret:', error);
      return res.status(500).json({
        success: false,
        error: 'Error al verificar código'
      });
    }
    
    // Verificar código
    const isValid = verify2FAToken(secret, code, 2);
    
    if (!isValid) {
      console.warn(`[2FA] Código inválido al desactivar para usuario ${user.email} (${userId})`);
      
      return res.status(401).json({
        success: false,
        error: 'Código incorrecto'
      });
    }
    
    // ✅ Código válido - Desactivar 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorBackupCodes = undefined;
    await user.save();
    
    // Log de auditoría
    console.log(`[2FA] Desactivado para usuario ${user.email} (${userId})`);
    
    return res.status(200).json({
      success: true,
      message: '2FA desactivado exitosamente'
    });
    
  } catch (error: any) {
    console.error('[2FA] Error en disable:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al desactivar 2FA'
    });
  }
}

/**
 * GET /api/auth/2fa-status
 * Retorna el estado de 2FA del usuario actual
 */
export async function get2FAStatus(req: Request, res: Response) {
  try {
    const userId = req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado'
      });
    }
    
    const user = await UserModel.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: {
        twoFactorEnabled: user.twoFactorEnabled,
        email: user.email
      }
    });
    
  } catch (error: any) {
    console.error('[2FA] Error en status:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener estado de 2FA'
    });
  }
}
