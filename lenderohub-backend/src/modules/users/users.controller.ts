import { Request, Response, NextFunction } from 'express';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode-svg';
import { UserModel } from '../../models/user.model';
import bcrypt from 'bcryptjs';

// ============================================
// Types
// ============================================
interface CreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  profileType: string;
  clientId?: string;
  businessUnitId?: string;
}

interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  profileType?: string;
  isActive?: boolean;
}

interface Enable2FARequest {
  code: string;
}

// ============================================
// User CRUD Controllers
// ============================================

/**
 * Get all users (with pagination and filters)
 * GET /api/users
 */
export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      profileType,
      isActive,
      search,
      clientId,
    } = req.query;

    // Build filter
    const filter: any = {};

    if (profileType) {
      filter.profileType = profileType;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    if (clientId) {
      filter.clientId = clientId;
    }

    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
      ];
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Query
    const [users, total] = await Promise.all([
      UserModel.find(filter)
        .select('-passwordHash -twoFactorSecret -refreshTokens')
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 })
        .exec(),
      UserModel.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single user by ID
 * GET /api/users/:id
 */
export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await UserModel.findById(id)
      .select('-passwordHash -twoFactorSecret -refreshTokens')
      .exec();

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new user
 * POST /api/users
 */
export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      profileType,
      clientId,
      businessUnitId,
    } = req.body as CreateUserRequest;

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !profileType) {
      res.status(400).json({
        success: false,
        message: 'Todos los campos requeridos deben ser proporcionados',
      });
      return;
    }

    // Check if email already exists
    const existingUser = await UserModel.findOne({ email: email.toLowerCase() }).exec();

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'El correo electrónico ya está registrado',
      });
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 8 caracteres',
      });
      return;
    }

    // Create user
    const user = new UserModel({
      email: email.toLowerCase(),
      passwordHash: password, // Will be hashed by pre-save hook
      firstName,
      lastName,
      phone,
      profileType,
      clientId,
      businessUnitId,
      createdBy: (req as any).user?._id,
    });

    await user.save();

    // Return user without sensitive data
    const userResponse = user.toJSON();

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: userResponse,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user
 * PUT /api/users/:id
 */
export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body as UpdateUserRequest;

    // Find user
    const user = await UserModel.findById(id).exec();

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
      return;
    }

    // Update allowed fields
    if (updates.firstName) user.firstName = updates.firstName;
    if (updates.lastName) user.lastName = updates.lastName;
    if (updates.phone !== undefined) user.phone = updates.phone;
    if (updates.profileType) user.profileType = updates.profileType as any;
    if (updates.isActive !== undefined) user.isActive = updates.isActive;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user (soft delete)
 * DELETE /api/users/:id
 */
export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await UserModel.findById(id).exec();

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
      return;
    }

    // Soft delete - just deactivate
    user.isActive = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Usuario desactivado exitosamente',
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// 2FA Setup Controllers
// ============================================

/**
 * Generate 2FA secret and QR code
 * POST /api/users/2fa/setup
 */
export const setup2FA = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = (req as any).user;

    if (!currentUser) {
      res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
      return;
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `LenderoHUB (${currentUser.email})`,
      issuer: 'LenderoHUB',
      length: 32,
    });

    // Save tentative secret (not enabled yet)
    currentUser.twoFactorSecret = secret.base32;
    await currentUser.save();

    // Generate QR code SVG
    const qrCode = new QRCode({
      content: secret.otpauth_url || '',
      padding: 0,
      width: 256,
      height: 256,
      color: '#000000',
      background: '#ffffff',
      ecl: 'M',
    });

    res.status(200).json({
      success: true,
      message: '2FA configurado. Escanea el código QR con tu aplicación.',
      data: {
        secret: secret.base32,
        qrCode: qrCode.svg(),
        manualEntry: secret.base32,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Enable 2FA (verify code and activate)
 * POST /api/users/2fa/enable
 */
export const enable2FA = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    const { code } = req.body as Enable2FARequest;

    if (!currentUser) {
      res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
      return;
    }

    if (!currentUser.twoFactorSecret) {
      res.status(400).json({
        success: false,
        message: 'Debes configurar 2FA primero',
      });
      return;
    }

    // Verify the code
    const verified = speakeasy.totp.verify({
      secret: currentUser.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!verified) {
      res.status(400).json({
        success: false,
        message: 'Código inválido',
      });
      return;
    }

    // Enable 2FA
    currentUser.twoFactorEnabled = true;

    // Generate backup codes (10 codes)
    const backupCodes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      const hashedCode = await bcrypt.hash(code, 10);
      backupCodes.push(code);
      currentUser.twoFactorBackupCodes = currentUser.twoFactorBackupCodes || [];
      currentUser.twoFactorBackupCodes.push(hashedCode);
    }

    await currentUser.save();

    res.status(200).json({
      success: true,
      message: '2FA habilitado exitosamente',
      data: {
        backupCodes,
        warning: 'Guarda estos códigos de respaldo en un lugar seguro. No podrás verlos de nuevo.',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Disable 2FA
 * POST /api/users/2fa/disable
 */
export const disable2FA = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    const { code } = req.body;

    if (!currentUser) {
      res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
      return;
    }

    if (!currentUser.twoFactorEnabled) {
      res.status(400).json({
        success: false,
        message: '2FA no está habilitado',
      });
      return;
    }

    // Verify current code before disabling
    const verified = speakeasy.totp.verify({
      secret: currentUser.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!verified) {
      res.status(400).json({
        success: false,
        message: 'Código inválido',
      });
      return;
    }

    // Disable 2FA
    currentUser.twoFactorEnabled = false;
    currentUser.twoFactorSecret = undefined;
    currentUser.twoFactorBackupCodes = undefined;
    await currentUser.save();

    res.status(200).json({
      success: true,
      message: '2FA deshabilitado exitosamente',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change password
 * POST /api/users/change-password
 */
export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    const { currentPassword, newPassword } = req.body;

    if (!currentUser) {
      res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
      return;
    }

    // Get user with password
    const user = await UserModel.findById(currentUser._id).select('+passwordHash').exec();

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
      return;
    }

    // Verify current password
    const isValid = await user.comparePassword(currentPassword);

    if (!isValid) {
      res.status(401).json({
        success: false,
        message: 'Contraseña actual incorrecta',
      });
      return;
    }

    // Validate new password
    if (newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 8 caracteres',
      });
      return;
    }

    // Update password
    user.passwordHash = newPassword; // Will be hashed by pre-save hook
    await user.save();

    // Clear all refresh tokens (force re-login on all devices)
    await user.clearRefreshTokens();

    res.status(200).json({
      success: true,
      message: 'Contraseña actualizada exitosamente',
    });
  } catch (error) {
    next(error);
  }
};
