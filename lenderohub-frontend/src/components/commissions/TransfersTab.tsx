"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { Search } from "lucide-react";
import type { CommissionTransfer } from "@/services/commissions.service";

interface TransfersTabProps {
  transfers: CommissionTransfer[];
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function TransfersTab({
  transfers,
  search,
  onSearchChange,
  onSearchSubmit,
  page,
  totalPages,
  onPageChange,
}: TransfersTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar por referencia, concepto o CECO..."
            className="pl-9"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSearchSubmit();
              }
            }}
          />
        </div>
        <Button variant="outline" onClick={onSearchSubmit}>
          Buscar
        </Button>
      </div>

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
                  No hay transferencias registradas.
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
