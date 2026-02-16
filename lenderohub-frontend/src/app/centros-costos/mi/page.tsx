"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardLayout, PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Building2, Copy, FileText, Info, MapPin, Phone, ShieldCheck, User } from "lucide-react";
import { costCentresService, CostCentre, CommercialRule, MoneyValue } from "@/services/costCentres.service";
import { cn, formatCurrency, formatDate, truncateClabe } from "@/lib/utils";

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

export default function MiCentroCostosPage() {
  const [costCentre, setCostCentre] = useState<CostCentre | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCostCentre = async () => {
      try {
        setLoading(true);
        setError(null);
        const centres = await costCentresService.getCostCentres();
        const selected = centres.find((cc) => cc.default) || centres[0];
        if (!selected) {
          setError("No hay centro de costos disponible.");
          return;
        }
        const detail = await costCentresService.getCostCentre(selected.id);
        setCostCentre(detail);
      } catch (err: any) {
        console.error("Error loading my cost centre:", err);
        setError(err?.message || "No se pudo cargar el centro de costos.");
      } finally {
        setLoading(false);
      }
    };

    loadCostCentre();
  }, []);

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

  const handleCopyClabe = () => {
    if (!costCentre?.fincoClabeNumber) return;
    navigator.clipboard.writeText(costCentre.fincoClabeNumber);
  };

  return (
    <DashboardLayout title="Mi Centro de Costos" subtitle="Información general del CECO">
      <div className="space-y-6">
        <PageHeader
          title={costCentre?.alias || "Mi Centro de Costos"}
          description={costCentre?.code ? `Código ${costCentre.code}` : undefined}
          actions={
            costCentre ? (
              <Button variant="outline" asChild>
                <Link href={`/centros-costos/${costCentre.id}`}>Ver detalle completo</Link>
              </Button>
            ) : undefined
          }
        />

        {error && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
            <p className="flex-1 text-destructive">{error}</p>
          </div>
        )}

        <div className={cn("grid grid-cols-1 xl:grid-cols-3 gap-6", loading && "opacity-60")}>
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info size={18} />
                Información General
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow label="Nombre / Razón social" value={costCentre?.alias || "—"} />
              <DetailRow label="Nombre corto" value={costCentre?.shortName || "—"} mono />
              <DetailRow label="Código" value={costCentre?.code || "—"} mono />
              <DetailRow
                label="CLABE concentradora"
                value={
                  costCentre?.fincoClabeNumber ? (
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
              <DetailRow label="Creado" value={costCentre?.createdAt ? formatDate(costCentre.createdAt) : "—"} />
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
              <DetailRow label="Correo" value={costCentre?.contact?.email || "Sin correo"} />
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
                <ShieldCheck size={18} />
                Condiciones Comerciales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow label="SPEI IN" value={formatRule(costCentre?.commercialRules?.in)} />
              <DetailRow label="SPEI OUT" value={formatRule(costCentre?.commercialRules?.out)} />
              <DetailRow label="Cuota mensual" value={formatRule(costCentre?.commercialRules?.monthlyFee)} />
              <DetailRow label="Saldo mínimo" value={formatMoney(costCentre?.commercialRules?.minimumBalanceNewAccounts)} />
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
              <DetailRow label="RFC" value={costCentre?.rfc || "Sin RFC"} mono />
              <DetailRow
                label="Dirección"
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

          <Card className="xl:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck size={18} />
                Perfil Transaccional
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DetailRow label="Límite mensual de cobro" value={formatMoney(costCentre?.transactionProfile?.limitIn)} />
              <DetailRow label="Operaciones mensuales de cobro" value={costCentre?.transactionProfile?.opsIn ?? "No definido"} />
              <DetailRow label="Límite mensual de pago" value={formatMoney(costCentre?.transactionProfile?.limitOut)} />
              <DetailRow label="Operaciones mensuales de pago" value={costCentre?.transactionProfile?.opsOut ?? "No definido"} />
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
