// src/integrations/finco/client.ts

import axios, { AxiosInstance, AxiosError } from 'axios';
import crypto from 'crypto';
import { v5 as uuidv5 } from 'uuid';
import {
  FincoConfig,
  Account,
  Transfer,
  SPEITransfer,
  Balance,
  Beneficiary,
  FincoResponse,
  PaginatedResponse
} from './types';

export class FincoClient {
  private client: AxiosInstance;
  private config: FincoConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  
  // Namespace para idempotencia
  // Staging: fb9e4ed2-ab8c-4ce3-9bec-4ae7008bfd43
  // Production: (pendiente de Finco)
  private readonly NAMESPACE_IDEMPOTENCY = process.env.FINCO_IDEMPOTENCY_NAMESPACE || 'fb9e4ed2-ab8c-4ce3-9bec-4ae7008bfd43';

  constructor(config: FincoConfig) {
    this.config = config;
    console.log('🎭 MOCK_MODE desde environment:', process.env.MOCK_MODE);
    const baseURL = config.apiUrl || 'https://apicore.stg.finch.lat';
    
    console.log('🔍 Configurando cliente Finco:');
    console.log('   Base URL:', baseURL);
    console.log('   Client ID:', config.clientId);
    
    this.client = axios.create({
      baseURL: baseURL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey, // API key siempre presente
      },
      timeout: 30000,
    });

    // Interceptor para agregar token a las peticiones
    this.client.interceptors.request.use(
      async (request) => {
        // Solo agregar Authorization para endpoints que no son de auth
        if (!request.url?.includes('/auth/') && !request.url?.includes('/credentials')) {
          // Obtener token si no existe o expiró
          if (!this.accessToken || this.isTokenExpired()) {
            await this.authenticate();
          }
          
          if (this.accessToken) {
            request.headers['Authorization'] = `Bearer ${this.accessToken}`;
          }
        }
        
        return request;
      },
      (error) => Promise.reject(error)
    );

