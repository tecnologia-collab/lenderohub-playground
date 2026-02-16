'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuth, UserProfileSummary } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Lock, Mail, ArrowRight, Shield, Zap, TrendingUp, Eye, EyeOff, FileText, User, Building2, Users, Percent, Wallet, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

// ============================================
// Profile type display config
// ============================================
const PROFILE_TYPE_CONFIG: Record<string, {
  label: string;
  description: string;
  icon: typeof Building2;
  color: string;
  bgColor: string;
}> = {
  corporate: {
    label: 'Corporativo',
    description: 'Acceso completo a todas las funciones',
    icon: Building2,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 hover:border-purple-400',
  },
  administrator: {
    label: 'Administrador',
    description: 'Gestion de usuarios y operaciones',
    icon: Users,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 hover:border-blue-400',
  },
  commissionAgent: {
    label: 'Comisionista',
    description: 'Gestion de comisiones y solicitudes',
    icon: Percent,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 hover:border-amber-400',
  },
  subaccountManager: {
    label: 'Subcuenta',
    description: 'Operaciones de subcuentas asignadas',
    icon: Wallet,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800 hover:border-cyan-400',
  },
  // Aliases for different profile type naming
  subaccount: {
    label: 'Subcuenta',
    description: 'Operaciones de subcuentas asignadas',
    icon: Wallet,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800 hover:border-cyan-400',
  },
  system: {
    label: 'Sistema',
    description: 'Acceso de sistema',
    icon: Shield,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800 hover:border-gray-400',
  },
};

function getProfileConfig(type: string) {
  return PROFILE_TYPE_CONFIG[type] || {
    label: type,
    description: '',
    icon: User,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800 hover:border-gray-400',
  };
}

