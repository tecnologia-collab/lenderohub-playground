"use client";

import React from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { ChevronRight, Star } from "lucide-react";
import type { CommissionCostCentre } from "@/services/commissions.service";

interface CostCentresTabProps {
  costCentres: CommissionCostCentre[];
}

export function CostCentresTab({ costCentres }: CostCentresTabProps) {
  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ALIAS</TableHead>
            <TableHead>CODIGO</TableHead>
            <TableHead>NOMBRE/RAZON SOCIAL</TableHead>
            <TableHead className="text-right">SPEI IN COMISION CECO</TableHead>
            <TableHead className="text-right">SPEI IN PAGO COMISIONISTA</TableHead>
            <TableHead className="text-right">SPEI OUT PAGOS</TableHead>
            <TableHead className="text-right">SPEI OUT GANANCIA</TableHead>
            <TableHead className="text-right">CUOTAS MENSUALES</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {costCentres.map((centre) => (
            <TableRow key={`${centre.code}-${centre.alias}`}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {centre.isFavorite && (
                    <Star className="h-4 w-4 text-warning fill-warning" />
                  )}
                  {centre.isFeatured && (
                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                      Destacado
                    </Badge>
                  )}
                  <span>{centre.alias}</span>
                </div>
              </TableCell>
              <TableCell>
                <code className="rounded bg-muted px-2 py-1 text-xs">{centre.code}</code>
              </TableCell>
              <TableCell className="text-muted-foreground">{centre.name}</TableCell>
              <TableCell className="text-right">
                <CostCentreAmount value={centre.transferIn} id={centre.id} />
              </TableCell>
              <TableCell className="text-right">
                <CostCentreAmount value={centre.transferInCommissionAgentPayment} id={centre.id} />
              </TableCell>
              <TableCell className="text-right">
                <CostCentreAmount value={centre.transferOut} id={centre.id} />
              </TableCell>
              <TableCell className="text-right">
                <CostCentreAmount value={centre.transferOutEarnings} id={centre.id} />
              </TableCell>
              <TableCell className="text-right">
                <CostCentreAmount value={centre.monthlyCharges} id={centre.id} />
              </TableCell>
            </TableRow>
          ))}
          {costCentres.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                No hay centros de costos disponibles.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function CostCentreAmount({ value, id }: { value: number; id?: string }) {
  const content = (
    <div className="flex items-center justify-end gap-2">
      <span>{formatCurrency(value || 0)}</span>
      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!id}>
        <ChevronRight size={14} />
      </Button>
    </div>
  );

  if (!id) {
    return content;
  }

  return (
    <Link href={`/centros-costos/${id}`} className="flex items-center justify-end gap-2">
      <span>{formatCurrency(value || 0)}</span>
      <ChevronRight size={14} className="text-muted-foreground" />
    </Link>
  );
}