    // Interceptor de respuesta para manejar errores
    this.client.interceptors.response.use(
      response => response,
      this.handleError.bind(this)
    );
  }

  // ========== AUTHENTICATION ==========

  private async authenticate(): Promise<void> {
    try {
      console.log('🔐 Obteniendo token de acceso de Finco...');
      
      // Endpoint correcto según la documentación
      const authResponse = await this.client.post(
        `/v1/clients/${this.config.clientId}/auth/credential-tokens`,
        {
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }
      );

      this.accessToken = authResponse.data.token;
      
      // Parsear expires_at de la respuesta
      if (authResponse.data.expires_at) {
        this.tokenExpiry = new Date(authResponse.data.expires_at);
      } else {
        // Por defecto 24 horas
        this.tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
      
      console.log('✅ Token obtenido exitosamente');
      console.log('   Expira:', this.tokenExpiry.toLocaleString());
      
    } catch (error: any) {
      console.error('❌ Error obteniendo token:', error.response?.data || error.message);
      throw new Error('No se pudo autenticar con Finco');
    }
  }

  private isTokenExpired(): boolean {
    if (!this.tokenExpiry) return true;
    // Renovar 5 minutos antes de que expire
    return new Date(Date.now() + 5 * 60 * 1000) >= this.tokenExpiry;
  }

  // ========== IDEMPOTENCY HELPERS ==========

  /**
   * Ordenar keys de un objeto recursivamente (alfabéticamente)
   * Requerido por Finco para calcular el hash de idempotency
   */
  private sortObjectKeysRecursively(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sortObjectKeysRecursively(item));
    return Object.keys(obj).sort().reduce((result: any, key) => {
      result[key] = this.sortObjectKeysRecursively(obj[key]);
      return result;
    }, {});
  }

  /**
   * Calcular hash SHA256 del body para idempotency
   * IMPORTANTE: Finco ordena keys ALFABÉTICAMENTE de forma recursiva
   */
  private calculateBodyHash(data: any): string {
    const sortedData = this.sortObjectKeysRecursively(data);
    const jsonString = JSON.stringify(sortedData);
    return crypto.createHash('sha256').update(jsonString).digest('hex');
  }

  /**
   * Generar Idempotency-Key usando UUID v5
   * Formato: uuidv5(clientId + method + bodyHash, namespace)
   */
  private generateIdempotencyKey(clientId: string, method: string, bodyHash: string): string {
    const input = clientId + method + bodyHash;
    return uuidv5(input, this.NAMESPACE_IDEMPOTENCY);
  }

  // ========== ERROR HANDLING ==========

  private handleError(error: AxiosError): Promise<never> {
    console.error('=== FINCO API ERROR ===');
    console.error('URL:', error.config?.url);
    console.error('Method:', error.config?.method);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      
      const fincoError = error.response.data as any;
      
      // Manejar estructura de error de Monato/Finco
      if (fincoError.details && fincoError.details[0]) {
        const detail = fincoError.details[0];
        const metadata = detail.metadata || {};
        const errorMessage = metadata.error_detail || fincoError.message || 'Error en API de Finco';
        throw new Error(`${errorMessage} (${metadata.error_code || error.response.status})`);
      }
      
      throw new Error(fincoError.message || `Error ${error.response.status}: ${error.response.statusText}`);
    } else if (error.request) {
      console.error('No response received');
      throw new Error('No se pudo conectar con Finco');
    } else {
      console.error('Request error:', error.message);
      throw error;
    }
  }

  // ========== ACCOUNTS ==========

  async getAccounts(): Promise<any> {
    const response = await this.client.get(`/v1/clients/${this.config.clientId}/accounts`);
    return response.data;
  }

  async getAccount(accountId: string): Promise<any> {
    const response = await this.client.get(`/v1/clients/${this.config.clientId}/accounts/${accountId}`);
    return response.data;
  }

  async getAccountBalance(accountId: string): Promise<any> {
    const response = await this.client.get(`/v1/clients/${this.config.clientId}/accounts/${accountId}`);
    return {
      available: response.data.availableBalance,
      pending: 0,
      total: response.data.availableBalance,
      currency: 'MXN'
    };
  }

  // ========== INSTRUMENTS (BENEFICIARIOS) ==========

  /**
   * Obtener todos los instrumentos (beneficiarios)
   * GET /v1/clients/{clientId}/instruments
   */
  async getInstruments(): Promise<any> {
    try {
      const response = await this.client.get(`/v1/clients/${this.config.clientId}/instruments`);
      return response.data;
    } catch (error) {
      console.error('❌ Error obteniendo instruments');
      throw error;
    }
  }

  /**
   * Obtener un instrumento específico por ID
   * GET /v1/clients/{clientId}/instruments/{instrumentId}
   */
  async getInstrument(instrumentId: string): Promise<any> {
    try {
      const response = await this.client.get(
        `/v1/clients/${this.config.clientId}/instruments/${instrumentId}`
      );
      return response.data;
    } catch (error) {
      console.error('❌ Error obteniendo instrument:', instrumentId);
      throw error;
    }
  }

  /**
   * Crear un nuevo instrumento (beneficiario con CLABE)
   * POST /v1/clients/{clientId}/instruments
   */
  async createInstrument(data: any): Promise<any> {
    console.log('🔍 createInstrument - MOCK_MODE es:', process.env.MOCK_MODE);
    
    // MODO MOCK
    if (process.env.MOCK_MODE === 'true') {
      console.log('🎭 MODO MOCK: Creando instrument falso');
      const mockInstrument = {
        id: `mock-instrument-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        bankId: data.destination_bank_id || "mock-bank-id",
        clientId: this.config.clientId,
        ownerId: this.config.clientId,
        alias: data.alias || data.beneficiary_name,
        type: "RECEIVER",
        instrumentDetail: {
          clabeNumber: data.clabe,
          holderName: data.beneficiary_name,
          accountNumber: ""
        },
        audit: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
          blockedAt: null
        },
        rfc: data.rfc || "XAXX010101000"
      };
      console.log('✅ Instrument mock creado:', mockInstrument);
      return mockInstrument;
    }
    
    // Extraer account_number de la CLABE (posiciones 3-14 = 12 dígitos)
    const account_number = data.clabe.substring(3, 15);
    
    // Construir payload según ejemplo que funcionó
    const payload = {
      source_bank_id: process.env.FINCO_BANK_ID || "9d84b03a-28d1-4898-a69c-38824239e2b1",
      client_id: this.config.clientId,
      alias: data.alias || data.beneficiary_name || "Beneficiario",
      type: "SENDER",
      rfc: data.rfc || "XAXX010101000",
      virtual_clabe: {
        destination_bank_id: data.destination_bank_id,
        account_number: account_number,
        clabe_number: data.clabe,
        holder_name: data.beneficiary_name.substring(0, 40)
      }
    };

    console.log('📝 Creando instrument (beneficiario):', JSON.stringify(payload, null, 2));

    try {
      const response = await this.client.post(
        `/v1/clients/${this.config.clientId}/instruments`,
        payload
      );
      console.log('✅ Instrument creado exitosamente:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error creando instrument');
      throw error;
    }
  }

  /**
   * Eliminar un instrumento (beneficiario)
   * DELETE /v1/clients/{clientId}/instruments/{instrumentId}
   */
  async deleteInstrument(instrumentId: string): Promise<void> {
    try {
      console.log('🗑️ Eliminando instrument:', instrumentId);
      await this.client.delete(
        `/v1/clients/${this.config.clientId}/instruments/${instrumentId}`
      );
      console.log('✅ Instrument eliminado exitosamente');
    } catch (error) {
      console.error('❌ Error eliminando instrument:', instrumentId);
      throw error;
    }
  }

  // ========== MONEY OUT (SPEI TRANSFERS) ==========

  /**
   * Crear transferencia SPEI (Money Out)
   * POST /v1/transactions/money_out
   */
  async createSPEITransfer(transfer: any): Promise<any> {
    // MODO MOCK
    if (process.env.MOCK_MODE === 'true') {
      console.log('🎭 MODO MOCK: Creando transferencia falsa');
      const mockTransfer = {
        id: `mock-tx-${Date.now()}`,
        bankId: "mock-bank",
        clientId: this.config.clientId,
        externalReference: transfer.reference,
        trackingId: `MOCK${Date.now()}`,
        description: transfer.concept,
        amount: (transfer.amount / 100).toFixed(2),
        currency: "MXN",
        category: "DEBIT_TRANS",
        subCategory: "SPEI_DEBIT",
        transactionStatus: "INITIALIZED",
        audit: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };
      console.log('✅ Transferencia mock creada:', mockTransfer);
      return mockTransfer;
    }
      
    // Construir el payload según documentación de Monato
    const payload = {
      client_id: this.config.clientId,
      source_instrument_id: transfer.source_instrument_id || transfer.sourceInstrumentId || process.env.FINCO_INSTRUMENT_ID || '',
      destination_instrument_id: transfer.destination_instrument_id || '',
      transaction_request: {
        external_reference: transfer.reference || Date.now().toString().slice(-7),
        description: transfer.concept || transfer.description || '',
        amount: (transfer.amount / 100).toFixed(2), // Convertir centavos a pesos
        currency: "MXN"
      }
    };

    console.log('📤 Preparando transferencia SPEI...');
    console.log('💰 Payload:', JSON.stringify(payload, null, 2));

    // Idempotency-Key (habilitado por defecto)
    // Usar FINCO_USE_IDEMPOTENCY=false para deshabilitar
    const useIdempotency = process.env.FINCO_USE_IDEMPOTENCY !== 'false';
    const headers: Record<string, string> = {};

    if (useIdempotency) {
      const bodyHash = this.calculateBodyHash(payload);
      const idempotencyKey = this.generateIdempotencyKey(
        this.config.clientId,
        'money_out',
        bodyHash
      );
      headers['Idempotency-Key'] = idempotencyKey;
      console.log('🔑 Idempotency-Key:', idempotencyKey);
      console.log('   Body Hash:', bodyHash);
    } else {
      console.log('ℹ️ Idempotency deshabilitado (usando external_reference para unicidad)');
    }

    try {
      const response = await this.client.post('/v1/transactions/money_out', payload, {
        headers: Object.keys(headers).length > 0 ? headers : undefined
      });

      console.log('✅ Transferencia iniciada:', response.data);
      return response.data;
    } catch (error: any) {
      // El error se manejará en el interceptor
      throw error;
    }
  }

  // ========== INTERNAL TRANSACTIONS ==========

  /**
   * Create an internal transfer between two Monato accounts (book-to-book)
   * POST /v1/transactions/internal_transaction
   *
   * Internal transfers are instant (LIQUIDATED immediately).
   * No SPEI involved - both source and destination are internal Monato instruments.
   *
   * @param transfer.source_instrument_id - Finco instrument UUID of the source account
   * @param transfer.destination_instrument_id - Finco instrument UUID of the destination account
   * @param transfer.amount - Amount in cents (will be converted to pesos string for Finco)
   * @param transfer.description - Description (max 40 chars)
   * @param transfer.external_reference - Optional numeric reference (max 7 digits)
   * @returns Finco transaction response with transactionStatus: 'LIQUIDATED'
   */
  async createInternalTransfer(transfer: {
    source_instrument_id: string;
    destination_instrument_id: string;
    amount: number;
    description: string;
    external_reference?: string;
  }): Promise<any> {
    // MODO MOCK
    if (process.env.MOCK_MODE === 'true') {
      console.log('🎭 MODO MOCK: Creando internal transfer falsa');
      const mockTransfer = {
        id: `mock-int-tx-${Date.now()}`,
        bankId: 'mock-bank',
        clientId: this.config.clientId,
        externalReference: transfer.external_reference || `${Date.now()}`.slice(-7),
        trackingId: `MOCKINT${Date.now()}`,
        description: transfer.description,
        amount: (transfer.amount / 100).toFixed(2),
        currency: 'MXN',
        category: 'INTER_TRANS',
        subCategory: 'INT_DEBIT',
        transactionStatus: 'LIQUIDATED',
        audit: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };
      console.log('✅ Internal transfer mock creada:', mockTransfer);
      return mockTransfer;
    }

    const payload = {
      client_id: this.config.clientId,
      source_instrument_id: transfer.source_instrument_id,
      destination_instrument_id: transfer.destination_instrument_id,
      transaction_request: {
        amount: (transfer.amount / 100).toFixed(2),
        currency: 'MXN',
        description: transfer.description,
        external_reference: transfer.external_reference || `${Date.now()}`.slice(-7)
      }
    };

    console.log('📤 Preparando internal transfer...');
    console.log('💰 Payload:', JSON.stringify(payload, null, 2));

    // Idempotency-Key (same pattern as createSPEITransfer)
    const useIdempotency = process.env.FINCO_USE_IDEMPOTENCY !== 'false';
    const headers: Record<string, string> = {};

    if (useIdempotency) {
      const bodyHash = this.calculateBodyHash(payload);
      const idempotencyKey = this.generateIdempotencyKey(
        this.config.clientId,
        'internal_transaction',
        bodyHash
      );
      headers['Idempotency-Key'] = idempotencyKey;
      console.log('🔑 Idempotency-Key:', idempotencyKey);
      console.log('   Body Hash:', bodyHash);
    }

    try {
      const response = await this.client.post('/v1/transactions/internal_transaction', payload, {
        headers: Object.keys(headers).length > 0 ? headers : undefined
      });

      console.log('✅ Internal transfer completada:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error en internal transfer:', error.message);
      throw error;
    }
  }

  // ========== PENNY VALIDATION ==========

  /**
   * Initiate penny validation (account verification) for an instrument
   * POST /v1/transactions/penny_validation
   *
   * Sends 0.01 MXN to the destination instrument and triggers CEP generation.
   * The CEP result is delivered via the CEP webhook asynchronously.
   *
   * @param destinationInstrumentId - Finco instrument UUID of the beneficiary
   * @param description - Optional description (max 40 chars, letters/numbers/spaces only)
   * @param externalReference - Optional numeric reference (max 7 digits)
   * @returns Finco transaction response with metadata.dataCep
   */
  async initiatePennyValidation(
    destinationInstrumentId: string,
    description?: string,
    externalReference?: string
  ): Promise<any> {
    // MODO MOCK
    if (process.env.MOCK_MODE === 'true') {
      console.log('🎭 MODO MOCK: Penny validation falsa');
      const mockResponse = {
        id: `mock-pv-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        bankId: 'mock-bank-id',
        clientId: this.config.clientId,
        externalReference: externalReference || '000000',
        trackingId: `MOCK${Date.now()}PVXXXXXXXXX`,
        description: description || 'Validacion de cuenta',
        amount: '0.01',
        currency: 'MXN',
        category: 'DEBIT_TRANS',
        subCategory: 'SPEI_DEBIT',
        transactionStatus: 'INITIALIZED',
        audit: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: 'None',
          blockedAt: 'None'
        },
        metadata: {
          dataCep: {
            cepUrl: '',
            validationId: `mock-val-${Date.now()}`,
            status: 'PENDING',
            createdAt: new Date().toISOString()
          }
        }
      };
      console.log('✅ Penny validation mock creada:', mockResponse.id);
      return mockResponse;
    }

    const sourceInstrumentId = process.env.FINCO_INSTRUMENT_ID || '';
    if (!sourceInstrumentId) {
      throw new Error('FINCO_INSTRUMENT_ID not configured (source instrument for penny validation)');
    }

    const payload: Record<string, string> = {
      client_id: this.config.clientId,
      source_instrument_id: sourceInstrumentId,
      destination_instrument_id: destinationInstrumentId
    };

    if (description) {
      payload.description = description.substring(0, 40);
    }

    if (externalReference) {
      payload.external_reference = externalReference.substring(0, 7);
    }

    console.log('🔍 Iniciando penny validation...');
    console.log('   Destination instrument:', destinationInstrumentId);
    console.log('   Payload:', JSON.stringify(payload, null, 2));

    // Idempotency-Key
    const useIdempotency = process.env.FINCO_USE_IDEMPOTENCY !== 'false';
    const headers: Record<string, string> = {};

    if (useIdempotency) {
      const bodyHash = this.calculateBodyHash(payload);
      const idempotencyKey = this.generateIdempotencyKey(
        this.config.clientId,
        'penny_validation',
        bodyHash
      );
      headers['Idempotency-Key'] = idempotencyKey;
      console.log('🔑 Idempotency-Key:', idempotencyKey);
    }

    try {
      const response = await this.client.post('/v1/transactions/penny_validation', payload, {
        headers: Object.keys(headers).length > 0 ? headers : undefined
      });

      console.log('✅ Penny validation iniciada:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error en penny validation:', error.message);
      throw error;
    }
  }

  // ========== PRIVATE ACCOUNTS ==========

  /**
   * Crear cuenta privada
   * POST /v1/clients/{clientId}/private_accounts
   */
  async createPrivateAccount(data: any): Promise<any> {
    const payload = {
      bank_id: process.env.FINCO_BANK_ID,
      owner_id: this.config.clientId,
      client_bank_adapter_id: process.env.FINCO_CLIENT_BANK_ADAPTER_ID,
      client_id: this.config.clientId,
      account_id: process.env.FINCO_ACCOUNT_ID
    };

    console.log('📤 Creando cuenta privada en Finco...');
    console.log('   Payload:', JSON.stringify(payload, null, 2));

    const response = await this.client.post(
      `/v1/clients/${this.config.clientId}/private_accounts`,
      payload
    );

    console.log('✅ Cuenta privada creada en Finco');
    console.log('   Response completo:', JSON.stringify(response.data, null, 2));

    // Normalizar campos de CLABE - Finco puede usar diferentes nombres
    const rawData = response.data;
    const clabeNumber = rawData.clabeNumber 
      || rawData.clabe_number 
      || rawData.clabe 
      || rawData.instrumentDetail?.clabeNumber
      || rawData.instrumentDetail?.clabe_number
      || rawData.instrument_detail?.clabe_number
      || '';

    console.log('   CLABE extraído:', clabeNumber || '(no encontrado)');

    return {
      ...rawData,
      clabeNumber, // Campo normalizado
    };
  }

  // ========== BANKS ==========

  /**
   * Obtener catálogo de bancos SPEI
   * GET /v1/banks
   */
  async getBanks(page?: number, pageSize?: number): Promise<any> {
    try {
      // Valores por defecto
      const currentPage = page || 1;
      const currentPageSize = pageSize || 400;
      
      console.log(`🏦 Obteniendo bancos SPEI (página ${currentPage}, tamaño ${currentPageSize})...`);
      
      const response = await this.client.get('/v1/banks', {
        params: {
          page: currentPage,
          page_size: currentPageSize
        }
      });
      
      console.log(`✅ ${response.data.banks?.length || 0} bancos obtenidos de ${response.data.total_banks} totales`);
      
      return response.data;
    } catch (error) {
      console.error('❌ Error obteniendo bancos:', error);
      return { banks: [], total_banks: 0 };
    }
  }

  // ========== TRANSACTIONS ==========

  /**
   * Obtener transacciones
   * GET /v1/transactions
   */
  async getTransactions(params?: any): Promise<any> {
    try {
      const response = await this.client.get('/v1/transactions', { params });
      return response.data;
    } catch (error) {
      console.error('Error getting transactions:', error);
      return {
        data: [],
        pagination: {
          page: 1,
          per_page: 20,
          total: 0,
          total_pages: 0
        }
      };
    }
  }

  /**
   * Obtener una transacción específica
   * GET /v1/clients/{clientId}/transactions/{transactionId}
   */
  async getTransaction(transactionId: string): Promise<any> {
    try {
      const response = await this.client.get(
        `/v1/clients/${this.config.clientId}/transactions/${transactionId}`
      );
      return response.data;
    } catch (error) {
      console.error('Error getting transaction:', transactionId);
      throw error;
    }
  }

  // ========== MÉTODOS DE COMPATIBILIDAD (Aliases) ==========

  async getTransfer(transferId: string): Promise<any> {
    return this.getTransaction(transferId);
  }

  async getTransfers(params?: any): Promise<any> {
    return this.getTransactions(params);
  }

  async getBeneficiaries(): Promise<any[]> {
    // En Monato los beneficiarios son instruments
    const response = await this.getInstruments();
    return response.data || [];
  }

  async createBeneficiary(data: any): Promise<any> {
    // En Monato/Finco esto es createInstrument
    return this.createInstrument(data);
  }

  async deleteBeneficiary(id: string): Promise<void> {
    // En Monato/Finco esto es deleteInstrument
    return this.deleteInstrument(id);
  }

  // ========== WEBHOOKS ==========

  /**
   * Listar webhooks registrados
   * GET /v1/clients/{clientId}/webhooks
   */
  async listWebhooks(): Promise<any> {
    try {
      console.log('📋 Listando webhooks registrados...');
      const response = await this.client.get(
        `/v1/clients/${this.config.clientId}/webhooks`
      );
      console.log('✅ Webhooks obtenidos:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error listando webhooks:', error);
      throw error;
    }
  }

  /**
   * Registrar un nuevo webhook
   * POST /v1/clients/{clientId}/webhooks
   * @param url - URL donde Finco enviará los webhooks
   * @param token - Token de autenticación para validar los webhooks
   * @param webhookType - Tipo: MONEY_IN, STATUS_UPDATE, CEP
   */
  async registerWebhook(url: string, token: string, webhookType: 'MONEY_IN' | 'STATUS_UPDATE' | 'CEP'): Promise<any> {
    try {
      console.log(`🔔 Registrando webhook ${webhookType}...`);
      console.log('   URL:', url);

      const payload = {
        client_id: this.config.clientId,
        url: url,
        token: token,
        webhook_type: webhookType,
        auth_type: 'AUTH'
      };

      const response = await this.client.post(
        `/v1/clients/${this.config.clientId}/webhooks`,
        payload
      );

      console.log(`✅ Webhook ${webhookType} registrado:`, response.data);
      return response.data;
    } catch (error: any) {
      // Si ya existe, no es error crítico
      if (error.response?.status === 409 || error.response?.data?.message?.includes('already exists')) {
        console.log(`⚠️ Webhook ${webhookType} ya existe`);
        return { exists: true, type: webhookType };
      }
      console.error(`❌ Error registrando webhook ${webhookType}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Obtener un webhook específico
   * GET /v1/clients/{clientId}/webhooks/{webhookId}
   */
  async getWebhook(webhookId: string): Promise<any> {
    try {
      const response = await this.client.get(
        `/v1/clients/${this.config.clientId}/webhooks/${webhookId}`
      );
      return response.data;
    } catch (error) {
      console.error('❌ Error obteniendo webhook:', webhookId);
      throw error;
    }
  }

  /**
   * Actualizar un webhook
   * PATCH /v1/clients/{clientId}/webhooks/{webhookId}
   */
  async updateWebhook(webhookId: string, updates: { url?: string; token?: string; webhook_status?: 'ACTIVE' | 'INACTIVE' }): Promise<any> {
    try {
      console.log(`🔄 Actualizando webhook ${webhookId}...`);
      const response = await this.client.patch(
        `/v1/clients/${this.config.clientId}/webhooks/${webhookId}`,
        updates
      );
      console.log('✅ Webhook actualizado:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error actualizando webhook:', webhookId);
      throw error;
    }
  }

  /**
   * Eliminar un webhook
   * DELETE /v1/clients/{clientId}/webhooks/{webhookId}
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    try {
      console.log(`🗑️ Eliminando webhook ${webhookId}...`);
      await this.client.delete(
        `/v1/clients/${this.config.clientId}/webhooks/${webhookId}`
      );
      console.log('✅ Webhook eliminado');
    } catch (error) {
      console.error('❌ Error eliminando webhook:', webhookId);
      throw error;
    }
  }

  /**
   * Registrar todos los webhooks necesarios para LenderoHUB
   * @param baseUrl - URL base del backend (ej: https://hubstg.lenderocapital.com)
   * @param token - Token para autenticación de webhooks
   */
  async registerAllWebhooks(baseUrl: string, token: string): Promise<{
    moneyIn: any;
    statusUpdate: any;
    cep: any;
  }> {
    console.log('═══════════════════════════════════════════════');
    console.log('🔔 Registrando webhooks en Finco');
    console.log('═══════════════════════════════════════════════');
    console.log('   Base URL:', baseUrl);
    console.log('   Client ID:', this.config.clientId);
    console.log('═══════════════════════════════════════════════');

    const results = {
      moneyIn: await this.registerWebhook(`${baseUrl}/api/webhooks/finco/money-in`, token, 'MONEY_IN'),
      statusUpdate: await this.registerWebhook(`${baseUrl}/api/webhooks/finco/status-update`, token, 'STATUS_UPDATE'),
      cep: await this.registerWebhook(`${baseUrl}/api/webhooks/finco/cep`, token, 'CEP')
    };

    console.log('═══════════════════════════════════════════════');
    console.log('✅ Registro de webhooks completado');
    console.log('═══════════════════════════════════════════════');

    return results;
  }

  /**
   * Validar webhook de Finco (verificar token)
   */
  validateWebhookToken(receivedToken: string, expectedToken: string): boolean {
    return receivedToken === expectedToken;
  }

  // ========== UTILITIES ==========

  /**
   * Método de prueba para verificar conexión
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.authenticate();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtener el token actual (útil para debugging)
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Verificar si el token está vigente
   */
  isAuthenticated(): boolean {
    return this.accessToken !== null && !this.isTokenExpired();
  }
}