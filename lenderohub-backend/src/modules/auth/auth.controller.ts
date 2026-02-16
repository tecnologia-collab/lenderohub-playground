import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../../models/user.model';
import { UserProfile } from '../../models/userProfiles.model';
import { PasswordSetupToken, generateSetupToken, getSetupTokenExpiration } from '../../models/passwordSetupTokens.model';
import { JWTService } from '../../services/auth/jwt.service';
import { TwoFactorService } from '../../services/auth/twoFactor.service';
import { encrypt, decrypt } from '../../utils/encryption';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Permissions } from '../../config/permissions';
import { emailService } from '../../services/email';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { auditService, AuditAction } from '../../services/audit';

// ============================================
// Profile Helpers
// ============================================
const fetchActiveProfiles = async (userId: string) => {
  const userProfiles = await UserProfile.find({
    user: userId,
    isActive: true,
  }).lean();

  return userProfiles.map((p) => ({
    id: p._id.toString(),
    type: p.type,
  }));
};

// ============================================
// 2FA Secret Helpers (compatibilidad)
// ============================================
const isEncrypted2FASecret = (value: string): boolean => {
  const parts = value.split(':');
  if (parts.length !== 3) return false;

  const [iv, authTag, encrypted] = parts;
  const hexRegex = /^[0-9a-fA-F]+$/;

  return (
    iv.length === 32 &&
    authTag.length === 32 &&
    iv.match(hexRegex) !== null &&
    authTag.match(hexRegex) !== null &&
    encrypted.length > 0 &&
    encrypted.match(hexRegex) !== null
  );
};

const get2FASecretForVerification = (storedSecret: string): string => {
  if (isEncrypted2FASecret(storedSecret)) {
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY no está configurada');
    }
    return decrypt(storedSecret);
  }

  return storedSecret;
};

const store2FASecret = (secret: string): string => {
  if (!process.env.ENCRYPTION_KEY) {
    return secret;
  }

  try {
    return encrypt(secret);
  } catch (error) {
    console.warn('⚠️ No se pudo encriptar secret 2FA, guardando en texto plano');
    return secret;
  }
};

