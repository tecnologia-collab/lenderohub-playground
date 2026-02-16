"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  commissionsService,
  type CommissionRequestItem,
  type CommissionRequestStatus,
} from "@/services/commissions.service";
import { FileText, FileCode, Plus } from "lucide-react";

// ============================================
// Types
// ============================================

interface RequestsTabProps {
  userRole: string;
}

type StatusFilter = "all" | "new" | "approved" | "rejected";

// ============================================
// Status Helpers
// ============================================

const STATUS_CONFIG: Record<
  CommissionRequestStatus,
  { label: string; variant: "warning" | "pending" | "destructive" | "success" | "secondary" }
> = {
  new: { label: "Pendiente", variant: "warning" },
  approved: { label: "Aprobada", variant: "pending" },
  rejected: { label: "Rechazada", variant: "destructive" },
  completed: { label: "Completada", variant: "success" },
  cancelled: { label: "Cancelada", variant: "secondary" },
};

function getStatusBadge(status: CommissionRequestStatus) {
  const config = STATUS_CONFIG[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// ============================================
// Sub-components
// ============================================

function StatusFilterTabs({
  active,
  onChange,
}: {
  active: StatusFilter;
  onChange: (filter: StatusFilter) => void;
}) {
  const filters: { id: StatusFilter; label: string }[] = [
    { id: "new", label: "Pendientes" },
    { id: "approved", label: "Aprobadas" },
    { id: "rejected", label: "Rechazadas" },
    { id: "all", label: "Todas" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((f) => (
        <Button
          key={f.id}
          variant={active === f.id ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(f.id)}
        >
          {f.label}
        </Button>
      ))}
    </div>
  );
}

// ============================================
// Agent (commissionAgent) View
// ============================================

function AgentRequestsView() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<CommissionRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [amount, setAmount] = useState("");
  const [invoicePDF, setInvoicePDF] = useState<File | null>(null);
  const [invoiceXML, setInvoiceXML] = useState<File | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const data = await commissionsService.getCommissionRequests({ mine: true });
      setRequests(data.requests || []);
    } catch (error: any) {
      toast({
        title: "Error al cargar solicitudes",
        description: error?.message || "No se pudieron cargar tus solicitudes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const resetForm = () => {
    setAmount("");
    setInvoicePDF(null);
    setInvoiceXML(null);
  };

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast({
        title: "Monto invalido",
        description: "Ingresa un monto mayor a cero.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("amount", String(parsedAmount));
      if (invoicePDF) formData.append("invoicePDF", invoicePDF);
      if (invoiceXML) formData.append("invoiceXML", invoiceXML);

      await commissionsService.createCommissionRequest(formData);
      toast({
        title: "Solicitud enviada",
        description: "Tu solicitud de pago ha sido registrada.",
        variant: "success",
      });
      setDialogOpen(false);
      resetForm();
      await loadRequests();
    } catch (error: any) {
      toast({
        title: "Error al enviar solicitud",
        description: error?.message || "No se pudo crear la solicitud.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Mis Solicitudes de Pago</h3>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus size={16} />
          Solicitar Pago
        </Button>
      </div>

      <div className="relative min-h-[120px]">
        <LoadingOverlay isLoading={loading} message="Cargando solicitudes..." />
        <div className={cn(loading && "opacity-50 pointer-events-none")}>
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>FOLIO</TableHead>
                  <TableHead>FECHA</TableHead>
                  <TableHead className="text-right">MONTO</TableHead>
                  <TableHead className="text-right">MONTO A TRANSFERIR</TableHead>
                  <TableHead>ESTADO</TableHead>
                  <TableHead>MENSAJE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req._id}>
                    <TableCell>
                      <code className="rounded bg-muted px-2 py-1 text-xs">{req.folio}</code>
                    </TableCell>
                    <TableCell>{formatDate(req.date)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(req.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {typeof req.amountTransfer === "number"
                        ? formatCurrency(req.amountTransfer)
                        : "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {req.rejectionMessage || "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {requests.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No tienes solicitudes registradas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Create request dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Pago de Comision</DialogTitle>
            <DialogDescription>
              Ingresa el monto y adjunta tus facturas para solicitar el pago.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="req-amount">Monto (MXN)</Label>
              <Input
                id="req-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-pdf">Factura PDF</Label>
              <Input
                id="req-pdf"
                type="file"
                accept=".pdf"
                onChange={(e) => setInvoicePDF(e.target.files?.[0] || null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-xml">Factura XML</Label>
              <Input
                id="req-xml"
                type="file"
                accept=".xml"
                onChange={(e) => setInvoiceXML(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDialogOpen(false); resetForm(); }}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar Solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// Corporate/Admin View
// ============================================

function CorporateRequestsView() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<CommissionRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("new");

  // Rejection dialog
  const [rejectTarget, setRejectTarget] = useState<CommissionRequestItem | null>(null);
  const [rejectionMessage, setRejectionMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadRequests = useCallback(async (status: StatusFilter) => {
    try {
      setLoading(true);
      const params: { status?: string } = {};
      if (status !== "all") {
        params.status = status;
      }
      const data = await commissionsService.getCommissionRequests(params);
      setRequests(data.requests || []);
    } catch (error: any) {
      toast({
        title: "Error al cargar solicitudes",
        description: error?.message || "No se pudieron cargar las solicitudes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRequests(statusFilter);
  }, [loadRequests, statusFilter]);

  const handleApprove = async (req: CommissionRequestItem) => {
    try {
      setActionLoading(req._id);
      await commissionsService.approveCommissionRequest(req._id);
      toast({
        title: "Solicitud aprobada",
        description: `La solicitud ${req.folio} ha sido aprobada.`,
        variant: "success",
      });
      await loadRequests(statusFilter);
    } catch (error: any) {
      toast({
        title: "Error al aprobar",
        description: error?.message || "No se pudo aprobar la solicitud.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectTarget) return;
    if (!rejectionMessage.trim()) {
      toast({
        title: "Mensaje requerido",
        description: "Debes ingresar un motivo de rechazo.",
        variant: "destructive",
      });
      return;
    }

    try {
      setActionLoading(rejectTarget._id);
      await commissionsService.rejectCommissionRequest(rejectTarget._id, rejectionMessage.trim());
      toast({
        title: "Solicitud rechazada",
        description: `La solicitud ${rejectTarget.folio} ha sido rechazada.`,
      });
      setRejectTarget(null);
      setRejectionMessage("");
      await loadRequests(statusFilter);
    } catch (error: any) {
      toast({
        title: "Error al rechazar",
        description: error?.message || "No se pudo rechazar la solicitud.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h3 className="text-lg font-semibold">Solicitudes de Pago</h3>
        <StatusFilterTabs active={statusFilter} onChange={setStatusFilter} />
      </div>

      <div className="relative min-h-[120px]">
        <LoadingOverlay isLoading={loading} message="Cargando solicitudes..." />
        <div className={cn(loading && "opacity-50 pointer-events-none")}>
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>FOLIO</TableHead>
                  <TableHead>FECHA</TableHead>
                  <TableHead>COMISIONISTA</TableHead>
                  <TableHead className="text-right">MONTO</TableHead>
                  <TableHead>FACTURAS</TableHead>
                  <TableHead>ESTADO</TableHead>
                  <TableHead>ACCIONES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req._id}>
                    <TableCell>
                      <code className="rounded bg-muted px-2 py-1 text-xs">{req.folio}</code>
                    </TableCell>
                    <TableCell>{formatDate(req.date)}</TableCell>
                    <TableCell className="font-medium">{req.commissionAgent}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(req.amount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <span
                          title={req.hasInvoicePDF ? "PDF adjunto" : "Sin PDF"}
                          className={cn(
                            "inline-flex items-center gap-1 text-xs",
                            req.hasInvoicePDF ? "text-red-500" : "text-muted-foreground/40"
                          )}
                        >
                          <FileText size={14} />
                          PDF
                        </span>
                        <span
                          title={req.hasInvoiceXML ? "XML adjunto" : "Sin XML"}
                          className={cn(
                            "inline-flex items-center gap-1 text-xs",
                            req.hasInvoiceXML ? "text-blue-500" : "text-muted-foreground/40"
                          )}
                        >
                          <FileCode size={14} />
                          XML
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                    <TableCell>
                      {req.status === "new" ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleApprove(req)}
                            disabled={actionLoading === req._id}
                          >
                            {actionLoading === req._id ? "..." : "Aprobar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => { setRejectTarget(req); setRejectionMessage(""); }}
                            disabled={actionLoading === req._id}
                          >
                            Rechazar
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {requests.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No hay solicitudes
                      {statusFilter !== "all" ? ` con estado "${STATUS_CONFIG[statusFilter as CommissionRequestStatus]?.label || statusFilter}"` : ""}.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Rejection dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectionMessage(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Solicitud</DialogTitle>
            <DialogDescription>
              Ingresa el motivo de rechazo para la solicitud {rejectTarget?.folio}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejection-msg">Motivo de rechazo</Label>
            <Input
              id="rejection-msg"
              placeholder="Escribe el motivo del rechazo..."
              value={rejectionMessage}
              onChange={(e) => setRejectionMessage(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setRejectTarget(null); setRejectionMessage(""); }}
              disabled={!!actionLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={!!actionLoading}
            >
              {actionLoading ? "Procesando..." : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function RequestsTab({ userRole }: RequestsTabProps) {
  const isAgent = userRole === "commissionAgent";

  if (isAgent) {
    return <AgentRequestsView />;
  }

  return <CorporateRequestsView />;
}
