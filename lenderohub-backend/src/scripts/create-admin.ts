import mongoose from 'mongoose';
import { UserModel } from '../models/user.model';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// ============================================
// Create Admin User Script
// ============================================

// Default credentials (can be overridden via env vars)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@a.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';
const ADMIN_FIRST_NAME = process.env.ADMIN_FIRST_NAME || 'Admin';
const ADMIN_LAST_NAME = process.env.ADMIN_LAST_NAME || 'LenderoHUB';

async function createAdminUser() {
  try {
    // Connect to MongoDB
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/lenderohub';
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado a MongoDB');
    console.log('   URI:', MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));

    // Check if admin already exists
    const existingAdmin = await UserModel.findOne({ email: ADMIN_EMAIL.toLowerCase() });

    if (existingAdmin) {
      console.log('');
      console.log('⚠️  Usuario admin ya existe');
      console.log('   Email:', existingAdmin.email);
      console.log('   ID:', existingAdmin._id);
      console.log('   2FA Enabled:', existingAdmin.twoFactorEnabled ? 'Sí' : 'No');
      console.log('   Active:', existingAdmin.isActive ? 'Sí' : 'No');

      // Offer to reset password
      if (process.argv.includes('--reset')) {
        existingAdmin.passwordHash = ADMIN_PASSWORD;
        existingAdmin.twoFactorEnabled = false;
        existingAdmin.twoFactorSecret = undefined;
        existingAdmin.failedLoginAttempts = 0;
        existingAdmin.lockedUntil = undefined;
        await existingAdmin.save();
        console.log('');
        console.log('✅ Usuario reseteado:');
        console.log('   - Contraseña actualizada');
        console.log('   - 2FA deshabilitado');
        console.log('   - Bloqueos removidos');
      } else {
        console.log('');
        console.log('💡 Usa --reset para resetear contraseña y 2FA');
      }

      process.exit(0);
    }

    // Create admin user
    const admin = new UserModel({
      email: ADMIN_EMAIL.toLowerCase(),
      passwordHash: ADMIN_PASSWORD, // Will be hashed by pre-save hook
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      profileType: 'corporate',
      isActive: true,
      twoFactorEnabled: false,
    });

    await admin.save();

    console.log('');
    console.log('✅ Usuario admin creado exitosamente');
    console.log('');
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║         CREDENCIALES DE USUARIO ADMIN              ║');
    console.log('╚════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📧 Email:    ', ADMIN_EMAIL);
    console.log('🔑 Password: ', ADMIN_PASSWORD);
    console.log('🆔 ID:       ', admin._id.toString());
    console.log('');
    console.log('⚠️  IMPORTANTE: Configura 2FA en el primer login');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run script
createAdminUser();
