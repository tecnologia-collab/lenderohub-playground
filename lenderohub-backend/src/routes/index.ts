// src/routes/index.ts
import { Router } from 'express';
import mockFincoRoutes from './mock-finco.routes';
import userRoutes from './user.routes';
import transferRoutes from './transfers.routes';
import beneficiariesRoutes from './beneficiaries.routes';
import costCentresRoutes from './costCentres.routes';
import virtualBagsRoutes from './cashBags.routes';
import subaccountsRoutes from './subaccounts.routes';
import commissionsRoutes from './commissions.routes';
import commissionAgentsRoutes from './commissionAgents.routes';
import accountsRoutes from './accounts.routes';
import userProfilesRoutes from './userProfiles.routes';
import reportsRoutes from './reports.routes';
import fincoWebhooks from './webhooks/finco.routes';
import auditLogsRoutes from './auditLogs.routes';
import monthlyChargesRoutes from './monthlyCharges.routes';
import notificationsRoutes from './notifications.routes';
import reconciliationRoutes from './reconciliation.routes';
import massBeneficiaryRoutes from './massBeneficiary.routes';
import massTransferRoutes from './massTransfer.routes';
import beneficiaryClusterRoutes from './beneficiaryClusters.routes';
import registrationRoutes from './registration.routes';
import hubController from '../controllers/hub.controller';
import healthController from '../controllers/health.controller';

const router = Router();

// ========== Mock Finco API (playground only) ==========
router.use('/mock-finco', mockFincoRoutes);

// Ruta de salud (public, no auth required)
router.get('/health', healthController.getHealth);

// ========== HUB (Dashboard) ==========
router.get('/hub/balance', hubController.getHubBalance);
router.get('/hub/movements', hubController.getHubMovements);
router.get('/hub/balance-history', hubController.getBalanceHistory);
router.post('/hub/sync', hubController.syncHubBalance);
router.post('/hub/sync-balances', hubController.syncAllBalances);
router.get('/dashboard/stats', hubController.getDashboardStats);
router.get('/dashboard/operations', hubController.getDashboardOperations);

// ========== Banks Catalog ==========
router.get('/banks', hubController.getBanks);

// ========== Rutas existentes ==========
router.use('/users', userRoutes);
router.use('/transfers', transferRoutes);
router.use('/transactions', transferRoutes);  // Alias for transfers
router.use('/webhooks/finco', fincoWebhooks);

// ========== Nuevas Rutas ==========
router.use('/beneficiaries', beneficiariesRoutes);
router.use('/cost-centres', costCentresRoutes);
router.use('/virtual-bags', virtualBagsRoutes);
router.use('/subaccounts', subaccountsRoutes);
router.use('/accounts', accountsRoutes);
router.use('/commissions', commissionsRoutes);
router.use('/', commissionAgentsRoutes);

// ========== Reports ==========
router.use('/reports', reportsRoutes);

// ========== User Profiles ==========
router.use('/', userProfilesRoutes);

// ========== Audit Logs ==========
router.use('/', auditLogsRoutes);

// ========== Monthly Charges ==========
router.use('/monthly-charges', monthlyChargesRoutes);

// ========== Notifications ==========
router.use('/notifications', notificationsRoutes);

// ========== Reconciliation ==========
router.use('/reconciliation', reconciliationRoutes);

// ========== Mass Beneficiary Imports ==========
router.use('/mass-beneficiaries', massBeneficiaryRoutes);

// ========== Mass Transfer Out ==========
router.use('/mass-transfers', massTransferRoutes);

// ========== Beneficiary Clusters ==========
router.use('/beneficiary-clusters', beneficiaryClusterRoutes);

// ========== Registration ==========
router.use('/', registrationRoutes);

export default router;