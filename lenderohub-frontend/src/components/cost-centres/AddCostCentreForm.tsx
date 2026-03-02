/**
 * Add Cost Centre Form Component
 * Integrado con el diseño existente de LenderoHUB
 * Incluye todos los campos de LenderoPay: datos de contacto, fiscales, etc.
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2, CheckCircle2, Layers, Info, User, Building, ChevronDown, ChevronUp } from 'lucide-react';
import { costCentresService, CostCentre, CreateCostCentreRequest } from '@/services/costCentres.service';
import { ApiError } from '@/lib/api';

// ============================================
// Types
// ============================================
interface AddCostCentreFormProps {
  onSuccess?: (costCentre: CostCentre) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}

interface FormData {
  // Identificación básica
  alias: string;
  shortName: string;
  createFincoCustomer: boolean;

  // Datos de contacto
  contactName: string;
  contactLastname: string;
  contactSecondLastname: string;
  contactEmail: string;
  contactPhoneNumber: string;
  contactPhoneNumber2: string;

  // Datos fiscales
  rfc: string;
  fiscalStreet: string;
  fiscalExteriorNumber: string;
  fiscalInteriorNumber: string;
  fiscalNeighborhood: string;
  fiscalCity: string;
  fiscalState: string;
  fiscalPostalCode: string;

  // Perfil de transacciones
  transactionProfile: {
    limitIn: string;
    opsIn: string;
    limitOut: string;
    opsOut: string;
  };
}

interface FormErrors {
  alias?: string;
  shortName?: string;
  contactName?: string;
  contactLastname?: string;
  contactEmail?: string;
  contactPhoneNumber?: string;
  rfc?: string;
  fiscalStreet?: string;
  fiscalPostalCode?: string;
  limitIn?: string;
  opsIn?: string;
  limitOut?: string;
  opsOut?: string;
  general?: string;
}

// Estados de México para el select
const MEXICAN_STATES = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas',
  'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México',
  'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit',
  'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí',
  'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'
];

// ============================================
// Component
// ============================================
export function AddCostCentreForm({ onSuccess, onError, onCancel }: AddCostCentreFormProps) {
  const [formData, setFormData] = useState<FormData>({
    // Identificación básica
    alias: '',
    shortName: '',
    createFincoCustomer: true,

    // Datos de contacto
    contactName: '',
    contactLastname: '',
    contactSecondLastname: '',
    contactEmail: '',
    contactPhoneNumber: '',
    contactPhoneNumber2: '',

    // Datos fiscales
    rfc: '',
    fiscalStreet: '',
    fiscalExteriorNumber: '',
    fiscalInteriorNumber: '',
    fiscalNeighborhood: '',
    fiscalCity: '',
    fiscalState: '',
    fiscalPostalCode: '',

    // Perfil de transacciones
    transactionProfile: {
      limitIn: '1000000',
      opsIn: '100',
      limitOut: '1000000',
      opsOut: '100',
    },
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [showContactData, setShowContactData] = useState(true);
  const [showFiscalData, setShowFiscalData] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [constanciaFile, setConstanciaFile] = useState<File | null>(null);
  const [constanciaLoading, setConstanciaLoading] = useState(false);
  const [constanciaError, setConstanciaError] = useState<string | null>(null);
  const [constanciaSuccess, setConstanciaSuccess] = useState(false);

  const handleConstanciaUpload = async (file: File) => {
    setConstanciaFile(file);
    setConstanciaError(null);
    setConstanciaSuccess(false);
    setConstanciaLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const result = await costCentresService.parseConstancia(form);
      const d = result.data;
      setFormData(prev => ({
        ...prev,
        rfc: d.rfc || prev.rfc,
        contactName: d.contactName || prev.contactName,
        contactLastname: d.contactLastname || prev.contactLastname,
        contactSecondLastname: d.contactSecondLastname || prev.contactSecondLastname,
        fiscalStreet: d.fiscalStreet || prev.fiscalStreet,
        fiscalExteriorNumber: d.fiscalExteriorNumber || prev.fiscalExteriorNumber,
        fiscalNeighborhood: d.fiscalNeighborhood || prev.fiscalNeighborhood,
        fiscalCity: d.fiscalCity || prev.fiscalCity,
        fiscalState: d.fiscalState || prev.fiscalState,
        fiscalPostalCode: d.fiscalPostalCode || prev.fiscalPostalCode,
      }));
      setShowContactData(true);
      setShowFiscalData(true);
      setConstanciaSuccess(true);
    } catch (err: any) {
      setConstanciaError(err.message || 'Error al procesar el PDF');
    } finally {
      setConstanciaLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validación básica
    if (!formData.alias.trim()) {
      newErrors.alias = 'El nombre es requerido';
    } else if (formData.alias.length < 3) {
      newErrors.alias = 'El nombre debe tener al menos 3 caracteres';
    }

    if (!formData.shortName.trim()) {
      newErrors.shortName = 'El nombre corto es requerido';
    } else if (formData.shortName.length < 2) {
      newErrors.shortName = 'El nombre corto debe tener al menos 2 caracteres';
    } else if (formData.shortName.length > 10) {
      newErrors.shortName = 'El nombre corto no puede exceder 10 caracteres';
    }

    // Validación de datos de contacto
    if (!formData.contactName.trim()) {
      newErrors.contactName = 'El nombre del contacto es requerido';
    }

    if (!formData.contactLastname.trim()) {
      newErrors.contactLastname = 'El apellido paterno es requerido';
    }

    if (!formData.contactEmail.trim()) {
      newErrors.contactEmail = 'El correo electrónico es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      newErrors.contactEmail = 'El correo electrónico no es válido';
    }

    if (!formData.contactPhoneNumber.trim()) {
      newErrors.contactPhoneNumber = 'El teléfono principal es requerido';
    } else if (!/^\d{10}$/.test(formData.contactPhoneNumber)) {
      newErrors.contactPhoneNumber = 'El teléfono debe tener 10 dígitos';
    }

    // Validación de RFC (opcional pero si se ingresa debe ser válido)
    if (formData.rfc.trim()) {
      const rfcPattern = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
      if (!rfcPattern.test(formData.rfc.toUpperCase())) {
        newErrors.rfc = 'RFC inválido. 12 caracteres para persona moral, 13 para física';
      }
    }

    // Validación de código postal (opcional pero si se ingresa debe ser válido)
    if (formData.fiscalPostalCode.trim() && !/^\d{5}$/.test(formData.fiscalPostalCode)) {
      newErrors.fiscalPostalCode = 'El código postal debe tener 5 dígitos';
    }

    // Validación de perfil de transacciones (solo si está abierto)
    if (showAdvanced) {
      const limitIn = parseFloat(formData.transactionProfile.limitIn);
      const opsIn = parseInt(formData.transactionProfile.opsIn);
      const limitOut = parseFloat(formData.transactionProfile.limitOut);
      const opsOut = parseInt(formData.transactionProfile.opsOut);

      if (isNaN(limitIn) || limitIn <= 0) {
        newErrors.limitIn = 'Ingresa un límite válido';
      }
      if (isNaN(opsIn) || opsIn <= 0) {
        newErrors.opsIn = 'Ingresa un número válido de operaciones';
      }
      if (isNaN(limitOut) || limitOut <= 0) {
        newErrors.limitOut = 'Ingresa un límite válido';
      }
      if (isNaN(opsOut) || opsOut <= 0) {
        newErrors.opsOut = 'Ingresa un número válido de operaciones';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field as keyof FormErrors];
        return newErrors;
      });
    }
  };

  const handleProfileChange = (field: keyof FormData['transactionProfile'], value: string) => {
    setFormData(prev => ({
      ...prev,
      transactionProfile: {
        ...prev.transactionProfile,
        [field]: value,
      },
    }));
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field as keyof FormErrors];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);
      setErrors({});

      const request: CreateCostCentreRequest = {
        alias: formData.alias,
        shortName: formData.shortName,
        provider: 'finco',
        createFincoCustomer: formData.createFincoCustomer,

        // Datos de contacto
        contact: {
          name: formData.contactName,
          lastname: formData.contactLastname,
          secondLastname: formData.contactSecondLastname || undefined,
          email: formData.contactEmail,
          phoneNumber: formData.contactPhoneNumber,
          phoneNumber2: formData.contactPhoneNumber2 || undefined,
        },

        // Datos fiscales
        rfc: formData.rfc || undefined,
        fiscalAddress: {
          street: formData.fiscalStreet || undefined,
          exteriorNumber: formData.fiscalExteriorNumber || undefined,
          interiorNumber: formData.fiscalInteriorNumber || undefined,
          neighborhood: formData.fiscalNeighborhood || undefined,
          city: formData.fiscalCity || undefined,
          state: formData.fiscalState || undefined,
          postalCode: formData.fiscalPostalCode || undefined,
        },
      };

      if (showAdvanced) {
        request.transactionProfile = {
          limitIn: parseFloat(formData.transactionProfile.limitIn) * 100, // Convert to cents
          opsIn: parseInt(formData.transactionProfile.opsIn),
          limitOut: parseFloat(formData.transactionProfile.limitOut) * 100,
          opsOut: parseInt(formData.transactionProfile.opsOut),
        };
      }

      const costCentre = await costCentresService.createCostCentre(request);
      onSuccess?.(costCentre);

      // Reset form
      setFormData({
        alias: '',
        shortName: '',
        createFincoCustomer: true,
        contactName: '',
        contactLastname: '',
        contactSecondLastname: '',
        contactEmail: '',
        contactPhoneNumber: '',
        contactPhoneNumber2: '',
        rfc: '',
        fiscalStreet: '',
        fiscalExteriorNumber: '',
        fiscalInteriorNumber: '',
        fiscalNeighborhood: '',
        fiscalCity: '',
        fiscalState: '',
        fiscalPostalCode: '',
        transactionProfile: {
          limitIn: '1000000',
          opsIn: '100',
          limitOut: '1000000',
          opsOut: '100',
        },
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof ApiError
        ? error.message
        : (error instanceof Error ? error.message : 'Error al crear centro de costos');
      console.error('Error creating cost centre:', errorMessage);
      setErrors({ general: errorMessage });
      if (error instanceof Error) {
        onError?.(error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Nuevo Centro de Costos
        </CardTitle>
        <CardDescription>
          Crea un nuevo centro de costos para organizar tus operaciones financieras
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {errors.general && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{errors.general}</p>
            </div>
          )}

          {/* ========================================
              SECCIÓN: Información Básica
          ======================================== */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Información Básica</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="alias" className="block text-sm font-medium mb-2 text-foreground">
                  Nombre del Centro de Costos <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  id="alias"
                  value={formData.alias}
                  onChange={(e) => handleInputChange('alias', e.target.value)}
                  className={`w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                    errors.alias ? 'border-destructive' : 'border-border'
                  }`}
                  placeholder="Ej: Operaciones CDMX"
                  disabled={loading}
                />
                {errors.alias && (
                  <p className="text-sm text-destructive mt-1">{errors.alias}</p>
                )}
              </div>

              <div>
                <label htmlFor="shortName" className="block text-sm font-medium mb-2 text-foreground">
                  Nombre Corto <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  id="shortName"
                  value={formData.shortName}
                  onChange={(e) => handleInputChange('shortName', e.target.value.toUpperCase())}
                  className={`w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                    errors.shortName ? 'border-destructive' : 'border-border'
                  }`}
                  placeholder="Ej: OPCDMX"
                  maxLength={10}
                  disabled={loading}
                />
                <div className="flex justify-between mt-1">
                  {errors.shortName ? (
                    <p className="text-sm text-destructive">{errors.shortName}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Identificador único (2-10 caracteres)</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {formData.shortName.length}/10
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================
              SECCIÓN: Datos de Contacto
          ======================================== */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowContactData(!showContactData)}
              className="flex items-center gap-2 text-sm font-semibold text-foreground border-b pb-2 w-full"
            >
              <User className="h-4 w-4" />
              Datos de Contacto
              {showContactData ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
            </button>

            {showContactData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contactName" className="block text-sm font-medium mb-2 text-foreground">
                    Nombre(s) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    id="contactName"
                    value={formData.contactName}
                    onChange={(e) => handleInputChange('contactName', e.target.value)}
                    className={`w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                      errors.contactName ? 'border-destructive' : 'border-border'
                    }`}
                    placeholder="Juan Carlos"
                    disabled={loading}
                  />
                  {errors.contactName && (
                    <p className="text-sm text-destructive mt-1">{errors.contactName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="contactLastname" className="block text-sm font-medium mb-2 text-foreground">
                    Apellido Paterno <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    id="contactLastname"
                    value={formData.contactLastname}
                    onChange={(e) => handleInputChange('contactLastname', e.target.value)}
                    className={`w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                      errors.contactLastname ? 'border-destructive' : 'border-border'
                    }`}
                    placeholder="García"
                    disabled={loading}
                  />
                  {errors.contactLastname && (
                    <p className="text-sm text-destructive mt-1">{errors.contactLastname}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="contactSecondLastname" className="block text-sm font-medium mb-2 text-foreground">
                    Apellido Materno
                  </label>
                  <input
                    type="text"
                    id="contactSecondLastname"
                    value={formData.contactSecondLastname}
                    onChange={(e) => handleInputChange('contactSecondLastname', e.target.value)}
                    className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="López"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="contactEmail" className="block text-sm font-medium mb-2 text-foreground">
                    Correo Electrónico <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="email"
                    id="contactEmail"
                    value={formData.contactEmail}
                    onChange={(e) => handleInputChange('contactEmail', e.target.value.toLowerCase())}
                    className={`w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                      errors.contactEmail ? 'border-destructive' : 'border-border'
                    }`}
                    placeholder="contacto@empresa.com"
                    disabled={loading}
                  />
                  {errors.contactEmail && (
                    <p className="text-sm text-destructive mt-1">{errors.contactEmail}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="contactPhoneNumber" className="block text-sm font-medium mb-2 text-foreground">
                    Teléfono Principal <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="tel"
                    id="contactPhoneNumber"
                    value={formData.contactPhoneNumber}
                    onChange={(e) => handleInputChange('contactPhoneNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className={`w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                      errors.contactPhoneNumber ? 'border-destructive' : 'border-border'
                    }`}
                    placeholder="5512345678"
                    disabled={loading}
                  />
                  {errors.contactPhoneNumber ? (
                    <p className="text-sm text-destructive mt-1">{errors.contactPhoneNumber}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">10 dígitos, sin espacios</p>
                  )}
                </div>

                <div>
                  <label htmlFor="contactPhoneNumber2" className="block text-sm font-medium mb-2 text-foreground">
                    Teléfono Adicional
                  </label>
                  <input
                    type="tel"
                    id="contactPhoneNumber2"
                    value={formData.contactPhoneNumber2}
                    onChange={(e) => handleInputChange('contactPhoneNumber2', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="5587654321"
                    disabled={loading}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ========================================
              SECCIÓN: Datos Fiscales
          ======================================== */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowFiscalData(!showFiscalData)}
              className="flex items-center gap-2 text-sm font-semibold text-foreground border-b pb-2 w-full"
            >
              <Building className="h-4 w-4" />
              Datos Fiscales
              {showFiscalData ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
            </button>

            {showFiscalData && (
              <>
              {/* Upload CSF */}
              <div className={`flex items-center gap-3 p-3 rounded-lg border-2 border-dashed transition-colors ${constanciaLoading ? 'border-primary/40 bg-primary/5' : constanciaSuccess ? 'border-emerald-400/60 bg-emerald-500/5' : 'border-border hover:border-primary/30'}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${constanciaSuccess ? 'bg-emerald-500/10' : 'bg-muted'}`}>
                  {constanciaLoading ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  ) : constanciaSuccess ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {constanciaLoading ? (
                    <p className="text-sm font-medium text-primary">Leyendo constancia…</p>
                  ) : constanciaSuccess ? (
                    <>
                      <p className="text-sm font-medium text-emerald-700">Datos extraídos correctamente</p>
                      <p className="text-xs text-muted-foreground truncate">{constanciaFile?.name}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">Constancia de Situación Fiscal</p>
                      <p className="text-xs text-muted-foreground">Sube el PDF del SAT para auto-rellenar</p>
                    </>
                  )}
                  {constanciaError && <p className="text-xs text-destructive mt-0.5">{constanciaError}</p>}
                </div>
                <label htmlFor="constancia-upload" className={constanciaLoading ? 'pointer-events-none' : 'cursor-pointer'}>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${constanciaSuccess ? 'bg-muted text-muted-foreground hover:bg-muted/80' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
                    {constanciaSuccess ? 'Cambiar' : 'Adjuntar'}
                  </span>
                  <input id="constancia-upload" type="file" accept="application/pdf" className="hidden" disabled={constanciaLoading} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleConstanciaUpload(f); e.target.value = ''; }} />
                </label>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label htmlFor="rfc" className="block text-sm font-medium mb-2 text-foreground">
                      RFC
                    </label>
                    <input
                      type="text"
                      id="rfc"
                      value={formData.rfc}
                      onChange={(e) => handleInputChange('rfc', e.target.value.toUpperCase())}
                      className={`w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground uppercase focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                        errors.rfc ? 'border-destructive' : 'border-border'
                      }`}
                      placeholder="XAXX010101000"
                      maxLength={13}
                      disabled={loading}
                    />
                    {errors.rfc ? (
                      <p className="text-sm text-destructive mt-1">{errors.rfc}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">12 caracteres para persona moral, 13 para física</p>
                    )}
                  </div>
                </div>

                <h4 className="text-sm font-medium text-muted-foreground">Domicilio Fiscal</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label htmlFor="fiscalStreet" className="block text-sm font-medium mb-2 text-foreground">
                      Calle
                    </label>
                    <input
                      type="text"
                      id="fiscalStreet"
                      value={formData.fiscalStreet}
                      onChange={(e) => handleInputChange('fiscalStreet', e.target.value)}
                      className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Av. Reforma"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label htmlFor="fiscalExteriorNumber" className="block text-sm font-medium mb-2 text-foreground">
                      Número Exterior
                    </label>
                    <input
                      type="text"
                      id="fiscalExteriorNumber"
                      value={formData.fiscalExteriorNumber}
                      onChange={(e) => handleInputChange('fiscalExteriorNumber', e.target.value)}
                      className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="123"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label htmlFor="fiscalInteriorNumber" className="block text-sm font-medium mb-2 text-foreground">
                      Número Interior
                    </label>
                    <input
                      type="text"
                      id="fiscalInteriorNumber"
                      value={formData.fiscalInteriorNumber}
                      onChange={(e) => handleInputChange('fiscalInteriorNumber', e.target.value)}
                      className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Piso 5, Oficina 501"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label htmlFor="fiscalNeighborhood" className="block text-sm font-medium mb-2 text-foreground">
                      Colonia
                    </label>
                    <input
                      type="text"
                      id="fiscalNeighborhood"
                      value={formData.fiscalNeighborhood}
                      onChange={(e) => handleInputChange('fiscalNeighborhood', e.target.value)}
                      className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Juárez"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label htmlFor="fiscalPostalCode" className="block text-sm font-medium mb-2 text-foreground">
                      Código Postal
                    </label>
                    <input
                      type="text"
                      id="fiscalPostalCode"
                      value={formData.fiscalPostalCode}
                      onChange={(e) => handleInputChange('fiscalPostalCode', e.target.value.replace(/\D/g, '').slice(0, 5))}
                      className={`w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                        errors.fiscalPostalCode ? 'border-destructive' : 'border-border'
                      }`}
                      placeholder="06600"
                      disabled={loading}
                    />
                    {errors.fiscalPostalCode && (
                      <p className="text-sm text-destructive mt-1">{errors.fiscalPostalCode}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="fiscalCity" className="block text-sm font-medium mb-2 text-foreground">
                      Ciudad / Municipio
                    </label>
                    <input
                      type="text"
                      id="fiscalCity"
                      value={formData.fiscalCity}
                      onChange={(e) => handleInputChange('fiscalCity', e.target.value)}
                      className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Cuauhtémoc"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label htmlFor="fiscalState" className="block text-sm font-medium mb-2 text-foreground">
                      Estado
                    </label>
                    <select
                      id="fiscalState"
                      value={formData.fiscalState}
                      onChange={(e) => handleInputChange('fiscalState', e.target.value)}
                      className="w-full px-3 py-2.5 bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      disabled={loading}
                    >
                      <option value="">Selecciona un estado</option>
                      {MEXICAN_STATES.map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              </>
            )}
          </div>

          {/* ========================================
              SECCIÓN: Integración Finco
          ======================================== */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-bold text-sm">F</span>
              </div>
              <div>
                <p className="font-medium text-foreground">Integración con Finco</p>
                <p className="text-sm text-muted-foreground">
                  Crear automáticamente un Customer en Finco con cuenta CLABE
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleInputChange('createFincoCustomer', !formData.createFincoCustomer)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.createFincoCustomer ? 'bg-primary' : 'bg-muted'
              }`}
              disabled={loading}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.createFincoCustomer ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Info message about Finco */}
          {formData.createFincoCustomer && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-600">
                Se creará un Customer en Finco y se generará una cuenta CLABE automáticamente.
                El código del centro de costos se asignará como LC0001, LC0002, etc.
              </p>
            </div>
          )}

          {/* ========================================
              SECCIÓN: Opciones Avanzadas
          ======================================== */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-primary hover:underline"
            >
              {showAdvanced ? '- Ocultar opciones avanzadas' : '+ Mostrar opciones avanzadas'}
            </button>
          </div>

          {showAdvanced && (
            <div className="space-y-4 pt-4 border-t border-border">
              <h4 className="font-medium text-foreground">Perfil de Transacciones</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="limitIn" className="block text-sm font-medium mb-2 text-foreground">
                    Límite de Entrada (MXN)
                  </label>
                  <input
                    type="number"
                    id="limitIn"
                    value={formData.transactionProfile.limitIn}
                    onChange={(e) => handleProfileChange('limitIn', e.target.value)}
                    className={`w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                      errors.limitIn ? 'border-destructive' : 'border-border'
                    }`}
                    placeholder="1000000"
                    disabled={loading}
                  />
                  {errors.limitIn && (
                    <p className="text-sm text-destructive mt-1">{errors.limitIn}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="opsIn" className="block text-sm font-medium mb-2 text-foreground">
                    Operaciones de Entrada (máx/día)
                  </label>
                  <input
                    type="number"
                    id="opsIn"
                    value={formData.transactionProfile.opsIn}
                    onChange={(e) => handleProfileChange('opsIn', e.target.value)}
                    className={`w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                      errors.opsIn ? 'border-destructive' : 'border-border'
                    }`}
                    placeholder="100"
                    disabled={loading}
                  />
                  {errors.opsIn && (
                    <p className="text-sm text-destructive mt-1">{errors.opsIn}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="limitOut" className="block text-sm font-medium mb-2 text-foreground">
                    Límite de Salida (MXN)
                  </label>
                  <input
                    type="number"
                    id="limitOut"
                    value={formData.transactionProfile.limitOut}
                    onChange={(e) => handleProfileChange('limitOut', e.target.value)}
                    className={`w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                      errors.limitOut ? 'border-destructive' : 'border-border'
                    }`}
                    placeholder="1000000"
                    disabled={loading}
                  />
                  {errors.limitOut && (
                    <p className="text-sm text-destructive mt-1">{errors.limitOut}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="opsOut" className="block text-sm font-medium mb-2 text-foreground">
                    Operaciones de Salida (máx/día)
                  </label>
                  <input
                    type="number"
                    id="opsOut"
                    value={formData.transactionProfile.opsOut}
                    onChange={(e) => handleProfileChange('opsOut', e.target.value)}
                    className={`w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                      errors.opsOut ? 'border-destructive' : 'border-border'
                    }`}
                    placeholder="100"
                    disabled={loading}
                  />
                  {errors.opsOut && (
                    <p className="text-sm text-destructive mt-1">{errors.opsOut}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================
              Form Actions
          ======================================== */}
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
                  Crear Centro de Costos
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
