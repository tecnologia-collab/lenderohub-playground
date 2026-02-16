import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/user.model';
import { JWTService } from '../services/auth/jwt.service';

// ============================================
// Types
// ============================================
export interface AuthRequest extends Request {
  user?: any;
}

// ============================================
// Authenticate Token Middleware
// ============================================
export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Token de autenticación requerido',
      });
      return;
    }

    const token = authHeader.substring(7);

    // Verify token
    let decoded;
    try {
      decoded = JWTService.verifyAccessToken(token);
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message || 'Token inválido',
      });
      return;
    }

    // Get user (incluir twoFactorSecret para 2FA setup)
    const user = await UserModel.findById(decoded.userId)
      .select('+twoFactorSecret')
      .exec();

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Usuario no encontrado',
      });
      return;
    }

    // CRIT-03: Validate tokenVersion matches
    if (
      decoded.tokenVersion === undefined && (user.tokenVersion || 0) > 0 ||
      decoded.tokenVersion !== undefined && decoded.tokenVersion !== (user.tokenVersion || 0)
    ) {
      res.status(401).json({
        success: false,
        message: 'Sesión expirada, inicie sesión nuevamente',
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'Usuario inactivo',
      });
      return;
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

// ============================================
// Require Profile Type
// ============================================
export const requireProfileType = (...allowedTypes: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Autenticación requerida',
      });
      return;
    }

    if (!allowedTypes.includes(req.user.profileType)) {
      res.status(403).json({
        success: false,
        message: 'No tienes permisos para esta acción',
      });
      return;
    }

    next();
  };
};

// Backward compatibility
export const authMiddleware = authenticateToken;

// ============================================
// Load User Profile Middleware
// ============================================
import { UserProfile } from '../models/userProfiles.model';

/**
 * Middleware that loads the active UserProfile for the authenticated user.
 * Must be used AFTER authMiddleware.
 * Sets req.userProfile with the user's active profile (if any).
 *
 * Supports X-Profile-Id header for multi-profile selection.
 * Fallback chain:
 * 1. Specific profile via X-Profile-Id header
 * 2. Profile matching user.profileType
 * 3. First active profile (ultimate fallback)
 */
export const loadUserProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      next();
      return;
    }

    const profileId = req.headers['x-profile-id'] as string;

    let profile;
    if (profileId) {
      // Load specific profile if header provided
      profile = await UserProfile.findOne({
        _id: profileId,
        user: req.user._id,
        isActive: true,
      }).populate('client');
    }

    if (!profile) {
      // Fallback: load by profileType from user
      profile = await UserProfile.findOne({
        user: req.user._id,
        type: req.user.profileType,
        isActive: true,
      }).populate('client');
    }

    if (!profile) {
      // Ultimate fallback: first active profile
      profile = await UserProfile.findOne({
        user: req.user._id,
        isActive: true,
      }).populate('client');
    }

    if (profile) {
      (req as any).userProfile = profile;
    }

    next();
  } catch (error) {
    next(error);
  }
};
