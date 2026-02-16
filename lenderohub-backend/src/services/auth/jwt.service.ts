import jwt from 'jsonwebtoken';

// ============================================
// Configuration
// ============================================
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = '7d';

// ============================================
// Types
// ============================================
export interface JWTPayload {
  userId: string;
  email: string;
  profileType: string;
  tokenVersion?: number;
}

export interface TempJWTPayload {
  userId: string;
  type: 'temp-login';
}

// ============================================
// JWT Service
// ============================================
export class JWTService {
  /**
   * Generate access token (short-lived)
   */
  static generateAccessToken(payload: JWTPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
  }

  /**
   * Generate refresh token (long-lived)
   */
  static generateRefreshToken(payload: JWTPayload): string {
    return jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
    });
  }

  /**
   * Generate temporary token for 2FA flow (5 minutes)
   */
  static generateTempToken(userId: string): string {
    const payload: TempJWTPayload = {
      userId,
      type: 'temp-login',
    };
    
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: '5m',
    });
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (error) {
      throw new Error('Token inválido o expirado');
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
    } catch (error) {
      throw new Error('Refresh token inválido o expirado');
    }
  }

  /**
   * Verify temp token (for 2FA)
   */
  static verifyTempToken(token: string): TempJWTPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as TempJWTPayload;
      
      if (decoded.type !== 'temp-login') {
        throw new Error('Invalid token type');
      }
      
      return decoded;
    } catch (error) {
      throw new Error('Token temporal inválido o expirado');
    }
  }

  /**
   * Decode token without verification (use with caution)
   */
  static decode(token: string): any {
    return jwt.decode(token);
  }
}
