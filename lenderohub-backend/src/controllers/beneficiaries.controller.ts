/**
 * Beneficiaries Controller
 * 
 * Handles beneficiary (instrument) management via Finco API
 */

import { Request, Response } from 'express';
import { FincoClient } from '../integrations/finco/client';
import { getBankIdFromClabe } from '../utils/bankMapping';
import { AuthRequest } from '../middlewares/auth.middleware';
import { CostCentre } from '../models/providerAccounts.model';
import { InternalAccount } from '../models/accounts.model';
import { UserBeneficiary } from '../models/userBeneficiaries.model';
import {
  BeneficiaryVerification,
  VerificationStatus
} from '../models/beneficiaryVerifications.model';

// Instanciar FincoClient con config desde variables de entorno
const fincoClient = new FincoClient({
  apiUrl: process.env.FINCO_API_URL || 'https://apicore.stg.finch.lat',
  clientId: process.env.FINCO_CLIENT_ID || '',
  clientSecret: process.env.FINCO_CLIENT_SECRET || '',
  apiKey: process.env.FINCO_API_KEY || '',
  environment: (process.env.FINCO_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox'
});

// HIGH-01: Input sanitization
const sanitizeText = (input: string): string => {
  return input.replace(/[<>"']/g, '').trim().substring(0, 100);
};

export const beneficiariesController = {
  /**
   * GET /api/v1/beneficiaries
   * Get all beneficiaries for the authenticated user
   */
  async getBeneficiaries(req: AuthRequest, res: Response) {
    try {
      console.log('📋 Obteniendo lista de beneficiarios...');
      
      const response = await fincoClient.getInstruments();
      const clientId = req.user?.clientId?.toString();
      const userId = req.user?._id?.toString();

      let filteredInstruments = response.data || [];
      if (clientId) {
        const costCentres = await CostCentre.find({ client: clientId, disabled: { $ne: true } })
          .select('_id')
          .lean();
        const costCentreIds = costCentres.map((cc) => cc._id);
        const internalAccounts = await InternalAccount.find({
          costCentre: { $in: costCentreIds }
        }).select('fullNumber').lean();

        const internalClabes = new Set(
          internalAccounts
            .map((account) => account.fullNumber)
            .filter((clabe): clabe is string => Boolean(clabe))
        );

        filteredInstruments = filteredInstruments.filter((instrument: any) => {
          const clabe = instrument.instrumentDetail?.clabeNumber;
          return !clabe || !internalClabes.has(clabe);
        });
      }

      if (userId) {
        const totalMappings = await UserBeneficiary.countDocuments();
        if (totalMappings === 0) {
          if (filteredInstruments.length > 0) {
            try {
              await UserBeneficiary.insertMany(
                filteredInstruments.map((instrument: any) => ({
                  user: userId,
                  instrumentId: instrument.id
                })),
                { ordered: false }
              );
            } catch (error: any) {
              console.warn('⚠️ No se pudo backfillear beneficiarios:', error?.message || error);
            }
          }
        } else {
          const userMappings = await UserBeneficiary.find({ user: userId }).select('instrumentId').lean();
          const allowedIds = new Set(userMappings.map((mapping) => mapping.instrumentId));
          filteredInstruments = filteredInstruments.filter((instrument: any) => allowedIds.has(instrument.id));
        }
      }

      return res.json({
        success: true,
        data: filteredInstruments,
        total: filteredInstruments.length,
      });
    } catch (error: any) {
      console.error('❌ Error fetching beneficiaries:', error.message);
      return res.status(error.status || 500).json({
        success: false,
        error: 'Failed to fetch beneficiaries',
        message: error.message,
      });
    }
  },

  /**
   * GET /api/v1/beneficiaries/:id
   * Get a specific beneficiary by ID
   */
  async getBeneficiary(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      console.log('🔍 Obteniendo beneficiario:', id);

      const instrument = await fincoClient.getInstrument(id);

      return res.json({
        success: true,
        data: instrument,
      });
    } catch (error: any) {
      console.error('❌ Error fetching beneficiary:', error.message);
      return res.status(error.status || 500).json({
        success: false,
        error: 'Failed to fetch beneficiary',
        message: error.message,
      });
    }
  },

  /**
   * POST /api/v1/beneficiaries
   * Create a new beneficiary (instrument)
   */
  async createBeneficiary(req: AuthRequest, res: Response) {
    try {
      const { clabe, rfc } = req.body;
      // HIGH-01: Sanitize text inputs
      const alias = req.body.alias ? sanitizeText(req.body.alias).substring(0, 50) : '';
      const name = req.body.name ? sanitizeText(req.body.name).substring(0, 100) : '';

      console.log('➕ Creando nuevo beneficiario:', { alias, name, clabe });

      // Validate required fields
      if (!alias || !name || !clabe) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'alias, name, and clabe are required',
        });
      }

      // Validate CLABE format
      if (!/^\d{18}$/.test(clabe)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid CLABE',
          message: 'CLABE must be exactly 18 digits',
        });
      }

      // Detectar banco desde CLABE (primeros 3 dígitos)
      const bankInfo = getBankIdFromClabe(clabe);
      
      if (!bankInfo) {
        return res.status(400).json({
          success: false,
          error: 'Invalid bank code',
          message: `Bank code ${clabe.substring(0, 3)} not found in catalog`,
        });
      }

      const destination_bank_id = bankInfo.bankId;
      
      console.log(`🏦 Banco detectado: ${bankInfo.bankName} (${clabe.substring(0, 3)})`);

      const requestBody = {
        alias,
        beneficiary_name: name,
        clabe,
        rfc: rfc || 'ND',
        destination_bank_id,
      };

      const instrument = await fincoClient.createInstrument(requestBody);

      const userId = req.user?._id?.toString();
      if (userId && instrument?.id) {
        try {
          await UserBeneficiary.findOneAndUpdate(
            { user: userId, instrumentId: instrument.id },
            { user: userId, instrumentId: instrument.id },
            { upsert: true, new: true }
          );
        } catch (error: any) {
          console.warn('⚠️ No se pudo registrar beneficiario por usuario:', error?.message || error);
        }
      }

      return res.status(201).json({
        success: true,
        data: instrument,
        message: 'Beneficiary created successfully',
      });
    } catch (error: any) {
      console.error('❌ Error creating beneficiary:', error.message);
      return res.status(error.status || 500).json({
        success: false,
        error: 'Failed to create beneficiary',
        message: error.message,
      });
    }
  },

  /**
   * DELETE /api/v1/beneficiaries/:id
   * Delete a beneficiary
   */
  async deleteBeneficiary(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      console.log('🗑️ Eliminando beneficiario:', id);

      await fincoClient.deleteInstrument(id);
      const userId = req.user?._id?.toString();
      if (userId) {
        await UserBeneficiary.deleteOne({ user: userId, instrumentId: id });
      }

      return res.json({
        success: true,
        message: 'Beneficiary deleted successfully',
      });
    } catch (error: any) {
      console.error('❌ Error deleting beneficiary:', error.message);
      return res.status(error.status || 500).json({
        success: false,
        error: 'Failed to delete beneficiary',
        message: error.message,
      });
    }
  },

  /**
   * POST /api/v1/beneficiaries/:id/verify
   * Initiate penny validation (account verification) for a beneficiary instrument.
   * Sends 0.01 MXN via Finco penny_validation endpoint.
   * CEP result arrives asynchronously via webhook.
   */
  async verify(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?._id?.toString();

      console.log('🔍 Iniciando penny validation para instrumento:', id);

      // 1. Verify the instrument exists in Finco
      let instrument: any;
      try {
        instrument = await fincoClient.getInstrument(id);
      } catch (err: any) {
        return res.status(404).json({
          success: false,
          error: 'Beneficiary not found',
          message: `Instrument ${id} not found in Finco`,
        });
      }

      // 2. Check if there is already a pending or completed verification
      const existingVerification = await BeneficiaryVerification.findOne({
        instrumentId: id,
        status: { $in: [VerificationStatus.Verified, VerificationStatus.Pending, VerificationStatus.Delayed] }
      }).sort({ createdAt: -1 });

      if (existingVerification) {
        if (existingVerification.status === VerificationStatus.Verified) {
          return res.json({
            success: true,
            message: 'Beneficiary already verified',
            data: {
              status: existingVerification.status,
              beneficiaryName: existingVerification.beneficiaryName,
              beneficiaryRfc: existingVerification.beneficiaryRfc,
              cepUrl: existingVerification.cepUrl,
              verifiedAt: existingVerification.processedAt,
            },
          });
        }

        // Pending or delayed -- verification in progress
        return res.json({
          success: true,
          message: 'Verification already in progress',
          data: {
            status: existingVerification.status,
            transactionId: existingVerification.transactionId,
            trackingId: existingVerification.trackingId,
            initiatedAt: existingVerification.createdAt,
          },
        });
      }

      // 3. Call Finco penny validation
      const result = await fincoClient.initiatePennyValidation(id);

      // 4. Store verification record
      const verification = new BeneficiaryVerification({
        instrumentId: id,
        transactionId: result.id,
        trackingId: result.trackingId,
        status: VerificationStatus.Pending,
        cepUrl: result.metadata?.dataCep?.cepUrl || undefined,
        validationId: result.metadata?.dataCep?.validationId || undefined,
        initiatedBy: userId ? userId : undefined,
      });
      await verification.save();

      console.log('✅ Penny validation iniciada, transactionId:', result.id);

      return res.json({
        success: true,
        message: 'Verification initiated',
        data: {
          status: VerificationStatus.Pending,
          transactionId: result.id,
          trackingId: result.trackingId,
          instrumentId: id,
        },
      });

    } catch (error: any) {
      console.error('❌ Error initiating penny validation:', error.message);
      return res.status(error.status || 500).json({
        success: false,
        error: 'Failed to initiate verification',
        message: error.message,
      });
    }
  },

  /**
   * GET /api/v1/beneficiaries/:id/verification-status
   * Get the current verification status for a beneficiary instrument.
   */
  async getVerificationStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      console.log('📋 Consultando estado de verificacion para instrumento:', id);

      // Find the most recent verification for this instrument
      const verification = await BeneficiaryVerification.findOne({
        instrumentId: id
      }).sort({ createdAt: -1 }).lean();

      if (!verification) {
        return res.json({
          success: true,
          data: {
            instrumentId: id,
            status: VerificationStatus.None,
            message: 'No verification initiated for this beneficiary',
          },
        });
      }

      return res.json({
        success: true,
        data: {
          instrumentId: id,
          status: verification.status,
          transactionId: verification.transactionId,
          trackingId: verification.trackingId,
          beneficiaryName: verification.beneficiaryName,
          beneficiaryRfc: verification.beneficiaryRfc,
          beneficiaryAccount: verification.beneficiaryAccount,
          cepUrl: verification.cepUrl,
          processedAt: verification.processedAt,
          initiatedAt: verification.createdAt,
        },
      });

    } catch (error: any) {
      console.error('❌ Error getting verification status:', error.message);
      return res.status(error.status || 500).json({
        success: false,
        error: 'Failed to get verification status',
        message: error.message,
      });
    }
  },
};
