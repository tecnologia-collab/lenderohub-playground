'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Lock, Eye, EyeOff, Shield, CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

interface TokenValidation {
  valid: boolean;
  email?: string;
  userName?: string;
  message?: string;
}

export default function SetupPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tokenValidation, setTokenValidation] = useState<TokenValidation | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});


  // Validar token al cargar
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setTokenValidation({
          valid: false,
          message: 'No se proporcionó un enlace válido.',
        });
        setLoading(false);
        return;
      }

      try {
        const response = await api.get<TokenValidation>(`/auth/validate-setup-token?token=${token}`);
        setTokenValidation(response);
      } catch (error: any) {
        console.error('Error validating token:', error);
        setTokenValidation({
          valid: false,
          message: 'Error al validar el enlace. Intenta de nuevo o contacta al administrador.',
        });
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!password) {
      newErrors.password = 'La contraseña es requerida';
    } else if (password.length < 4) {
      newErrors.password = 'La contraseña debe tener al menos 4 caracteres';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirma tu contraseña';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);

    try {
      await api.post('/auth/setup-password', {
        token,
        password,
        confirmPassword,
      });

      setSuccess(true);
      toast({
        title: 'Contraseña establecida',
        description: 'Ya puedes iniciar sesión con tu nueva contraseña.',
      });
    } catch (error: any) {
      const errorMessage = error.message || 'Error al establecer la contraseña';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });

      // Si el token expiró o ya fue usado, mostrar mensaje
      if (errorMessage.includes('expirado') || errorMessage.includes('utilizado')) {
        setTokenValidation({
          valid: false,
          message: errorMessage,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Validando enlace...</p>
        </div>
      </div>
    );
  }

  // Token inválido o expirado
  if (!tokenValidation?.valid) {
    return (
      <div className="min-h-screen flex bg-background">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden">
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
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          
          <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
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
            <div className="text-blue-200 text-sm">
              © 2026 Lendero Capital. Todos los derechos reservados.
            </div>
          </div>
        </div>

        {/* Right Side - Error */}
        <div className="flex-1 flex items-center justify-center p-8 bg-background">
          <div className="w-full max-w-md text-center">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Enlace no válido
            </h2>
            <p className="text-muted-foreground mb-8">
              {tokenValidation?.message || 'El enlace es inválido o ha expirado. Contacta al administrador para obtener uno nuevo.'}
            </p>
            <Button
              onClick={() => router.push('/login')}
              className="h-12 px-8 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold"
            >
              Ir al inicio de sesión
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Éxito
  if (success) {
    return (
      <div className="min-h-screen flex bg-background">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden">
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
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          
          <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
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
            <div className="text-blue-200 text-sm">
              © 2026 Lendero Capital. Todos los derechos reservados.
            </div>
          </div>
        </div>

        {/* Right Side - Success */}
        <div className="flex-1 flex items-center justify-center p-8 bg-background">
          <div className="w-full max-w-md text-center">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              ¡Contraseña establecida!
            </h2>
            <p className="text-muted-foreground mb-8">
              Tu contraseña ha sido configurada exitosamente. Ya puedes iniciar sesión en LenderoHUB.
            </p>
            <Button
              onClick={() => router.push('/login')}
              className="h-12 px-8 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold flex items-center gap-2 mx-auto"
            >
              Iniciar Sesión
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Formulario de setup
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden">
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
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
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
                ¡Bienvenido! 🎉
              </h1>
              <p className="text-xl text-blue-100 leading-relaxed">
                Configura tu contraseña para acceder a la plataforma de transferencias SPEI más segura.
              </p>
            </div>

            <div className="mt-12 space-y-4">
              <div className="flex items-center gap-3 text-blue-100">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <span className="text-sm">Protección con autenticación de dos factores</span>
              </div>
            </div>
          </div>

          <div className="text-blue-200 text-sm">
            © 2026 Lendero Capital. Todos los derechos reservados.
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-12 flex items-center justify-center gap-3">
            <Image
              src="/logoGray.svg"
              alt="Lendero"
              width={128}
              height={64}
              className="h-16 w-auto dark:brightness-0 dark:invert"
            />
            <span className="text-4xl font-bold text-foreground">HUB</span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">
              Configura tu contraseña
            </h2>
            <p className="text-muted-foreground">
              Hola <strong>{tokenValidation.userName}</strong>, establece tu contraseña para acceder a LenderoHUB.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Usuario: <span className="font-medium">{tokenValidation.email}</span>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nueva contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
                  }}
                  required
                  className={`w-full pl-12 pr-12 py-3.5 bg-gray-50 dark:bg-gray-900 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400 ${
                    errors.password ? 'border-red-500' : 'border-gray-200 dark:border-gray-800'
                  }`}
                  placeholder="--------"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500">{errors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirmar contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: '' }));
                  }}
                  required
                  className={`w-full pl-12 pr-12 py-3.5 bg-gray-50 dark:bg-gray-900 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400 ${
                    errors.confirmPassword ? 'border-red-500' : 'border-gray-200 dark:border-gray-800'
                  }`}
                  placeholder="--------"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-red-500">{errors.confirmPassword}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-12 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  Establecer Contraseña
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </Button>
          </form>

          {/* Tips */}
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
            <p className="text-sm text-blue-800 dark:text-blue-300 font-medium mb-2">Recomendaciones de seguridad:</p>
            <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
              <li>-- Usa una contraseña de al menos 8 caracteres</li>
              <li>-- Combina mayúsculas, minúsculas y números</li>
              <li>-- No uses información personal fácil de adivinar</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
