"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardLayout, PageHeader } from "@/components/layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Palette,
  Bell,
  Shield,
  Info,
  Key,
  Globe,
  Moon,
  Sun,
  Monitor,
  Check,
  ShieldOff,
  Loader2,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  ExternalLink,
  BanknoteIcon,
  ArrowRightLeft,
  Receipt,
} from "lucide-react";
import { useTheme } from "next-themes";
import { twoFactorService, TwoFactorStatus } from "@/services";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { usePreferences, NotificationPreferences } from "@/hooks/usePreferences";

// ============================================
// Notification toggle config
// ============================================
const NOTIFICATION_TOGGLES: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
  icon: typeof Bell;
}[] = [
  {
    key: "inApp",
    label: "Notificaciones in-app",
    description: "Alertas dentro de la plataforma",
    icon: Bell,
  },
  {
    key: "email",
    label: "Notificaciones por email",
    description: "Recibe alertas en tu correo electronico",
    icon: Bell,
  },
  {
    key: "deposits",
    label: "Depositos recibidos",
    description: "Aviso cuando se reciba un deposito en tu cuenta",
    icon: BanknoteIcon,
  },
  {
    key: "transfers",
    label: "Transferencias completadas",
    description: "Aviso cuando una transferencia sea procesada",
    icon: ArrowRightLeft,
  },
  {
    key: "commissions",
    label: "Solicitudes de comision",
    description: "Aviso de nuevas solicitudes y aprobaciones de comision",
    icon: Receipt,
  },
];

