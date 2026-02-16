/**
 * Users Controller
 *
 * Handles HTTP requests for user management
 */

import { Request, Response, NextFunction } from 'express';
import { usersService, CreateUserDTO, UpdateUserDTO, UserFilters, AssignRoleDTO } from '../services/users';
import { getCreatableRolesForUser as getCreatableRolesForUserConfig } from '../config/permissions';
import { UserProfileType, UserModel } from '../models/user.model';
import { AuthRequest } from '../middlewares/auth.middleware';

const parseStringArray = (value?: string | string[]): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
};

const parseBoolean = (value?: string | boolean): boolean | undefined => {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

const parseNumber = (value?: string | number): number | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

// ============================================
// Get Users List
// ============================================
export const getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    const { profileType, isActive, search, page, limit } = req.query;

    const filters: UserFilters = {
      profileType: profileType as UserProfileType | undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search: search as string | undefined,
    };

    const pagination = {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    };

    const result = await usersService.getUsers(user._id.toString(), filters, pagination);

    res.status(200).json({
      success: true,
      data: result.users,
      meta: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
        limit: pagination.limit,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============================================
// Get Single User
// ============================================
export const getUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    const { id } = req.params;
    const result = await usersService.getUserById(user._id.toString(), id);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============================================
// Create User
// ============================================
export const createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    const {
      email,
      password,
      firstName,
      lastName,
      secondLastName,
      phone,
      profileType,
      clientId,
      readOnly,
      costCentreIds,
      costCentreId,
      virtualBagIds,
      commissionType,
      rfc,
      commissionTransferOutFee,
      transferInCommissionPercentage,
    } = req.body;

    // Validation
    if (!email || !firstName || !lastName || !profileType) {
      res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: email, firstName, lastName, profileType',
      });
      return;
    }

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;

    const data: CreateUserDTO = {
      email,
      password,
      firstName,
      lastName,
      secondLastName,
      phone,
      profileType,
      clientId,
      readOnly: parseBoolean(readOnly),
      costCentreIds: parseStringArray(costCentreIds),
      costCentreId,
      virtualBagIds: parseStringArray(virtualBagIds),
      commissionType,
      rfc,
      commissionTransferOutFee: parseNumber(commissionTransferOutFee),
      transferInCommissionPercentage: parseNumber(transferInCommissionPercentage),
      commissionDocumentFiles: files
        ? {
            identificationDocumentFile: files.identificationDocumentFile?.[0],
            financialStatementFile: files.financialStatementFile?.[0],
            proofOfAddressFile: files.proofOfAddressFile?.[0],
          }
        : undefined,
    };

    const result = await usersService.createUser(user._id.toString(), data);

    res.status(201).json({
      success: true,
      message: result.emailSent 
        ? 'Usuario creado exitosamente. Se ha enviado un correo para establecer la contraseña.'
        : 'Usuario creado exitosamente. No se pudo enviar el correo, contacta al administrador.',
      data: result.user,
      emailSent: result.emailSent,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============================================
// Find User by Email (Onboarding)
// ============================================
export const findUserByEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    const { email } = req.body;

    if (!email) {
      res.status(400).json({ success: false, message: 'Email requerido' });
      return;
    }

    const result = await usersService.findByEmail(user._id.toString(), email);

    if (!result) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============================================
// Assign Role to Existing User
// ============================================
export const assignRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    const { id } = req.params;
    const {
      profileType,
      reactivate,
      readOnly,
      costCentreIds,
      costCentreId,
      virtualBagIds,
      commissionType,
      rfc,
      commissionTransferOutFee,
      transferInCommissionPercentage,
    } = req.body;

    if (!profileType) {
      res.status(400).json({ success: false, message: 'profileType es requerido' });
      return;
    }

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;

    const payload: AssignRoleDTO = {
      profileType,
      reactivate: reactivate === true || reactivate === 'true',
      readOnly: parseBoolean(readOnly),
      costCentreIds: parseStringArray(costCentreIds),
      costCentreId,
      virtualBagIds: parseStringArray(virtualBagIds),
      commissionType,
      rfc,
      commissionTransferOutFee: parseNumber(commissionTransferOutFee),
      transferInCommissionPercentage: parseNumber(transferInCommissionPercentage),
      commissionDocumentFiles: files
        ? {
            identificationDocumentFile: files.identificationDocumentFile?.[0],
            financialStatementFile: files.financialStatementFile?.[0],
            proofOfAddressFile: files.proofOfAddressFile?.[0],
          }
        : undefined,
    };

    const result = await usersService.assignRole(
      user._id.toString(),
      id,
      payload
    );

    res.status(200).json({
      success: true,
      message: 'Rol actualizado',
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============================================
// Update User
// ============================================
const EDITABLE_FIELDS = ['firstName', 'lastName', 'secondLastName', 'phone'];
const PROTECTED_FIELDS = ['profileType', 'isActive', 'readOnly'];

export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    const { id } = req.params;
    const { firstName, lastName, secondLastName, phone, profileType, isActive, readOnly } = req.body;

    // CRIT-02: Non-corporate users cannot modify protected fields
    if (user.profileType !== 'corporate') {
      const attemptedProtected = PROTECTED_FIELDS.filter(f => req.body[f] !== undefined);
      if (attemptedProtected.length > 0) {
        res.status(403).json({ success: false, message: 'No tiene permisos para modificar estos campos' });
        return;
      }
    }

    const data: UpdateUserDTO = {};
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (secondLastName !== undefined) data.secondLastName = secondLastName;
    if (phone !== undefined) data.phone = phone;
    // Protected fields - only corporate users reach here if these are set
    if (profileType !== undefined) data.profileType = profileType;
    if (isActive !== undefined) data.isActive = isActive;
    if (readOnly !== undefined) data.readOnly = parseBoolean(readOnly);

    const result = await usersService.updateUser(user._id.toString(), id, data);

    res.status(200).json({
      success: true,
      message: 'Usuario actualizado',
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============================================
// Deactivate User
// ============================================
export const deactivateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    const { id } = req.params;
    const result = await usersService.deactivateUser(user._id.toString(), id);

    res.status(200).json({
      success: true,
      message: 'Usuario desactivado',
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============================================
// Reactivate User
// ============================================
export const reactivateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    const { id } = req.params;
    const result = await usersService.reactivateUser(user._id.toString(), id);

    res.status(200).json({
      success: true,
      message: 'Usuario reactivado',
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============================================
// Reset 2FA
// ============================================
export const reset2FA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    const { id } = req.params;
    const result = await usersService.reset2FA(user._id.toString(), id);

    res.status(200).json({
      success: true,
      message: '2FA reseteado. El usuario deberá configurarlo nuevamente.',
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============================================
// Reset Password
// ============================================
export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    const { id } = req.params;
    const result = await usersService.resetPassword(user._id.toString(), id);

    res.status(200).json({
      success: true,
      message: 'Contraseña reseteada',
      data: {
        tempPassword: result.tempPassword,
        warning: 'Proporciona esta contraseña temporal al usuario de forma segura. Deberá cambiarla en el primer inicio de sesión.',
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============================================
// Get User Stats
// ============================================
export const getUserStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    const result = await usersService.getUserStats(user._id.toString());

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============================================
// Update Current User Profile (PUT /me)
// ============================================
export const updateMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    const { firstName, lastName, secondLastName, phone } = req.body;

    const updates: Record<string, string> = {};
    if (firstName !== undefined) {
      const trimmed = String(firstName).trim();
      if (trimmed.length === 0) {
        res.status(400).json({ success: false, message: 'El nombre no puede estar vacío' });
        return;
      }
      updates.firstName = trimmed;
    }
    if (lastName !== undefined) {
      const trimmed = String(lastName).trim();
      if (trimmed.length === 0) {
        res.status(400).json({ success: false, message: 'El apellido paterno no puede estar vacío' });
        return;
      }
      updates.lastName = trimmed;
    }
    if (secondLastName !== undefined) {
      updates.secondLastName = String(secondLastName).trim();
    }
    if (phone !== undefined) {
      const trimmed = String(phone).trim();
      if (trimmed.length > 0 && !/^\+?[\d\s\-()]{7,20}$/.test(trimmed)) {
        res.status(400).json({ success: false, message: 'Formato de teléfono inválido' });
        return;
      }
      updates.phone = trimmed;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, message: 'No hay campos para actualizar' });
      return;
    }

    const user = await UserModel.findByIdAndUpdate(userId, updates, { new: true })
      .select('-passwordHash -refreshTokens -passwordResetToken -passwordResetExpires -twoFactorSecret -twoFactorBackupCodes');

    if (!user) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Perfil actualizado',
      data: user,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============================================
// Get Creatable Roles
// ============================================
export const getCreatableRolesForUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    console.log(`[getCreatableRolesForUser] user:`, user ? { email: user.email, profileType: user.profileType } : 'null');
    
    if (!user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    const roles = getCreatableRolesForUserConfig(user);
    console.log(`[getCreatableRolesForUser] roles para ${user.email}:`, roles);

    res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error: any) {
    console.error('[getCreatableRolesForUser] Error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============================================
// Get User Form Options
// ============================================
export const getUserFormOptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    console.log(`[getUserFormOptions] user:`, user ? { email: user.email, profileType: user.profileType, clientId: user.clientId } : 'null');
    
    if (!user) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    const { costCentreId } = req.query;
    const data = await usersService.getFormOptions(user._id.toString(), {
      costCentreId: costCentreId as string | undefined,
    });

    console.log(`[getUserFormOptions] Respuesta: ${data.costCentres.length} CECOs, ${data.virtualBags.length} bolsas virtuales`);
    
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('[getUserFormOptions] Error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};