export default function LoginPage() {
  const { login, verify2FA, switchProfile, user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<'credentials' | '2fa' | 'profile-select'>('credentials');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Modals
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);

  // Step 2: 2FA
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [canSubmit2FA, setCanSubmit2FA] = useState(false);

  // Step 3: Profile Selection
  const [availableProfiles, setAvailableProfiles] = useState<UserProfileSummary[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileSwitching, setProfileSwitching] = useState(false);

  // Prevenir submit inmediato del 2FA (proteccion contra Enter del login)
  useEffect(() => {
    if (step === '2fa') {
      setCanSubmit2FA(false);
      const timer = setTimeout(() => setCanSubmit2FA(true), 500);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);

      if (result.requires2FA && result.tempToken) {
        setTempToken(result.tempToken);
        setTwoFactorCode(''); // Limpiar codigo anterior
        setStep('2fa');
      } else if (result.profiles && result.profiles.length > 1) {
        // Multiple profiles - show profile selector
        setAvailableProfiles(result.profiles);
        setStep('profile-select');
      }
      // If single profile, AuthContext already handles redirect
    } catch (err: any) {
      const errorMsg = err.message || 'Error al iniciar sesion';
      setError(errorMsg);
      toast({
        title: 'Error de autenticacion',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Proteccion contra submit inmediato
    if (!canSubmit2FA) {
      return;
    }

    // Validar que hay codigo
    if (twoFactorCode.length !== 6) {
      return;
    }

    setError('');
    setLoading(true);

    try {
      const result = await verify2FA(tempToken, twoFactorCode);

      if (result.profiles && result.profiles.length > 1) {
        // Multiple profiles - show profile selector
        setAvailableProfiles(result.profiles);
        setStep('profile-select');
      }
      // If single profile, AuthContext already handles redirect
    } catch (err: any) {
      const errorMsg = err.message || 'Codigo 2FA invalido';
      setError(errorMsg);
      toast({
        title: 'Error de verificacion',
        description: errorMsg,
        variant: 'destructive',
      });
      setTwoFactorCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSelect = async (profileId: string) => {
    setSelectedProfileId(profileId);
    setProfileSwitching(true);
    setError('');

    try {
      await switchProfile(profileId);
      router.push('/hub');
    } catch (err: any) {
      const errorMsg = err.message || 'Error al seleccionar perfil';
      setError(errorMsg);
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
      setSelectedProfileId(null);
    } finally {
      setProfileSwitching(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);

    try {
      await api.post('/auth/forgot-password', { email: forgotPasswordEmail });

      setForgotPasswordSent(true);
      toast({
        title: 'Correo enviado',
        description: 'Si el email existe, recibiras un enlace para restablecer tu contrasena.',
      });
    } catch (err: any) {
      // Siempre mostrar exito para no revelar si el email existe
      setForgotPasswordSent(true);
      toast({
        title: 'Correo enviado',
        description: 'Si el email existe, recibiras un enlace para restablecer tu contrasena.',
      });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const resetForgotPassword = () => {
    setForgotPasswordEmail('');
    setForgotPasswordSent(false);
    setShowForgotPassword(false);
  };


  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Side - Branding */}
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
            {/* Logo GRANDE con HUB al lado */}
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
                {step === 'profile-select' ? 'Selecciona tu perfil' : 'Hola de nuevo!'}
              </h1>
              <p className="text-xl text-blue-100 leading-relaxed">
                {step === 'profile-select'
                  ? 'Tienes acceso con multiples perfiles. Elige con cual deseas ingresar.'
                  : 'Tu plataforma de transferencias SPEI. Gestiona pagos, dispersiones y beneficiarios de forma rapida y segura.'
                }
              </p>
            </div>

            {/* Features */}
            {step !== 'profile-select' && (
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
          <div className="lg:hidden mb-12 flex items-center justify-center gap-3">
            <Image
              src="/logoGray.svg"
              alt="Lendero"
              width={128}
              height={64}
              className="h-16 w-auto dark:brightness-0 dark:invert"
            />
            <span className="text-4xl font-bold text-gray-900 dark:text-white">HUB</span>
          </div>

          {step === 'credentials' ? (
            <>
              {/* Header */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Bienvenido
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Ingresa tus credenciales para continuar
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleCredentialsSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Correo electronico
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400"
                      placeholder="tu@email.com"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Contrasena
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-12 pr-12 py-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400"
                      placeholder="--------"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end text-sm">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Olvidaste tu contrasena?
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    'Iniciando sesion...'
                  ) : (
                    <>
                      Iniciar Sesion
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>
              </form>

              {/* Footer */}
              <div className="mt-8 text-center space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No tienes cuenta?{' '}
                  <a href="/register" className="text-blue-600 hover:text-blue-700 font-semibold">
                    Registrate
                  </a>
                </p>
                <button
                  type="button"
                  onClick={() => setShowPrivacyNotice(true)}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 underline flex items-center justify-center gap-1 mx-auto"
                >
                  <FileText className="w-3 h-3" />
                  Aviso de Privacidad
                </button>
              </div>
            </>
          ) : step === '2fa' ? (
            <>
              {/* 2FA Header */}
              <div className="mb-8 text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Verificacion en Dos Pasos
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Ingresa el codigo de tu aplicacion autenticadora
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* 2FA Form */}
              <form onSubmit={handle2FASubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
                    Codigo de 6 digitos
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    maxLength={6}
                    autoComplete="off"
                    name="totp-code"
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-center text-3xl tracking-[0.5em] font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="000000"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-3">
                  <Button
                    type="submit"
                    disabled={loading || twoFactorCode.length !== 6 || !canSubmit2FA}
                    className="w-full h-12 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-base transition-all shadow-lg hover:shadow-xl"
                  >
                    {loading ? 'Verificando...' : 'Verificar Codigo'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setStep('credentials');
                      setTwoFactorCode('');
                      setTempToken('');
                      setError('');
                    }}
                    disabled={loading}
                    className="w-full h-12 rounded-xl"
                  >
                    Volver
                  </Button>
                </div>

                <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                  No tienes acceso a tu autenticador?{' '}
                  <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
                    Usar codigo de respaldo
                  </a>
                </p>
              </form>
            </>
          ) : (
            /* Profile Selection Step */
            <>
              <div className="mb-8 text-center">
                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Selecciona tu perfil
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Tienes acceso con {availableProfiles.length} perfiles. Elige con cual deseas ingresar.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Profile Cards */}
              <div className="space-y-3">
                {availableProfiles.map((profile) => {
                  const config = getProfileConfig(profile.type);
                  const Icon = config.icon;
                  const isSelected = selectedProfileId === profile.id;
                  const isLoading = profileSwitching && isSelected;

                  return (
                    <button
                      key={profile.id}
                      onClick={() => handleProfileSelect(profile.id)}
                      disabled={profileSwitching}
                      className={cn(
                        'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left',
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 shadow-md'
                          : config.bgColor,
                        profileSwitching && !isSelected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      )}
                    >
                      <div className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                        isSelected ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-background'
                      )}>
                        <Icon className={cn('w-6 h-6', config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm">
                          {config.label}
                        </p>
                        {config.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {config.description}
                          </p>
                        )}
                      </div>
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      ) : isSelected ? (
                        <Check className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <ArrowRight className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Logged in as info */}
              {user && (
                <p className="mt-6 text-center text-xs text-muted-foreground">
                  Sesion iniciada como <span className="font-medium">{user.email}</span>
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal: Recuperar Contrasena */}
      <Dialog open={showForgotPassword} onOpenChange={(open) => !open && resetForgotPassword()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">
              Olvidaste tu contrasena?
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Escribe tu usuario y te enviaremos un enlace para obtener una nueva contrasena.
            </DialogDescription>
          </DialogHeader>

          {!forgotPasswordSent ? (
            <form onSubmit={handleForgotPassword} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Usuario
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400"
                    placeholder="tu@email.com"
                    disabled={forgotPasswordLoading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={forgotPasswordLoading || !forgotPasswordEmail}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold"
              >
                {forgotPasswordLoading ? 'Enviando...' : 'Obtener nueva contrasena'}
              </Button>
            </form>
          ) : (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Hemos enviado un enlace de recuperacion a <strong>{forgotPasswordEmail}</strong>
              </p>
              <Button
                onClick={resetForgotPassword}
                variant="outline"
                className="rounded-xl"
              >
                Cerrar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Aviso de Privacidad */}
      <Dialog open={showPrivacyNotice} onOpenChange={setShowPrivacyNotice}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5" />
              AVISO DE PRIVACIDAD
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 pr-2 text-sm text-gray-700 dark:text-gray-300 space-y-4">
            <p>
              Para <strong>LENDERO CAPITAL, S.A.P.I DE C.V</strong>; y demas subsidiarias, es de vital importancia hacer del conocimiento de los USUARIOS, que sus datos proporcionados seran manejados con la debida probidad y en estricto acatamiento a lo establecido por la <strong>LEY FEDERAL DE PROTECCION DE DATOS PERSONALES EN POSESION DE LOS PARTICULARES</strong> y su Reglamento.
            </p>

            <p>
              Toda informacion correspondiente a los derechos y prerrogativas de la citada Ley y su Reglamento son de consulta publica, las cuales pueden ser verificada por el propio usuario a traves de la Secretaria de Gobernacion en el siguiente Fuente de Acceso Publico: <a href="http://www.ordenjuridico.gob.mx" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">www.ordenjuridico.gob.mx</a>.
            </p>

            <h3 className="font-bold text-base text-gray-900 dark:text-white mt-6">DEFINICIONES</h3>
            <p>
              En terminos por lo dispuesto en el articulo 3 de la LEY FEDERAL DE PROTECCION DE DATOS PERSONALES EN POSESION DE LOS PARTICULARES, se entendera para todo el cuerpo normativo del presente AVISO DE PRIVACIDAD, los siguientes:
            </p>

            <h3 className="font-bold text-base text-gray-900 dark:text-white mt-6">CONSENTIMIENTO DEL TITULAR</h3>
            <p className="italic">
              Reconozco haber recibido el presente aviso de privacidad y otorgo mi consentimiento expreso para el tratamiento de mis datos personales, incluyendo mis datos personales financieros o patrimoniales, en los terminos del presente aviso de privacidad.
            </p>
          </div>

          <div className="pt-4 border-t mt-4">
            <Button
              onClick={() => setShowPrivacyNotice(false)}
              className="w-full h-11 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold"
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
