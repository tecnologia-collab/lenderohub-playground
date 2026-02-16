import { Router, Request, Response } from 'express';

const router = Router();

// Mock data store (in-memory)
const instruments: any[] = [
  {
    id: 'instr-001',
    name: 'Proveedor Demo SA',
    alias: 'proveedor-demo',
    clabe: '012345678901234567',
    bank: 'BBVA',
    bankCode: '012',
    status: 'active',
    verificationStatus: 'verified',
    createdAt: new Date().toISOString()
  },
  {
    id: 'instr-002',
    name: 'Servicios Tech MX',
    alias: 'servicios-tech',
    clabe: '021345678901234568',
    bank: 'Banorte',
    bankCode: '072',
    status: 'active',
    verificationStatus: 'verified',
    createdAt: new Date().toISOString()
  },
  {
    id: 'instr-003',
    name: 'Logistica Express',
    alias: 'logistica-express',
    clabe: '014345678901234569',
    bank: 'Santander',
    bankCode: '014',
    status: 'active',
    verificationStatus: 'pending',
    createdAt: new Date().toISOString()
  }
];

let transferCounter = 1000;
const transfers: any[] = [];

// GET /instruments - List all instruments (beneficiaries)
router.get('/instruments', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: instruments,
    total: instruments.length
  });
});

// POST /instruments - Create new instrument
router.post('/instruments', (req: Request, res: Response) => {
  const { name, alias, clabe, bank, bankCode } = req.body;
  const newInstrument = {
    id: `instr-${Date.now()}`,
    name: name || 'New Instrument',
    alias: alias || 'new-instrument',
    clabe: clabe || '000000000000000000',
    bank: bank || 'Unknown',
    bankCode: bankCode || '000',
    status: 'active',
    verificationStatus: 'pending',
    createdAt: new Date().toISOString()
  };
  instruments.push(newInstrument);
  res.status(201).json({ success: true, data: newInstrument });
});

// GET /instruments/:id - Get instrument detail
router.get('/instruments/:id', (req: Request, res: Response) => {
  const instrument = instruments.find(i => i.id === req.params.id);
  if (!instrument) {
    return res.status(404).json({ success: false, error: 'Instrument not found' });
  }
  res.json({ success: true, data: instrument });
});

// DELETE /instruments/:id - Delete instrument
router.delete('/instruments/:id', (req: Request, res: Response) => {
  const idx = instruments.findIndex(i => i.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Instrument not found' });
  }
  instruments[idx].status = 'deleted';
  res.json({ success: true, message: 'Instrument deleted' });
});

// POST /instruments/:id/verify - Penny validation
router.post('/instruments/:id/verify', (req: Request, res: Response) => {
  const instrument = instruments.find(i => i.id === req.params.id);
  if (!instrument) {
    return res.status(404).json({ success: false, error: 'Instrument not found' });
  }
  instrument.verificationStatus = 'verified';
  res.json({
    success: true,
    data: {
      instrumentId: instrument.id,
      verificationStatus: 'verified',
      verifiedAt: new Date().toISOString(),
      pennyAmount: 0.01
    }
  });
});

// GET /accounts/:id/balance - Get account balance
router.get('/accounts/:id/balance', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      accountId: req.params.id,
      availableBalance: 500000.00,
      currentBalance: 500000.00,
      currency: 'MXN',
      lastUpdated: new Date().toISOString()
    }
  });
});

// POST /transfers - Create transfer
router.post('/transfers', (req: Request, res: Response) => {
  const { amount, concept, instrumentId, externalReference } = req.body;
  transferCounter++;
  const transfer = {
    id: `txn-${transferCounter}`,
    amount: amount || 0,
    concept: concept || 'Mock transfer',
    instrumentId: instrumentId || 'instr-001',
    externalReference: externalReference || String(transferCounter),
    status: 'completed',
    cepUrl: `https://mock-cep.example.com/cep/${transferCounter}`,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString()
  };
  transfers.push(transfer);
  res.status(201).json({ success: true, data: transfer });
});

// GET /transfers/:id - Get transfer status
router.get('/transfers/:id', (req: Request, res: Response) => {
  const transfer = transfers.find(t => t.id === req.params.id);
  if (!transfer) {
    // Return a mock completed transfer for any ID
    return res.json({
      success: true,
      data: {
        id: req.params.id,
        status: 'completed',
        amount: 1000.00,
        concept: 'Mock transfer',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      }
    });
  }
  res.json({ success: true, data: transfer });
});

// POST /webhooks/simulate - Simulate incoming webhook (CEP notification)
router.post('/webhooks/simulate', (req: Request, res: Response) => {
  const { transferId, status } = req.body;
  res.json({
    success: true,
    message: 'Webhook simulated',
    data: {
      event: 'transfer.status_updated',
      transferId: transferId || `txn-${transferCounter}`,
      status: status || 'completed',
      timestamp: new Date().toISOString()
    }
  });
});

export default router;
