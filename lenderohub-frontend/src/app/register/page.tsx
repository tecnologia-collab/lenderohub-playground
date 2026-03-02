'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  Building2,
  User,
  Mail,
  Phone,
  ArrowRight,
  Shield,
  Zap,
  TrendingUp,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { api } from '@/lib/api';

// ============================================
// Types
// ============================================
interface FormData {
  companyName: string;
  rfc: string;
  businessType: string;
  firstName: string;
  lastName: string;
  secondLastName: string;
  email: string;
  phone: string;
}

interface FormErrors {
  companyName?: string;
  rfc?: string;
  businessType?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

const BUSINESS_TYPES = [
  { value: 'SA', label: 'S.A. (Sociedad Anonima)' },
  { value: 'SAPI', label: 'S.A.P.I. (Sociedad Anonima Promotora de Inversion)' },
  { value: 'SC', label: 'S.C. (Sociedad Civil)' },
  { value: 'SARL', label: 'S. de R.L. (Sociedad de Responsabilidad Limitada)' },
  { value: 'persona_fisica', label: 'Persona Fisica con Actividad Empresarial' },
  { value: 'otro', label: 'Otro' },
];

// ============================================
// Validation
// ============================================
function validateForm(data: FormData): FormErrors {
  const errors: FormErrors = {};

  if (!data.companyName || data.companyName.trim().length < 2) {
    errors.companyName = 'Nombre de empresa es requerido (minimo 2 caracteres)';
  }

  if (!data.rfc || data.rfc.trim().length < 10 || data.rfc.trim().length > 13) {
    errors.rfc = 'RFC debe tener entre 10 y 13 caracteres';
  } else if (!/^[A-Za-z0-9]+$/.test(data.rfc.trim())) {
    errors.rfc = 'RFC solo puede contener letras y numeros';
  }

  if (!data.businessType) {
    errors.businessType = 'Selecciona el tipo de empresa';
  }

  if (!data.firstName || data.firstName.trim().length < 2) {
    errors.firstName = 'Nombre es requerido (minimo 2 caracteres)';
  }

  if (!data.lastName || data.lastName.trim().length < 2) {
    errors.lastName = 'Apellido paterno es requerido (minimo 2 caracteres)';
  }

  if (!data.email) {
    errors.email = 'Email es requerido';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Email no es valido';
  }

  if (!data.phone || data.phone.trim().length < 10) {
    errors.phone = 'Telefono es requerido (minimo 10 digitos)';
  } else if (!/^[0-9+\-\s()]+$/.test(data.phone)) {
    errors.phone = 'Telefono solo puede contener numeros, +, -, espacios y parentesis';
  }

  return errors;
}

// ============================================
// Component
// ============================================
export default function RegisterPage() {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');

  const [formData, setFormData] = useState<FormData>({
    companyName: '',
    rfc: '',
    businessType: '',
    firstName: '',
    lastName: '',
    secondLastName: '',
    email: '',
    phone: '',
  });


  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field as keyof FormErrors];
        return next;
      });
    }
    if (serverError) setServerError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    // Client-side validation
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      await api.post('/register', {
        companyName: formData.companyName.trim(),
        rfc: formData.rfc.trim().toUpperCase(),
        businessType: formData.businessType,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        secondLastName: formData.secondLastName.trim() || undefined,
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
      });

      setSubmittedEmail(formData.email.trim().toLowerCase());
      setStep('success');
      toast({
        title: 'Solicitud enviada',
        description: 'Tu solicitud de registro ha sido enviada exitosamente.',
      });
    } catch (err: any) {
      const errorMsg = err.message || 'Error al enviar la solicitud. Intenta de nuevo.';
      setServerError(errorMsg);
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Side - Branding (same as login) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
            `,
            backgroundSize: '100px 100px',
            transform: 'rotate(-12deg) scale(1.5)',
          }} />
        </div>

        {/* Floating Circles */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          {/* Logo & Title */}
          <div>
            <div className="mb-12 flex items-center gap-3">
              <Image
                src="/logoGray.svg"
                alt="Lendero"
                width={160}
                height={80}
                className="h-20 w-auto brightness-0 invert"
              />
              <span className="text-5xl font-bold">HUB</span>
            </div>

            <div className="space-y-6 max-w-md">
              <h1 className="text-5xl font-bold leading-tight">
                {step === 'success' ? 'Solicitud enviada' : 'Unete a LenderoHUB'}
              </h1>
              <p className="text-xl text-blue-100 leading-relaxed">
                {step === 'success'
                  ? 'Hemos recibido tu solicitud. Nuestro equipo la revisara y te contactaremos pronto.'
                  : 'Registra tu empresa para acceder a nuestra plataforma de transferencias SPEI. Gestiona pagos de forma rapida y segura.'
                }
              </p>
            </div>

            {/* Features */}
            {step !== 'success' && (
              <div className="mt-12 space-y-4">
                <div className="flex items-center gap-3 text-blue-100">
                  <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <span className="text-sm">Transferencias seguras con 2FA</span>
                </div>
                <div className="flex items-center gap-3 text-blue-100">
                  <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5" />
                  </div>
                  <span className="text-sm">Procesamiento en tiempo real</span>
                </div>
                <div className="flex items-center gap-3 text-blue-100">
                  <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <span className="text-sm">Reportes y analiticas avanzadas</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-blue-200 text-sm">
            &copy; 2026 Lendero Capital. Todos los derechos reservados.
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-gray-950">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 flex items-center justify-center gap-3">
            <Image
              src="/logoGray.svg"
              alt="Lendero"
              width={128}
              height={64}
              className="h-16 w-auto dark:brightness-0 dark:invert"
            />
            <span className="text-4xl font-bold text-gray-900 dark:text-white">HUB</span>
          </div>

          {step === 'form' ? (
            <>
              {/* Header */}
              <div className="mb-6">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Solicitar cuenta
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Completa el formulario para solicitar acceso a LenderoHUB
                </p>
              </div>

              {/* Server Error */}
              {serverError && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <p className="text-red-600 dark:text-red-400 text-sm">{serverError}</p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Company Section */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Datos de la empresa
                  </p>
                  <div className="h-px bg-gray-200 dark:bg-gray-800" />
                </div>

                {/* Company Name */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nombre de la empresa *
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => handleChange('companyName', e.target.value)}
                      className={`w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400 ${
                        errors.companyName ? 'border-red-400' : 'border-gray-200 dark:border-gray-800'
                      }`}
                      placeholder="Empresa S.A. de C.V."
                      disabled={loading}
                    />
                  </div>
                  {errors.companyName && (
                    <p className="text-red-500 text-xs mt-1">{errors.companyName}</p>
                  )}
                </div>

                {/* RFC + Business Type in row */}
                <div className="grid grid-cols-2 gap-3">
                  {/* RFC */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      RFC *
                    </label>
                    <input
                      type="text"
                      value={formData.rfc}
                      onChange={(e) => handleChange('rfc', e.target.value.toUpperCase())}
                      maxLength={13}
                      className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400 uppercase ${
                        errors.rfc ? 'border-red-400' : 'border-gray-200 dark:border-gray-800'
                      }`}
                      placeholder="XAXX010101000"
                      disabled={loading}
                    />
                    {errors.rfc && (
                      <p className="text-red-500 text-xs mt-1">{errors.rfc}</p>
                    )}
                  </div>

                  {/* Business Type */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Tipo *
                    </label>
                    <Select
                      value={formData.businessType}
                      onValueChange={(val) => handleChange('businessType', val)}
                      disabled={loading}
                    >
                      <SelectTrigger
                        className={`w-full py-3 h-auto bg-gray-50 dark:bg-gray-900 rounded-xl ${
                          errors.businessType ? 'border-red-400' : 'border-gray-200 dark:border-gray-800'
                        }`}
                      >
                        <SelectValue placeholder="Selecciona..." />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_TYPES.map((bt) => (
                          <SelectItem key={bt.value} value={bt.value}>
                            {bt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.businessType && (
                      <p className="text-red-500 text-xs mt-1">{errors.businessType}</p>
                    )}
                  </div>
                </div>

                {/* Contact Section */}
                <div className="space-y-1 pt-2">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Persona de contacto
                  </p>
                  <div className="h-px bg-gray-200 dark:bg-gray-800" />
                </div>

                {/* First Name + Last Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Nombre *
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => handleChange('firstName', e.target.value)}
                        className={`w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400 ${
                          errors.firstName ? 'border-red-400' : 'border-gray-200 dark:border-gray-800'
                        }`}
                        placeholder="Juan"
                        disabled={loading}
                      />
                    </div>
                    {errors.firstName && (
                      <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Apellido paterno *
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => handleChange('lastName', e.target.value)}
                      className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400 ${
                        errors.lastName ? 'border-red-400' : 'border-gray-200 dark:border-gray-800'
                      }`}
                      placeholder="Perez"
                      disabled={loading}
                    />
                    {errors.lastName && (
                      <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
                    )}
                  </div>
                </div>

                {/* Second Last Name (optional) */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Apellido materno <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.secondLastName}
                    onChange={(e) => handleChange('secondLastName', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400"
                    placeholder="Lopez"
                    disabled={loading}
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Correo electronico *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className={`w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400 ${
                        errors.email ? 'border-red-400' : 'border-gray-200 dark:border-gray-800'
                      }`}
                      placeholder="contacto@empresa.com"
                      disabled={loading}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                  )}
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Telefono *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className={`w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400 ${
                        errors.phone ? 'border-red-400' : 'border-gray-200 dark:border-gray-800'
                      }`}
                      placeholder="55 1234 5678"
                      disabled={loading}
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
                  )}
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    'Enviando solicitud...'
                  ) : (
                    <>
                      Enviar Solicitud
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>
              </form>

              {/* Footer */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Ya tienes cuenta?{' '}
                  <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
                    Inicia sesion
                  </Link>
                </p>
              </div>
            </>
          ) : (
            /* Success Screen */
            <>
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                  Solicitud enviada
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-lg mb-2">
                  Tu solicitud ha sido enviada exitosamente.
                </p>
                <p className="text-gray-500 dark:text-gray-500 text-sm mb-8">
                  Te contactaremos a <strong className="text-gray-700 dark:text-gray-300">{submittedEmail}</strong> cuando sea aprobada.
                </p>

                <div className="space-y-3">
                  <Link href="/login">
                    <Button
                      className="w-full h-12 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl"
                    >
                      Ir a Iniciar Sesion
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
