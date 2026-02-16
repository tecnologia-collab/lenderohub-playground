"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import type { CommissionTransfer } from "@/services/commissions.service";

interface MonthlyChargesTabProps {
  transfers: CommissionTransfer[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function MonthlyChargesTab({
  transfers,
  page,
  totalPages,
  onPageChange,
}: MonthlyChargesTabProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>FECHA</TableHead>
              <TableHead>DESDE</TableHead>
              <TableHead>REFERENCIA</TableHead>
              <TableHead>CONCEPTO</TableHead>
              <TableHead>CLAVE DE RASTREO</TableHead>
              <TableHead className="text-right">MONTO</TableHead>
              <TableHead>ESTADO</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.map((transfer, index) => {
              const date = parseDate(transfer.date);
              return (
                <TableRow key={`${transfer.reference}-${index}`}>
                  <TableCell>
                    <div className="text-sm">
                      <p className="font-medium">{formatDate(date)}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(date)}</p>
                    </div>
                  </TableCell>
                  <TableCell>{transfer.fromCostCentre}</TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-2 py-1 text-xs">{transfer.reference}</code>
                  </TableCell>
                  <TableCell>{transfer.concept}</TableCell>
                  <TableCell className="text-muted-foreground">{transfer.trackingCode}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(transfer.amount)}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{transfer.status}</span>
                  </TableCell>
                </TableRow>
              );
            })}
            {transfers.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No hay transferencias de cuotas disponibles.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Página {page} de {totalPages || 1}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}

function parseDate(value: string) {
  if (!value) return new Date();
  if (value.includes(" ") && !value.includes("T")) {
    return new Date(value.replace(" ", "T"));
  }
  return new Date(value);
}
