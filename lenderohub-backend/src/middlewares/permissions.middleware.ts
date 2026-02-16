import { Response, NextFunction } from 'express'
import { Permissions, Permission } from '../config/permissions'
import { AuthRequest } from './auth.middleware'

export function requirePermission(permission: Permission | Permission[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const user = req.user
    if (!user) {
      res.status(401).json({ success: false, message: 'No autenticado' })
      return
    }

    const hasPermission = Array.isArray(permission)
      ? Permissions.userHasAny(user, permission)
      : Permissions.userHas(user, permission)

    if (!hasPermission) {
      res.status(403).json({ success: false, message: 'No tienes permisos para esta acción' })
      return
    }

    next()
  }
}