// ============================================
// Password Strength Validation (HIGH-03)
// ============================================
const validatePasswordStrength = (password: string): { valid: boolean; message: string } => {
  if (password.length < 8) {
    return { valid: false, message: 'La contraseña debe tener al menos 8 caracteres' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'La contraseña debe contener al menos una letra mayúscula' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'La contraseña debe contener al menos una letra minúscula' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'La contraseña debe contener al menos un número' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:',.<>?\/]/.test(password)) {
    return { valid: false, message: 'La contraseña debe contener al menos un carácter especial (!@#$%^&*()_+-=[]{}|;:\',.<>?/)' };
  }
  return { valid: true, message: '' };
};

// ============================================
// Login Controller
// ============================================
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    // MED-01: Validate input types to prevent MongoDB operator injection
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ success: false, message: 'Formato de datos inválido' });
      return;
    }

    // Validate input
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email y contraseña son requeridos' });
      return;
    }

    // Find user
    const user = await UserModel.findOne({ email: email.toLowerCase() })
      .select('+passwordHash +twoFactorSecret')
      .exec();

    if (!user) {
      res.status(401).json({ success: false, message: 'Credenciales inválidas' });
      return;
    }

    // Check if active
    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'Usuario inactivo' });
      return;
    }

    // Check if locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      res.status(423).json({ success: false, message: `Cuenta bloqueada. Intenta en ${minutes} minutos.` });
      return;
    }

    // Verify password
    const isValid = await user.comparePassword(password);

    if (!isValid) {
      user.failedLoginAttempts += 1;

      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
        await user.save();

        // Audit failed login (account locked)
        auditService.log({
          action: AuditAction.LoginFailed,
          userId: user._id.toString(),
          userEmail: user.email,
          details: { reason: 'account_locked', attempts: user.failedLoginAttempts },
          req
        });

        res.status(423).json({ success: false, message: 'Cuenta bloqueada por múltiples intentos. Intenta en 30 minutos.' });
        return;
      }

      await user.save();

      // Audit failed login
      auditService.log({
        action: AuditAction.LoginFailed,
        userId: user._id.toString(),
        userEmail: user.email,
        details: { reason: 'invalid_password', attempts: user.failedLoginAttempts },
        req
      });

      res.status(401).json({ success: false, message: 'Credenciales inválidas' });
      return;
    }

    // Reset failed attempts
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;

    // Check 2FA
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const tempToken = JWTService.generateTempToken(user._id.toString());
      await user.save();

      res.status(200).json({
        success: true,
        requires2FA: true,
        tempToken,
        message: 'Ingresa el código de tu aplicación de autenticación',
      });
      return;
    }

    // No 2FA - generate tokens
    const payload = {
      userId: user._id.toString(),
      email: user.email,
      profileType: user.profileType,
      tokenVersion: user.tokenVersion || 0,
    };

    const accessToken = JWTService.generateAccessToken(payload);
    const refreshToken = JWTService.generateRefreshToken(payload);

    // Save refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.addRefreshToken(refreshToken, expiresAt);

    // Update last login
    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip || req.socket.remoteAddress || '';
    await user.save();

    // Fetch all active profiles for multi-profile selection
    const profiles = await fetchActiveProfiles(user._id.toString());

    // Audit successful login
    auditService.log({
      action: AuditAction.Login,
      userId: user._id.toString(),
      userEmail: user.email,
      details: { method: 'password', has2FA: false },
      req
    });

    res.status(200).json({
      success: true,
      requires2FA: false,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        secondLastName: user.secondLastName,
        fullName: user.fullName,
        profileType: user.profileType,
        twoFactorEnabled: user.twoFactorEnabled || false,
        readOnly: user.readOnly || false,
        permissions: Permissions.getForUser(user),
      },
      profiles,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Verify 2FA Controller (Login flow)
// ============================================
export const verify2FA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { tempToken, code } = req.body;

    if (!tempToken || !code) {
      res.status(400).json({ success: false, message: 'Token y código requeridos' });
      return;
    }

    // Verify temp token
    let decoded;
    try {
      decoded = JWTService.verifyTempToken(tempToken);
    } catch (error) {
      res.status(401).json({ success: false, message: 'Token temporal inválido o expirado. Inicia sesión de nuevo.' });
      return;
    }

    // Find user
    const user = await UserModel.findById(decoded.userId).select('+twoFactorSecret').exec();

    if (!user || !user.twoFactorSecret) {
      res.status(401).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }

    // Verify code
    let secretToVerify: string;
    try {
      secretToVerify = get2FASecretForVerification(user.twoFactorSecret);
    } catch (error) {
      console.error('Error al preparar secret 2FA:', error);
      res.status(500).json({ success: false, message: 'Error al verificar 2FA' });
      return;
    }

    const isValid = TwoFactorService.verifyCode(secretToVerify, code);

    if (!isValid) {
      // Usar 400 en lugar de 401 para que el frontend no haga redirect automático
      res.status(400).json({ success: false, message: 'Código inválido. Verifica el código en tu app de autenticación.' });
      return;
    }

    // Generate tokens
    const payload = {
      userId: user._id.toString(),
      email: user.email,
      profileType: user.profileType,
      tokenVersion: user.tokenVersion || 0,
    };

    const accessToken = JWTService.generateAccessToken(payload);
    const refreshToken = JWTService.generateRefreshToken(payload);

    // Save refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.addRefreshToken(refreshToken, expiresAt);

    // Update last login
    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip || req.socket.remoteAddress || '';
    await user.save();

    // Fetch all active profiles for multi-profile selection
    const profiles = await fetchActiveProfiles(user._id.toString());

    // Audit successful login with 2FA
    auditService.log({
      action: AuditAction.Login,
      userId: user._id.toString(),
      userEmail: user.email,
      details: { method: 'password', has2FA: true },
      req
    });

    res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        secondLastName: user.secondLastName,
        fullName: user.fullName,
        profileType: user.profileType,
        twoFactorEnabled: user.twoFactorEnabled,
        readOnly: user.readOnly || false,
        permissions: Permissions.getForUser(user),
      },
      profiles,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Setup 2FA Controller
