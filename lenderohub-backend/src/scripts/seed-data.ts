import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import bcrypt from 'bcryptjs';
import { connectMongo } from '../database/mongo';
import { UserModel } from '../models/user.model';


const run = async () => {
  await connectMongo();

  const email = (process.env.ADMIN_EMAIL || 'admin@demo.com').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Admin123!';

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await UserModel.findOneAndUpdate(
    { email },
    {
      email,
      passwordHash,
      profileType: 'administrator',
      isActive: true,
    },
    { upsert: true, new: true }
  );

  console.log('✅ Admin listo:', {
    id: user._id.toString(),
    email: user.email,
    profileType: user.profileType,
  });

  process.exit(0);
};

run().catch((err) => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});
