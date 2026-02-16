// src/integrations/finco/index.ts
import { FincoClient } from './client';
import { FincoConfig } from './types';

let fincoClient: FincoClient | null = null;

export function initializeFinco(): void {
  // LOGS DE DEBUG
  console.log('🔍 Iniciando configuración de Finco...');
  console.log('API Key presente:', !!process.env.FINCO_API_KEY);
  console.log('Client ID presente:', !!process.env.FINCO_CLIENT_ID);
  
  const config: FincoConfig = {
    apiUrl: process.env.FINCO_API_URL || 'https://sandbox.fincoapp.io/api',
    apiKey: process.env.FINCO_API_KEY || '',
    clientId: process.env.FINCO_CLIENT_ID || '',
    clientSecret: process.env.FINCO_CLIENT_SECRET || '',
    environment: (process.env.FINCO_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
  };

  if (!config.apiKey || !config.clientId) {
    console.warn('⚠️  Finco credentials not configured. Running in mock mode.');
    console.log('Missing API Key:', !config.apiKey);
    console.log('Missing Client ID:', !config.clientId);
    return;
  }

  fincoClient = new FincoClient(config);
  console.log('✅ Finco integration initialized successfully!');
  console.log('📊 Account CLABE:', process.env.FINCO_CLABE);
}

export function getFincoClient(): FincoClient | null {
  return fincoClient;
}

export * from './types';
export { FincoClient } from './client';