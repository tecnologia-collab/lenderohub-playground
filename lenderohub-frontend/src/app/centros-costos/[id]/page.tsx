"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  Copy,
  CreditCard,
  FileText,
  Info,
  MapPin,
  Phone,
  Receipt,
  ShieldCheck,
  TrendingUp,
  User,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

import { DashboardLayout, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import {
  costCentresService,
  CommercialRule,
  CostCentre,
  CostCentreAccumulators,
  MoneyValue,
} from "@/services/costCentres.service";
import { cn, formatCurrency, formatDate, truncateClabe } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const statusConfig = {
  active: { label: "Activo", variant: "success" as const },
  disabled: { label: "Deshabilitado", variant: "secondary" as const },
};

const getMoneyAmount = (value?: MoneyValue): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && typeof value.amount === "number") {
    const precision = value.precision ?? 2;
    return value.amount / Math.pow(10, precision);
  }
  return null;
};

const formatMoney = (value?: MoneyValue, emptyLabel = "No definido") => {
  const amount = getMoneyAmount(value);
  if (amount === null) return emptyLabel;
  return formatCurrency(amount);
};

const formatRule = (rule?: CommercialRule) => {
  if (!rule) return "No definido";
  if (rule.type === "na") return "No aplica";
  if (rule.type === "percentage") {
    return rule.value !== undefined ? `${rule.value}%` : "Porcentaje no definido";
  }
  if (rule.type === "fixed") {
    return formatMoney(rule.amount, "Monto no definido");
  }
  return "No definido";
};

function DetailRow({
  label,
  value,
  mono = false,
  muted = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  muted?: boolean;
}) {
  const displayValue =
    value === null || value === undefined || value === "" ? "—" : value;
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm text-right",
          mono && "font-mono",
          muted ? "text-muted-foreground" : "font-medium text-foreground"
        )}
      >
        {displayValue}
      </span>
    </div>
  );
}

