'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, CheckCircle, AlertCircle, Copy, Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { api, ApiResponse } from '@/lib/api';

// Types para las respuestas de 2FA
interface Setup2FAResponse {
  qrCodeUrl: string;
  secret: string;
  manualEntry?: string;
}

interface Verify2FAResponse {
  backupCodes: string[];
}

export default function Setup2FAPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const loadSetupData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get<ApiResponse<Setup2FAResponse & { alreadyEnabled?: boolean }>>('/auth/setup-2fa');

      if (response.success && response.data) {
        // Si ya tiene 2FA habilitado, redirigir al dashboard
        if (response.data.alreadyEnabled) {
          console.log('2FA ya está habilitado, redirigiendo...');
          router.push('/hub');
          return;
        }

        if (response.data.qrCodeUrl) {
          setQrCodeUrl(response.data.qrCodeUrl);
        }
        if (response.data.secret || response.data.manualEntry) {
          setSecret(response.data.secret || response.data.manualEntry || '');
        }
      } else {
        setError(response.message || 'Error al cargar configuración de 2FA');
      }
    } catch (err: any) {
      console.error('Error loading 2FA setup:', err);
      setError(err.message || 'Error al cargar configuración de 2FA');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (user?.twoFactorEnabled) {
      router.push('/hub');
      return;
    }
    loadSetupData();
  }, [user, router, loadSetupData]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (verificationCode.length !== 6) {
      setError('El código debe tener 6 dígitos');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const response = await api.post<ApiResponse<Verify2FAResponse>>('/auth/verify-setup-2fa', {
        code: verificationCode,
      });

      if (response.success) {
        if (response.data?.backupCodes) {
          setBackupCodes(response.data.backupCodes);
        }
        setSuccess(true);
        await refreshUser();
        setTimeout(() => router.push('/hub'), 3000);
      } else {
        setError(response.message || 'Código inválido. Por favor, intenta nuevamente.');
        setVerificationCode('');
      }
    } catch (err: any) {
      console.error('Error verifying 2FA:', err);
      setError(err.message || 'Error al verificar código');
      setVerificationCode('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyBackupCodes = () => {
    const text = backupCodes.join('\n');
    navigator.clipboard.writeText(text);
    alert('Códigos de respaldo copiados al portapapeles. ¡Guárdalos en un lugar seguro!');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 relative">
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Generando código 2FA...</p>
          </div>
        </div>
      </div>
    );
  }

  if (success && backupCodes.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <Card className="w-full max-w-md p-6">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">¡2FA Configurado!</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4 text-center text-sm">
            Tu cuenta ahora está protegida con autenticación de dos factores.
          </p>
          
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-900 dark:text-amber-200 mb-1">Códigos de Respaldo</p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Guarda estos códigos en un lugar seguro.
                </p>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-800 mb-2">
              <div className="grid grid-cols-2 gap-1 font-mono text-xs">
                {backupCodes.map((code, i) => (
                  <div key={i} className="text-gray-900 dark:text-gray-100">{i + 1}. {code}</div>
                ))}
              </div>
            </div>
            
            <Button onClick={handleCopyBackupCodes} variant="outline" size="sm" className="w-full">
              <Copy className="w-3 h-3 mr-2" /> Copiar Códigos
            </Button>
          </div>
          
          <p className="text-xs text-gray-500 dark:text-gray-500 text-center">Redirigiendo al dashboard...</p>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <Card className="w-full max-w-md p-6 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¡2FA Configurado!</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-3 text-sm">
            Tu cuenta ahora está protegida con autenticación de dos factores.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">Redirigiendo al dashboard...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
            backgroundSize: '100px 100px',
            transform: 'rotate(-12deg) scale(1.5)',
          }} />
        </div>

        <div className="relative z-10 flex flex-col justify-center p-12 text-white w-full">
          <div className="max-w-md">
            <div className="mb-6 flex items-center gap-3">
              <Image
                src="/logoGray.svg"
                alt="Lendero"
                width={120}
                height={40}
                className="h-10 w-auto brightness-0 invert"
              />
              <span className="text-2xl font-bold">HUB</span>
            </div>

            <h1 className="text-3xl font-bold mb-4">Protege tu Cuenta 🔐</h1>
            <p className="text-lg text-blue-100 mb-6">
              La autenticación de dos factores agrega una capa extra de seguridad.
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm mb-0.5">Seguridad Mejorada</h3>
                  <p className="text-xs text-blue-100">Protege tu cuenta incluso si alguien conoce tu contraseña</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm mb-0.5">Fácil de Usar</h3>
                  <p className="text-xs text-blue-100">Solo toma unos segundos generar un código</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm mb-0.5">Estándar Mundial</h3>
                  <p className="text-xs text-blue-100">Usado por bancos y empresas globalmente</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Form - COMPACTO */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-4 flex items-center justify-center gap-3">
            <Image
              src="/logoGray.svg"
              alt="Lendero"
              width={96}
              height={32}
              className="h-8 w-auto dark:brightness-0 dark:invert"
            />
            <span className="text-xl font-bold text-gray-900 dark:text-white">HUB</span>
          </div>

          <Card className="p-5">
            {/* Header COMPACTO */}
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Configurar 2FA</h2>
              <p className="text-gray-600 dark:text-gray-400 text-xs">Protege tu cuenta en 3 pasos</p>
            </div>

            {/* Notice COMPACTO */}
            <div className="mb-4 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  <strong>Obligatorio</strong> - Configuración requerida para todos los usuarios
                </p>
              </div>
            </div>

            {/* Steps COMPACTO */}
            <div className="space-y-3">
              {/* Step 1: QR COMPACTO */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Escanea el QR</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Google o Microsoft Authenticator</p>
                  </div>
                </div>

                {qrCodeUrl && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 flex justify-center border border-gray-200 dark:border-gray-700">
                    <Image
                      src={qrCodeUrl}
                      alt="QR 2FA"
                      width={160}
                      height={160}
                      className="w-40 h-40"
                      unoptimized
                    />
                  </div>
                )}
              </div>

              {/* Step 2: Secret COMPACTO */}
              {secret && (
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">O ingresa manualmente</h3>
                  </div>
                  
                  <div className="flex gap-2">
                    <code className="flex-1 px-2.5 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono text-gray-900 dark:text-white break-all">
                      {secret}
                    </code>
                    <Button type="button" variant="outline" size="icon" onClick={handleCopySecret} className="h-9 w-9 flex-shrink-0">
                      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Verify COMPACTO */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Verifica con código</h3>
                </div>

                {error && (
                  <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                    <p className="text-red-600 dark:text-red-400 text-xs">{error}</p>
                  </div>
                )}

                <form onSubmit={handleVerify} className="space-y-3">
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    maxLength={6}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-center text-2xl tracking-[0.5em] font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="000000"
                    disabled={submitting}
                    autoFocus
                  />

                  <Button
                    type="submit"
                    disabled={submitting || verificationCode.length !== 6}
                    className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm shadow-lg hover:shadow-xl transition-all"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Completar
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
