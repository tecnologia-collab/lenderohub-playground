"use client";

import React, { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout";
import {
  BalanceCard,
  StatCard,
  OperationsSummary,
  QuickActions,
  MonthlyOperationsTable,
  NationalOperations,
  SubaccountsList,
  RecentTransactions,
  BalanceChart,
  type Provider,
} from "@/components/dashboard";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Send,
  Plus,
  Users,
  ArrowLeftRight,
  RefreshCw,
  AlertCircle,
  Percent,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDashboard, useDashboardOperations } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";

// ============================================
// Quick Actions Config (all possible actions)
// ============================================
const ALL_QUICK_ACTIONS = [
  {
    key: "nueva-transferencia",
    icon: Send,
    label: "Nueva Transferencia",
    href: "/dispersiones/nueva",
    color: "from-emerald-500 to-cyan-500",
    permission: "transactions:create",
  },
  {
    key: "nueva-subcuenta",
    icon: Plus,
    label: "Nueva Subcuenta",
    href: "/subcuentas/nueva",
    color: "from-violet-500 to-purple-500",
    permission: "subaccounts:create",
    allowedRoles: ["corporate"],
  },
  {
    key: "agregar-usuario",
    icon: Users,
    label: "Agregar Usuario",
    href: "/usuarios/nuevo",
    color: "from-amber-500 to-orange-500",
    permission: "users:create",
    allowedRoles: ["corporate", "administrator"],
  },
  {
    key: "entre-bolsas",
    icon: ArrowLeftRight,
    label: "Entre Bolsas",
    href: "/subcuentas/transferir",
    color: "from-pink-500 to-rose-500",
    permission: "subaccounts:update",
    allowedRoles: ["corporate", "subaccount"],
  },
];

// ============================================
// Loading Skeleton
// ============================================
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="md:col-span-2 h-40 bg-muted rounded-xl" />
        <div className="h-40 bg-muted rounded-xl" />
        <div className="h-40 bg-muted rounded-xl" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  );
}

// ============================================
// Error Display
// ============================================
function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold">Error al cargar datos</h3>
      <p className="text-muted-foreground text-center max-w-md">
        {error.message || "Ocurrio un error al cargar el dashboard. Por favor intenta de nuevo."}
      </p>
      <Button onClick={onRetry} variant="outline" className="gap-2">
        <RefreshCw size={16} />
        Reintentar
      </Button>
    </div>
  );
}

