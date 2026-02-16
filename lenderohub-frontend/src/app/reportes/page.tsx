"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DashboardLayout, PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { env } from "@/config/env";
import { reportsService } from "@/services/reports.service";
import type {
  ReportSummary,
  ReportTransaction,
  ReportTransactionsResponse,
} from "@/services/reports.service";
import {
  FileBarChart,
  Download,
  Calendar,
  FileText,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ============================================
// Helpers
// ============================================

const reportTypes = [
  { id: "transactions", name: "Transacciones", icon: FileText, description: "Historial detallado de movimientos" },
  { id: "commissions", name: "Comisiones", icon: TrendingUp, description: "Resumen de comisiones cobradas" },
  { id: "balance", name: "Estado de Cuenta", icon: FileBarChart, description: "Balance y movimientos por periodo" },
  { id: "reconciliation", name: "Conciliacion", icon: CheckCircle2, description: "Comparativa con banco" },
];

const periodLabels: Record<string, string> = {
  week: "7D",
  month: "1M",
  quarter: "3M",
  year: "1A",
};

const txTypeFilters = [
  { key: "all", label: "Todas" },
  { key: "transfer_in", label: "SPEI In" },
  { key: "transfer_out", label: "SPEI Out" },
  { key: "internal", label: "Internas" },
];

function getPeriodDates(period: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  let from: Date;
  switch (period) {
    case "week":
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "quarter":
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "year":
      from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { from: from.toISOString(), to };
}

function getStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (["liquidated", "completed"].includes(s)) {
    return <Badge variant="success">{status}</Badge>;
  }
  if (["sent", "pending", "processing"].includes(s)) {
    return <Badge variant="warning">{status}</Badge>;
  }
  if (["new", "initialized"].includes(s)) {
    return <Badge variant="secondary">{status}</Badge>;
  }
  // failed, cancelled, refunded, rejected
  return <Badge variant="destructive">{status}</Badge>;
}

function getTypeBadge(type: string) {
  switch (type) {
    case "transfer_in":
      return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">SPEI In</Badge>;
    case "transfer_out":
      return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">SPEI Out</Badge>;
    case "internal":
      return <Badge className="bg-violet-500/10 text-violet-600 border-violet-500/20">Interno</Badge>;
    default:
      return <Badge variant="secondary">{type}</Badge>;
  }
}

// ============================================
// Chart Tooltip
// ============================================

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
        <p className="text-muted-foreground text-xs mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ============================================
// Page Component
// ============================================

export default function ReportesPage() {
  const { toast } = useToast();

  // Period & filters
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [selectedReportType, setSelectedReportType] = useState<string | null>(null);
  const [txTypeFilter, setTxTypeFilter] = useState("all");
  const [txPage, setTxPage] = useState(1);
  const txLimit = 15;

  // Data states
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [txResponse, setTxResponse] = useState<ReportTransactionsResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTx, setLoadingTx] = useState(true);
  const [exporting, setExporting] = useState(false);

  // ----------------------------------------
  // Fetch summary
  // ----------------------------------------
  const fetchSummary = useCallback(async (period: string) => {
    setLoadingSummary(true);
    try {
      const { from, to } = getPeriodDates(period);
      const data = await reportsService.getSummary({ from, to });
      setSummary(data);
    } catch (err: any) {
      toast({
        title: "Error al cargar resumen",
        description: err?.message || "No se pudo obtener el resumen de reportes",
        variant: "destructive",
      });
    } finally {
      setLoadingSummary(false);
    }
  }, [toast]);

  // ----------------------------------------
  // Fetch transactions
  // ----------------------------------------
  const fetchTransactions = useCallback(async (period: string, type: string, page: number) => {
    setLoadingTx(true);
    try {
      const { from, to } = getPeriodDates(period);
      const params: Record<string, string | number | boolean | undefined> = {
        from,
        to,
        page,
        limit: txLimit,
      };
      if (type !== "all") {
        params.type = type;
      }
      const data = await reportsService.getTransactions(params);
      setTxResponse(data);
    } catch (err: any) {
      toast({
        title: "Error al cargar transacciones",
        description: err?.message || "No se pudieron obtener las transacciones",
        variant: "destructive",
      });
    } finally {
      setLoadingTx(false);
    }
  }, [toast]);

  // ----------------------------------------
  // Effects
  // ----------------------------------------
  useEffect(() => {
    fetchSummary(selectedPeriod);
  }, [selectedPeriod, fetchSummary]);

  useEffect(() => {
    setTxPage(1);
    fetchTransactions(selectedPeriod, txTypeFilter, 1);
  }, [selectedPeriod, txTypeFilter, fetchTransactions]);

  useEffect(() => {
    fetchTransactions(selectedPeriod, txTypeFilter, txPage);
    // Only re-run when txPage changes (not when filter/period changes -- that's handled above)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txPage]);

  // ----------------------------------------
  // Export handler
  // ----------------------------------------
  const handleExport = () => {
    if (!selectedReportType) return;
    setExporting(true);
    try {
      const { from, to } = getPeriodDates(selectedPeriod);
      const baseUrl = env.apiUrl;
      const exportPath = reportsService.getExportUrl(selectedReportType, "csv", { from, to });
      const url = `${baseUrl}${exportPath}`;
      window.open(url, "_blank");
      toast({
        title: "Exportando reporte",
        description: "Se abrira una nueva pestana con la descarga",
      });
    } catch (err: any) {
      toast({
        title: "Error al exportar",
        description: err?.message || "No se pudo generar el reporte",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  // ----------------------------------------
  // Derived
  // ----------------------------------------
  const transactions: ReportTransaction[] = txResponse?.data || [];
  const totalTx = txResponse?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalTx / txLimit));
  const monthlyData = summary?.monthlyData || [];
  const typeData = summary?.transactionsByType || [];

  // ----------------------------------------
  // Render
  // ----------------------------------------
  return (
    <DashboardLayout title="Reportes" subtitle="Analisis y exportacion de datos">
      <div className="space-y-6">
        <PageHeader
          title="Reportes y Analisis"
          description="Genera y descarga reportes de tu actividad"
          actions={
            <div className="flex items-center gap-3">
              <Button variant="outline" className="gap-2" disabled>
                <Calendar size={16} />
                Periodo
              </Button>
              <Button
                className="gap-2"
                disabled={!selectedReportType || exporting}
                onClick={handleExport}
              >
                {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Exportar
              </Button>
            </div>
          }
        />

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <ArrowDownLeft className="text-success" size={20} />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Ingresos ({periodLabels[selectedPeriod]})</p>
                  <p className="text-xl font-bold text-success">
                    {loadingSummary ? "..." : formatCurrency(summary?.totalIncome ?? 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <ArrowUpRight className="text-destructive" size={20} />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Egresos ({periodLabels[selectedPeriod]})</p>
                  <p className="text-xl font-bold">
                    {loadingSummary ? "..." : formatCurrency(summary?.totalExpense ?? 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="text-primary" size={20} />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Neto ({periodLabels[selectedPeriod]})</p>
                  <p className="text-xl font-bold text-primary">
                    {loadingSummary ? "..." : formatCurrency(summary?.netFlow ?? 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <FileText className="text-violet-500" size={20} />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Transacciones</p>
                  <p className="text-xl font-bold">
                    {loadingSummary ? "..." : (summary?.totalTransactions ?? 0).toLocaleString("es-MX")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Flujo de Efectivo</CardTitle>
                <CardDescription>Ingresos vs Egresos</CardDescription>
              </div>
              <div className="flex gap-1">
                {(["week", "month", "quarter", "year"] as const).map((period) => (
                  <Button
                    key={period}
                    variant={selectedPeriod === period ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setSelectedPeriod(period)}
                    className={cn(
                      "text-xs",
                      selectedPeriod === period && "bg-primary/20 text-primary"
                    )}
                  >
                    {periodLabels[period]}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {loadingSummary ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <Loader2 className="animate-spin mr-2" size={20} />
                    Cargando...
                  </div>
                ) : monthlyData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Sin datos para el periodo seleccionado
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="ingresos" name="Ingresos" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="egresos" name="Egresos" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Por Tipo</CardTitle>
              <CardDescription>Distribucion de transacciones</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                  <Loader2 className="animate-spin mr-2" size={20} />
                  Cargando...
                </div>
              ) : typeData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                  Sin datos
                </div>
              ) : (
                <>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={typeData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {typeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 mt-4">
                    {typeData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-medium">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Transacciones</CardTitle>
              <CardDescription>
                {loadingTx ? "Cargando..." : `${totalTx.toLocaleString("es-MX")} transacciones encontradas`}
              </CardDescription>
            </div>
            <div className="flex gap-1">
              {txTypeFilters.map((f) => (
                <Button
                  key={f.key}
                  variant={txTypeFilter === f.key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setTxTypeFilter(f.key)}
                  className={cn(
                    "text-xs",
                    txTypeFilter === f.key && "bg-primary/20 text-primary"
                  )}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {loadingTx ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="animate-spin mr-2" size={20} />
                Cargando transacciones...
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                No se encontraron transacciones para este periodo
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Contraparte</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            <div>{formatDate(tx.createdAt)}</div>
                            <div className="text-xs">{formatTime(tx.createdAt)}</div>
                          </TableCell>
                          <TableCell>{getTypeBadge(tx.type)}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{tx.concept}</TableCell>
                          <TableCell className="text-muted-foreground">{tx.counterparty || "-"}</TableCell>
                          <TableCell className={cn(
                            "text-right font-medium whitespace-nowrap",
                            tx.type === "transfer_in" ? "text-emerald-600" : tx.type === "transfer_out" ? "text-red-600" : ""
                          )}>
                            {tx.type === "transfer_in" ? "+" : tx.type === "transfer_out" ? "-" : ""}
                            {formatCurrency(tx.amount)}
                          </TableCell>
                          <TableCell>{getStatusBadge(tx.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Pagina {txPage} de {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={txPage <= 1}
                        onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                        className="gap-1"
                      >
                        <ChevronLeft size={14} />
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={txPage >= totalPages}
                        onClick={() => setTxPage((p) => p + 1)}
                        className="gap-1"
                      >
                        Siguiente
                        <ChevronRight size={14} />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Report Types / Export */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Generar Reporte</CardTitle>
            <CardDescription>Selecciona el tipo de reporte a generar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {reportTypes.map((report) => (
                <button
                  key={report.id}
                  onClick={() => setSelectedReportType(report.id)}
                  className={cn(
                    "p-4 rounded-xl border-2 text-left transition-all",
                    selectedReportType === report.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-3">
                    <report.icon size={20} className="text-foreground" />
                  </div>
                  <p className="font-medium text-foreground">{report.name}</p>
                  <p className="text-muted-foreground text-sm mt-1">{report.description}</p>
                </button>
              ))}
            </div>
            {selectedReportType && (
              <div className="mt-4 flex justify-end">
                <Button className="gap-2" onClick={handleExport} disabled={exporting}>
                  {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  Generar Reporte
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
