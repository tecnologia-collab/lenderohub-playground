"use client";

import React, { useState } from "react";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  LucideIcon,
  ChevronDown,
  Check,
} from "lucide-react";

// ============================================
// Provider Types
// ============================================
export type Provider = "total" | "finco";
export const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "total", label: "Total" },
  { value: "finco", label: "Finco" },
];

// ============================================
// Balance Card - Main balance display
// ============================================
interface BalanceCardProps {
  balance: number;
  currency?: string;
  trend?: number;
  label?: string;
  showProviderSelector?: boolean;
  selectedProvider?: Provider;
  onProviderChange?: (provider: Provider) => void;
}

export function BalanceCard({ 
  balance, 
  currency = "MXN", 
  trend,
  label = "Balance Total",
  showProviderSelector = false,
  selectedProvider = "total",
  onProviderChange,
}: BalanceCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isPositive = trend && trend > 0;

  const handleProviderSelect = (provider: Provider) => {
    onProviderChange?.(provider);
    setMenuOpen(false);
  };

  return (
    <Card className="relative" hover>
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-cyan-500/10 rounded-lg overflow-hidden" />
      
      <CardContent className="relative p-6">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Wallet size={18} />
          <span className="text-sm font-medium">{label}</span>
          
          {/* Provider Selector */}
          {showProviderSelector && (
            <div className="relative ml-auto">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-muted hover:bg-muted/80 text-foreground rounded-md transition-colors border border-border"
              >
                {PROVIDERS.find(p => p.value === selectedProvider)?.label}
                <ChevronDown size={14} className={cn("transition-transform text-muted-foreground", menuOpen && "rotate-180")} />
              </button>
              
              {menuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setMenuOpen(false)} 
                  />
                  <div className="absolute right-0 mt-1 w-28 bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
                    {PROVIDERS.map((provider) => (
                      <button
                        key={provider.value}
                        onClick={() => handleProviderSelect(provider.value)}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                      >
                        {provider.label}
                        {selectedProvider === provider.value && (
                          <Check size={14} className="text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            {formatCurrency(balance, currency)}
          </span>
        </div>

        {trend !== undefined && (
          <div className="flex items-center gap-2">
            <Badge variant={isPositive ? "success" : "destructive"}>
              {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span className="ml-1">{isPositive ? "+" : ""}{trend}%</span>
            </Badge>
            <span className="text-muted-foreground text-sm">vs. periodo anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Stat Card - Generic stat display
// ============================================
interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: number;
  variant?: "default" | "income" | "expense" | "info";
  format?: "currency" | "number" | "none";
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  variant = "default",
  format = "none",
}: StatCardProps) {
  const variantStyles = {
    default: "text-foreground",
    income: "text-success",
    expense: "text-destructive",
    info: "text-primary",
  };

  const iconBgStyles = {
    default: "bg-muted",
    income: "bg-success/10",
    expense: "bg-destructive/10",
    info: "bg-primary/10",
  };

  const iconStyles = {
    default: "text-muted-foreground",
    income: "text-success",
    expense: "text-destructive",
    info: "text-primary",
  };

  const displayValue = 
    format === "currency" ? formatCurrency(Number(value)) :
    format === "number" ? formatNumber(Number(value)) :
    value;

  return (
    <Card hover>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          {Icon && (
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", iconBgStyles[variant])}>
              <Icon size={24} className={iconStyles[variant]} />
            </div>
          )}
          {trend !== undefined && (
            <Badge variant={trend > 0 ? "success" : trend < 0 ? "destructive" : "secondary"}>
              {trend > 0 ? "+" : ""}{trend}%
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm mb-1">{title}</p>
        <p className={cn("text-2xl font-bold", variantStyles[variant])}>{displayValue}</p>
      </CardContent>
    </Card>
  );
}

// ============================================
// Metric Card - Simple metric display (like in the image)
// ============================================
interface MetricCardProps {
  value: string | number;
  label: string;
  variant?: "default" | "success" | "primary" | "warning";
  format?: "currency" | "number" | "none";
}

export function MetricCard({ 
  value, 
  label, 
  variant = "default",
  format = "none" 
}: MetricCardProps) {
  const variantStyles = {
    default: "text-foreground",
    success: "text-success",
    primary: "text-primary",
    warning: "text-warning",
  };

  const displayValue = 
    format === "currency" ? formatCurrency(Number(value)) :
    format === "number" ? formatNumber(Number(value)) :
    value;

  return (
    <Card hover>
      <CardContent className="p-6 text-center">
        <p className={cn("text-3xl lg:text-4xl font-bold mb-2", variantStyles[variant])}>
          {displayValue}
        </p>
        <p className="text-muted-foreground text-sm uppercase tracking-wide">{label}</p>
      </CardContent>
    </Card>
  );
}

// ============================================
// Operations Summary Card
// ============================================
interface OperationItem {
  label: string;
  count: number;
  variant: "success" | "warning" | "destructive" | "default" | "pending";
}

interface OperationsSummaryProps {
  title: string;
  items: OperationItem[];
}

export function OperationsSummary({ title, items }: OperationsSummaryProps) {
  const variantStyles = {
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    default: "text-foreground",
    pending: "text-blue-500",
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <span className="text-muted-foreground">{item.label}</span>
            <span className={cn("font-semibold text-lg", variantStyles[item.variant])}>
              {item.count}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================
// Quick Actions
// ============================================
interface QuickAction {
  icon: LucideIcon;
  label: string;
  href: string;
  color: string;
}

interface QuickActionsProps {
  actions: QuickAction[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {actions.map((action, index) => (
        <a
          key={index}
          href={action.href}
          className="group bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5 active:scale-[0.98]"
        >
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center mb-3",
            "bg-gradient-to-br shadow-lg group-hover:scale-110 transition-transform",
            action.color
          )}>
            <action.icon size={22} className="text-white" />
          </div>
          <p className="text-foreground font-medium text-sm">{action.label}</p>
        </a>
      ))}
    </div>
  );
}