// ============================================
// Commission Agent Dashboard
// ============================================
function CommissionAgentDashboard({ userName }: { userName: string }) {
  return (
    <DashboardLayout title="Dashboard" subtitle={`Bienvenido, ${userName}`}>
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <Percent className="w-16 h-16 mx-auto text-primary" />
            <h2 className="text-2xl font-bold">Mis Comisiones</h2>
            <p className="text-muted-foreground">
              Consulta tu balance de comisiones y solicita pagos en la seccion de Comisiones.
            </p>
            <Button asChild>
              <a href="/comisiones">Ir a Comisiones</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

// ============================================
// Subaccount Dashboard
// ============================================
function SubaccountDashboard({ userName }: { userName: string }) {
  const {
    recentTransactions,
    virtualBags,
    isLoading,
    error,
    refetch,
  } = useDashboard();

  const subaccountsForDisplay = virtualBags.map((bag) => ({
    id: bag.id,
    name: bag.name,
    balance: bag.balance,
    color: bag.color || "#10b981",
  }));

  const filteredQuickActions = [
    { icon: Send, label: "Nueva Transferencia", href: "/dispersiones/nueva", color: "from-emerald-500 to-cyan-500" },
  ];

  if (isLoading && !virtualBags.length) {
    return (
      <DashboardLayout title="Dashboard" subtitle={`Bienvenido, ${userName}`}>
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  if (error && !virtualBags.length) {
    return (
      <DashboardLayout title="Dashboard" subtitle="Error">
        <DashboardError error={error} onRetry={refetch} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dashboard" subtitle={`Bienvenido, ${userName}`}>
      <div className="space-y-6">
        {/* Refresh button */}
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={refetch}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            Actualizar
          </Button>
        </div>

        {/* Welcome Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="text-primary" size={24} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Mis Subcuentas</h2>
                <p className="text-muted-foreground text-sm">
                  Administra tus bolsas y consulta movimientos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <QuickActions actions={filteredQuickActions} />

        {/* Subaccounts */}
        <SubaccountsList
          subaccounts={subaccountsForDisplay}
          onViewAll={() => console.log("View all subaccounts")}
          onSelect={(id) => console.log("Selected:", id)}
        />

        {/* Recent Transactions */}
        <RecentTransactions
          transactions={recentTransactions}
          onViewAll={() => console.log("View all transactions")}
          onTransactionClick={(id) => console.log("Transaction:", id)}
        />
      </div>
    </DashboardLayout>
  );
}

// ============================================
// Full Dashboard (Corporate & Administrator)
// ============================================
function FullDashboard({
  userName,
  showSubaccounts,
}: {
  userName: string;
  showSubaccounts: boolean;
}) {
  const [selectedProvider, setSelectedProvider] = useState<Provider>("total");
  const { user, hasPermission } = useAuth();

  const {
    balance,
    stats,
    recentTransactions,
    virtualBags,
    balanceHistory,
    isLoading,
    error,
    refetch,
  } = useDashboard();

  const { data: operationsData } = useDashboardOperations();

  // Filter quick actions based on permissions and role
  const filteredQuickActions = useMemo(() => {
    return ALL_QUICK_ACTIONS
      .filter((action) => {
        if (action.permission && !hasPermission(action.permission)) return false;
        if (action.allowedRoles && !action.allowedRoles.includes(user?.profileType || "")) return false;
        return true;
      })
      .map(({ key, permission, allowedRoles, ...rest }) => rest);
  }, [hasPermission, user?.profileType]);

  // Filtrar datos por provider (preparado para multiples providers)
  const getFilteredBalance = () => {
    const baseBalance = balance?.availableBalance ?? stats?.totalBalance ?? 0;
    return baseBalance;
  };

  const getFilteredStats = () => {
    return {
      todayIncome: stats?.todayIncome ?? 0,
      todayExpense: stats?.todayExpense ?? 0,
      todayIncomeChange: stats?.todayIncomeChange ?? 0,
      todayExpenseChange: stats?.todayExpenseChange ?? 0,
    };
  };

  const filteredBalance = getFilteredBalance();
  const filteredStats = getFilteredStats();

  // Loading state
  if (isLoading && !balance) {
    return (
      <DashboardLayout title="Dashboard" subtitle="Cargando...">
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  // Error state
  if (error && !balance) {
    return (
      <DashboardLayout title="Dashboard" subtitle="Error">
        <DashboardError error={error} onRetry={refetch} />
      </DashboardLayout>
    );
  }

  // Transform data for components
  const dailyOperations = [
    { label: "En proceso", count: stats?.pendingTransactions ?? 0, variant: "pending" as const },
    { label: "Liquidadas", count: stats?.completedToday ?? 0, variant: "success" as const },
    { label: "Canceladas", count: 0, variant: "default" as const },
    { label: "Devuelta", count: 0, variant: "warning" as const },
    { label: "Rechazada", count: stats?.failedToday ?? 0, variant: "destructive" as const },
  ];

  const subaccountsForDisplay = virtualBags.map((bag) => ({
    id: bag.id,
    name: bag.name,
    balance: bag.balance,
    color: bag.color || "#10b981",
  }));

  const balanceChartData = balanceHistory.map((point) => ({
    date: point.date,
    balance: point.balance,
  }));

  const monthlyOperationsByCountry = operationsData?.monthlyOperationsByCountry || [];
  const nationalMetrics = operationsData?.nationalMetrics || [];

  return (
    <DashboardLayout title="Dashboard" subtitle={`Bienvenido de vuelta, ${userName}`}>
      <div className="space-y-6">
        {/* Refresh button */}
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={refetch}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            Actualizar
          </Button>
        </div>

        {/* Top Row: Balance + Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <div className="md:col-span-2">
            <BalanceCard
              balance={filteredBalance}
              trend={12.5}
              label="Balance Total"
              showProviderSelector
              selectedProvider={selectedProvider}
              onProviderChange={setSelectedProvider}
            />
          </div>
          <StatCard
            title="Ingresos Hoy"
            value={filteredStats.todayIncome}
            icon={ArrowDownLeft}
            trend={filteredStats.todayIncomeChange}
            variant="income"
            format="currency"
          />
          <StatCard
            title="Egresos Hoy"
            value={filteredStats.todayExpense}
            icon={ArrowUpRight}
            trend={filteredStats.todayExpenseChange}
            variant="expense"
            format="currency"
          />
        </div>

        {/* Quick Actions */}
        {filteredQuickActions.length > 0 && (
          <QuickActions actions={filteredQuickActions} />
        )}

        {/* Operations Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily Operations */}
          <OperationsSummary title="Operaciones Diarias" items={dailyOperations} />

          {/* Monthly Operations Table */}
          <div className="lg:col-span-2">
            <MonthlyOperationsTable
              data={monthlyOperationsByCountry}
              onViewAll={() => console.log("View all")}
            />
          </div>
        </div>

        {/* National Operations Metrics */}
        <NationalOperations
          title="Operaciones Nacionales Mensuales"
          metrics={nationalMetrics}
        />

        {/* Charts + Subaccounts + Transactions */}
        <div className={showSubaccounts ? "grid grid-cols-1 xl:grid-cols-3 gap-6" : ""}>
          {/* Balance Chart */}
          <div className={showSubaccounts ? "xl:col-span-2" : ""}>
            <BalanceChart data={balanceChartData} />
          </div>

          {/* Subaccounts - only for corporate */}
          {showSubaccounts && (
            <SubaccountsList
              subaccounts={subaccountsForDisplay}
              onViewAll={() => console.log("View all subaccounts")}
              onSelect={(id) => console.log("Selected:", id)}
            />
          )}
        </div>

        {/* Recent Transactions */}
        <RecentTransactions
          transactions={recentTransactions}
          onViewAll={() => console.log("View all transactions")}
          onTransactionClick={(id) => console.log("Transaction:", id)}
        />
      </div>
    </DashboardLayout>
  );
}

// ============================================
// Dashboard Page (entry point with role routing)
// ============================================
export default function DashboardPage() {
  const { user } = useAuth();

  const userName = user?.firstName || user?.fullName || "Usuario";

  // Commission Agent: minimal dashboard with link to commissions
  if (user?.profileType === "commissionAgent") {
    return <CommissionAgentDashboard userName={userName} />;
  }

  // Subaccount: simplified dashboard with bags and transactions
  if (user?.profileType === "subaccount") {
    return <SubaccountDashboard userName={userName} />;
  }

  // Administrator: full dashboard without SubaccountsList
  if (user?.profileType === "administrator") {
    return <FullDashboard userName={userName} showSubaccounts={false} />;
  }

  // Corporate (default): full dashboard with everything
  return <FullDashboard userName={userName} showSubaccounts={true} />;
}
