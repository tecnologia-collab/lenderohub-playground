import { Router } from 'express';
import {
  setup2FA,
  verifySetup2FA,
  verify2FALogin,
  disable2FA,
  get2FAStatus
} from '../controllers/twoFactor.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

/**
 * 🔐 Rutas de Autenticación de Dos Factores (2FA)
 * Todas las rutas (excepto verify-2fa-login) requieren autenticación JWT
 */

// GET /api/auth/2fa-status
// Obtener estado de 2FA del usuario actual
router.get('/2fa-status', authenticateToken, get2FAStatus);

// GET /api/auth/setup-2fa
// Iniciar configuración de 2FA (generar QR code)
router.get('/setup-2fa', authenticateToken, setup2FA);

// POST /api/auth/verify-setup-2fa
// Verificar código y activar 2FA
router.post('/verify-setup-2fa', authenticateToken, verifySetup2FA);

// POST /api/auth/verify-2fa
// Verificar código durante el login (no requiere JWT completo, solo tempToken)
router.post('/verify-2fa', verify2FALogin);

// POST /api/auth/disable-2fa
// Desactivar 2FA (requiere código de confirmación)
router.post('/disable-2fa', authenticateToken, disable2FA);

export default router;
