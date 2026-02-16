"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout, PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TransactionsTable,
  type Transaction,
} from "@/components/dashboard";
import {
  Plus,
  Search,
  Filter,
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Send,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MoneyOutForm } from "@/components/transfers/MoneyOutForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { transfersService, toDisplayTransaction } from "@/services/transfers.service";
import type { Transaction as ApiTransaction, ClabeInstrumentDetail, CardInstrumentDetail } from "@/types/api.types";
import { RequirePermission } from "@/components/auth/RequirePermission";

// ============================================
// Helpers
// ============================================
const getInstrumentAccount = (detail?: ClabeInstrumentDetail | CardInstrumentDetail) => {
  if (!detail) return undefined;
  if ("clabeNumber" in detail) return detail.clabeNumber;
  return detail.cardNumber;
};

export default function DispersionesPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showMoneyOutForm, setShowMoneyOutForm] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionDetails, setTransactionDetails] = useState<ApiTransaction | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const canCreateTransfer = hasPermission("transactions:create");

  const loadTransactions = async () => {
    try {
      setTransactionsLoading(true);
      setTransactionsError(null);
      const response = await transfersService.getTransactions({ page: 1, limit: 50 });
      const display = response.data.map((tx) => toDisplayTransaction(tx));
      setTransactions(display);
    } catch (error: any) {
      console.error("Error loading transactions:", error);
      setTransactionsError(error?.message || "No se pudieron cargar las transferencias.");
    } finally {
      setTransactionsLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return transactions;
    const term = searchTerm.toLowerCase();
    return transactions.filter((tx) =>
      [tx.description, tx.trackingKey, tx.beneficiary]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [transactions, searchTerm]);

  const stats = useMemo(() => {
    const now = new Date();
    const isSameDay = (date: Date) =>
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
    const isSameMonth = (date: Date) =>
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const outgoing = transactions.filter((tx) => tx.type === "out");
    const today = outgoing.filter((tx) => isSameDay(new Date(tx.date)));
    const pending = outgoing.filter((tx) => ["pending", "processing"].includes(tx.status));
    const completed = outgoing.filter((tx) => tx.status === "completed" && isSameMonth(new Date(tx.date)));

    const sumAmount = (items: Transaction[]) =>
      items.reduce((sum, tx) => sum + (Number.isFinite(tx.amount) ? tx.amount : 0), 0);

    return {
      today: { count: today.length, amount: sumAmount(today) },
      pending: { count: pending.length, amount: sumAmount(pending) },
      completed: { count: completed.length, amount: sumAmount(completed) },
    };
  }, [transactions]);

  const handleMoneyOutSuccess = (transaction: any) => {
    toast({
      title: "Transferencia enviada",
      description: `Tracking: ${transaction.trackingId}`,
      variant: "success",
    });
    setShowMoneyOutForm(false);
    loadTransactions();
  };

  const handleMoneyOutError = (error: Error) => {
    toast({
      title: "Error en transferencia",
      description: error.message,
      variant: "destructive",
    });
  };

  const handleTransactionClick = async (id: string) => {
    const baseTransaction = transactions.find((tx) => tx.id === id) || null;
    setSelectedTransaction(baseTransaction);
    setDetailsError(null);
    setDetailsLoading(true);
    setTransactionDetails(null);

    try {
      const details = await transfersService.getTransaction(id);
      setTransactionDetails(details);
    } catch (error: any) {
      console.error("Error loading transaction details:", error);
      setDetailsError(error?.message || "No se pudo cargar el detalle de la transferencia.");
    } finally {
      setDetailsLoading(false);
    }
  };

  return (
    <DashboardLayout title="Dispersiones" subtitle="Gestion de transferencias SPEI">
      <RequirePermission permission="transactions:read" fallbackUrl="/">
      <div className="space-y-6">
        <PageHeader
          title="Transferencias SPEI"
          description="Envía y administra tus transferencias bancarias"
          actions={
            <div className="flex items-center gap-3">
              <Button variant="outline" className="gap-2">
                <Download size={16} />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
              {canCreateTransfer && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => router.push("/dispersiones/masivas")}
                >
                  <FileSpreadsheet size={16} />
                  <span className="hidden sm:inline">Dispersion Masiva</span>
                </Button>
              )}
              {canCreateTransfer && (
                <Button
                  className="gap-2"
                  onClick={() => setShowMoneyOutForm(!showMoneyOutForm)}
                >
                  {showMoneyOutForm ? (
                    <>
                      <X size={16} />
                      Cancelar
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Nueva Transferencia
                    </>
                  )}
                </Button>
              )}
            </div>
          }
        />

        {/* Money Out Form */}
        {showMoneyOutForm && (
          <MoneyOutForm
            onSuccess={handleMoneyOutSuccess}
            onError={handleMoneyOutError}
            onCancel={() => setShowMoneyOutForm(false)}
          />
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Send className="text-primary" size={20} />
                </div>
                <Badge>{transactionsLoading ? "..." : `${stats.today.count} hoy`}</Badge>
              </div>
              <p className="text-muted-foreground text-sm">Enviadas Hoy</p>
              <p className="text-2xl font-bold">
                {transactionsLoading ? "..." : `$${stats.today.amount.toLocaleString("es-MX")}`}
              </p>
            </CardContent>
          </Card>

          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Clock className="text-warning" size={20} />
                </div>
                <Badge variant="warning">{transactionsLoading ? "..." : stats.pending.count}</Badge>
              </div>
              <p className="text-muted-foreground text-sm">Pendientes</p>
              <p className="text-2xl font-bold">
                {transactionsLoading ? "..." : `$${stats.pending.amount.toLocaleString("es-MX")}`}
              </p>
            </CardContent>
          </Card>

          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <ArrowUpRight className="text-success" size={20} />
                </div>
                <Badge variant="success">{transactionsLoading ? "..." : stats.completed.count}</Badge>
              </div>
              <p className="text-muted-foreground text-sm">Completadas (mes)</p>
              <p className="text-2xl font-bold">
                {transactionsLoading ? "..." : `$${stats.completed.amount.toLocaleString("es-MX")}`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Historial de Transferencias</CardTitle>
                <CardDescription>Todas las transferencias enviadas</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-64 bg-muted/50 border border-border rounded-lg pl-9 pr-4 py-2 text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <Button variant="outline" size="icon">
                  <Filter size={16} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="py-8 text-center text-muted-foreground">Cargando transferencias...</div>
            ) : transactionsError ? (
              <div className="py-8 text-center text-destructive">{transactionsError}</div>
            ) : (
              <TransactionsTable
                transactions={filteredTransactions}
                onTransactionClick={handleTransactionClick}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!selectedTransaction}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTransaction(null);
            setTransactionDetails(null);
            setDetailsError(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de transferencia</DialogTitle>
          </DialogHeader>
          {detailsLoading ? (
            <div className="py-8 text-center text-muted-foreground">Cargando detalle...</div>
          ) : detailsError ? (
            <div className="py-8 text-center text-destructive">{detailsError}</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Tracking</p>
                  <p className="font-medium">{selectedTransaction?.trackingKey || transactionDetails?.trackingId || "—"}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Referencia</p>
                  <p className="font-medium">{transactionDetails?.externalReference || "—"}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Estatus</p>
                  <p className="font-medium">{transactionDetails?.transactionStatus || selectedTransaction?.status}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Monto</p>
                  <p className="font-medium">
                    ${selectedTransaction?.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">Descripción</p>
                <p className="font-medium">{selectedTransaction?.description || transactionDetails?.description}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Ordenante</p>
                  <p className="font-medium">
                    {transactionDetails?.sourceInstrument?.instrumentDetail?.holderName || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getInstrumentAccount(transactionDetails?.sourceInstrument?.instrumentDetail) || "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Beneficiario</p>
                  <p className="font-medium">
                    {transactionDetails?.destinationInstrument?.instrumentDetail?.holderName || selectedTransaction?.beneficiary || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getInstrumentAccount(transactionDetails?.destinationInstrument?.instrumentDetail) || "—"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </RequirePermission>
    </DashboardLayout>
  );
}
