import mongoose from 'mongoose';
import { UserModel } from '../models/user.model';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function listUsers() {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/lenderohub';
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado a MongoDB\n');

    const users = await UserModel.find({}).select('+twoFactorSecret').exec();

    console.log(`📋 Usuarios encontrados: ${users.length}\n`);

    for (const user of users) {
      console.log(`  📧 ${user.email}`);
      console.log(`     ID: ${user._id}`);
      console.log(`     2FA: ${user.twoFactorEnabled ? '✅ Habilitado' : '❌ Deshabilitado'}`);
      console.log(`     Has Secret: ${user.twoFactorSecret ? 'Sí' : 'No'}`);
      console.log(`     Active: ${user.isActive ? 'Sí' : 'No'}`);
      console.log('');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listUsers();
