import jwt from 'jsonwebtoken';
import { jwtConfig } from '../../config/jwt';

export const signAccessToken = (payload: object) =>
  jwt.sign(payload, jwtConfig.accessSecret, {
    expiresIn: jwtConfig.accessExpiresIn,
  });

export const signRefreshToken = (payload: object) =>
  jwt.sign(payload, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpiresIn,
  });

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, jwtConfig.accessSecret);

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, jwtConfig.refreshSecret);
