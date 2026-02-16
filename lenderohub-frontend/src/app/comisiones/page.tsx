"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout, PageHeader } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn, formatCurrency } from "@/lib/utils";
import {
  commissionsService,
  CommissionAccount,
  CommissionAccountTag,
  CommissionCollectionItem,
  CommissionCostCentre,
  CommissionTransfer,
} from "@/services/commissions.service";
import { CommissionCard } from "@/components/commissions/CommissionCard";
import { CostCentresTab } from "@/components/commissions/CostCentresTab";
import { TransfersTab } from "@/components/commissions/TransfersTab";
import { MonthlyChargesTab } from "@/components/commissions/MonthlyChargesTab";
import { CollectionTab } from "@/components/commissions/CollectionTab";
import { RequestsTab } from "@/components/commissions/RequestsTab";

type CommissionsTab = "centres" | "transfers" | "monthly" | "collection" | "requests";

const tabOptions: { id: CommissionsTab; label: string }[] = [
  { id: "centres", label: "CENTROS DE COSTOS" },
  { id: "transfers", label: "TRANSFERENCIAS" },
  { id: "monthly", label: "CUOTAS MENSUALES" },
  { id: "collection", label: "COBRANZA" },
  { id: "requests", label: "SOLICITUDES" },
];

export default function ComisionesPage() {
  const { toast } = useToast();
  const { hasPermission, user } = useAuth();

  const [activeTab, setActiveTab] = useState<CommissionsTab>("centres");

  const [dashboardAccounts, setDashboardAccounts] = useState<CommissionAccount[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  const [costCentres, setCostCentres] = useState<CommissionCostCentre[]>([]);
  const [costCentresLoading, setCostCentresLoading] = useState(true);

  const [transfers, setTransfers] = useState<CommissionTransfer[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [transfersSearch, setTransfersSearch] = useState("");
  const [transfersPage, setTransfersPage] = useState(1);
  const [transfersTotalPages, setTransfersTotalPages] = useState(1);
  const [transfersLoaded, setTransfersLoaded] = useState(false);

  const [monthlyTransfers, setMonthlyTransfers] = useState<CommissionTransfer[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyPage, setMonthlyPage] = useState(1);
  const [monthlyTotalPages, setMonthlyTotalPages] = useState(1);
  const [monthlyLoaded, setMonthlyLoaded] = useState(false);

  const [collectionItems, setCollectionItems] = useState<CommissionCollectionItem[]>([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionLoaded, setCollectionLoaded] = useState(false);
  const [collectionPeriod, setCollectionPeriod] = useState(getDefaultPeriod());

  const [transferTarget, setTransferTarget] = useState<CommissionAccount | null>(null);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [collectLoading, setCollectLoading] = useState<CommissionAccountTag | null>(null);

  const canReadCostCentres = hasPermission("cost_centres:read");
  const canReadTransfers = hasPermission("transactions:read");
  const canCreateTransfers = hasPermission("transactions:create");

  const accountsByTag = useMemo(() => {
    const map = new Map<CommissionAccountTag, CommissionAccount>();
    dashboardAccounts.forEach((account) => map.set(account.tag, account));
    return map;
  }, [dashboardAccounts]);

  const availableTabs = useMemo(
    () =>
      tabOptions.filter((tab) => {
        if (tab.id === "transfers" || tab.id === "monthly") {
          return canReadTransfers;
        }
        if (tab.id === "centres" || tab.id === "collection") {
          return canReadCostCentres;
        }
        if (tab.id === "requests") {
          return canReadTransfers || canCreateTransfers;
        }
        return true;
      }),
    [canReadCostCentres, canReadTransfers, canCreateTransfers]
  );

  const periodOptions = useMemo(() => getPeriodOptions(12), []);

  const loadDashboard = useCallback(async () => {
    if (!canReadCostCentres) {
      setDashboardAccounts([]);
      setDashboardLoading(false);
      return;
    }
    try {
      setDashboardLoading(true);
      const data = await commissionsService.getDashboard();
      setDashboardAccounts(data.accounts || []);
    } catch (error: any) {
      toast({
        title: "Error al cargar dashboard",
        description: error?.message || "No se pudo cargar la información de comisiones.",
        variant: "destructive",
      });
    } finally {
      setDashboardLoading(false);
    }
  }, [toast, canReadCostCentres]);

  const loadCostCentres = useCallback(async () => {
    if (!canReadCostCentres) {
      setCostCentres([]);
      setCostCentresLoading(false);
      return;
    }
    try {
      setCostCentresLoading(true);
      const data = await commissionsService.getCostCentres();
      setCostCentres(data);
    } catch (error: any) {
      toast({
        title: "Error al cargar centros de costos",
        description: error?.message || "No se pudo obtener la información de CECOs.",
        variant: "destructive",
      });
    } finally {
      setCostCentresLoading(false);
    }
  }, [toast, canReadCostCentres]);

  const loadTransfers = useCallback(
    async (page = transfersPage, search = transfersSearch) => {
      if (!canReadTransfers) {
        setTransfers([]);
        setTransfersLoaded(true);
        setTransfersLoading(false);
        return;
      }
      try {
        setTransfersLoading(true);
        const response = await commissionsService.getTransfers({ page, limit: 10, search });
        setTransfers(response.transfers || []);
        setTransfersTotalPages(response.meta?.totalPages || 1);
        setTransfersPage(response.meta?.page || page);
        setTransfersLoaded(true);
      } catch (error: any) {
        toast({
          title: "Error al cargar transferencias",
          description: error?.message || "No se pudo cargar el historial de transferencias.",
          variant: "destructive",
        });
      } finally {
        setTransfersLoading(false);
      }
    },
    [toast, transfersPage, transfersSearch, canReadTransfers]
  );

  const loadMonthlyTransfers = useCallback(
    async (page = monthlyPage) => {
      if (!canReadTransfers) {
        setMonthlyTransfers([]);
        setMonthlyLoaded(true);
        setMonthlyLoading(false);
        return;
      }
      try {
        setMonthlyLoading(true);
        const response = await commissionsService.getMonthlyChargesTransfers({ page, limit: 10 });
        setMonthlyTransfers(response.transfers || []);
        setMonthlyTotalPages(response.meta?.totalPages || 1);
        setMonthlyPage(response.meta?.page || page);
        setMonthlyLoaded(true);
      } catch (error: any) {
        toast({
          title: "Error al cargar cuotas",
          description: error?.message || "No se pudo cargar el historial de cuotas.",
          variant: "destructive",
        });
      } finally {
        setMonthlyLoading(false);
      }
    },
    [toast, monthlyPage, canReadTransfers]
  );

  const loadCollection = useCallback(
    async (period = collectionPeriod) => {
      if (!canReadCostCentres) {
        setCollectionItems([]);
        setCollectionLoaded(true);
        setCollectionLoading(false);
        return;
      }
      try {
        setCollectionLoading(true);
        const response = await commissionsService.getCollection(period);
        setCollectionItems(response.costCentres || []);
        setCollectionLoaded(true);
      } catch (error: any) {
        toast({
          title: "Error al cargar cobranza",
          description: error?.message || "No se pudo obtener la información de cobranza.",
          variant: "destructive",
        });
      } finally {
        setCollectionLoading(false);
      }
    },
    [toast, collectionPeriod, canReadCostCentres]
  );

  useEffect(() => {
    loadDashboard();
    loadCostCentres();
  }, [loadDashboard, loadCostCentres]);

  useEffect(() => {
    if (!availableTabs.find((tab) => tab.id === activeTab) && availableTabs.length > 0) {
      setActiveTab(availableTabs[0].id);
    }
  }, [activeTab, availableTabs]);

  useEffect(() => {
    if (activeTab === "transfers" && !transfersLoaded) {
      loadTransfers(1, transfersSearch);
    }
    if (activeTab === "monthly" && !monthlyLoaded) {
      loadMonthlyTransfers(1);
    }
    if (activeTab === "collection" && !collectionLoaded) {
      loadCollection(collectionPeriod);
    }
  }, [
    activeTab,
    collectionLoaded,
    collectionPeriod,
    loadCollection,
    loadMonthlyTransfers,
    loadTransfers,
    monthlyLoaded,
    transfersLoaded,
    transfersSearch,
  ]);

  const handleTransferOpen = (account?: CommissionAccount) => {
    if (!account) {
      return;
    }
    setTransferTarget(account);
    setTransferAmount("");
  };

  const handleTransferSubmit = async () => {
    if (!transferTarget) return;

    const parsedAmount = parseAmount(transferAmount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast({
        title: "Monto inválido",
        description: "Ingresa un monto mayor a cero para transferir.",
        variant: "destructive",
      });
      return;
    }

    if (transferTarget.balance !== undefined && parsedAmount > transferTarget.balance) {
      toast({
        title: "Monto excede el saldo",
        description: "El monto supera el saldo disponible en la cuenta seleccionada.",
        variant: "destructive",
      });
      return;
    }

    try {
      setTransferLoading(true);
      await commissionsService.transferToCorporate(transferTarget.tag, parsedAmount);
      toast({
        title: "Transferencia solicitada",
        description: `Se envio la transferencia desde ${transferTarget.alias}.`,
        variant: "success",
      });
      setTransferTarget(null);
      await loadDashboard();
    } catch (error: any) {
      toast({
        title: "Error al transferir",
        description: error?.message || "No se pudo completar la transferencia.",
        variant: "destructive",
      });
    } finally {
      setTransferLoading(false);
    }
  };

  const handleCollect = async (account?: CommissionAccount) => {
    if (!account) return;
    try {
      setCollectLoading(account.tag);
      const result = await commissionsService.collectByTag(account.tag);
      toast({
        title: "Cobro completado",
        description: `Transferencias: ${result.totalTransfers} • Total: ${formatCurrency(result.totalAmount)}`,
      });
      await Promise.all([loadDashboard(), loadTransfers(), loadMonthlyTransfers()]);
    } catch (error: any) {
      toast({
        title: "Error al cobrar comisiones",
        description: error?.message || "No se pudo ejecutar el cobro.",
        variant: "destructive",
      });
    } finally {
      setCollectLoading(null);
    }
  };

  return (
    <DashboardLayout title="Comisiones" subtitle="Comisiones CECO">
      <div className="space-y-6">
        <PageHeader
          title="Comisiones CECO"
          description="Monitorea las comisiones internas y la cobranza mensual."
        />

        <div className="relative">
          <LoadingOverlay isLoading={dashboardLoading} message="Cargando balances..." />
          <div className={cn("space-y-4", dashboardLoading && "opacity-50 pointer-events-none")}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {canReadCostCentres ? (
                <>
                  <CommissionCard
                    title="SPEI IN COMISION CECO"
                    clabe={accountsByTag.get("transferIn")?.clabe}
                    balance={accountsByTag.get("transferIn")?.balance}
                    onCollect={() => handleCollect(accountsByTag.get("transferIn"))}
                    onTransfer={() => handleTransferOpen(accountsByTag.get("transferIn"))}
                    disabled={!canCreateTransfers || !accountsByTag.get("transferIn") || collectLoading === "transferIn"}
                  />
                  <CommissionCard
                    title="SPEI IN PAGO COMISIONISTA"
                    clabe={accountsByTag.get("transferInCommissionAgentPayment")?.clabe}
                    balance={accountsByTag.get("transferInCommissionAgentPayment")?.balance}
                    onCollect={() => handleCollect(accountsByTag.get("transferInCommissionAgentPayment"))}
                    onTransfer={() => handleTransferOpen(accountsByTag.get("transferInCommissionAgentPayment"))}
                    disabled={
                      !canCreateTransfers ||
                      !accountsByTag.get("transferInCommissionAgentPayment") ||
                      collectLoading === "transferInCommissionAgentPayment"
                    }
                  />
                  <CommissionCard
                    title="SPEI OUT PAGOS"
                    clabe={accountsByTag.get("transferOut")?.clabe}
                    balance={accountsByTag.get("transferOut")?.balance}
                    onCollect={() => handleCollect(accountsByTag.get("transferOut"))}
                    onTransfer={() => handleTransferOpen(accountsByTag.get("transferOut"))}
                    disabled={!canCreateTransfers || !accountsByTag.get("transferOut") || collectLoading === "transferOut"}
                  />
                </>
              ) : (
                <Card className="col-span-full">
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    No tienes permisos para ver las comisiones del CECO.
                  </CardContent>
                </Card>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {canReadCostCentres ? (
                <>
                  <CommissionCard
                    title="SPEI OUT GANANCIA"
                    clabe={accountsByTag.get("transferOutEarnings")?.clabe}
                    balance={accountsByTag.get("transferOutEarnings")?.balance}
                    onCollect={() => handleCollect(accountsByTag.get("transferOutEarnings"))}
                    onTransfer={() => handleTransferOpen(accountsByTag.get("transferOutEarnings"))}
                    disabled={
                      !canCreateTransfers ||
                      !accountsByTag.get("transferOutEarnings") ||
                      collectLoading === "transferOutEarnings"
                    }
                  />
                  <CommissionCard
                    title="CUOTAS MENSUALES"
                    clabe={accountsByTag.get("monthlyCharges")?.clabe}
                    balance={accountsByTag.get("monthlyCharges")?.balance}
                    onCollect={() => handleCollect(accountsByTag.get("monthlyCharges"))}
                    onTransfer={() => handleTransferOpen(accountsByTag.get("monthlyCharges"))}
                    disabled={
                      !canCreateTransfers ||
                      !accountsByTag.get("monthlyCharges") ||
                      collectLoading === "monthlyCharges"
                    }
                  />
                </>
              ) : (
                <Card className="col-span-full">
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    Sin permisos para visualizar saldos de cuentas internas.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap gap-6 border-b px-6 pt-4">
              {availableTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={cn(
                    "pb-3 text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "border-b-2 border-primary text-primary"
                      : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="p-6">
              {availableTabs.length === 0 && (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    No tienes permisos para ver módulos de comisiones.
                  </CardContent>
                </Card>
              )}
              {availableTabs.length > 0 && activeTab === "centres" && (
                <div className="relative min-h-[200px]">
                  <LoadingOverlay isLoading={costCentresLoading} message="Cargando centros de costos..." />
                  <div className={cn(costCentresLoading && "opacity-50 pointer-events-none")}>
                    <CostCentresTab costCentres={costCentres} />
                  </div>
                </div>
              )}

              {availableTabs.length > 0 && activeTab === "transfers" && (
                <div className="relative min-h-[200px]">
                  <LoadingOverlay isLoading={transfersLoading} message="Cargando transferencias..." />
                  <div className={cn(transfersLoading && "opacity-50 pointer-events-none")}>
                    {canReadTransfers ? (
                      <TransfersTab
                        transfers={transfers}
                        search={transfersSearch}
                        onSearchChange={setTransfersSearch}
                        onSearchSubmit={() => loadTransfers(1, transfersSearch)}
                        page={transfersPage}
                        totalPages={transfersTotalPages}
                        onPageChange={(page) => loadTransfers(page, transfersSearch)}
                      />
                    ) : (
                      <Card>
                        <CardContent className="p-6 text-sm text-muted-foreground">
                          No tienes permisos para ver transferencias.
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )}

              {availableTabs.length > 0 && activeTab === "monthly" && (
                <div className="relative min-h-[200px]">
                  <LoadingOverlay isLoading={monthlyLoading} message="Cargando cuotas mensuales..." />
                  <div className={cn(monthlyLoading && "opacity-50 pointer-events-none")}>
                    {canReadTransfers ? (
                      <MonthlyChargesTab
                        transfers={monthlyTransfers}
                        page={monthlyPage}
                        totalPages={monthlyTotalPages}
                        onPageChange={(page) => loadMonthlyTransfers(page)}
                      />
                    ) : (
                      <Card>
                        <CardContent className="p-6 text-sm text-muted-foreground">
                          No tienes permisos para ver cuotas mensuales.
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )}

              {availableTabs.length > 0 && activeTab === "collection" && (
                <div className="relative min-h-[200px]">
                  <LoadingOverlay isLoading={collectionLoading} message="Cargando cobranza..." />
                  <div className={cn(collectionLoading && "opacity-50 pointer-events-none")}>
                    {canReadCostCentres ? (
                      <CollectionTab
                        period={collectionPeriod}
                        periodOptions={periodOptions}
                        onPeriodChange={setCollectionPeriod}
                        onSearch={() => loadCollection(collectionPeriod)}
                        onDownload={() =>
                          toast({
                            title: "Descarga solicitada",
                            description: "Prepararemos el reporte para descarga.",
                          })
                        }
                        items={collectionItems}
                      />
                    ) : (
                      <Card>
                        <CardContent className="p-6 text-sm text-muted-foreground">
                          No tienes permisos para ver cobranza.
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )}

              {availableTabs.length > 0 && activeTab === "requests" && (
                <RequestsTab userRole={user?.profileType || ""} />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!transferTarget} onOpenChange={(open) => !open && setTransferTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir saldo</DialogTitle>
            <DialogDescription>
              Ingresa el monto a transferir a la cuenta corporativa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Cuenta seleccionada</p>
              <p className="font-medium">{transferTarget?.alias}</p>
              <p className="text-sm text-muted-foreground">{transferTarget?.clabe}</p>
              {typeof transferTarget?.balance === "number" && (
                <p className="text-sm text-muted-foreground">
                  Saldo disponible: {formatCurrency(transferTarget.balance)}
                </p>
              )}
            </div>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Monto a transferir"
              value={transferAmount}
              onChange={(event) => setTransferAmount(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferTarget(null)} disabled={transferLoading}>
              Cancelar
            </Button>
            <Button onClick={handleTransferSubmit} disabled={transferLoading}>
              {transferLoading ? "Procesando..." : "Transferir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function parseAmount(value: string) {
  if (!value) return 0;
  const normalized = value.replace(/,/g, "");
  return Number.parseFloat(normalized);
}

function getDefaultPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getPeriodOptions(monthsBack: number) {
  const options: { value: string; label: string }[] = [];
  const now = new Date();

  for (let i = 0; i < monthsBack; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("es-MX", {
      month: "long",
      year: "numeric",
    })
      .format(date)
      .toUpperCase();
    options.push({ value, label });
  }

  return options;
}
