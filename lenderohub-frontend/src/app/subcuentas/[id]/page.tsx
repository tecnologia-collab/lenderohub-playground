"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout, PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSubaccount, useSubaccountVirtualBags } from "@/hooks/useApi";
import { subaccountsService } from "@/services";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import {
  ArrowLeft,
  Plus,
  Wallet,
  PieChart,
  Layers,
  ArrowLeftRight,
  CreditCard,
  Pencil,
  History,
  Users,
  Trash2,
  ChevronDown,
} from "lucide-react";
import type { SubaccountVirtualBag, SubaccountTransaction, SubaccountAssignment } from "@/types/api.types";

// Color options for virtual bags
const COLOR_OPTIONS = [
  { value: "#10b981", label: "Verde" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#8b5cf6", label: "Morado" },
  { value: "#f59e0b", label: "Naranja" },
  { value: "#ef4444", label: "Rojo" },
  { value: "#3b82f6", label: "Azul" },
  { value: "#ec4899", label: "Rosa" },
  { value: "#6366f1", label: "Indigo" },
];

// Transaction type display config
const TRANSACTION_TYPE_CONFIG: Record<string, { label: string; variant: "default" | "success" | "destructive" | "pending" | "warning" }> = {
  transfer_in: { label: "SPEI In", variant: "success" },
  transfer_out: { label: "SPEI Out", variant: "destructive" },
  virtual_in: { label: "Comision", variant: "pending" },
  internal: { label: "Interno", variant: "default" },
};

// Transaction status display config
const TRANSACTION_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "success" | "destructive" | "warning" | "secondary" }> = {
  Liquidated: { label: "Liquidado", variant: "success" },
  Completed: { label: "Completado", variant: "success" },
  Sent: { label: "Enviado", variant: "warning" },
  Pending: { label: "Pendiente", variant: "warning" },
  Processing: { label: "Procesando", variant: "warning" },
  New: { label: "Nuevo", variant: "secondary" },
  Failed: { label: "Fallido", variant: "destructive" },
  Cancelled: { label: "Cancelado", variant: "destructive" },
};

type TransactionFilter = "all" | "in" | "out";

