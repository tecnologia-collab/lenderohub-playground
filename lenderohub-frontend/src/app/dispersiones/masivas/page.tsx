"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout, PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { usersService } from "@/services/users.service";
import {
  massTransferService,
  type MassTransfer,
  type MassTransferRow,
} from "@/services/massTransfer.service";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Loader2,
  RotateCcw,
  History,
  Send,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ============================================
// Types
// ============================================
type WizardStep = "upload" | "preview" | "results";

interface CostCentreOption {
  id: string;
  alias: string;
}

// ============================================
// Helpers
// ============================================
function getRowStatusBadge(status: MassTransferRow["status"]) {
  switch (status) {
    case "valid":
      return <Badge variant="success">Valida</Badge>;
    case "invalid":
      return <Badge variant="destructive">Invalida</Badge>;
    case "pending":
      return <Badge variant="pending">Pendiente</Badge>;
    case "sent":
      return <Badge variant="processing">Enviada</Badge>;
    case "completed":
      return <Badge variant="success">Completada</Badge>;
    case "failed":
      return <Badge variant="destructive">Fallida</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getBatchStatusBadge(status: MassTransfer["status"]) {
  switch (status) {
    case "pending_review":
      return <Badge variant="pending">Pendiente</Badge>;
    case "confirmed":
      return <Badge variant="processing">Confirmada</Badge>;
    case "processing":
      return <Badge variant="processing">Procesando</Badge>;
    case "completed":
      return <Badge variant="success">Completada</Badge>;
    case "partially_completed":
      return <Badge variant="warning">Parcial</Badge>;
    case "failed":
      return <Badge variant="destructive">Fallida</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

// ============================================
// Component
// ============================================
export default function DispersionesMasivasPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard state
  const [step, setStep] = useState<WizardStep>("upload");
  const [loading, setLoading] = useState(false);

  // Upload step
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [costCentres, setCostCentres] = useState<CostCentreOption[]>([]);
  const [costCentreId, setCostCentreId] = useState("");
  const [costCentresLoading, setCostCentresLoading] = useState(true);

  // Preview + Results
  const [massTransfer, setMassTransfer] = useState<MassTransfer | null>(null);

  // History
  const [historyItems, setHistoryItems] = useState<MassTransfer[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [expandedHistoryData, setExpandedHistoryData] = useState<MassTransfer | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);

  // Polling ref
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ============================================
  // Load cost centres
  // ============================================
  useEffect(() => {
    let isMounted = true;

    usersService
      .getFormOptions()
      .then((response) => {
        const options = response.data?.costCentres || [];
        if (!isMounted) return;
        setCostCentres(options.map((cc) => ({ id: cc.id, alias: cc.alias })));
        if (options.length === 1) {
          setCostCentreId(options[0].id);
        }
      })
      .catch(() => {
        if (isMounted) {
          toast({
            title: "Error",
            description: "No se pudieron cargar los centros de costos.",
            variant: "destructive",
          });
        }
      })
      .finally(() => {
        if (isMounted) setCostCentresLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // ============================================
  // Cleanup polling on unmount
  // ============================================
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ============================================
  // File handling
  // ============================================
  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Archivo invalido",
        description: "Solo se aceptan archivos CSV (.csv).",
        variant: "destructive",
      });
      return;
    }
    setSelectedFile(file);
  }, [toast]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  // ============================================
  // Upload & Validate
  // ============================================
  const handleUpload = async () => {
    if (!selectedFile || !costCentreId) return;

    setLoading(true);
    try {
      const result = await massTransferService.upload(selectedFile, costCentreId);
      setMassTransfer(result);
      setStep("preview");
      toast({
        title: "Archivo procesado",
        description: `${result.totalRows} filas encontradas, ${result.validRows} validas.`,
        variant: "success",
      });
    } catch (error: any) {
      toast({
        title: "Error al procesar archivo",
        description: error.message || "No se pudo procesar el archivo CSV.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Confirm & Execute
  // ============================================
  const handleConfirm = async () => {
    if (!massTransfer) return;

    setLoading(true);
    try {
      const result = await massTransferService.confirm(massTransfer._id);
      setMassTransfer(result);
      setStep("results");
      toast({
        title: "Dispersiones confirmadas",
        description: "Las transferencias estan siendo procesadas.",
        variant: "success",
      });

      // Start polling if processing
      if (result.status === "processing" || result.status === "confirmed") {
        startPolling(result._id);
      }
    } catch (error: any) {
      toast({
        title: "Error al confirmar",
        description: error.message || "No se pudieron confirmar las dispersiones.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Polling for results
  // ============================================
  const startPolling = useCallback((id: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const updated = await massTransferService.getById(id);
        setMassTransfer(updated);

        if (
          updated.status !== "processing" &&
          updated.status !== "confirmed"
        ) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 3000);
  }, []);

  // ============================================
  // History
  // ============================================
  const loadHistory = async () => {
    if (!costCentreId) return;
    setHistoryLoading(true);
    try {
      const result = await massTransferService.getAll(costCentreId);
      setHistoryItems(result.data);
      setHistoryTotal(result.total);
    } catch {
      toast({
        title: "Error",
        description: "No se pudo cargar el historial.",
        variant: "destructive",
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next && historyItems.length === 0) {
      loadHistory();
    }
  };

  const handleExpandHistory = async (id: string) => {
    if (expandedHistoryId === id) {
      setExpandedHistoryId(null);
      setExpandedHistoryData(null);
      return;
    }
    setExpandedHistoryId(id);
    setExpandedLoading(true);
    try {
      const data = await massTransferService.getById(id);
      setExpandedHistoryData(data);
    } catch {
      toast({
        title: "Error",
        description: "No se pudieron cargar los detalles.",
        variant: "destructive",
      });
      setExpandedHistoryId(null);
    } finally {
      setExpandedLoading(false);
    }
  };

  // ============================================
  // Reset
  // ============================================
  const handleReset = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setStep("upload");
    setSelectedFile(null);
    setMassTransfer(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ============================================
  // Render: Upload Step
  // ============================================
  const renderUploadStep = () => (
    <div className="space-y-6">
      {/* Cost Centre Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Centro de Costos</CardTitle>
          <CardDescription>
            Selecciona el CECO desde el que se realizaran las dispersiones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {costCentresLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="animate-spin" size={16} />
              Cargando centros de costos...
            </div>
          ) : costCentres.length === 1 ? (
            <div className="px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground">
              {costCentres[0].alias}
            </div>
          ) : (
            <select
              value={costCentreId}
              onChange={(e) => setCostCentreId(e.target.value)}
              className="w-full max-w-sm px-3 py-2.5 bg-muted/50 border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 border-border"
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
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Subir Archivo CSV</CardTitle>
          <CardDescription>
            El archivo debe contener las columnas: CLABE, Beneficiario, Monto,
            Concepto, Referencia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
              transition-colors duration-200
              ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : selectedFile
                  ? "border-success bg-success/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleInputChange}
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                  <FileSpreadsheet className="text-success" size={24} />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {(selectedFile.size / 1024).toFixed(1)} KB — Clic para
                    cambiar archivo
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="text-muted-foreground" size={24} />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    Arrastra tu archivo CSV aqui
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    o haz clic para seleccionarlo
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end mt-6">
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !costCentreId || loading}
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Procesando...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Subir y Validar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================
  // Render: Preview Step
  // ============================================
  const renderPreviewStep = () => {
    if (!massTransfer) return null;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="text-primary" size={20} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Filas</p>
                  <p className="text-2xl font-bold">{massTransfer.totalRows}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="text-success" size={20} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Validas</p>
                  <p className="text-2xl font-bold text-success">
                    {massTransfer.validRows}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <XCircle className="text-destructive" size={20} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Invalidas</p>
                  <p className="text-2xl font-bold text-destructive">
                    {massTransfer.invalidRows}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Send className="text-primary" size={20} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monto Total</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(massTransfer.totalAmount)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Warning for invalid rows */}
        {massTransfer.invalidRows > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-warning/10 border border-warning/20">
            <AlertCircle className="text-warning shrink-0" size={20} />
            <p className="text-sm text-warning">
              <span className="font-medium">
                {massTransfer.invalidRows} fila
                {massTransfer.invalidRows > 1 ? "s" : ""} con errores
              </span>{" "}
              — estas filas no seran procesadas. Revisa los detalles en la tabla
              de abajo.
            </p>
          </div>
        )}

        {/* Rows Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detalle de Filas</CardTitle>
            <CardDescription>
              Revisa las filas antes de confirmar la dispersion.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>CLABE</TableHead>
                  <TableHead>Beneficiario</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {massTransfer.rows.map((row) => (
                  <TableRow
                    key={row.rowNumber}
                    className={
                      row.status === "invalid" ? "bg-destructive/5" : ""
                    }
                  >
                    <TableCell className="font-mono text-muted-foreground">
                      {row.rowNumber}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {row.beneficiaryClabe}
                    </TableCell>
                    <TableCell>{row.beneficiaryName}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(row.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {row.concept}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {row.reference}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getRowStatusBadge(row.status)}
                        {row.errorMessage && (
                          <span
                            className="text-destructive cursor-help"
                            title={row.errorMessage}
                          >
                            <AlertCircle size={14} />
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <ArrowLeft size={16} />
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={massTransfer.validRows === 0 || loading}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Procesando...
              </>
            ) : (
              <>
                <Send size={16} />
                Confirmar Dispersiones ({massTransfer.validRows} transferencias)
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  // ============================================
  // Render: Results Step
  // ============================================
  const renderResultsStep = () => {
    if (!massTransfer) return null;

    const isProcessing =
      massTransfer.status === "processing" ||
      massTransfer.status === "confirmed";

    return (
      <div className="space-y-6">
        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <Loader2 className="text-primary animate-spin shrink-0" size={20} />
            <p className="text-sm text-primary font-medium">
              Procesando dispersiones... Esta pagina se actualizara
              automaticamente.
            </p>
          </div>
        )}

        {/* Result Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="text-primary" size={20} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <div className="mt-1">
                    {getBatchStatusBadge(massTransfer.status)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="text-success" size={20} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Exitosas</p>
                  <p className="text-2xl font-bold text-success">
                    {massTransfer.successCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <XCircle className="text-destructive" size={20} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fallidas</p>
                  <p className="text-2xl font-bold text-destructive">
                    {massTransfer.failCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Send className="text-primary" size={20} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Monto Dispersado
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(massTransfer.totalAmount)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resultado por Fila</CardTitle>
            <CardDescription>
              Detalle final de cada transferencia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>CLABE</TableHead>
                  <TableHead>Beneficiario</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {massTransfer.rows.map((row) => (
                  <TableRow
                    key={row.rowNumber}
                    className={
                      row.status === "failed" || row.status === "invalid"
                        ? "bg-destructive/5"
                        : row.status === "completed"
                        ? "bg-success/5"
                        : ""
                    }
                  >
                    <TableCell className="font-mono text-muted-foreground">
                      {row.rowNumber}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {row.beneficiaryClabe}
                    </TableCell>
                    <TableCell>{row.beneficiaryName}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(row.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {row.concept}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {row.reference}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getRowStatusBadge(row.status)}
                        {row.errorMessage && (
                          <span
                            className="text-destructive cursor-help"
                            title={row.errorMessage}
                          >
                            <AlertCircle size={14} />
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {!isProcessing && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setShowHistory(true);
                if (historyItems.length === 0 && costCentreId) loadHistory();
              }}
              className="gap-2"
            >
              <History size={16} />
              Ver Historial
            </Button>
            <Button onClick={handleReset} className="gap-2">
              <RotateCcw size={16} />
              Nueva Dispersion Masiva
            </Button>
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // Render: History Section
  // ============================================
  const renderHistory = () => (
    <Card className="mt-6">
      <CardHeader
        className="cursor-pointer"
        onClick={toggleHistory}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <History size={18} />
              Historial de Dispersiones Masivas
            </CardTitle>
            <CardDescription>
              {historyTotal > 0
                ? `${historyTotal} dispersion${historyTotal !== 1 ? "es" : ""} registrada${historyTotal !== 1 ? "s" : ""}`
                : "Consulta dispersiones anteriores"}
            </CardDescription>
          </div>
          {showHistory ? (
            <ChevronUp size={20} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={20} className="text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {showHistory && (
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="animate-spin" size={16} />
              Cargando historial...
            </div>
          ) : historyItems.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No hay dispersiones masivas registradas.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Archivo</TableHead>
                  <TableHead className="text-right">Total Filas</TableHead>
                  <TableHead className="text-right">Exitosas</TableHead>
                  <TableHead className="text-right">Fallidas</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyItems.map((item) => (
                  <React.Fragment key={item._id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => handleExpandHistory(item._id)}
                    >
                      <TableCell className="text-muted-foreground">
                        {formatDate(item.createdAt)}{" "}
                        {formatTime(item.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.fileName}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.totalRows}
                      </TableCell>
                      <TableCell className="text-right text-success">
                        {item.successCount}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {item.failCount}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.totalAmount)}
                      </TableCell>
                      <TableCell>
                        {getBatchStatusBadge(item.status)}
                      </TableCell>
                      <TableCell>
                        {expandedHistoryId === item._id ? (
                          <ChevronUp size={16} className="text-muted-foreground" />
                        ) : (
                          <ChevronDown size={16} className="text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expanded Detail */}
                    {expandedHistoryId === item._id && (
                      <TableRow>
                        <TableCell colSpan={8} className="p-0">
                          {expandedLoading ? (
                            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                              <Loader2 className="animate-spin" size={16} />
                              Cargando detalles...
                            </div>
                          ) : expandedHistoryData ? (
                            <div className="p-4 bg-muted/30">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-12">#</TableHead>
                                    <TableHead>CLABE</TableHead>
                                    <TableHead>Beneficiario</TableHead>
                                    <TableHead className="text-right">
                                      Monto
                                    </TableHead>
                                    <TableHead>Concepto</TableHead>
                                    <TableHead>Estado</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {expandedHistoryData.rows.map((row) => (
                                    <TableRow key={row.rowNumber}>
                                      <TableCell className="font-mono text-muted-foreground">
                                        {row.rowNumber}
                                      </TableCell>
                                      <TableCell className="font-mono text-sm">
                                        {row.beneficiaryClabe}
                                      </TableCell>
                                      <TableCell>
                                        {row.beneficiaryName}
                                      </TableCell>
                                      <TableCell className="text-right font-medium">
                                        {formatCurrency(row.amount)}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">
                                        {row.concept}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          {getRowStatusBadge(row.status)}
                                          {row.errorMessage && (
                                            <span
                                              className="text-destructive cursor-help"
                                              title={row.errorMessage}
                                            >
                                              <AlertCircle size={14} />
                                            </span>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      )}
    </Card>
  );

  // ============================================
  // Main Render
  // ============================================
  return (
    <DashboardLayout
      title="Dispersiones Masivas"
      subtitle="Carga masiva de transferencias via CSV"
    >
      <RequirePermission permission="transactions:create" fallbackUrl="/">
        <div className="space-y-6">
          <PageHeader
            title="Dispersion Masiva"
            description="Sube un archivo CSV con multiples transferencias para procesarlas en lote"
            actions={
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => router.push("/dispersiones")}
                >
                  <ArrowLeft size={16} />
                  <span className="hidden sm:inline">Volver</span>
                </Button>
              </div>
            }
          />

          {/* Wizard Steps Indicator */}
          <div className="flex items-center gap-2 text-sm">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                step === "upload"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Upload size={14} />
              <span>1. Subir</span>
            </div>
            <div className="w-6 h-px bg-border" />
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                step === "preview"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <FileSpreadsheet size={14} />
              <span>2. Revisar</span>
            </div>
            <div className="w-6 h-px bg-border" />
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                step === "results"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <CheckCircle2 size={14} />
              <span>3. Resultado</span>
            </div>
          </div>

          {/* Step Content */}
          {step === "upload" && renderUploadStep()}
          {step === "preview" && renderPreviewStep()}
          {step === "results" && renderResultsStep()}

          {/* History (always available below) */}
          {costCentreId && renderHistory()}
        </div>
      </RequirePermission>
    </DashboardLayout>
  );
}
