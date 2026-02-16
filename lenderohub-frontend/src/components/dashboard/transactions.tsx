"use client";

import React from "react";
import { cn, formatCurrency, formatRelativeTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";

// ============================================
// Transaction Types
// ============================================
export type TransactionType = "in" | "out" | "internal";
export type TransactionStatus = "completed" | "pending" | "processing" | "failed" | "cancelled";

export interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  amount: number;
  currency?: string;
  status: TransactionStatus;
  date: Date | string;
  beneficiary?: string;
  trackingKey?: string;
}

// ============================================
// Transaction Row Component
// ============================================
interface TransactionRowProps {
  transaction: Transaction;
  onClick?: (id: string) => void;
}

export function TransactionRow({ transaction, onClick }: TransactionRowProps) {
  const { type, description, amount, status, date, currency = "MXN" } = transaction;

  const statusConfig = {
    completed: { label: "Completada", variant: "success" as const },
    pending: { label: "Pendiente", variant: "warning" as const },
    processing: { label: "Procesando", variant: "processing" as const },
    failed: { label: "Fallida", variant: "destructive" as const },
    cancelled: { label: "Cancelada", variant: "secondary" as const },
  };

  const typeIcon = {
    in: { icon: ArrowDownLeft, bg: "bg-success/10", color: "text-success" },
    out: { icon: ArrowUpRight, bg: "bg-destructive/10", color: "text-destructive" },
    internal: { icon: ArrowUpRight, bg: "bg-primary/10", color: "text-primary" },
  };

  const Icon = typeIcon[type].icon;

  return (
    <div
      onClick={() => onClick?.(transaction.id)}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group"
    >
      {/* Icon */}
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", typeIcon[type].bg)}>
        <Icon size={18} className={typeIcon[type].color} />
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="text-foreground font-medium truncate group-hover:text-primary transition-colors">
          {description}
        </p>
        <p className="text-muted-foreground text-xs flex items-center gap-1">
          <Clock size={12} />
          {formatRelativeTime(date)}
        </p>
      </div>

      {/* Amount & Status */}
      <div className="text-right">
        <p className={cn(
          "font-semibold",
          type === "in" ? "text-success" : "text-foreground"
        )}>
          {type === "in" ? "+" : "-"}{formatCurrency(amount, currency)}
        </p>
        <Badge variant={statusConfig[status].variant} className="text-xs">
          {statusConfig[status].label}
        </Badge>
      </div>
    </div>
  );
}

// ============================================
// Recent Transactions Card
// ============================================
interface RecentTransactionsProps {
  transactions: Transaction[];
  onViewAll?: () => void;
  onTransactionClick?: (id: string) => void;
  title?: string;
  maxItems?: number;
}

export function RecentTransactions({
  transactions,
  onViewAll,
  onTransactionClick,
  title = "Transacciones Recientes",
  maxItems = 5,
}: RecentTransactionsProps) {
  const displayedTransactions = transactions.slice(0, maxItems);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <p className="text-muted-foreground text-sm mt-1">
            Últimos movimientos de tu cuenta
          </p>
        </div>
        {onViewAll && (
          <Button variant="ghost" size="sm" onClick={onViewAll} className="gap-1">
            Ver historial <ChevronRight size={16} />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-1">
        {displayedTransactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay transacciones recientes
          </div>
        ) : (
          displayedTransactions.map((tx) => (
            <TransactionRow
              key={tx.id}
              transaction={tx}
              onClick={onTransactionClick}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Transactions Table (Full)
// ============================================
interface TransactionsTableProps {
  transactions: Transaction[];
  onTransactionClick?: (id: string) => void;
}

export function TransactionsTable({ transactions, onTransactionClick }: TransactionsTableProps) {
  const statusConfig = {
    completed: { label: "Completada", variant: "success" as const },
    pending: { label: "Pendiente", variant: "warning" as const },
    processing: { label: "Procesando", variant: "processing" as const },
    failed: { label: "Fallida", variant: "destructive" as const },
    cancelled: { label: "Cancelada", variant: "secondary" as const },
  };

  const typeIcon = {
    in: { icon: ArrowDownLeft, bg: "bg-success/10", color: "text-success" },
    out: { icon: ArrowUpRight, bg: "bg-destructive/10", color: "text-destructive" },
    internal: { icon: ArrowUpRight, bg: "bg-primary/10", color: "text-primary" },
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-muted-foreground font-medium text-xs uppercase tracking-wider pb-4 pl-4">
              Tipo
            </th>
            <th className="text-left text-muted-foreground font-medium text-xs uppercase tracking-wider pb-4">
              Descripción
            </th>
            <th className="text-left text-muted-foreground font-medium text-xs uppercase tracking-wider pb-4">
              Estado
            </th>
            <th className="text-left text-muted-foreground font-medium text-xs uppercase tracking-wider pb-4">
              Fecha
            </th>
            <th className="text-right text-muted-foreground font-medium text-xs uppercase tracking-wider pb-4 pr-4">
              Monto
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const Icon = typeIcon[tx.type].icon;
            
            return (
              <tr
                key={tx.id}
                onClick={() => onTransactionClick?.(tx.id)}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer group"
              >
                <td className="py-4 pl-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    typeIcon[tx.type].bg
                  )}>
                    <Icon size={18} className={typeIcon[tx.type].color} />
                  </div>
                </td>
                <td className="py-4">
                  <p className="text-foreground font-medium group-hover:text-primary transition-colors">
                    {tx.description}
                  </p>
                  {tx.trackingKey && (
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {tx.trackingKey}
                    </p>
                  )}
                </td>
                <td className="py-4">
                  <Badge variant={statusConfig[tx.status].variant}>
                    {statusConfig[tx.status].label}
                  </Badge>
                </td>
                <td className="py-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock size={14} />
                    <span className="text-sm">{formatRelativeTime(tx.date)}</span>
                  </div>
                </td>
                <td className="py-4 pr-4 text-right">
                  <span className={cn(
                    "font-semibold",
                    tx.type === "in" ? "text-success" : "text-foreground"
                  )}>
                    {tx.type === "in" ? "+" : "-"}{formatCurrency(tx.amount, tx.currency || "MXN")}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
