import dotenv from 'dotenv';

// Carga .env.local por defecto en desarrollo (sin romper prod)
dotenv.config({ path: '.env.local' });

const requireEnv = (key: string) => {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Falta variable de entorno: ${key}`);
  }
  return val;
};

export const jwtConfig = {
  accessSecret: requireEnv('JWT_SECRET'),
  refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
  accessExpiresIn: process.env.JWT_EXPIRE ?? '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRE ?? '30d',
};
