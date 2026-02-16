/**
 * Money Out Form Component
 * Integrado con el diseño existente de LenderoHUB
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { transfersService } from '@/services/transfers.service';
import { beneficiariesService } from '@/services/beneficiaries.service';
import { accountsService } from '@/services/accounts.service';
import type { Beneficiary } from '@/services/beneficiaries.service';
import type { TransferSourceAccount } from '@/types/api.types';

// ============================================
// Types
// ============================================
interface MoneyOutFormProps {
  onSuccess?: (transaction: any) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}

interface FormData {
  fromAccountId: string;
  beneficiaryId: string;
  amount: string;
  description: string;
  externalReference: string;
  beneficiaryEmail: string;
}

interface FormErrors {
  fromAccountId?: string;
  beneficiaryId?: string;
  amount?: string;
  description?: string;
  externalReference?: string;
  beneficiaryEmail?: string;
  general?: string;
}

// ============================================
// Component
// ============================================
export function MoneyOutForm({ onSuccess, onError, onCancel }: MoneyOutFormProps) {
  // State
  const [formData, setFormData] = useState<FormData>({
    fromAccountId: '',
    beneficiaryId: '',
    amount: '',
    description: '',
    externalReference: '',
    beneficiaryEmail: '',
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [sourceAccounts, setSourceAccounts] = useState<TransferSourceAccount[]>([]);
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
  const [selectedSourceAccount, setSelectedSourceAccount] = useState<TransferSourceAccount | null>(null);

  const concentrationAccounts = useMemo(
    () => sourceAccounts.filter((account) => account.type === 'concentration'),
    [sourceAccounts]
  );

  const subaccountAccounts = useMemo(
    () => sourceAccounts.filter((account) => account.type === 'subaccount'),
    [sourceAccounts]
  );

  const virtualBagAccounts = useMemo(
    () => sourceAccounts.filter((account) => account.type === 'virtualBag'),
    [sourceAccounts]
  );

  const sourceClabes = useMemo(() => {
    const clabes = sourceAccounts
      .map((account) => account.clabeNumber)
      .filter((clabe): clabe is string => Boolean(clabe));
    return new Set(clabes);
  }, [sourceAccounts]);

  const filteredBeneficiaries = useMemo(
    () =>
      beneficiaries.filter((beneficiary) => {
        const clabe = beneficiary.clabe || beneficiary.clabeNumber;
        if (!clabe) return false;
        return !sourceClabes.has(clabe);
      }),
    [beneficiaries, sourceClabes]
  );

  useEffect(() => {
    if (!selectedBeneficiary) return;
    const clabe = selectedBeneficiary.clabe || selectedBeneficiary.clabeNumber;
    if (clabe && sourceClabes.has(clabe)) {
      setSelectedBeneficiary(null);
      setFormData((prev) => ({ ...prev, beneficiaryId: '' }));
    }
  }, [selectedBeneficiary, sourceClabes]);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // ============================================
  // Data Loading
  // ============================================
  const loadInitialData = async () => {
    try {
      setLoadingData(true);
      
      const [beneficiariesData, sources] = await Promise.all([
        beneficiariesService.getBeneficiaries(),
        accountsService.getTransferSources(),
      ]);

      // Filter only active beneficiaries
      const activeBeneficiaries = beneficiariesData.filter(
        b => b.status === 'ACTIVE'
      );
      
      const defaultSource = sources[0] || null;
      setBeneficiaries(activeBeneficiaries);
      setSourceAccounts(sources);
      setSelectedSourceAccount(defaultSource);
      setAvailableBalance(defaultSource?.balance || 0);
      setFormData((prev) => ({
        ...prev,
        fromAccountId: defaultSource?.id || '',
      }));
    } catch (error) {
      console.error('Error loading initial data:', error);
      setErrors({ general: 'Error al cargar datos iniciales' });
    } finally {
      setLoadingData(false);
    }
  };

  // ============================================
  // Validation
  // ============================================
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.fromAccountId) {
      newErrors.fromAccountId = 'Selecciona una cuenta origen';
    }

    if (!formData.beneficiaryId) {
      newErrors.beneficiaryId = 'Selecciona un beneficiario';
    }

    const amount = parseFloat(formData.amount);
    if (!formData.amount || isNaN(amount)) {
      newErrors.amount = 'Ingresa un monto válido';
    } else if (amount <= 0) {
      newErrors.amount = 'El monto debe ser mayor a 0';
    } else if (amount > availableBalance) {
      newErrors.amount = 'Saldo insuficiente';
    } else if (amount < 1) {
      newErrors.amount = 'El monto mínimo es $1.00 MXN';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Ingresa una descripción';
    } else if (formData.description.length > 40) {
      newErrors.description = 'Máximo 40 caracteres';
    } else if (!/^[a-zA-Z0-9\sñÑ]+$/.test(formData.description)) {
      newErrors.description = 'Solo letras, números y espacios';
    }

    if (formData.externalReference) {
      if (!/^\d+$/.test(formData.externalReference)) {
        newErrors.general = 'La referencia debe ser numérica';
      } else if (formData.externalReference.length > 7) {
        newErrors.general = 'La referencia debe tener máximo 7 dígitos';
      }
    }

    if (formData.beneficiaryEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.beneficiaryEmail)) {
        newErrors.beneficiaryEmail = 'Ingresa un correo válido';
      }
    }

    const beneficiaryClabe = selectedBeneficiary?.clabe || selectedBeneficiary?.clabeNumber;
    const sourceClabe = selectedSourceAccount?.clabeNumber;
    if (beneficiaryClabe && sourceClabe && beneficiaryClabe === sourceClabe) {
      newErrors.beneficiaryId = 'No puedes transferir a la misma cuenta ordenante';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ============================================
  // Handlers
  // ============================================
  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    if (field === 'beneficiaryId') {
      const beneficiary = filteredBeneficiaries.find(b => b.id === value);
      setSelectedBeneficiary(beneficiary || null);
    }

    if (field === 'fromAccountId') {
      const source = sourceAccounts.find((account) => account.id === value) || null;
      setSelectedSourceAccount(source);
      setAvailableBalance(source?.balance || 0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setErrors({});

      const response = await transfersService.moneyOut({
        beneficiaryId: formData.beneficiaryId,
        amount: parseFloat(formData.amount),
        description: formData.description,
        externalReference: formData.externalReference || undefined,
        fromAccountId: formData.fromAccountId || undefined,
        beneficiaryEmail: formData.beneficiaryEmail || undefined,
      });

      onSuccess?.(response);

      // Reset form
      setFormData({
        fromAccountId: formData.fromAccountId,
        beneficiaryId: '',
        amount: '',
        description: '',
        externalReference: '',
        beneficiaryEmail: '',
      });
      setSelectedBeneficiary(null);

    } catch (error: any) {
      console.error('Error sending transfer:', error);
      const errorMessage = error.message || 'Error al enviar transferencia';
      setErrors({ general: errorMessage });
      onError?.(error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Render Loading
  // ============================================
  if (loadingData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (sourceAccounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nueva Transferencia</CardTitle>
          <CardDescription>
            No hay cuentas disponibles para enviar transferencias.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="secondary">Sin cuentas origen</Badge>
        </CardContent>
      </Card>
    );
  }

  // ============================================
  // Render No Beneficiaries
  // ============================================
  if (filteredBeneficiaries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nueva Transferencia</CardTitle>
          <CardDescription>
            Necesitas agregar beneficiarios válidos antes de hacer transferencias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => window.location.href = '/beneficiarios'}>
            Agregar Beneficiario
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ============================================
  // Render Form
  // ============================================
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva Transferencia SPEI</CardTitle>
        <CardDescription>
          Envía dinero a cuentas bancarias en México
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* General Error */}
          {errors.general && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{errors.general}</p>
            </div>
          )}

          {/* Source Account */}
          <div>
            <label htmlFor="source-account" className="block text-sm font-medium mb-2 text-foreground">
              Cuenta origen *
            </label>
            <select
              id="source-account"
              value={formData.fromAccountId}
              onChange={(e) => handleInputChange('fromAccountId', e.target.value)}
              className={`w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                errors.fromAccountId ? 'border-destructive' : 'border-border'
              }`}
              disabled={loading || sourceAccounts.length === 0}
            >
              <option value="">Selecciona cuenta origen</option>
              {concentrationAccounts.length > 0 && (
                <optgroup label="Concentradora">
                  {concentrationAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · ${account.balance.toLocaleString('es-MX')}
                    </option>
                  ))}
                </optgroup>
              )}
              {subaccountAccounts.length > 0 && (
                <optgroup label="Subcuentas Finco">
                  {subaccountAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · ${account.balance.toLocaleString('es-MX')}
                    </option>
                  ))}
                </optgroup>
              )}
              {virtualBagAccounts.length > 0 && (
                <optgroup label="Bolsas virtuales">
                  {virtualBagAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · ${account.balance.toLocaleString('es-MX')}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {errors.fromAccountId && (
              <p className="text-sm text-destructive mt-1">{errors.fromAccountId}</p>
            )}
          </div>

          {/* Available Balance */}
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-sm text-muted-foreground mb-1">Saldo disponible</p>
            <p className="text-2xl font-bold text-primary">
              ${availableBalance.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
            </p>
            {selectedSourceAccount?.type === 'virtualBag' && (
              <p className="text-xs text-muted-foreground mt-1">
                Envio desde bolsa virtual: {selectedSourceAccount.name}
              </p>
            )}
            {selectedSourceAccount?.type === 'subaccount' && (
              <p className="text-xs text-muted-foreground mt-1">
                Envio desde subcuenta Finco: {selectedSourceAccount.name}
              </p>
            )}
          </div>

          {/* Beneficiary Select */}
          <div>
            <label htmlFor="beneficiary" className="block text-sm font-medium mb-2 text-foreground">
              Beneficiario *
            </label>
            <select
              id="beneficiary"
              value={formData.beneficiaryId}
              onChange={(e) => handleInputChange('beneficiaryId', e.target.value)}
              className={`w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                errors.beneficiaryId ? 'border-destructive' : 'border-border'
              }`}
              disabled={loading}
            >
              <option value="">Selecciona un beneficiario</option>
              {filteredBeneficiaries.map((beneficiary) => (
                <option key={beneficiary.id} value={beneficiary.id}>
                  {beneficiary.name} - {beneficiary.clabe || beneficiary.clabeNumber}
                </option>
              ))}
            </select>
            {errors.beneficiaryId && (
              <p className="text-sm text-destructive mt-1">{errors.beneficiaryId}</p>
            )}
            {selectedBeneficiary && (
              <div className="mt-2 p-2 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-sm text-muted-foreground">
                  {selectedBeneficiary.bank} • RFC: {selectedBeneficiary.rfc}
                </p>
              </div>
            )}
          </div>

          {/* Amount Input */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium mb-2 text-foreground">
              Monto (MXN) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-muted-foreground">$</span>
              <input
                type="number"
                id="amount"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                className={`w-full pl-8 pr-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  errors.amount ? 'border-destructive' : 'border-border'
                }`}
                placeholder="0.00"
                step="0.01"
                min="0"
                disabled={loading}
              />
            </div>
            {errors.amount && (
              <p className="text-sm text-destructive mt-1">{errors.amount}</p>
            )}
          </div>

          {/* Description Input */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2 text-foreground">
              Descripción / Concepto * (máx. 40 caracteres)
            </label>
            <input
              type="text"
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className={`w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                errors.description ? 'border-destructive' : 'border-border'
              }`}
              placeholder="Ej: Pago de servicios"
              maxLength={40}
              disabled={loading}
            />
            <div className="flex justify-between mt-1">
              {errors.description ? (
                <p className="text-sm text-destructive">{errors.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Solo letras, números y espacios (ñ/Ñ permitidos)
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {formData.description.length}/40
              </p>
            </div>
          </div>

          {/* External Reference (Optional) */}
          <div>
            <label htmlFor="reference" className="block text-sm font-medium mb-2 text-foreground">
              Referencia Externa (opcional, máx. 7 dígitos)
            </label>
            <input
              type="text"
              id="reference"
              value={formData.externalReference}
              onChange={(e) => handleInputChange('externalReference', e.target.value)}
              className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="1234567"
              maxLength={7}
              disabled={loading}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Si no se proporciona, se generará automáticamente
            </p>
          </div>

          {/* Beneficiary Email */}
          <div>
            <label htmlFor="beneficiary-email" className="block text-sm font-medium mb-2 text-foreground">
              Correo del beneficiario (opcional)
            </label>
            <input
              type="email"
              id="beneficiary-email"
              value={formData.beneficiaryEmail}
              onChange={(e) => handleInputChange('beneficiaryEmail', e.target.value)}
              className={`w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                errors.beneficiaryEmail ? 'border-destructive' : 'border-border'
              }`}
              placeholder="beneficiario@empresa.com"
              disabled={loading}
            />
            {errors.beneficiaryEmail ? (
              <p className="text-sm text-destructive mt-1">{errors.beneficiaryEmail}</p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                Este correo recibira la notificacion de la transferencia
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
                className="flex-1"
              >
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              disabled={loading || loadingData}
              className="flex-1 gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar Transferencia
                </>
              )}
            </Button>
          </div>

          {/* Security Note */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
            <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Transferencia segura</p>
              <p>Esta operación usa idempotencia para prevenir duplicados</p>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
