"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DashboardLayout, PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  Plus,
  Search,
  Building2,
  Layers,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Star,
  Copy,
  Settings,
  Eye,
  Power,
  PowerOff,
} from "lucide-react";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { AddCostCentreForm } from "@/components/cost-centres/AddCostCentreForm";
import { costCentresService, CostCentre } from "@/services/costCentres.service";
import { useToast } from "@/hooks/use-toast";
import { RequirePermission } from "@/components/auth/RequirePermission";

const statusConfig = {
  active: { label: "Activo", variant: "success" as const, icon: CheckCircle2 },
  disabled: { label: "Deshabilitado", variant: "secondary" as const, icon: XCircle },
};

const providerConfig = {
  finco: { label: "Finco", color: "bg-blue-500/10 text-blue-600" },
  stp: { label: "STP", color: "bg-purple-500/10 text-purple-600" },
};

export default function CentrosCostosPage() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "disabled">("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [costCentres, setCostCentres] = useState<CostCentre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canCreate = hasPermission("cost_centres:create");
  const canManage = hasPermission("cost_centres:manage");

  // Load cost centres on mount
  useEffect(() => {
    loadCostCentres();
  }, []);

  useEffect(() => {
    const isNew = searchParams?.get("new");
    if (isNew) {
      setShowAddForm(true);
    }
  }, [searchParams]);

  const loadCostCentres = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await costCentresService.getCostCentres();
      setCostCentres(data);
    } catch (err: any) {
      console.error('Error loading cost centres:', err);
      setError(err.message || 'Error al cargar centros de costos');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSuccess = (costCentre: CostCentre) => {
    toast({
      title: "Centro de Costos creado",
      description: `"${costCentre.alias}" creado con código ${costCentre.code}`,
      variant: "success",
    });
    setShowAddForm(false);
    loadCostCentres();
  };

  const handleAddError = (error: Error) => {
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive",
    });
  };

  const handleToggleStatus = async (costCentre: CostCentre) => {
    try {
      if (costCentre.disabled) {
        await costCentresService.enableCostCentre(costCentre.id);
        toast({
          title: "Centro de Costos habilitado",
          description: `"${costCentre.alias}" ha sido habilitado`,
          variant: "success",
        });
      } else {
        await costCentresService.disableCostCentre(costCentre.id);
        toast({
          title: "Centro de Costos deshabilitado",
          description: `"${costCentre.alias}" ha sido deshabilitado`,
        });
      }
      loadCostCentres();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Error al cambiar estado",
        variant: "destructive",
      });
    }
  };

  const handleSetDefault = async (costCentre: CostCentre) => {
    try {
      await costCentresService.setDefaultCostCentre(costCentre.id);
      toast({
        title: "Predeterminado actualizado",
        description: `"${costCentre.alias}" es ahora el centro de costos predeterminado`,
        variant: "success",
      });
      loadCostCentres();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Error al establecer predeterminado",
        variant: "destructive",
      });
    }
  };

  const copyClabe = (clabe: string) => {
    navigator.clipboard.writeText(clabe);
    toast({
      title: "CLABE copiada",
      description: clabe,
    });
  };

  const filteredCostCentres = costCentres.filter((cc) => {
    const matchesSearch =
      cc.alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cc.shortName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && !cc.disabled) ||
      (filterStatus === "disabled" && cc.disabled);
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: costCentres.length,
    active: costCentres.filter((cc) => !cc.disabled).length,
    disabled: costCentres.filter((cc) => cc.disabled).length,
  };

  return (
    <DashboardLayout title="Centros de Costos" subtitle="Gestion de centros de costos">
      <RequirePermission permission="cost_centres:read" fallbackUrl="/">
      <div className="space-y-6">
        <PageHeader
          title="Centros de Costos"
          description="Administra los centros de costos de tu organización"
          actions={
            canCreate && (
              <Button
                className="gap-2"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                {showAddForm ? (
                  <>
                    <X size={16} />
                    Cancelar
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Nuevo Centro de Costos
                  </>
                )}
              </Button>
            )
          }
        />

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
            <p className="flex-1 text-destructive">{error}</p>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setError(null)}
              className="text-destructive hover:text-destructive"
            >
              <X size={16} />
            </Button>
          </div>
        )}

        {/* Add Cost Centre Form */}
        {showAddForm && (
          <AddCostCentreForm
            onSuccess={handleAddSuccess}
            onError={handleAddError}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {/* Content with Loading Overlay */}
        <div className="relative min-h-[300px]">
          <LoadingOverlay isLoading={loading} message="Cargando centros de costos..." />

          <div className={loading ? 'opacity-50 pointer-events-none space-y-6' : 'space-y-6'}>
            {/* Stats Row */}
            {(
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card hover>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Layers className="text-primary" size={24} />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Total Centros</p>
                    <p className="text-3xl font-bold">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card hover>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                    <CheckCircle2 className="text-success" size={24} />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Activos</p>
                    <p className="text-3xl font-bold text-success">{stats.active}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card hover>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                    <XCircle className="text-muted-foreground" size={24} />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Deshabilitados</p>
                    <p className="text-3xl font-bold text-muted-foreground">{stats.disabled}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
            )}

            {/* Filters */}
            {costCentres.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nombre, código o alias..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex gap-2">
              {[
                { value: "all", label: "Todos" },
                { value: "active", label: "Activos" },
                { value: "disabled", label: "Deshabilitados" },
              ].map((option) => (
                <Button
                  key={option.value}
                  variant={filterStatus === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus(option.value as typeof filterStatus)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
            )}

            {/* Cost Centres List */}
            {costCentres.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-muted-foreground font-medium text-xs uppercase tracking-wider p-4">
                        Centro de Costos
                      </th>
                      <th className="text-left text-muted-foreground font-medium text-xs uppercase tracking-wider p-4">
                        Código
                      </th>
                      <th className="text-left text-muted-foreground font-medium text-xs uppercase tracking-wider p-4">
                        Proveedor
                      </th>
                      <th className="text-left text-muted-foreground font-medium text-xs uppercase tracking-wider p-4">
                        CLABE
                      </th>
                      <th className="text-left text-muted-foreground font-medium text-xs uppercase tracking-wider p-4">
                        Estado
                      </th>
                      <th className="text-right text-muted-foreground font-medium text-xs uppercase tracking-wider p-4">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCostCentres.map((costCentre) => {
                      const status = costCentre.disabled ? "disabled" : "active";
                      const StatusIcon = statusConfig[status].icon;
                      const providerInfo = providerConfig[costCentre.provider] || providerConfig.finco;

                      return (
                        <tr
                          key={costCentre.id}
                          className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Layers className="text-primary" size={18} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-foreground">
                                    {costCentre.alias}
                                  </p>
                                  {costCentre.default && (
                                    <Star className="h-4 w-4 text-warning fill-warning" />
                                  )}
                                </div>
                                <p className="text-muted-foreground text-sm">{costCentre.shortName}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                              {costCentre.code}
                            </code>
                          </td>
                          <td className="p-4">
                            <span className={cn(
                              "text-xs font-medium px-2 py-1 rounded",
                              providerInfo.color
                            )}>
                              {providerInfo.label}
                            </span>
                          </td>
                          <td className="p-4">
                            {costCentre.fincoClabeNumber ? (
                              <div className="flex items-center gap-2">
                                <code className="text-sm font-mono">
                                  {costCentre.fincoClabeNumber.substring(0, 4)}...{costCentre.fincoClabeNumber.substring(14)}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => copyClabe(costCentre.fincoClabeNumber!)}
                                >
                                  <Copy size={12} />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </td>
                          <td className="p-4">
                            <Badge variant={statusConfig[status].variant} className="gap-1">
                              <StatusIcon size={12} />
                              {statusConfig[status].label}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Ver detalles"
                                asChild
                              >
                                <Link href={`/centros-costos/${costCentre.id}`}>
                                  <Eye size={14} />
                                </Link>
                              </Button>
                              {canManage && !costCentre.default && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Establecer como predeterminado"
                                  onClick={() => handleSetDefault(costCentre)}
                                >
                                  <Star size={14} />
                                </Button>
                              )}
                              {canManage && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title={costCentre.disabled ? "Habilitar" : "Deshabilitar"}
                                  onClick={() => handleToggleStatus(costCentre)}
                                >
                                  {costCentre.disabled ? (
                                    <Power size={14} className="text-success" />
                                  ) : (
                                    <PowerOff size={14} className="text-muted-foreground" />
                                  )}
                                </Button>
                              )}
                              {canManage && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Configuración"
                                >
                                  <Settings size={14} />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
            )}

            {/* Empty State */}
            {costCentres.length === 0 && !showAddForm && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Layers className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium text-foreground mb-2">
                    No hay centros de costos registrados
                  </p>
                  <p className="text-muted-foreground mb-6">
                    {canCreate
                      ? "Crea tu primer centro de costos para comenzar a organizar tus operaciones"
                      : "No hay centros de costos disponibles"}
                  </p>
                  {canCreate && (
                    <Button onClick={() => setShowAddForm(true)} className="gap-2">
                      <Plus size={16} />
                      Crear Centro de Costos
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      </RequirePermission>
    </DashboardLayout>
  );
}