export default function CostCentreDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const costCentreId = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const [costCentre, setCostCentre] = useState<CostCentre | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accumulators, setAccumulators] = useState<CostCentreAccumulators | null>(null);

  useEffect(() => {
    if (!costCentreId) {
      setError("ID de centro de costos inválido.");
      setLoading(false);
      return;
    }

    const loadCostCentre = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await costCentresService.getCostCentre(costCentreId);
        setCostCentre(data);
      } catch (err: any) {
        console.error("Error loading cost centre:", err);
        setError(err.message || "Error al cargar centro de costos");
      } finally {
        setLoading(false);
      }
    };

    loadCostCentre();
  }, [costCentreId]);

  useEffect(() => {
    if (!costCentreId) return;
    costCentresService
      .getCostCentreAccumulators(costCentreId)
      .then((data) => setAccumulators(data))
      .catch(() => {});
  }, [costCentreId]);

  const contactName = useMemo(() => {
    if (!costCentre?.contact) return "Sin contacto registrado";
    const parts = [
      costCentre.contact.name,
      costCentre.contact.lastname,
      costCentre.contact.secondLastname,
    ].filter(Boolean);
    return parts.length ? parts.join(" ") : "Sin contacto registrado";
  }, [costCentre]);

  const contactPhones = useMemo(() => {
    if (!costCentre?.contact) return [];
    const numbers = [
      costCentre.contact.phoneNumber,
      costCentre.contact.phoneNumber2,
      ...(costCentre.contact.phoneNumbers || []),
    ].filter(Boolean) as string[];
    return Array.from(new Set(numbers));
  }, [costCentre]);

  const fiscalAddress = useMemo(() => {
    if (!costCentre?.fiscalAddress) return "Sin domicilio fiscal";
    const addressParts = [
      costCentre.fiscalAddress.street,
      costCentre.fiscalAddress.exteriorNumber,
      costCentre.fiscalAddress.interiorNumber,
      costCentre.fiscalAddress.neighborhood,
      costCentre.fiscalAddress.city,
      costCentre.fiscalAddress.state,
      costCentre.fiscalAddress.postalCode,
      costCentre.fiscalAddress.country,
    ].filter(Boolean);
    return addressParts.length ? addressParts.join(", ") : "Sin domicilio fiscal";
  }, [costCentre]);

  const clusterLabel = useMemo(() => {
    const cluster = costCentre?.cluster;
    if (!cluster) return "Sin cluster asignado";
    if (typeof cluster === "string") return cluster;
    return cluster.name || cluster.id || cluster._id || "Cluster asignado";
  }, [costCentre]);

  const handleCopyClabe = () => {
    if (!costCentre?.fincoClabeNumber) return;
    navigator.clipboard.writeText(costCentre.fincoClabeNumber);
    toast({
      title: "CLABE copiada",
      description: costCentre.fincoClabeNumber,
    });
  };

  const status = costCentre?.disabled ? "disabled" : "active";

  return (
    <DashboardLayout title="Centro de Costos" subtitle="Detalle y configuración">
      <div className="space-y-6">
        <PageHeader
          title={costCentre?.alias || "Detalle de Centro de Costos"}
          description={costCentre?.code ? `Código ${costCentre.code}` : undefined}
          actions={
            <Button variant="outline" className="gap-2" asChild>
              <Link href="/centros-costos">
                <ArrowLeft size={16} />
                Volver
              </Link>
            </Button>
          }
        />

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
              <XCircle size={16} />
            </Button>
          </div>
        )}

        <div className="relative min-h-[320px]">
          <LoadingOverlay isLoading={loading} message="Cargando detalle del centro de costos..." />
          <div className={loading ? "opacity-50 pointer-events-none space-y-6" : "space-y-6"}>
            {costCentre && (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={statusConfig[status].variant}>{statusConfig[status].label}</Badge>
                  {costCentre.default && (
                    <Badge variant="secondary" className="gap-1">
                      <BadgeCheck size={12} />
                      Predeterminado
                    </Badge>
                  )}
                  <Badge variant="outline">
                    Proveedor: {costCentresService.getProviderLabel(costCentre.provider)}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Info size={18} />
                        Información General
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <DetailRow label="Alias" value={costCentre.alias} />
                      <DetailRow label="Nombre corto" value={costCentre.shortName} mono />
                      <DetailRow label="Código" value={costCentre.code} mono />
                      <DetailRow
                        label="CLABE"
                        value={
                          costCentre.fincoClabeNumber ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="font-mono">{truncateClabe(costCentre.fincoClabeNumber)}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={handleCopyClabe}
                              >
                                <Copy size={12} />
                              </Button>
                            </span>
                          ) : (
                            "Sin CLABE"
                          )
                        }
                      />
                      <DetailRow label="Creado" value={formatDate(costCentre.createdAt)} />
                      <DetailRow label="Actualizado" value={formatDate(costCentre.updatedAt)} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User size={18} />
                        Datos de Contacto
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <DetailRow label="Contacto" value={contactName} />
                      <DetailRow
                        label="Correo"
                        value={costCentre.contact?.email || "Sin correo"}
                      />
                      <DetailRow
                        label="Teléfonos"
                        value={
                          contactPhones.length ? (
                            <span className="inline-flex flex-wrap gap-2 justify-end">
                              {contactPhones.map((phone) => (
                                <span key={phone} className="inline-flex items-center gap-1 text-sm">
                                  <Phone size={12} />
                                  {phone}
                                </span>
                              ))}
                            </span>
                          ) : (
                            "Sin teléfonos"
                          )
                        }
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 size={18} />
                        Datos Fiscales
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <DetailRow label="RFC" value={costCentre.rfc || "Sin RFC"} mono />
                      <DetailRow
                        label="Domicilio fiscal"
                        value={
                          <span className="inline-flex items-center gap-2">
                            <MapPin size={14} className="text-muted-foreground" />
                            <span className="text-right">{fiscalAddress}</span>
                          </span>
                        }
                      />
                      <DetailRow
                        label="Constancia fiscal"
                        value={
                          <span className="inline-flex items-center gap-2">
                            <FileText size={14} className="text-muted-foreground" />
                            Sin archivo
                          </span>
                        }
                        muted
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ShieldCheck size={18} />
                        Condiciones Comerciales
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <DetailRow label="SPEI Entrada" value={formatRule(costCentre.commercialRules?.in)} />
                      <DetailRow label="SPEI Salida" value={formatRule(costCentre.commercialRules?.out)} />
                      <DetailRow label="Cuota mensual" value={formatRule(costCentre.commercialRules?.monthlyFee)} />
                      <DetailRow
                        label="Fee transacción"
                        value={formatMoney(costCentre.commercialRules?.transactionFee)}
                      />
                      <DetailRow
                        label="Saldo mínimo"
                        value={formatMoney(costCentre.commercialRules?.minimumBalanceNewAccounts)}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wallet size={18} />
                        Perfil Transaccional
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <DetailRow
                        label="Límite entrada"
                        value={formatMoney(costCentre.transactionProfile?.limitIn)}
                      />
                      <DetailRow
                        label="Ops entrada"
                        value={costCentre.transactionProfile?.opsIn ?? "No definido"}
                      />
                      <DetailRow
                        label="Límite salida"
                        value={formatMoney(costCentre.transactionProfile?.limitOut)}
                      />
                      <DetailRow
                        label="Ops salida"
                        value={costCentre.transactionProfile?.opsOut ?? "No definido"}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BadgeCheck size={18} />
                        Cash Management
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <DetailRow
                        label="Estado"
                        value={
                          costCentre.cashManagementEnabled ? (
                            <span className="inline-flex items-center gap-2 text-success">
                              <BadgeCheck size={14} />
                              Habilitado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 text-muted-foreground">
                              <XCircle size={14} />
                              Deshabilitado
                            </span>
                          )
                        }
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BadgeCheck size={18} />
                        Cluster
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <DetailRow
                        label="Asignación"
                        value={clusterLabel}
                        mono={typeof costCentre.cluster === "string"}
                      />
                    </CardContent>
                  </Card>

                  {/* Acumulado del Mes */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp size={18} />
                        Acumulado del Mes
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <DetailRow label="Periodo" value={accumulators?.period || "—"} />
                      <div className="border-t border-border pt-3 mt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">ENTRADAS</p>
                        <DetailRow label="Operaciones" value={accumulators?.in?.count ?? 0} />
                        <DetailRow
                          label="Monto acumulado"
                          value={accumulators?.in?.amount ? formatCurrency(accumulators.in.amount) : "$0.00"}
                        />
                      </div>
                      <div className="border-t border-border pt-3 mt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">SALIDAS</p>
                        <DetailRow label="Operaciones" value={accumulators?.out?.count ?? 0} />
                        <DetailRow
                          label="Monto acumulado"
                          value={accumulators?.out?.amount ? formatCurrency(accumulators.out.amount) : "$0.00"}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Comisionistas Asignados */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users size={18} />
                        Comisionistas ({costCentre.commissionAgentAssignments?.length || 0})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(!costCentre.commissionAgentAssignments || costCentre.commissionAgentAssignments.length === 0) ? (
                        <p className="text-sm text-muted-foreground">Sin comisionistas asignados</p>
                      ) : (
                        <div className="space-y-3">
                          {costCentre.commissionAgentAssignments.map((assignment) => (
                            <div key={assignment._id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-3">
                                <Badge variant={assignment.isEnabled ? "success" : "secondary"}>
                                  {assignment.isEnabled ? "Activo" : "Inactivo"}
                                </Badge>
                                <span className="text-sm font-medium">
                                  {assignment.userProfile?.fullName || assignment.userProfile?.email || "Comisionista"}
                                </span>
                              </div>
                              <span className="text-sm font-mono font-medium">
                                {assignment.transferInCommissionPercentage}%
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Cuotas Mensuales */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Receipt size={18} />
                        Cuotas Mensuales ({costCentre.monthlyCharges?.length || 0})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(!costCentre.monthlyCharges || costCentre.monthlyCharges.length === 0) ? (
                        <p className="text-sm text-muted-foreground">Sin cuotas registradas</p>
                      ) : (
                        <div className="space-y-2">
                          {costCentre.monthlyCharges.slice(0, 6).map((charge) => (
                            <div key={charge._id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                              <div>
                                <span className="text-sm font-medium">{charge.period}</span>
                                <span className="text-sm text-muted-foreground ml-2">
                                  {formatDate(charge.createdAt)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium">{formatMoney(charge.amount)}</span>
                                <Badge variant={charge.status === "paid" ? "success" : charge.status === "unpaid" ? "warning" : "secondary"}>
                                  {charge.status === "paid" ? "Pagada" : charge.status === "unpaid" ? "Pendiente" : charge.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Cuentas del CECO - Full width */}
                {costCentre.accounts && costCentre.accounts.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard size={18} />
                        Cuentas del CECO ({costCentre.accounts.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left text-muted-foreground font-medium text-xs uppercase p-3">Alias</th>
                              <th className="text-left text-muted-foreground font-medium text-xs uppercase p-3">Tipo</th>
                              <th className="text-left text-muted-foreground font-medium text-xs uppercase p-3">CLABE</th>
                              <th className="text-right text-muted-foreground font-medium text-xs uppercase p-3">Balance</th>
                              <th className="text-right text-muted-foreground font-medium text-xs uppercase p-3">Retenido</th>
                            </tr>
                          </thead>
                          <tbody>
                            {costCentre.accounts.map((account) => (
                              <tr key={account._id} className="border-b border-border/50 hover:bg-muted/30">
                                <td className="p-3 text-sm font-medium">{account.alias || "Sin alias"}</td>
                                <td className="p-3">
                                  <Badge variant="outline" className="text-xs">{account.tag || "—"}</Badge>
                                </td>
                                <td className="p-3 text-sm font-mono">{account.fullNumber ? truncateClabe(account.fullNumber) : "—"}</td>
                                <td className="p-3 text-sm text-right font-medium">{formatMoney(account.balance)}</td>
                                <td className="p-3 text-sm text-right text-muted-foreground">{formatMoney(account.balanceWithheld, "$0.00")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
