import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

// ============================================
// Permission Matrix
// ============================================

const permissionMatrix: Record<string, Record<string, boolean>> = {
  corporate: {
    'notes:create': true,
    'notes:read': true,
    'notes:update': true,
    'notes:delete': true,
    'notes:resolve': true,
    'users:read': true,
    'users:manage': true,
  },
  administrator: {
    'notes:create': true,
    'notes:read': true,
    'notes:update': true,
    'notes:delete': false,
    'notes:resolve': true,
    'users:read': true,
    'users:manage': false,
  },
  subaccount: {
    'notes:create': true,
    'notes:read': true,
    'notes:update': false,
    'notes:delete': false,
    'notes:resolve': false,
    'users:read': false,
    'users:manage': false,
  },
};

// ============================================
// Middleware Factory
// ============================================

export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const profileType = req.user?.profileType;

    if (!profileType) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
      });
    }

    const rolePermissions = permissionMatrix[profileType];

    if (!rolePermissions) {
      return res.status(403).json({
        success: false,
        error: `Rol '${profileType}' no reconocido en la matriz de permisos`,
      });
    }

    const hasPermission = rolePermissions[permission] === true;

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: `No tienes permiso para ${permission}`,
      });
    }

    return next();
  };
};

export default requirePermission;