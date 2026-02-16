"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import type { CommissionCollectionItem } from "@/services/commissions.service";

interface CollectionTabProps {
  period: string;
  periodOptions: { value: string; label: string }[];
  onPeriodChange: (value: string) => void;
  onSearch: () => void;
  onDownload: () => void;
  items: CommissionCollectionItem[];
}

export function CollectionTab({
  period,
  periodOptions,
  onPeriodChange,
  onSearch,
  onDownload,
  items,
}: CollectionTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
          <p className="text-sm text-muted-foreground">Periodo</p>
          <Select value={period} onValueChange={onPeriodChange}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Selecciona un periodo" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button onClick={onSearch}>Buscar</Button>
          <Button variant="outline" onClick={onDownload}>
            Descargar
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ALIAS</TableHead>
              <TableHead className="text-right">SALDO PENDIENTE</TableHead>
              <TableHead className="text-right">SALDO CONCENTRADORA</TableHead>
              <TableHead>ESTADO</TableHead>
              <TableHead className="text-right">INTENTOS</TableHead>
              <TableHead>FECHA DEL ULTIMO INTENTO</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => {
              const date = parseDate(item.lastAttemptDate);
              return (
                <TableRow key={`${item.alias}-${index}`}>
                  <TableCell className="font-medium">{item.alias}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.pendingBalance)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.concentratorBalance)}</TableCell>
                  <TableCell className="text-muted-foreground">{item.status}</TableCell>
                  <TableCell className="text-right">{item.attempts}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p className="font-medium">{formatDate(date)}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(date)}</p>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No hay CECOs con cuotas impagas.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
