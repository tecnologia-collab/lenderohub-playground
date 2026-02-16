"use client";

import React from "react";
import { DashboardLayout, PageHeader } from "@/components/layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/users/RoleBadge";
import { useAuth } from "@/contexts/AuthContext";
import { usersService } from "@/services/users.service";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Save, X, Lock, Eye, EyeOff } from "lucide-react";

// ============================================
// InfoRow (view mode)
// ============================================
interface InfoRowProps {
  label: string;
  value?: string | null;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex flex-col gap-1 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">
        {value && value.trim().length > 0 ? value : "No registrado"}
      </p>
    </div>
  );
}

// ============================================
// EditRow (edit mode)
// ============================================
interface EditRowProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

function EditRow({ label, value, onChange, placeholder, required }: EditRowProps) {
  return (
    <div className="flex flex-col gap-1 py-2">
      <label className="text-xs text-muted-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || label}
        className="h-9"
      />
    </div>
  );
}

// ============================================
// Main Page
// ============================================
export default function PerfilPage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [timeZone, setTimeZone] = React.useState<string>("");

  // Edit mode state
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editForm, setEditForm] = React.useState({
    firstName: "",
    lastName: "",
    secondLastName: "",
    phone: "",
  });

  // Password change state
  const [passwordForm, setPasswordForm] = React.useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPassword, setChangingPassword] = React.useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  React.useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimeZone(tz || "America/Mexico_City");
  }, []);

  // Sync edit form when user changes or edit mode is entered
  React.useEffect(() => {
    if (user) {
      setEditForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        secondLastName: user.secondLastName || "",
        phone: user.phone || "",
      });
    }
  }, [user, editing]);

  const fullName = [user?.firstName, user?.lastName, user?.secondLastName]
    .filter(Boolean)
    .join(" ");

  // ============================================
  // Handlers
  // ============================================
  const handleStartEdit = () => {
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    // Reset form to current user data
    if (user) {
      setEditForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        secondLastName: user.secondLastName || "",
        phone: user.phone || "",
      });
    }
  };

  const handleSave = async () => {
    // Basic validation
    if (!editForm.firstName.trim()) {
      toast({ title: "Error", description: "El nombre es requerido.", variant: "destructive" });
      return;
    }
    if (!editForm.lastName.trim()) {
      toast({ title: "Error", description: "El apellido paterno es requerido.", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      await usersService.updateMe({
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        secondLastName: editForm.secondLastName.trim(),
        phone: editForm.phone.trim(),
      });
      toast({ title: "Perfil actualizado", description: "Tus datos fueron guardados.", variant: "success" });
      setEditing(false);
      await refreshUser();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo actualizar el perfil.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    // Validations
    if (!passwordForm.currentPassword) {
      toast({ title: "Error", description: "Ingresa tu contrasena actual.", variant: "destructive" });
      return;
    }
    if (!passwordForm.newPassword) {
      toast({ title: "Error", description: "Ingresa la nueva contrasena.", variant: "destructive" });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast({ title: "Error", description: "La nueva contrasena debe tener al menos 8 caracteres.", variant: "destructive" });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: "Error", description: "Las contrasenas no coinciden.", variant: "destructive" });
      return;
    }

    try {
      setChangingPassword(true);
      await api.post("/auth/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast({ title: "Contrasena actualizada", description: "Tu contrasena fue cambiada exitosamente.", variant: "success" });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo cambiar la contrasena.", variant: "destructive" });
    } finally {
      setChangingPassword(false);
    }
  };

  // ============================================
  // Render
  // ============================================
  return (
    <DashboardLayout title="Mi perfil" subtitle="Informacion de tu cuenta">
      <div className="space-y-6">
        <PageHeader
          title="Mi perfil"
          description="Revisa y edita la informacion de tu cuenta"
          actions={
            !editing ? (
              <Button variant="outline" onClick={handleStartEdit}>
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={handleCancelEdit} disabled={saving}>
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            )
          }
        />

        {/* General Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informacion general</CardTitle>
            <CardDescription>Datos principales asociados a tu cuenta</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {editing ? (
              <>
                <EditRow
                  label="Nombre"
                  value={editForm.firstName}
                  onChange={(v) => setEditForm((f) => ({ ...f, firstName: v }))}
                  required
                />
                <EditRow
                  label="Apellido paterno"
                  value={editForm.lastName}
                  onChange={(v) => setEditForm((f) => ({ ...f, lastName: v }))}
                  required
                />
                <EditRow
                  label="Apellido materno"
                  value={editForm.secondLastName}
                  onChange={(v) => setEditForm((f) => ({ ...f, secondLastName: v }))}
                />
                <div className="flex flex-col gap-1 py-2">
                  <p className="text-xs text-muted-foreground">Rol</p>
                  <div className="pt-1">
                    <RoleBadge role={user?.profileType} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <InfoRow label="Nombre" value={fullName || user?.fullName} />
                <div className="flex flex-col gap-1 py-2">
                  <p className="text-xs text-muted-foreground">Rol</p>
                  <div>
                    <RoleBadge role={user?.profileType} />
                  </div>
                </div>
                <InfoRow label="RFC" value={null} />
                <InfoRow label="Zona horaria" value={timeZone} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contacto</CardTitle>
            <CardDescription>Informacion de contacto para notificaciones</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {editing ? (
              <>
                <InfoRow label="Correo" value={user?.email} />
                <EditRow
                  label="Telefono"
                  value={editForm.phone}
                  onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))}
                  placeholder="+52 55 1234 5678"
                />
              </>
            ) : (
              <>
                <InfoRow label="Correo" value={user?.email} />
                <InfoRow label="Telefono" value={user?.phone} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Address (view only, not editable yet) */}
        {!editing && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Direccion</CardTitle>
              <CardDescription>Datos de domicilio registrados</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow label="Calle y numero" value={null} />
              <InfoRow label="Colonia" value={null} />
              <InfoRow label="Ciudad" value={null} />
              <InfoRow label="Estado" value={null} />
              <InfoRow label="Codigo postal" value={null} />
              <InfoRow label="Pais" value="Mexico" />
            </CardContent>
          </Card>
        )}

        {/* Change Password */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-lg">Cambiar contrasena</CardTitle>
                <CardDescription>Actualiza tu contrasena de acceso</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="max-w-md space-y-4">
            {/* Current Password */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Contrasena actual</label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))
                  }
                  placeholder="Ingresa tu contrasena actual"
                  className="h-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Nueva contrasena</label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))
                  }
                  placeholder="Minimo 8 caracteres"
                  className="h-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Confirmar nueva contrasena</label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))
                  }
                  placeholder="Repite la nueva contrasena"
                  className="h-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button onClick={handleChangePassword} disabled={changingPassword} className="mt-2">
              <Lock className="w-4 h-4 mr-2" />
              {changingPassword ? "Cambiando..." : "Cambiar contrasena"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