export default function SubcuentaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const subaccountId = params.id as string;

  const { data: subaccount, isLoading: loadingSubaccount, error: subaccountError, refetch: refetchSubaccount } = useSubaccount(subaccountId);
  const { data: virtualBagsData, isLoading: loadingBags, refetch: refetchBags } = useSubaccountVirtualBags(subaccountId);
  const virtualBags = useMemo(() => virtualBagsData ?? [], [virtualBagsData]);

  // Create bag dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    color: "#10b981",
    distributionPercentage: 0,
  });

  // Edit bag dialog state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingBag, setEditingBag] = useState<SubaccountVirtualBag | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    color: "#10b981",
    distributionPercentage: 0,
  });

  // Transfer dialog state
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromBagId: "",
    toBagId: "",
    amount: "",
    description: "",
  });

  // Transaction history state
  const [transactions, setTransactions] = useState<SubaccountTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>("all");
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionHasMore, setTransactionHasMore] = useState(false);
  const [transactionTotal, setTransactionTotal] = useState(0);
  const [loadingMoreTransactions, setLoadingMoreTransactions] = useState(false);

  // Assignments state
  const [assignments, setAssignments] = useState<SubaccountAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignForm, setAssignForm] = useState({
    userProfileId: "",
    transferFrom: true,
    transferTo: true,
  });
  const [removingAssignment, setRemovingAssignment] = useState<string | null>(null);

  const totalBagsBalance = useMemo(
    () => virtualBags.reduce((sum, bag) => sum + bag.balance, 0),
    [virtualBags]
  );

  const totalDistributedPercentage = useMemo(
    () => virtualBags.reduce((sum, bag) => sum + bag.distributionPercentage, 0),
    [virtualBags]
  );

  const availablePercentage = 100 - totalDistributedPercentage;

  // Available percentage for edit (excluding the editing bag's current percentage)
  const editAvailablePercentage = useMemo(() => {
    if (!editingBag) return availablePercentage;
    return availablePercentage + editingBag.distributionPercentage;
  }, [availablePercentage, editingBag]);

  // Load transactions
  const loadTransactions = useCallback(async (page: number, filter: TransactionFilter, append: boolean = false) => {
    if (page === 1) {
      setLoadingTransactions(true);
    } else {
      setLoadingMoreTransactions(true);
    }
    try {
      const typeParam = filter === "all" ? undefined : filter;
      const result = await subaccountsService.getTransactions(subaccountId, {
        type: typeParam,
        page,
        limit: 10,
      });
      if (append) {
        setTransactions((prev) => [...prev, ...result.transactions]);
      } else {
        setTransactions(result.transactions);
      }
      setTransactionHasMore(result.hasMore);
      setTransactionTotal(result.total);
      setTransactionPage(page);
    } catch {
      toast({
        title: "Error",
        description: "No se pudieron cargar los movimientos.",
        variant: "destructive",
      });
    } finally {
      setLoadingTransactions(false);
      setLoadingMoreTransactions(false);
    }
  }, [subaccountId, toast]);

  // Load assignments
  const loadAssignments = useCallback(async () => {
    setLoadingAssignments(true);
    try {
      const result = await subaccountsService.getAssignments(subaccountId);
      setAssignments(result);
    } catch {
      // Silently fail - assignments may not be available for all subaccounts
      setAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  }, [subaccountId]);

  // Initial data load for transactions and assignments
  useEffect(() => {
    loadTransactions(1, "all");
    loadAssignments();
  }, [loadTransactions, loadAssignments]);

  // Handle filter change for transactions
  const handleFilterChange = (filter: TransactionFilter) => {
    setTransactionFilter(filter);
    loadTransactions(1, filter);
  };

  // Handle load more transactions
  const handleLoadMore = () => {
    loadTransactions(transactionPage + 1, transactionFilter, true);
  };

  // Open edit dialog
  const openEditDialog = (bag: SubaccountVirtualBag) => {
    setEditingBag(bag);
    setEditForm({
      name: bag.name,
      description: bag.description || "",
      color: bag.color || "#6366f1",
      distributionPercentage: bag.distributionPercentage,
    });
    setIsEditOpen(true);
  };

  const handleEditBag = async () => {
    if (!editingBag) return;

    if (!editForm.name.trim()) {
      toast({
        title: "Nombre requerido",
        description: "Ingresa un nombre para la bolsa.",
        variant: "destructive",
      });
      return;
    }

    if (editForm.distributionPercentage > editAvailablePercentage) {
      toast({
        title: "Porcentaje excedido",
        description: `El porcentaje maximo disponible es ${editAvailablePercentage}%`,
        variant: "destructive",
      });
      return;
    }

    setIsEditing(true);
    try {
      await subaccountsService.updateVirtualBag(subaccountId, editingBag.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
        color: editForm.color,
        distributionPercentage: editForm.distributionPercentage,
      });
      await Promise.all([refetchSubaccount(), refetchBags()]);
      setIsEditOpen(false);
      setEditingBag(null);
      toast({
        title: "Bolsa actualizada",
        description: "La bolsa virtual fue actualizada correctamente.",
      });
    } catch (err: any) {
      toast({
        title: "Error al actualizar bolsa",
        description: err?.message || "No se pudo actualizar la bolsa virtual.",
        variant: "destructive",
      });
    } finally {
      setIsEditing(false);
    }
  };

  const handleCreateBag = async () => {
    if (!createForm.name.trim()) {
      toast({
        title: "Nombre requerido",
        description: "Ingresa un nombre para la bolsa.",
        variant: "destructive",
      });
      return;
    }

    if (createForm.distributionPercentage > availablePercentage) {
      toast({
        title: "Porcentaje excedido",
        description: `El porcentaje maximo disponible es ${availablePercentage}%`,
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      await subaccountsService.createVirtualBag(subaccountId, {
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        color: createForm.color,
        distributionPercentage: createForm.distributionPercentage,
      });
      await Promise.all([refetchSubaccount(), refetchBags()]);
      setIsCreateOpen(false);
      setCreateForm({ name: "", description: "", color: "#10b981", distributionPercentage: 0 });
      toast({
        title: "Bolsa creada",
        description: "La bolsa virtual fue creada correctamente.",
      });
    } catch (err: any) {
      toast({
        title: "Error al crear bolsa",
        description: err?.message || "No se pudo crear la bolsa virtual.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleTransfer = async () => {
    const amount = parseFloat(transferForm.amount);
    if (!transferForm.fromBagId || !transferForm.toBagId) {
      toast({
        title: "Selecciona las bolsas",
        description: "Debes seleccionar bolsa origen y destino.",
        variant: "destructive",
      });
      return;
    }

    if (transferForm.fromBagId === transferForm.toBagId) {
      toast({
        title: "Bolsas iguales",
        description: "Origen y destino deben ser diferentes.",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Monto invalido",
        description: "Ingresa un monto mayor a 0.",
        variant: "destructive",
      });
      return;
    }

    const fromBag = virtualBags.find((b) => b.id === transferForm.fromBagId);
    if (fromBag && amount > fromBag.balance) {
      toast({
        title: "Saldo insuficiente",
        description: `La bolsa origen solo tiene ${formatCurrency(fromBag.balance)} disponible.`,
        variant: "destructive",
      });
      return;
    }

    setIsTransferring(true);
    try {
      await subaccountsService.transferBetweenBags(subaccountId, {
        fromBagId: transferForm.fromBagId,
        toBagId: transferForm.toBagId,
        amount,
        description: transferForm.description.trim() || undefined,
      });
      await refetchBags();
      setIsTransferOpen(false);
      setTransferForm({ fromBagId: "", toBagId: "", amount: "", description: "" });
      toast({
        title: "Transferencia exitosa",
        description: "Los fondos fueron transferidos correctamente.",
      });
    } catch (err: any) {
      toast({
        title: "Error en transferencia",
        description: err?.message || "No se pudo completar la transferencia.",
        variant: "destructive",
      });
    } finally {
      setIsTransferring(false);
    }
  };

  const handleAssignUser = async () => {
    if (!assignForm.userProfileId.trim()) {
      toast({
        title: "ID requerido",
        description: "Ingresa el ID del perfil de usuario.",
        variant: "destructive",
      });
      return;
    }

    setIsAssigning(true);
    try {
      await subaccountsService.createAssignment(subaccountId, {
        userProfileId: assignForm.userProfileId.trim(),
        permissions: {
          transferFrom: assignForm.transferFrom,
          transferTo: assignForm.transferTo,
        },
      });
      await loadAssignments();
      setIsAssignOpen(false);
      setAssignForm({ userProfileId: "", transferFrom: true, transferTo: true });
      toast({
        title: "Usuario asignado",
        description: "El usuario fue asignado a la subcuenta correctamente.",
      });
    } catch (err: any) {
      toast({
        title: "Error al asignar",
        description: err?.message || "No se pudo asignar el usuario.",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    setRemovingAssignment(assignmentId);
    try {
      await subaccountsService.removeAssignment(subaccountId, assignmentId);
      await loadAssignments();
      toast({
        title: "Asignacion removida",
        description: "El usuario fue removido de la subcuenta.",
      });
    } catch (err: any) {
      toast({
        title: "Error al remover",
        description: err?.message || "No se pudo remover la asignacion.",
        variant: "destructive",
      });
    } finally {
      setRemovingAssignment(null);
    }
  };

  if (subaccountError) {
    return (
      <DashboardLayout title="Error" subtitle="Subcuenta no encontrada">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <p className="text-muted-foreground">No se pudo cargar la subcuenta.</p>
          <Button onClick={() => router.push("/subcuentas")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Subcuentas
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const pageTitle = loadingSubaccount ? "Cargando..." : (subaccount?.name || "Subcuenta");
  const pageDescription = subaccount?.clabeNumber
    ? `CLABE: ${subaccount.clabeNumber}`
    : subaccount?.tag === "concentration"
    ? "Cuenta Concentradora"
    : "Subcuenta Finco";

  return (
    <DashboardLayout
      title={subaccount?.name || "Subcuenta"}
      subtitle="Cash Management - Bolsas Virtuales"
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/subcuentas")}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft size={18} />
          </Button>
          <span className="text-muted-foreground text-sm">Volver a Subcuentas</span>
        </div>

        <PageHeader
          title={pageTitle}
          description={pageDescription}
          actions={
            <div className="flex gap-2">
              {virtualBags.length >= 2 && (
                <Button variant="outline" onClick={() => setIsTransferOpen(true)}>
                  <ArrowLeftRight size={16} className="mr-2" />
                  Transferir
                </Button>
              )}
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus size={16} className="mr-2" />
                Nueva Bolsa
              </Button>
            </div>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <CreditCard className="text-primary" size={24} />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Balance Finco</p>
                  <p className="text-2xl font-bold">
                    {loadingSubaccount ? "..." : formatCurrency(subaccount?.balance || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <Wallet className="text-success" size={24} />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">En Bolsas</p>
                  <p className="text-2xl font-bold text-success">
                    {loadingBags ? "..." : formatCurrency(totalBagsBalance)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                  <PieChart className="text-warning" size={24} />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Distribuido</p>
                  <p className="text-2xl font-bold text-warning">
                    {loadingBags ? "..." : `${totalDistributedPercentage.toFixed(1)}%`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
                  <Layers className="text-info" size={24} />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Bolsas Activas</p>
                  <p className="text-2xl font-bold text-info">
                    {loadingBags ? "..." : virtualBags.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Virtual Bags Table */}
        <Card>
          <CardHeader>
            <CardTitle>Bolsas Virtuales</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripcion</TableHead>
                <TableHead>Distribucion</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead className="w-[60px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingBags ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Cargando bolsas...
                  </TableCell>
                </TableRow>
              ) : virtualBags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Wallet className="h-8 w-8 text-muted-foreground/50" />
                      <p>No hay bolsas virtuales</p>
                      <Button size="sm" variant="outline" onClick={() => setIsCreateOpen(true)}>
                        <Plus size={14} className="mr-1" />
                        Crear primera bolsa
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                virtualBags.map((bag) => (
                  <TableRow key={bag.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: bag.color || "#6366f1" }}
                        />
                        <span className="font-medium">{bag.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {bag.description || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(bag.distributionPercentage, 100)}%`,
                              backgroundColor: bag.color || "#6366f1",
                            }}
                          />
                        </div>
                        <span className="text-sm">{bag.distributionPercentage}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(bag.balance)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openEditDialog(bag)}
                        title="Editar bolsa"
                      >
                        <Pencil size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={20} className="text-muted-foreground" />
                <CardTitle>Historial de Movimientos</CardTitle>
              </div>
              {transactionTotal > 0 && (
                <span className="text-sm text-muted-foreground">{transactionTotal} movimientos</span>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              {(["all", "in", "out"] as TransactionFilter[]).map((filter) => {
                const labels: Record<TransactionFilter, string> = { all: "Todos", in: "Ingresos", out: "Egresos" };
                return (
                  <Button
                    key={filter}
                    variant={transactionFilter === filter ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleFilterChange(filter)}
                  >
                    {labels[filter]}
                  </Button>
                );
              })}
            </div>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descripcion</TableHead>
                <TableHead>Contraparte</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingTransactions ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Cargando movimientos...
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <History className="h-8 w-8 text-muted-foreground/50" />
                      <p>No hay movimientos registrados</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => {
                  const typeConfig = TRANSACTION_TYPE_CONFIG[tx.type] || { label: tx.type, variant: "default" as const };
                  const statusConfig = TRANSACTION_STATUS_CONFIG[tx.status] || { label: tx.status, variant: "secondary" as const };
                  const isIncoming = tx.type === "transfer_in" || tx.type === "virtual_in";
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">
                        <div>{formatDate(tx.createdAt)}</div>
                        <div className="text-muted-foreground text-xs">{formatTime(tx.createdAt)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={typeConfig.variant}>{typeConfig.label}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={tx.description}>
                        {tx.description}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tx.counterparty || "-"}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${isIncoming ? "text-success" : "text-destructive"}`}>
                        {isIncoming ? "+" : "-"}{formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {transactionHasMore && !loadingTransactions && (
            <div className="flex justify-center py-4 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoadMore}
                disabled={loadingMoreTransactions}
              >
                {loadingMoreTransactions ? "Cargando..." : (
                  <>
                    <ChevronDown size={14} className="mr-1" />
                    Cargar mas
                  </>
                )}
              </Button>
            </div>
          )}
        </Card>

        {/* Assigned Users */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-muted-foreground" />
                <CardTitle>Usuarios Asignados</CardTitle>
              </div>
              <Button size="sm" onClick={() => setIsAssignOpen(true)}>
                <Plus size={14} className="mr-1" />
                Asignar Usuario
              </Button>
            </div>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Permisos</TableHead>
                <TableHead className="w-[60px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingAssignments ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Cargando usuarios...
                  </TableCell>
                </TableRow>
              ) : assignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-8 w-8 text-muted-foreground/50" />
                      <p>No hay usuarios asignados</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">
                      {assignment.userProfile.firstName} {assignment.userProfile.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {assignment.userProfile.email}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        {assignment.permissions.transferFrom && (
                          <Badge variant="default">Enviar</Badge>
                        )}
                        {assignment.permissions.transferTo && (
                          <Badge variant="success">Recibir</Badge>
                        )}
                        {!assignment.permissions.transferFrom && !assignment.permissions.transferTo && (
                          <Badge variant="secondary">Solo lectura</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveAssignment(assignment.id)}
                        disabled={removingAssignment === assignment.id}
                        title="Remover usuario"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Create Bag Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Bolsa Virtual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="bag-name">Nombre</Label>
              <Input
                id="bag-name"
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ej. Nomina, Proveedores"
              />
            </div>
            <div>
              <Label htmlFor="bag-description">Descripcion (opcional)</Label>
              <Input
                id="bag-description"
                value={createForm.description}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Descripcion de la bolsa"
              />
            </div>
            <div>
              <Label htmlFor="bag-percentage">
                Porcentaje de Distribucion (disponible: {availablePercentage}%)
              </Label>
              <Input
                id="bag-percentage"
                type="number"
                min={0}
                max={availablePercentage}
                value={createForm.distributionPercentage}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    distributionPercentage: Math.max(0, Math.min(availablePercentage, parseFloat(e.target.value) || 0)),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Los fondos entrantes se distribuiran automaticamente segun este porcentaje.
              </p>
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setCreateForm((prev) => ({ ...prev, color: color.value }))}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      createForm.color === color.value
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateBag} disabled={isCreating}>
              {isCreating ? "Creando..." : "Crear Bolsa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Bag Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditingBag(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Bolsa Virtual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-bag-name">Nombre</Label>
              <Input
                id="edit-bag-name"
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre de la bolsa"
              />
            </div>
            <div>
              <Label htmlFor="edit-bag-description">Descripcion (opcional)</Label>
              <Input
                id="edit-bag-description"
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Descripcion de la bolsa"
              />
            </div>
            <div>
              <Label htmlFor="edit-bag-percentage">
                Porcentaje de Distribucion (disponible: {editAvailablePercentage}%)
              </Label>
              <Input
                id="edit-bag-percentage"
                type="number"
                min={0}
                max={editAvailablePercentage}
                value={editForm.distributionPercentage}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    distributionPercentage: Math.max(0, Math.min(editAvailablePercentage, parseFloat(e.target.value) || 0)),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Los fondos entrantes se distribuiran automaticamente segun este porcentaje.
              </p>
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setEditForm((prev) => ({ ...prev, color: color.value }))}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      editForm.color === color.value
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditOpen(false); setEditingBag(null); }}>
              Cancelar
            </Button>
            <Button onClick={handleEditBag} disabled={isEditing}>
              {isEditing ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir entre Bolsas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="from-bag">Bolsa Origen</Label>
              <select
                id="from-bag"
                value={transferForm.fromBagId}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, fromBagId: e.target.value }))}
                className="w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 border-border"
              >
                <option value="">Selecciona origen</option>
                {virtualBags.map((bag) => (
                  <option key={bag.id} value={bag.id}>
                    {bag.name} - {formatCurrency(bag.balance)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="to-bag">Bolsa Destino</Label>
              <select
                id="to-bag"
                value={transferForm.toBagId}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, toBagId: e.target.value }))}
                className="w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 border-border"
              >
                <option value="">Selecciona destino</option>
                {virtualBags
                  .filter((b) => b.id !== transferForm.fromBagId)
                  .map((bag) => (
                    <option key={bag.id} value={bag.id}>
                      {bag.name} - {formatCurrency(bag.balance)}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <Label htmlFor="transfer-amount">Monto</Label>
              <Input
                id="transfer-amount"
                type="number"
                min={0}
                step={0.01}
                value={transferForm.amount}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="transfer-description">Concepto (opcional)</Label>
              <Input
                id="transfer-description"
                value={transferForm.description}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Descripcion de la transferencia"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTransferOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleTransfer} disabled={isTransferring}>
              {isTransferring ? "Transfiriendo..." : "Transferir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign User Dialog */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="assign-user-id">ID del Perfil de Usuario</Label>
              <Input
                id="assign-user-id"
                value={assignForm.userProfileId}
                onChange={(e) => setAssignForm((prev) => ({ ...prev, userProfileId: e.target.value }))}
                placeholder="Ingresa el ID del perfil"
              />
              <p className="text-xs text-muted-foreground mt-1">
                El administrador debe proporcionar el ID del perfil de usuario a asignar.
              </p>
            </div>
            <div className="space-y-3">
              <Label>Permisos</Label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignForm.transferFrom}
                    onChange={(e) => setAssignForm((prev) => ({ ...prev, transferFrom: e.target.checked }))}
                    className="rounded border-border"
                  />
                  <span className="text-sm">Enviar transferencias</span>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignForm.transferTo}
                    onChange={(e) => setAssignForm((prev) => ({ ...prev, transferTo: e.target.checked }))}
                    className="rounded border-border"
                  />
                  <span className="text-sm">Recibir transferencias</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAssignUser} disabled={isAssigning}>
              {isAssigning ? "Asignando..." : "Asignar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
