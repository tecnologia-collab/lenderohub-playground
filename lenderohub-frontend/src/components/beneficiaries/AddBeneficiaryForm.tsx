/**
 * Add Beneficiary Form Component
 * Integrado con el diseño existente de LenderoHUB
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2, CheckCircle2, User, Building2 } from 'lucide-react';
import { beneficiariesService } from '@/services/beneficiaries.service';
import type { CreateBeneficiaryRequest } from '@/services/beneficiaries.service';

// ============================================
// Types
// ============================================
interface AddBeneficiaryFormProps {
  onSuccess?: (beneficiary: any) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}

interface FormData {
  alias: string;
  name: string;
  clabe: string;
  rfc: string;
  type: 'person' | 'company';
}

interface FormErrors {
  alias?: string;
  name?: string;
  clabe?: string;
  rfc?: string;
  type?: string;
  general?: string;
}

// ============================================
// Component
// ============================================
export function AddBeneficiaryForm({ onSuccess, onError, onCancel }: AddBeneficiaryFormProps) {
  const [formData, setFormData] = useState<FormData>({
    alias: '',
    name: '',
    clabe: '',
    rfc: '',
    type: 'person',
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.alias.trim()) {
      newErrors.alias = 'El alias es requerido';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.clabe) {
      newErrors.clabe = 'La CLABE es requerida';
    } else if (!/^\d{18}$/.test(formData.clabe)) {
      newErrors.clabe = 'La CLABE debe tener exactamente 18 dígitos';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleClabeChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 18);
    handleInputChange('clabe', cleaned);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);
      setErrors({});

      const request: CreateBeneficiaryRequest = {
        alias: formData.alias,
        name: formData.name,
        clabe: formData.clabe,
        rfc: formData.rfc || undefined,
      };

      const beneficiary = await beneficiariesService.createBeneficiary(request);
      onSuccess?.(beneficiary);

      setFormData({
        alias: '',
        name: '',
        clabe: '',
        rfc: '',
        type: 'person',
      });

    } catch (error: any) {
      console.error('Error creating beneficiary:', error);
      const errorMessage = error.message || 'Error al crear beneficiario';
      setErrors({ general: errorMessage });
      onError?.(error);
    } finally {
      setLoading(false);
    }
  };

  const detectedBank = formData.clabe.length >= 3 
    ? beneficiariesService.getBankFromClabe(formData.clabe)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agregar Beneficiario</CardTitle>
        <CardDescription>
          Registra una cuenta destino para tus transferencias SPEI
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.general && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{errors.general}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">
              Tipo de Beneficiario *
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleInputChange('type', 'person')}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                  formData.type === 'person'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted/30'
                }`}
              >
                <User size={18} />
                <span className="font-medium">Persona</span>
              </button>
              <button
                type="button"
                onClick={() => handleInputChange('type', 'company')}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                  formData.type === 'company'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted/30'
                }`}
              >
                <Building2 size={18} />
                <span className="font-medium">Empresa</span>
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="alias" className="block text-sm font-medium mb-2 text-foreground">
              Alias / Nombre corto *
            </label>
            <input
              type="text"
              id="alias"
              value={formData.alias}
              onChange={(e) => handleInputChange('alias', e.target.value)}
              className={`w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                errors.alias ? 'border-destructive' : 'border-border'
              }`}
              placeholder="Ej: Proveedor ABC"
              disabled={loading}
            />
            {errors.alias && (
              <p className="text-sm text-destructive mt-1">{errors.alias}</p>
            )}
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2 text-foreground">
              Nombre completo / Razón social *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                errors.name ? 'border-destructive' : 'border-border'
              }`}
              placeholder={formData.type === 'company' ? 'Ej: Proveedor ABC S.A. de C.V.' : 'Ej: Juan Pérez García'}
              disabled={loading}
            />
            {errors.name && (
              <p className="text-sm text-destructive mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="clabe" className="block text-sm font-medium mb-2 text-foreground">
              CLABE interbancaria *
            </label>
            <input
              type="text"
              id="clabe"
              value={formData.clabe}
              onChange={(e) => handleClabeChange(e.target.value)}
              className={`w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                errors.clabe ? 'border-destructive' : 'border-border'
              }`}
              placeholder="012180012345678901"
              maxLength={18}
              disabled={loading}
            />
            <div className="flex justify-between mt-1">
              {errors.clabe ? (
                <p className="text-sm text-destructive">{errors.clabe}</p>
              ) : detectedBank ? (
                <p className="text-sm text-success">
                  ✓ Banco detectado: {detectedBank}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">18 dígitos</p>
              )}
              <p className="text-sm text-muted-foreground">
                {formData.clabe.length}/18
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="rfc" className="block text-sm font-medium mb-2 text-foreground">
              RFC (opcional)
            </label>
            <input
              type="text"
              id="rfc"
              value={formData.rfc}
              onChange={(e) => handleInputChange('rfc', e.target.value.toUpperCase())}
              className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-lg text-foreground font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="ABC123456XYZ"
              maxLength={13}
              disabled={loading}
            />
          </div>

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
              disabled={loading}
              className="flex-1 gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Agregar Beneficiario
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