// ============================================
export const setup2FA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    const { force } = req.query; // ?force=true para re-setup

    if (!user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    // Si ya tiene 2FA habilitado y no es force, no regenerar
    if (user.twoFactorEnabled && user.twoFactorSecret && force !== 'true') {
      res.status(200).json({
        success: true,
        message: '2FA ya está configurado',
        data: {
          alreadyEnabled: true,
          twoFactorEnabled: true,
        },
      });
      return;
    }

    // Generate 2FA secret (ahora es async)
    const setup = await TwoFactorService.setupTwoFactor(user.email);

    // Save secret (not enabled yet if force, or first time)
    user.twoFactorSecret = store2FASecret(setup.secret);

    // Si es force reset, deshabilitar 2FA hasta que verifique el nuevo código
    if (force === 'true') {
      user.twoFactorEnabled = false;
      user.twoFactorBackupCodes = [];
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Escanea el código QR con tu aplicación',
      data: setup,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Enable 2FA Controller
// ============================================
export const enable2FA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    const { code } = req.body;

    if (!user || !user.twoFactorSecret) {
      res.status(400).json({ success: false, message: 'Configura 2FA primero' });
      return;
    }

    // Verify code
    let secretToVerify: string;
    try {
      secretToVerify = get2FASecretForVerification(user.twoFactorSecret);
    } catch (error) {
      console.error('Error al preparar secret 2FA:', error);
      res.status(500).json({ success: false, message: 'Error al verificar 2FA' });
      return;
    }

    const isValid = TwoFactorService.verifyCode(secretToVerify, code);

    if (!isValid) {
      res.status(400).json({ success: false, message: 'Código inválido' });
      return;
    }

    // Enable 2FA
    user.twoFactorEnabled = true;

    // Generate backup codes
    const backupCodes = TwoFactorService.generateBackupCodes(10);

    // Reset backup codes array
    user.twoFactorBackupCodes = [];

    for (const backupCode of backupCodes) {
      const hashed = await bcrypt.hash(backupCode, 10);
      user.twoFactorBackupCodes.push(hashed);
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: '2FA habilitado exitosamente',
      data: {
        backupCodes,
        warning: 'Guarda estos códigos. No los verás de nuevo.',
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Get Current User
// ============================================
export const getCurrentUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    // Fetch all active profiles
    const profiles = await fetchActiveProfiles(user._id.toString());

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        secondLastName: user.secondLastName,
        fullName: user.fullName,
        profileType: user.profileType,
        twoFactorEnabled: user.twoFactorEnabled,
        lastLoginAt: user.lastLoginAt,
        readOnly: user.readOnly || false,
        permissions: Permissions.getForUser(user),
      },
      profiles,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Logout
// ============================================
export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      try {
        const decoded = JWTService.verifyRefreshToken(refreshToken);
        const user = await UserModel.findById(decoded.userId).exec();
        if (user) {
          await user.removeRefreshToken(refreshToken);
        }
      } catch (error) {
        // Token inválido, continuar
      }
    }

    res.status(200).json({ success: true, message: 'Sesión cerrada' });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Get 2FA Status
// ============================================
export const get2FAStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        twoFactorEnabled: user.twoFactorEnabled || false,
        hasSecret: !!user.twoFactorSecret,
        hasBackupCodes: (user.twoFactorBackupCodes?.length || 0) > 0,
        backupCodesCount: user.twoFactorBackupCodes?.length || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Disable 2FA
// ============================================
export const disable2FA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    const { password, code } = req.body;

    if (!user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    // Cargar usuario con passwordHash para verificar contraseña
    const fullUser = await UserModel.findById(user._id)
      .select('+passwordHash +twoFactorSecret')
      .exec();

    if (!fullUser) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }

    // Verificar contraseña (requerida para deshabilitar 2FA)
    if (!password) {
      res.status(400).json({ success: false, message: 'Contraseña requerida para deshabilitar 2FA' });
      return;
    }

    const isPasswordValid = await fullUser.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
      return;
    }

    // HIGH-02: SIEMPRE verificar código TOTP si 2FA está habilitado
    if (fullUser.twoFactorEnabled && fullUser.twoFactorSecret) {
      if (!code) {
        res.status(400).json({ success: false, message: 'Código 2FA requerido para deshabilitar 2FA' });
        return;
      }

      let secretToVerify: string;
      try {
        secretToVerify = get2FASecretForVerification(fullUser.twoFactorSecret);
      } catch (error) {
        console.error('Error al preparar secret 2FA:', error);
        res.status(500).json({ success: false, message: 'Error al verificar 2FA' });
        return;
      }

      const isValid = TwoFactorService.verifyCode(secretToVerify, code);
      if (!isValid) {
        res.status(400).json({ success: false, message: 'Código 2FA inválido' });
        return;
      }
    }

    // Deshabilitar 2FA
    fullUser.twoFactorEnabled = false;
    fullUser.twoFactorSecret = undefined;
    fullUser.twoFactorBackupCodes = [];
    await fullUser.save();

    res.status(200).json({
      success: true,
      message: '2FA deshabilitado exitosamente',
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Reset 2FA (Force re-setup)
// ============================================
export const reset2FA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    const { password } = req.body;

    if (!user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    // Cargar usuario con passwordHash
    const fullUser = await UserModel.findById(user._id)
      .select('+passwordHash +twoFactorSecret')
      .exec();

    if (!fullUser) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }

    // Verificar contraseña
    if (!password) {
      res.status(400).json({ success: false, message: 'Contraseña requerida' });
      return;
    }

    const isPasswordValid = await fullUser.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
      return;
    }

    // Generar nuevo secret
    const setup = await TwoFactorService.setupTwoFactor(fullUser.email);

    // Actualizar usuario
    fullUser.twoFactorSecret = store2FASecret(setup.secret);
    fullUser.twoFactorEnabled = false;
    fullUser.twoFactorBackupCodes = [];
    await fullUser.save();

    res.status(200).json({
      success: true,
      message: 'Escanea el nuevo código QR con tu aplicación',
      data: setup,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Forgot Password (Request Reset)
// ============================================
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ success: false, message: 'Email es requerido' });
      return;
    }

    // Buscar usuario
    const user = await UserModel.findOne({ email: email.toLowerCase() }).exec();

    // IMPORTANTE: Siempre responder éxito para no revelar si el email existe
    if (!user) {
      res.status(200).json({
        success: true,
        message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña.',
      });
      return;
    }

    // Verificar si el usuario está activo
    if (!user.isActive) {
      res.status(200).json({
        success: true,
        message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña.',
      });
      return;
    }

    // Generar token de recuperación
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Guardar token hasheado y expiración (1 hora)
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    // Enviar email
    const userName = user.firstName || 'Usuario';
    await emailService.sendPasswordResetEmail(user.email, resetToken, userName);

    res.status(200).json({
      success: true,
      message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña.',
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Reset Password (With Token)
// ============================================
export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      res.status(400).json({ success: false, message: 'Token y contraseña son requeridos' });
      return;
    }

    // HIGH-03: Validate password strength
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      res.status(400).json({ success: false, message: passwordCheck.message });
      return;
    }

    // Hash del token para comparar con el almacenado
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Buscar usuario con token válido y no expirado
    const user = await UserModel.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken').exec();

    if (!user) {
      res.status(400).json({
        success: false,
        message: 'El enlace de recuperación es inválido o ha expirado. Solicita uno nuevo.',
      });
      return;
    }

    // Actualizar contraseña
    user.passwordHash = password; // El middleware pre-save hace el hash
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;

    // CRIT-03: Increment tokenVersion to invalidate existing sessions
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    // Invalidar todos los refresh tokens por seguridad
    user.refreshTokens = [];

    await user.save();

    // Audit password reset
    auditService.log({
      action: AuditAction.PasswordReset,
      userId: user._id.toString(),
      userEmail: user.email,
      details: { method: 'token_reset' },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.',
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Verify Reset Token (Check if valid)
// ============================================
export const verifyResetToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ success: false, valid: false, message: 'Token es requerido' });
      return;
    }

    // Hash del token para comparar
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Buscar usuario con token válido
    const user = await UserModel.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).exec();

    if (!user) {
      res.status(200).json({
        success: true,
        valid: false,
        message: 'El enlace de recuperación es inválido o ha expirado.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      valid: true,
      email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Ofuscar email
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Validate Setup Token (Para usuarios nuevos)
// ============================================
export const validateSetupToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ 
        success: false, 
        valid: false, 
        message: 'Token es requerido' 
      });
      return;
    }

    // Buscar token
    const setupToken = await PasswordSetupToken.findOne({ token }).populate('user', 'email firstName lastName').exec();

    if (!setupToken) {
      res.status(200).json({
        success: true,
        valid: false,
        message: 'El enlace es inválido o ha expirado.',
      });
      return;
    }

    // Verificar si es válido (no expirado y no usado)
    if (!setupToken.isValid()) {
      const reason = setupToken.usedAt ? 'ya fue utilizado' : 'ha expirado';
      res.status(200).json({
        success: true,
        valid: false,
        message: `El enlace ${reason}. Contacta al administrador para obtener uno nuevo.`,
      });
      return;
    }

    const user = setupToken.user as any;

    res.status(200).json({
      success: true,
      valid: true,
      email: user?.email,
      userName: [user?.firstName, user?.lastName].filter(Boolean).join(' '),
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Setup Password (Establecer contraseña con token)
// ============================================
export const setupPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, password, confirmPassword } = req.body;

    // Validaciones básicas
    if (!token) {
      res.status(400).json({ success: false, message: 'Token es requerido' });
      return;
    }

    if (!password) {
      res.status(400).json({ success: false, message: 'Contraseña es requerida' });
      return;
    }

    // HIGH-03: Validate password strength
    const setupPasswordCheck = validatePasswordStrength(password);
    if (!setupPasswordCheck.valid) {
      res.status(400).json({ success: false, message: setupPasswordCheck.message });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ success: false, message: 'Las contraseñas no coinciden' });
      return;
    }

    // Buscar token
    const setupToken = await PasswordSetupToken.findOne({ token }).exec();

    if (!setupToken) {
      res.status(400).json({
        success: false,
        message: 'El enlace es inválido o ha expirado.',
      });
      return;
    }

    // Verificar si es válido
    if (!setupToken.isValid()) {
      const reason = setupToken.usedAt ? 'ya fue utilizado' : 'ha expirado';
      res.status(400).json({
        success: false,
        message: `El enlace ${reason}. Contacta al administrador para obtener uno nuevo.`,
      });
      return;
    }

    // Buscar usuario
    const user = await UserModel.findById(setupToken.user).exec();

    if (!user) {
      res.status(400).json({
        success: false,
        message: 'Usuario no encontrado.',
      });
      return;
    }

    // Verificar que usuario esté activo
    if (!user.isActive) {
      res.status(400).json({
        success: false,
        message: 'La cuenta está desactivada. Contacta al administrador.',
      });
      return;
    }

    // Actualizar contraseña
    user.passwordHash = password; // El middleware pre-save hace el hash
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    await user.save();

    // Marcar token como usado
    await setupToken.markAsUsed();

    res.status(200).json({
      success: true,
      message: 'Contraseña establecida exitosamente. Ya puedes iniciar sesión.',
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Change Password (Usuario autenticado)
// ============================================
export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    // Validaciones
    if (!currentPassword) {
      res.status(400).json({ success: false, message: 'La contraseña actual es requerida' });
      return;
    }

    if (!newPassword) {
      res.status(400).json({ success: false, message: 'La nueva contraseña es requerida' });
      return;
    }

    // HIGH-03: Validate password strength
    const changePasswordCheck = validatePasswordStrength(newPassword);
    if (!changePasswordCheck.valid) {
      res.status(400).json({ success: false, message: changePasswordCheck.message });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({ success: false, message: 'Las contraseñas no coinciden' });
      return;
    }

    if (currentPassword === newPassword) {
      res.status(400).json({ success: false, message: 'La nueva contraseña debe ser diferente a la actual' });
      return;
    }

    // Cargar usuario con passwordHash
    const fullUser = await UserModel.findById(user._id)
      .select('+passwordHash')
      .exec();

    if (!fullUser) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }

    // Verificar contraseña actual
    const isPasswordValid = await fullUser.comparePassword(currentPassword);
    if (!isPasswordValid) {
      res.status(401).json({ success: false, message: 'La contraseña actual es incorrecta' });
      return;
    }

    // Actualizar contraseña
    fullUser.passwordHash = newPassword; // El middleware pre-save hace el hash
    // CRIT-03: Increment tokenVersion to invalidate existing sessions
    fullUser.tokenVersion = (fullUser.tokenVersion || 0) + 1;
    await fullUser.save();

    // Audit password change
    auditService.log({
      action: AuditAction.PasswordChanged,
      userId: fullUser._id.toString(),
      userEmail: fullUser.email,
      details: { method: 'user_initiated' },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Contraseña actualizada exitosamente',
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Switch Profile (Multi-profile selection)
// ============================================
export const switchProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { profileId } = req.body;
    if (!profileId) {
      res.status(400).json({ success: false, message: 'profileId es requerido' });
      return;
    }

    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    // Verify the profile belongs to this user and is active
    const profile = await UserProfile.findOne({
      _id: profileId,
      user: userId,
      isActive: true,
    });

    if (!profile) {
      res.status(404).json({ success: false, message: 'Perfil no encontrado' });
      return;
    }

    // Update user's profileType to match the selected profile
    const user = req.user;
    user.profileType = profile.type;
    await user.save();

    // Generate new tokens with updated profileType
    const payload = {
      userId: user._id.toString(),
      email: user.email,
      profileType: profile.type,
      tokenVersion: user.tokenVersion || 0,
    };

    const accessToken = JWTService.generateAccessToken(payload);
    const refreshToken = JWTService.generateRefreshToken(payload);

    // Save refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.addRefreshToken(refreshToken, expiresAt);

    // Fetch all active profiles
    const profiles = await fetchActiveProfiles(user._id.toString());

    // Audit profile switch
    auditService.log({
      action: AuditAction.ProfileSwitched,
      userId: user._id.toString(),
      userEmail: user.email,
      targetId: profile._id.toString(),
      targetType: 'UserProfile',
      details: { profileType: profile.type },
      req
    });

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        secondLastName: user.secondLastName,
        fullName: user.fullName,
        profileType: profile.type,
        twoFactorEnabled: user.twoFactorEnabled || false,
        readOnly: user.readOnly || false,
        permissions: Permissions.getForUser(user),
      },
      activeProfile: {
        id: profile._id.toString(),
        type: profile.type,
      },
      profiles,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Resend Setup Email (Re-enviar correo de setup)
// ============================================
export const resendSetupEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.body;
    const requester = (req as any).user;

    if (!requester) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    if (!userId) {
      res.status(400).json({ success: false, message: 'ID de usuario es requerido' });
      return;
    }

    // Buscar usuario
    const user = await UserModel.findById(userId).exec();

    if (!user) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }

    // Verificar que el usuario requester tenga permisos (mismo clientId)
    if (requester.clientId && user.clientId && 
        requester.clientId.toString() !== user.clientId.toString()) {
      res.status(403).json({ success: false, message: 'No tienes permiso para esta acción' });
      return;
    }

    // Invalidar tokens anteriores
    await PasswordSetupToken.updateMany(
      { user: user._id, usedAt: null },
      { usedAt: new Date() }
    );

    // Generar nuevo token
    const newToken = generateSetupToken();
    await PasswordSetupToken.create({
      user: user._id,
      token: newToken,
      expiresAt: getSetupTokenExpiration(),
    });

    // Enviar email
    const userName = [user.firstName, user.lastName].filter(Boolean).join(' ');
    const emailSent = await emailService.sendPasswordSetupEmail(
      user.email,
      newToken,
      userName
    );

    if (!emailSent) {
      res.status(500).json({
        success: false,
        message: 'No se pudo enviar el correo. Intenta de nuevo.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Se ha enviado un nuevo correo para establecer la contraseña.',
    });
  } catch (error) {
    next(error);
  }
};
