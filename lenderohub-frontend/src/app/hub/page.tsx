"use client";

import React, { useState } from "react";
import { DashboardLayout, PageHeader } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Copy,
  RefreshCw,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Check,
} from "lucide-react";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { useHubBalance, useDashboardStats } from "@/hooks/useApi";
import { useToast } from "@/hooks/use-toast";

// Providers disponibles
type Provider = "total" | "finco";
const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "total", label: "Total" },
  { value: "finco", label: "Finco" },
];

export default function HubPage() {
  const { toast } = useToast();
  const [selectedProvider, setSelectedProvider] = useState<Provider>("total");
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  
  const { data: balance, isLoading: balanceLoading, error: balanceError, refetch: refetchBalance } = useHubBalance();
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats();
  
  // Por ahora, los datos son los mismos ya que solo tenemos Finco
  // Cuando se agreguen más providers, aquí se filtrarán los datos
  const getFilteredBalance = () => {
    if (!balance) return 0;
    // Total = suma de todos los providers (por ahora solo Finco)
    // Finco = solo balance de Finco
    return balance.availableBalance || 0;
  };
  
  const getFilteredStats = () => {
    if (!stats) return { todayIncome: 0, todayExpense: 0, pendingTransactions: 0, completedToday: 0, failedToday: 0 };
    // Por ahora retornamos los mismos stats, preparado para filtrado futuro
    return stats;
  };
  
  const filteredBalance = getFilteredBalance();
  const filteredStats = getFilteredStats();

  const isLoading = balanceLoading || statsLoading;
  const error = balanceError || statsError;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado al portapapeles",
      description: text,
    });
  };

  const handleSync = async () => {
    await Promise.all([refetchBalance(), refetchStats()]);
  };

  // Extraer número de cuenta de CLABE (últimos 11 dígitos)
  const getAccountNumber = (clabe: string) => {
    return clabe.slice(-11);
  };

  // Mostrar error
  if (error && !balance) {
    return (
      <DashboardLayout title="HUB" subtitle="Centro de operaciones bancarias">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md">
            <CardContent className="p-6 text-center space-y-4">
              <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
              <div>
                <h3 className="font-semibold text-lg">Error al cargar datos</h3>
                <p className="text-muted-foreground text-sm mt-2">
                  {error.message || "No se pudo conectar con el servidor"}
                </p>
              </div>
              <Button onClick={handleSync} className="gap-2">
                <RefreshCw size={16} />
                Reintentar
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const clabeNumber = balance?.clabeNumber || "734180000018000000";
  const accountNumber = getAccountNumber(clabeNumber);

  return (
    <DashboardLayout title="HUB" subtitle="Centro de operaciones bancarias">
      <div className="space-y-6 relative min-h-[400px]">
        <LoadingOverlay isLoading={isLoading && !balance && !stats} message="Cargando datos del HUB..." />
        <PageHeader
          title="Cuenta Centralizadora"
          description="Información de tu cuenta principal conectada con Finco"
          actions={
            <Button 
              variant="outline" 
              className="gap-2" 
              onClick={handleSync}
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              Sincronizar
            </Button>
          }
        />

        {/* Account Info Card */}
        <Card className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-cyan-500/5 rounded-lg overflow-hidden" />
          <CardContent className="relative p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Left side - Account details */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="text-primary" size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">LENDERO CAPITAL, S.A.P.I DE C.V</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="success">
                        <CheckCircle2 size={12} className="mr-1" />
                        Conectada
                      </Badge>
                      <span className="text-muted-foreground text-sm">vía Finco</span>
                    </div>
                  </div>
                </div>

                {/* CLABE */}
                <div className="space-y-2">
                  <p className="text-muted-foreground text-sm">CLABE Interbancaria</p>
                  <div className="flex items-center gap-2">
                    <code className="text-2xl font-mono font-bold tracking-wider">
                      {clabeNumber}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(clabeNumber)}
                    >
                      <Copy size={16} />
                    </Button>
                  </div>
                </div>

                {/* Account Number */}
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Número de Cuenta</p>
                  <div className="flex items-center gap-2">
                    <code className="text-lg font-mono">{accountNumber}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(accountNumber)}
                    >
                      <Copy size={16} />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right side - Balance */}
              <div className="text-left lg:text-right">
                <div className="flex items-center gap-2 mb-1 lg:justify-end">
                  <p className="text-muted-foreground text-sm">Balance Disponible</p>
                  {/* Provider Selector */}
                  <div className="relative">
                    <button
                      onClick={() => setProviderMenuOpen(!providerMenuOpen)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-muted hover:bg-muted/80 text-foreground rounded-md transition-colors border border-border"
                    >
                      {PROVIDERS.find(p => p.value === selectedProvider)?.label}
                      <ChevronDown size={14} className={`transition-transform text-muted-foreground ${providerMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {providerMenuOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setProviderMenuOpen(false)} 
                        />
                        <div className="absolute right-0 mt-1 w-32 bg-background border border-border rounded-lg shadow-lg z-50 py-1">
                          {PROVIDERS.map((provider) => (
                            <button
                              key={provider.value}
                              onClick={() => {
                                setSelectedProvider(provider.value);
                                setProviderMenuOpen(false);
                              }}
                              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors"
                            >
                              {provider.label}
                              {selectedProvider === provider.value && (
                                <Check size={14} className="text-primary" />
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-4xl lg:text-5xl font-bold text-foreground">
                  ${filteredBalance.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-muted-foreground text-sm mt-2 flex items-center gap-1 lg:justify-end">
                  <Clock size={14} />
                  Última actualización: {balance?.lastUpdated ? 
                    new Date(balance.lastUpdated).toLocaleTimeString('es-MX', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    }) : 'hace 2 min'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <ArrowDownLeft className="text-success" size={20} />
                </div>
                <Badge variant="success">{filteredStats.completedToday}</Badge>
              </div>
              <p className="text-muted-foreground text-sm">Ingresos Hoy</p>
              <p className="text-2xl font-bold text-success">
                +${filteredStats.todayIncome.toLocaleString("es-MX")}
              </p>
            </CardContent>
          </Card>

          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <ArrowUpRight className="text-destructive" size={20} />
                </div>
                <Badge variant="secondary">{filteredStats.failedToday}</Badge>
              </div>
              <p className="text-muted-foreground text-sm">Egresos Hoy</p>
              <p className="text-2xl font-bold">
                -${filteredStats.todayExpense.toLocaleString("es-MX")}
              </p>
            </CardContent>
          </Card>

          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Clock className="text-warning" size={20} />
                </div>
                <Badge variant="warning">{filteredStats.pendingTransactions}</Badge>
              </div>
              <p className="text-muted-foreground text-sm">Pendientes</p>
              <p className="text-2xl font-bold">En proceso</p>
            </CardContent>
          </Card>

          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Wallet className="text-primary" size={20} />
                </div>
              </div>
              <p className="text-muted-foreground text-sm">Neto del Día</p>
              <p className="text-2xl font-bold text-success">
                +${(filteredStats.todayIncome - filteredStats.todayExpense).toLocaleString("es-MX")}
              </p>
            </CardContent>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}