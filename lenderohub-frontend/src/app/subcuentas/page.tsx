"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout, PageHeader } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSubaccounts } from "@/hooks/useApi";
import { subaccountsService } from "@/services";
import { usersService } from "@/services/users.service";
import { formatCurrency } from "@/lib/utils";
import { Plus, Search, Wallet, TrendingUp, Building2, LayoutGrid, List, ChevronRight, Layers } from "lucide-react";
import { SubaccountCard } from "@/components/subaccounts/SubaccountCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { SubaccountCategory } from "@/types/api.types";
import { RequirePermission } from "@/components/auth/RequirePermission";

type FilterType = "all" | "client" | "internal";
type ViewMode = "grid" | "list";

export default function SubcuentasPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();
  // Include internal accounts for users with permission
  const canViewInternal = hasPermission("cost_centres:read");
  const { data: subaccountsData, isLoading, error, refetch } = useSubaccounts({
    includeInternal: canViewInternal,
  });
  const subaccounts = useMemo(() => subaccountsData ?? [], [subaccountsData]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("subcuentas-view-mode");
      return (saved === "list" || saved === "grid") ? saved : "grid";
    }
    return "grid";
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Persist view mode preference
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("subcuentas-view-mode", mode);
  };

  const canCreate = hasPermission("subaccounts:create") && ["corporate", "administrator"].includes(user?.profileType || "");
  const [costCentres, setCostCentres] = useState<{ id: string; alias: string }[]>([]);
  const [createForm, setCreateForm] = useState({
    name: "",
    costCentreId: "",
  });

  useEffect(() => {
    if (!canCreate) return;
    let isMounted = true;

    usersService
      .getFormOptions()
      .then((response) => {
        const options = response.data?.costCentres || [];
        if (!isMounted) return;
        setCostCentres(options.map((cc) => ({ id: cc.id, alias: cc.alias })));
        if (options.length === 1) {
          setCreateForm((prev) => ({ ...prev, costCentreId: options[0].id }));
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setCostCentres([]);
      });

    return () => {
      isMounted = false;
    };
  }, [canCreate]);

  const filteredAccounts = useMemo(() => {
    return subaccounts.filter((account) => {
      const matchesSearch = account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.clabeNumber?.includes(searchTerm) ||
        account.costCentreAlias?.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesFilter = true;
      if (filterType === "client") {
        matchesFilter = account.category === "client";
      } else if (filterType === "internal") {
        matchesFilter = account.category === "internal";
      }

      return matchesSearch && matchesFilter;
    });
  }, [subaccounts, searchTerm, filterType]);

  const totalBalance = useMemo(
    () => subaccounts.reduce((sum, acc) => sum + acc.balance, 0),
    [subaccounts]
  );

  const clientCount = useMemo(
    () => subaccounts.filter((acc) => acc.category === "client").length,
    [subaccounts]
  );

  const internalCount = useMemo(
    () => subaccounts.filter((acc) => acc.category === "internal").length,
    [subaccounts]
  );

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast({
        title: "Nombre requerido",
        description: "Ingresa un nombre para la subcuenta.",
        variant: "destructive",
      });
      return;
    }
    if (!createForm.costCentreId) {
      toast({
        title: "CECO requerido",
        description: "Selecciona un CECO para la subcuenta.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await subaccountsService.createSubaccount({
        name: createForm.name.trim(),
        costCentreId: createForm.costCentreId,
      });
      await refetch();
      setIsCreateOpen(false);
      setCreateForm({ name: "", costCentreId: costCentres.length === 1 ? costCentres[0].id : "" });

      const clabeMessage = created.clabeNumber
        ? `CLABE: ${created.clabeNumber}`
        : "La subcuenta fue creada correctamente en Finco.";

      toast({
        title: "Subcuenta creada",
        description: clabeMessage,
      });
    } catch (err: any) {
      toast({
        title: "Error al crear subcuenta",
        description: err?.message || "No se pudo crear la subcuenta.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filterOptions: { value: FilterType; label: string; count: number }[] = [
    { value: "all", label: "Todas", count: subaccounts.length },
    { value: "client", label: "Clientes", count: clientCount },
    ...(canViewInternal && internalCount > 0
      ? [{ value: "internal" as FilterType, label: "Internas", count: internalCount }]
      : []),
  ];

  return (
    <DashboardLayout title="Subcuentas" subtitle="Cuentas reales de Finco">
      <RequirePermission permission="subaccounts:read" fallbackUrl="/">
      <div className="space-y-6">
        <PageHeader
          title="Subcuentas"
          description="Administra tus cuentas reales y su cash management"
          actions={
            canCreate ? (
              <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
                <Plus size={16} />
                Nueva Subcuenta
              </Button>
            ) : null
          }
        />

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error.message || "Ocurrió un error cargando las subcuentas."}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Wallet className="text-primary" size={24} />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Balance Total</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? "..." : formatCurrency(totalBalance)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <TrendingUp className="text-success" size={24} />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Cuentas Cliente</p>
                  <p className="text-2xl font-bold text-success">
                    {isLoading ? "..." : clientCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {canViewInternal && (
            <Card hover>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                    <Building2 className="text-warning" size={24} />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Cuentas Internas</p>
                    <p className="text-2xl font-bold text-warning">
                      {isLoading ? "..." : internalCount}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Search, Filters, and View Toggle */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              placeholder="Buscar por nombre, CLABE o CECO..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            {filterOptions.map((option) => (
              <Button
                key={option.value}
                variant={filterType === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType(option.value)}
                className="gap-2"
              >
                {option.label}
                <span className="text-xs opacity-70">({option.count})</span>
              </Button>
            ))}
          </div>
          {/* View Toggle */}
          <div className="flex gap-1 border rounded-lg p-1">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewModeChange("grid")}
              className="px-2"
              title="Vista de tarjetas"
            >
              <LayoutGrid size={18} />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewModeChange("list")}
              className="px-2"
              title="Vista de lista"
            >
              <List size={18} />
            </Button>
          </div>
        </div>

        {/* Subaccounts View */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Cargando subcuentas...
          </div>
        ) : filteredAccounts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {searchTerm || filterType !== "all"
                ? "No se encontraron subcuentas con los filtros aplicados."
                : "No hay subcuentas disponibles."}
            </CardContent>
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccounts.map((account) => (
              <SubaccountCard
                key={account.id}
                id={account.id}
                name={account.name}
                costCentreAlias={account.costCentreAlias}
                clabeNumber={account.clabeNumber}
                balance={account.balance}
                tag={account.tag}
                category={account.category}
                hasVirtualBags={account.hasVirtualBags}
                virtualBagsCount={account.virtualBagsCount}
                onClick={() => router.push(`/subcuentas/${account.id}`)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>CECO</TableHead>
                  <TableHead>CLABE</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Bolsas</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map((account) => (
                  <TableRow
                    key={account.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/subcuentas/${account.id}`)}
                  >
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell className="text-muted-foreground">{account.costCentreAlias || "-"}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">{account.clabeNumber || "-"}</TableCell>
                    <TableCell>{formatCurrency(account.balance)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={account.category === "internal" ? "outline" : account.tag === "concentration" ? "default" : "secondary"}
                        className={account.category === "internal" ? "border-warning text-warning" : ""}
                      >
                        {account.category === "internal" ? "Interna" : account.tag === "concentration" ? "Concentradora" : "Regular"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {account.hasVirtualBags ? (
                        <div className="flex items-center gap-1.5 text-success">
                          <Layers size={14} />
                          <span className="text-sm">{account.virtualBagsCount ?? 0}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Subcuenta (Finco)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ej. Operaciones"
              />
            </div>
            <div>
              <Label htmlFor="cost-centre">CECO</Label>
              {costCentres.length === 1 ? (
                <div className="px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground">
                  {costCentres[0].alias}
                  <input type="hidden" value={costCentres[0].id} />
                </div>
              ) : (
                <select
                  id="cost-centre"
                  value={createForm.costCentreId}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, costCentreId: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 border-border"
                  disabled={costCentres.length === 0}
                >
                  <option value="">Selecciona un CECO</option>
                  {costCentres.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.alias}
                    </option>
                  ))}
                </select>
              )}
              {costCentres.length === 1 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Solo tienes acceso a este CECO.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? "Creando..." : "Crear Subcuenta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </RequirePermission>
    </DashboardLayout>
  );
}