// ============================================
// Main Page
// ============================================
export default function ConfiguracionPage() {
  const { theme, setTheme } = useTheme();
  const { user, refreshUser } = useAuth();
  const { preferences, loaded: prefsLoaded, updateNotification } = usePreferences();
  const [mounted, setMounted] = React.useState(false);

  // 2FA State
  const [twoFAStatus, setTwoFAStatus] = useState<TwoFactorStatus | null>(null);
  const [twoFALoading, setTwoFALoading] = useState(true);
  const [twoFAActionLoading, setTwoFAActionLoading] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");

  // Password Change State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Load 2FA status
  useEffect(() => {
    const load2FAStatus = async () => {
      try {
        const status = await twoFactorService.getStatus();
        setTwoFAStatus(status);
      } catch (error) {
        console.error("Error loading 2FA status:", error);
      } finally {
        setTwoFALoading(false);
      }
    };
    load2FAStatus();
  }, []);

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      toast({
        title: "Error",
        description: "Ingresa tu contrasena",
        variant: "destructive",
      });
      return;
    }

    setTwoFAActionLoading(true);
    try {
      await twoFactorService.disable(disablePassword);
      toast({
        title: "2FA deshabilitado",
        description:
          "La autenticacion de dos factores ha sido deshabilitada",
      });
      setShowDisableModal(false);
      setDisablePassword("");
      const status = await twoFactorService.getStatus();
      setTwoFAStatus(status);
      await refreshUser();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo deshabilitar 2FA",
        variant: "destructive",
      });
    } finally {
      setTwoFAActionLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast({
        title: "Error",
        description: "Ingresa tu contrasena actual",
        variant: "destructive",
      });
      return;
    }
    if (!newPassword) {
      toast({
        title: "Error",
        description: "Ingresa la nueva contrasena",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 4) {
      toast({
        title: "Error",
        description:
          "La nueva contrasena debe tener al menos 4 caracteres",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Las contrasenas no coinciden",
        variant: "destructive",
      });
      return;
    }

    setPasswordLoading(true);
    try {
      await twoFactorService.changePassword(
        currentPassword,
        newPassword,
        confirmPassword
      );
      toast({
        title: "Contrasena actualizada",
        description: "Tu contrasena ha sido cambiada exitosamente",
      });
      setShowPasswordModal(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: "Error",
        description:
          error.message || "No se pudo cambiar la contrasena",
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  // ============================================
  // Render
  // ============================================
  return (
    <DashboardLayout title="Configuracion" subtitle="Ajustes de tu cuenta y sistema">
      <div className="space-y-6">
        <PageHeader
          title="Configuracion"
          description="Personaliza tu experiencia en LenderoHUB"
        />

        {/* ==========================================
            SECTION A: Apariencia
        ========================================== */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Palette size={20} className="text-violet-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Apariencia</CardTitle>
                <CardDescription>
                  Personaliza el tema de la interfaz
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {mounted && (
                <>
                  {/* Light */}
                  <button
                    onClick={() => setTheme("light")}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl border-2 transition-all",
                      theme === "light"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center flex-shrink-0">
                      <Sun size={20} className="text-amber-500" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="font-medium">Claro</p>
                      <p className="text-muted-foreground text-sm">
                        Tema claro
                      </p>
                    </div>
                    {theme === "light" && (
                      <Check size={20} className="text-primary flex-shrink-0" />
                    )}
                  </button>

                  {/* Dark */}
                  <button
                    onClick={() => setTheme("dark")}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl border-2 transition-all",
                      theme === "dark"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center flex-shrink-0">
                      <Moon size={20} className="text-slate-300" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="font-medium">Oscuro</p>
                      <p className="text-muted-foreground text-sm">
                        Tema oscuro
                      </p>
                    </div>
                    {theme === "dark" && (
                      <Check size={20} className="text-primary flex-shrink-0" />
                    )}
                  </button>

                  {/* System */}
                  <button
                    onClick={() => setTheme("system")}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl border-2 transition-all",
                      theme === "system"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-white to-slate-900 border border-border flex items-center justify-center flex-shrink-0">
                      <Monitor size={20} className="text-slate-600" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="font-medium">Sistema</p>
                      <p className="text-muted-foreground text-sm">
                        Automatico
                      </p>
                    </div>
                    {theme === "system" && (
                      <Check size={20} className="text-primary flex-shrink-0" />
                    )}
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ==========================================
            SECTION B: Notificaciones
        ========================================== */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Bell size={20} className="text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Notificaciones</CardTitle>
                <CardDescription>
                  Configura como deseas recibir alertas
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {prefsLoaded &&
              NOTIFICATION_TOGGLES.map((item, index) => {
                const ItemIcon = item.icon;
                const isChecked = preferences.notifications[item.key];
                return (
                  <div
                    key={item.key}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg hover:bg-muted/50 transition-colors",
                      index < NOTIFICATION_TOGGLES.length - 1 &&
                        "border-b border-border"
                    )}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <ItemIcon
                        size={18}
                        className="text-muted-foreground flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <Label
                          htmlFor={`notif-${item.key}`}
                          className="font-medium text-foreground cursor-pointer"
                        >
                          {item.label}
                        </Label>
                        <p className="text-muted-foreground text-sm">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={`notif-${item.key}`}
                      checked={isChecked}
                      onCheckedChange={(checked) =>
                        updateNotification(item.key, checked)
                      }
                    />
                  </div>
                );
              })}
          </CardContent>
        </Card>

        {/* ==========================================
            SECTION C: Seguridad
        ========================================== */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Shield size={20} className="text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">Seguridad</CardTitle>
                  <CardDescription>
                    Protege tu cuenta con 2FA y controles avanzados
                  </CardDescription>
                </div>
              </div>
              {twoFALoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : twoFAStatus?.twoFactorEnabled ? (
                <Badge variant="success" className="gap-1">
                  <ShieldCheck size={14} />
                  Habilitado
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <ShieldOff size={14} />
                  No configurado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 2FA Status Grid */}
            {twoFAStatus && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Estado 2FA</p>
                  <p className="font-medium">
                    {twoFAStatus.twoFactorEnabled ? "Activo" : "Inactivo"}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">
                    Secret configurado
                  </p>
                  <p className="font-medium">
                    {twoFAStatus.hasSecret ? "Si" : "No"}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">
                    Codigos de respaldo
                  </p>
                  <p className="font-medium">
                    {twoFAStatus.backupCodesCount} disponibles
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Contrasena</p>
                  <Link
                    href="/perfil"
                    className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Cambiar
                    <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            )}

            {/* Disable 2FA (staging action) */}
            {twoFAStatus?.twoFactorEnabled && (
              <div className="pt-4 border-t border-border space-y-3">
                <p className="text-sm text-muted-foreground font-medium">
                  Acciones de desarrollo (solo staging):
                </p>

                {!showDisableModal ? (
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDisableModal(true)}
                      className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950"
                    >
                      <ShieldOff size={16} />
                      Deshabilitar 2FA
                    </Button>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 space-y-3">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      Confirma tu contrasena para deshabilitar 2FA
                    </p>
                    <input
                      type="password"
                      value={disablePassword}
                      onChange={(e) => setDisablePassword(e.target.value)}
                      placeholder="Tu contrasena"
                      className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDisable2FA}
                        disabled={twoFAActionLoading}
                      >
                        {twoFAActionLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Confirmar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowDisableModal(false);
                          setDisablePassword("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ==========================================
            Change Password Section
        ========================================== */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Lock size={20} className="text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Cambiar Contrasena</CardTitle>
                <CardDescription>
                  Actualiza tu contrasena de acceso
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showPasswordModal ? (
              <Button
                variant="outline"
                onClick={() => setShowPasswordModal(true)}
                className="gap-2"
              >
                <Key size={16} />
                Cambiar mi contrasena
              </Button>
            ) : (
              <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-4 max-w-md">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Contrasena actual
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Tu contrasena actual"
                      className="w-full px-3 py-2 pr-10 rounded-md border border-border bg-background text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowCurrentPassword(!showCurrentPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPassword ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Nueva contrasena
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nueva contrasena (minimo 4 caracteres)"
                      className="w-full px-3 py-2 pr-10 rounded-md border border-border bg-background text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Confirmar nueva contrasena
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la nueva contrasena"
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleChangePassword}
                    disabled={passwordLoading}
                  >
                    {passwordLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Guardar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ==========================================
            SECTION D: Informacion
        ========================================== */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Info size={20} className="text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Informacion</CardTitle>
                <CardDescription>
                  Datos del sistema y la sesion actual
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">
                  Version de la aplicacion
                </p>
                <p className="text-sm font-medium text-foreground">v1.0.0</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Ambiente</p>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-warning rounded-full animate-pulse" />
                  <p className="text-sm font-medium text-foreground">
                    {process.env.NEXT_PUBLIC_ENV || "Staging"}
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">
                  Usuario actual
                </p>
                <p className="text-sm font-medium text-foreground">
                  {user?.email || "---"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
