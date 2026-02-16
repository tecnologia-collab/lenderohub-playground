"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { RoleBadge } from "@/components/users/RoleBadge";
import {
  usersService,
  User,
  UserProfileType,
  ROLE_LABELS,
} from "@/services/users.service";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  UserCheck,
  UserX,
  Shield,
  ShieldCheck,
  Search,
  Plus,
  MoreHorizontal,
  UserMinus,
  UserPlus,
  KeyRound,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import AddUserForm from "@/components/users/AddUserForm";
import { PermissionsDialog } from "@/components/users/PermissionsDialog";
import { RequirePermission } from "@/components/auth/RequirePermission";

// Stats Card Component
function StatsCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
            {value}
          </p>
        </div>
        <div className={cn("p-3 rounded-xl", color)}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function UsuariosPage() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();

  // State
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    byRole: {} as Record<string, number>,
  });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Dialogs
  const [showAddUser, setShowAddUser] = useState(false);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: "deactivate" | "reactivate" | "reset2fa" | "resetPassword" | "resendInvitation" | null;
    user: User | null;
  }>({ open: false, type: null, user: null });
  const [permissionsDialog, setPermissionsDialog] = useState<{
    open: boolean;
    user: User | null;
  }>({ open: false, user: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const canUpdateUsers = hasPermission("users:update");
  const canDeleteUsers = hasPermission("users:delete");

  // Load users
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params: {
        search?: string;
        profileType?: UserProfileType;
        isActive?: boolean;
        page: number;
        limit: number;
      } = {
        page,
        limit: 20,
      };

      if (search) params.search = search;
      if (roleFilter !== "all") params.profileType = roleFilter as UserProfileType;
      if (statusFilter !== "all") params.isActive = statusFilter === "active";

      const response = await usersService.getUsers(params);
      setUsers(response.data);
      setTotalPages(response.meta.totalPages);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Error al cargar usuarios",
      });
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, page, toast]);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const response = await usersService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadStats();
  }, [loadUsers, loadStats]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Action handlers
  const handleAction = async () => {
    if (!actionDialog.user || !actionDialog.type) return;

    setActionLoading(true);
    try {
      const userId = actionDialog.user.id || actionDialog.user._id;
      if (!userId) throw new Error("ID de usuario no válido");

      switch (actionDialog.type) {
        case "deactivate":
          await usersService.deactivateUser(userId);
          toast({
            variant: "success",
            title: "Usuario desactivado",
            description: `${actionDialog.user.fullName} ha sido desactivado`,
          });
          break;
        case "reactivate":
          await usersService.reactivateUser(userId);
          toast({
            variant: "success",
            title: "Usuario reactivado",
            description: `${actionDialog.user.fullName} ha sido reactivado`,
          });
          break;
        case "reset2fa":
          await usersService.reset2FA(userId);
          toast({
            variant: "success",
            title: "2FA reseteado",
            description: `El usuario deberá configurar 2FA nuevamente`,
          });
          break;
        case "resetPassword":
          const result = await usersService.resetPassword(userId);
          setTempPassword(result.data.tempPassword);
          setActionLoading(false);
          return; // Don't close dialog yet
        case "resendInvitation":
          await usersService.resendInvitation(userId);
          toast({
            variant: "success",
            title: "Invitación enviada",
            description: `Se ha enviado un nuevo correo de invitación a ${actionDialog.user.email}`,
          });
          break;
      }

      setActionDialog({ open: false, type: null, user: null });
      loadUsers();
      loadStats();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Error al realizar la acción",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const copyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  const closePasswordDialog = () => {
    setTempPassword(null);
    setCopiedPassword(false);
    setActionDialog({ open: false, type: null, user: null });
  };

  const getActionDialogContent = () => {
    if (tempPassword) {
      return {
        title: "Contraseña temporal generada",
        description: "Proporciona esta contraseña al usuario de forma segura. Deberá cambiarla en su primer inicio de sesión.",
      };
    }

    switch (actionDialog.type) {
      case "deactivate":
        return {
          title: "Desactivar usuario",
          description: `¿Estás seguro de que deseas desactivar a ${actionDialog.user?.fullName}? El usuario no podrá acceder al sistema.`,
        };
      case "reactivate":
        return {
          title: "Reactivar usuario",
          description: `¿Estás seguro de que deseas reactivar a ${actionDialog.user?.fullName}?`,
        };
      case "reset2fa":
        return {
          title: "Resetear 2FA",
          description: `¿Estás seguro de que deseas resetear el 2FA de ${actionDialog.user?.fullName}? Deberá configurarlo nuevamente.`,
        };
      case "resetPassword":
        return {
          title: "Resetear contraseña",
          description: `¿Estás seguro de que deseas generar una nueva contraseña temporal para ${actionDialog.user?.fullName}?`,
        };
      case "resendInvitation":
        return {
          title: "Reenviar invitación",
          description: `¿Deseas reenviar el correo de invitación a ${actionDialog.user?.email}? El enlace anterior será invalidado.`,
        };
      default:
        return { title: "", description: "" };
    }
  };

  const dialogContent = getActionDialogContent();

  return (
    <DashboardLayout title="Usuarios" subtitle="Gestiona los usuarios del sistema">
      <RequirePermission allowedRoles={["corporate", "administrator"]} fallbackUrl="/">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Usuarios
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Gestiona los usuarios del sistema
            </p>
          </div>
        {hasPermission("users:create") && (
          <Button onClick={() => setShowAddUser(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Usuario
          </Button>
        )}
        </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total de usuarios"
          value={stats.total}
          icon={Users}
          color="bg-indigo-500"
        />
        <StatsCard
          title="Usuarios activos"
          value={stats.active}
          icon={UserCheck}
          color="bg-emerald-500"
        />
        <StatsCard
          title="Usuarios inactivos"
          value={stats.inactive}
          icon={UserX}
          color="bg-slate-500"
        />
        <StatsCard
          title="Con 2FA activo"
          value={Object.values(stats.byRole).reduce((a, b) => a + b, 0)}
          icon={Shield}
          color="bg-amber-500"
        />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filtrar por rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>2FA</TableHead>
              <TableHead>Último acceso</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                  No se encontraron usuarios
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow
                  key={user.id || user._id}
                  className={cn(
                    "cursor-pointer",
                    selectedUser?.id === user.id || selectedUser?._id === user._id
                      ? "bg-slate-50 dark:bg-slate-900/40"
                      : ""
                  )}
                  onClick={() => setSelectedUser(user)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {user.fullName}
                      </p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      return (
                        <RoleBadge role={user.profileType} />
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        user.isActive
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300"
                      )}
                    >
                      {user.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {user.twoFactorEnabled ? (
                      <Shield className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <span className="text-slate-400 text-sm">No configurado</span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleDateString("es-MX", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Nunca"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(canUpdateUsers || canDeleteUsers) ? (
                          <>
                            {canUpdateUsers && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setPermissionsDialog({
                                    open: true,
                                    user,
                                  })
                                }
                              >
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Permisos
                              </DropdownMenuItem>
                            )}
                            {canDeleteUsers && (
                              <>
                                <DropdownMenuSeparator />
                                {user.isActive ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setActionDialog({
                                        open: true,
                                        type: "deactivate",
                                        user,
                                      })
                                    }
                                  >
                                    <UserMinus className="h-4 w-4 mr-2" />
                                    Desactivar
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setActionDialog({
                                        open: true,
                                        type: "reactivate",
                                        user,
                                      })
                                    }
                                  >
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Reactivar
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {canUpdateUsers && (
                              <>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setActionDialog({
                                      open: true,
                                      type: "resendInvitation",
                                      user,
                                    })
                                  }
                                >
                                  <Mail className="h-4 w-4 mr-2" />
                                  Reenviar invitación
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setActionDialog({
                                      open: true,
                                      type: "reset2fa",
                                      user,
                                    })
                                  }
                                >
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Resetear 2FA
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setActionDialog({
                                      open: true,
                                      type: "resetPassword",
                                      user,
                                    })
                                  }
                                >
                                  <KeyRound className="h-4 w-4 mr-2" />
                                  Resetear contraseña
                                </DropdownMenuItem>
                              </>
                            )}
                          </>
                        ) : (
                          <DropdownMenuItem disabled className="opacity-60">
                            Sin permisos para acciones
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-500">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </div>

      {selectedUser && (
        <Card className="mt-6">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{selectedUser.fullName}</h3>
                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
              </div>
              <RoleBadge role={selectedUser.profileType} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">Estado</p>
                <p className="text-sm font-medium">
                  {selectedUser.isActive ? "Activo" : "Inactivo"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">2FA</p>
                <p className="text-sm font-medium">
                  {selectedUser.twoFactorEnabled ? "Configurado" : "Sin configurar"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">Ultimo acceso</p>
                <p className="text-sm font-medium">
                  {selectedUser.lastLoginAt
                    ? new Date(selectedUser.lastLoginAt).toLocaleDateString("es-MX", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Nunca"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add User Dialog */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent className="w-full max-w-2xl lg:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Usuario</DialogTitle>
            <DialogDescription>
              Crea un nuevo usuario en el sistema
            </DialogDescription>
          </DialogHeader>
          <AddUserForm
            onSuccess={() => {
              setShowAddUser(false);
              loadUsers();
              loadStats();
            }}
            onCancel={() => setShowAddUser(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog
        open={actionDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            if (tempPassword) {
              closePasswordDialog();
            } else {
              setActionDialog({ open: false, type: null, user: null });
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogContent.title}</DialogTitle>
            <DialogDescription>{dialogContent.description}</DialogDescription>
          </DialogHeader>

          {tempPassword && (
            <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                Contraseña temporal:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-white dark:bg-slate-900 rounded border font-mono text-lg">
                  {tempPassword}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyPassword}
                >
                  {copiedPassword ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            {tempPassword ? (
              <Button onClick={closePasswordDialog}>Cerrar</Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    setActionDialog({ open: false, type: null, user: null })
                  }
                  disabled={actionLoading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAction}
                  disabled={actionLoading}
                  variant={actionDialog.type === "deactivate" ? "destructive" : "default"}
                >
                  {actionLoading && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Confirmar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <PermissionsDialog
        user={permissionsDialog.user}
        open={permissionsDialog.open}
        onOpenChange={(open) =>
          setPermissionsDialog({ open, user: open ? permissionsDialog.user : null })
        }
      />
      </div>
      </RequirePermission>
    </DashboardLayout>
  );
}
