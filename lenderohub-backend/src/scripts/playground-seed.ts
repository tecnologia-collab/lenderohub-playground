import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import bcrypt from 'bcryptjs';
import { connectMongo } from '../database/mongo';
import { UserModel } from '../models/user.model';

const users = [
  {
    email: 'admin@playground.local',
    firstName: 'Admin',
    lastName: 'Playground',
    profileType: 'corporate' as const,
  },
  {
    email: 'manager@playground.local',
    firstName: 'Manager',
    lastName: 'Playground',
    profileType: 'administrator' as const,
  },
  {
    email: 'viewer@playground.local',
    firstName: 'Viewer',
    lastName: 'Playground',
    profileType: 'subaccount' as const,
  },
];

const run = async () => {
  await connectMongo();

  const password = 'playground123';
  const passwordHash = await bcrypt.hash(password, 12);

  console.log('Seeding playground users...\n');

  for (const userData of users) {
    const user = await UserModel.findOneAndUpdate(
      { email: userData.email },
      {
        ...userData,
        passwordHash,
        isActive: true,
        twoFactorEnabled: false,
        tokenVersion: 0,
      },
      { upsert: true, new: true }
    );

    console.log(`  Created: ${user.email} (${user.profileType})`);
  }

  console.log('\nAll users created with password: playground123');
  console.log('Login at: http://localhost:3001\n');

  process.exit(0);
};

run().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
