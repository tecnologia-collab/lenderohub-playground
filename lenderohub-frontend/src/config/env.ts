/**
 * Environment configuration for LenderoHUB Frontend
 * 
 * Create a .env.local file in the root with:
 * NEXT_PUBLIC_API_URL=https://hubstg.lenderocapital.com/api
 * NEXT_PUBLIC_ENV=staging
 */

export const env = {
  // API Configuration
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  
  // Environment
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  environment: process.env.NEXT_PUBLIC_ENV || 'development',
  
  // Feature flags
  enableMockData: process.env.NEXT_PUBLIC_ENABLE_MOCK === 'true',
  
  // Finco Configuration (for reference)
  fincoClientId: process.env.NEXT_PUBLIC_FINCO_CLIENT_ID || '',
} as const;

// Validate required env vars in production
if (env.isProduction && !process.env.NEXT_PUBLIC_API_URL) {
  console.warn('⚠️ NEXT_PUBLIC_API_URL is not set in production');
}
