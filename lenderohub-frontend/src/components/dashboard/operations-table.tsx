"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ArrowRight } from "lucide-react";

// ============================================
// Monthly Operations Table (by country)
// ============================================
interface CountryOperation {
  country: string;
  sent: number;
  received: number;
  inProcess: number;
  validated: string; // e.g., "5/40"
}

interface MonthlyOperationsTableProps {
  data: CountryOperation[];
  onViewAll?: () => void;
}

export function MonthlyOperationsTable({ data, onViewAll }: MonthlyOperationsTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg">Operaciones Mensuales</CardTitle>
        {onViewAll && (
          <Button variant="ghost" size="sm" onClick={onViewAll} className="gap-1">
            VIEW ALL <ArrowRight size={16} />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted-foreground font-medium text-xs uppercase tracking-wider pb-3">
                  País
                </th>
                <th className="text-center text-muted-foreground font-medium text-xs uppercase tracking-wider pb-3">
                  #Enviadas
                </th>
                <th className="text-center text-muted-foreground font-medium text-xs uppercase tracking-wider pb-3">
                  #Recibidas
                </th>
                <th className="text-center text-muted-foreground font-medium text-xs uppercase tracking-wider pb-3">
                  En Proceso
                </th>
                <th className="text-center text-muted-foreground font-medium text-xs uppercase tracking-wider pb-3">
                  Validadas
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr 
                  key={index} 
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-4">
                    <span className="font-medium text-foreground">{row.country}</span>
                  </td>
                  <td className="py-4 text-center">
                    <span className="text-primary font-semibold">{row.sent}</span>
                  </td>
                  <td className="py-4 text-center">
                    <span className="text-foreground">{row.received}</span>
                  </td>
                  <td className="py-4 text-center">
                    <span className="text-warning font-semibold">{row.inProcess}</span>
                  </td>
                  <td className="py-4 text-center">
                    <span className="text-success font-semibold">{row.validated}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// National Operations Metrics
// ============================================
interface NationalMetric {
  value: string | number;
  label: string;
  variant?: "default" | "success" | "primary" | "warning";
}

interface NationalOperationsProps {
  title?: string;
  metrics: NationalMetric[];
}

export function NationalOperations({ 
  title = "Operaciones Nacionales Mensuales", 
  metrics 
}: NationalOperationsProps) {
  const variantStyles = {
    default: "text-foreground",
    success: "text-success",
    primary: "text-primary",
    warning: "text-warning",
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {metrics.map((metric, index) => (
            <div 
              key={index} 
              className="text-center p-4 rounded-xl bg-muted/30 border border-border/50"
            >
              <p className={cn(
                "text-2xl lg:text-3xl font-bold mb-1",
                variantStyles[metric.variant || "default"]
              )}>
                {metric.value}
              </p>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                {metric.label}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Subaccounts List
// ============================================
interface Subaccount {
  id: string;
  name: string;
  balance: number;
  color: string;
}

interface SubaccountsListProps {
  subaccounts: Subaccount[];
  onViewAll?: () => void;
  onSelect?: (id: string) => void;
}

export function SubaccountsList({ subaccounts, onViewAll, onSelect }: SubaccountsListProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg">Subcuentas</CardTitle>
        {onViewAll && (
          <Button variant="ghost" size="sm" onClick={onViewAll} className="gap-1 text-primary">
            Ver todas <ChevronRight size={16} />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {subaccounts.map((account) => (
          <button
            key={account.id}
            onClick={() => onSelect?.(account.id)}
            className="w-full group p-3 bg-muted/30 rounded-xl border border-border/50 hover:border-primary/30 transition-all flex items-center gap-3"
          >
            <div 
              className="w-1.5 h-10 rounded-full flex-shrink-0"
              style={{ backgroundColor: account.color }}
            />
            <div className="flex-1 text-left">
              <p className="text-foreground font-medium">{account.name}</p>
              <p className="text-muted-foreground text-sm">
                ${account.balance.toLocaleString("es-MX")} MXN
              </p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
