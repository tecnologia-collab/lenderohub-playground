import { Router } from 'express';
import * as authController from './auth.controller';
import { authenticateToken } from '../../middlewares/auth.middleware';

const router = Router();

// ============================================
// PUBLIC ROUTES (no auth required)
// ============================================
router.post('/login', authController.login);
router.post('/verify-2fa', authController.verify2FA);
router.post('/logout', authController.logout);

// 🔑 Password Recovery Routes
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/verify-reset-token', authController.verifyResetToken);

// 🔑 Password Setup Routes (para usuarios nuevos)
router.get('/validate-setup-token', authController.validateSetupToken);
router.post('/setup-password', authController.setupPassword);

// ============================================
// PROTECTED ROUTES (require authentication)
// ============================================
router.get('/me', authenticateToken, authController.getCurrentUser);

// 🔐 2FA Routes
router.get('/setup-2fa', authenticateToken, authController.setup2FA);      // GET: obtener QR (no regenera si ya tiene 2FA)
router.post('/verify-setup-2fa', authenticateToken, authController.enable2FA); // POST: verificar código y habilitar 2FA
router.get('/2fa/status', authenticateToken, authController.get2FAStatus);  // GET: obtener estado de 2FA
router.post('/2fa/disable', authenticateToken, authController.disable2FA);  // POST: deshabilitar 2FA (solo staging)
router.post('/2fa/reset', authenticateToken, authController.reset2FA);      // POST: resetear 2FA (generar nuevo QR)

// 🔐 Rutas alternativas (compatibilidad)
router.post('/2fa/setup', authenticateToken, authController.setup2FA);
router.post('/2fa/enable', authenticateToken, authController.enable2FA);

// 📧 Re-envío de email de setup (requiere auth)
router.post('/resend-setup-email', authenticateToken, authController.resendSetupEmail);

// 🔐 Cambio de contraseña (requiere auth)
router.post('/change-password', authenticateToken, authController.changePassword);

// 🔄 Multi-profile: Switch active profile
router.post('/switch-profile', authenticateToken, authController.switchProfile);

export default router;
