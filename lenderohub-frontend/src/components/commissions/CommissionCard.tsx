"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

interface CommissionCardProps {
  title: string;
  clabe?: string;
  balance?: number;
  onCollect?: () => void;
  onTransfer?: () => void;
  disabled?: boolean;
}

export function CommissionCard({
  title,
  clabe,
  balance,
  onCollect,
  onTransfer,
  disabled = false,
}: CommissionCardProps) {
  return (
    <Card hover className="h-full">
      <CardContent className="p-5 space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-base font-semibold text-foreground">
            {clabe || "Sin CLABE"}
          </p>
        </div>
        <div className="flex items-end justify-between gap-3">
          <p className="text-2xl font-bold text-foreground">
            {typeof balance === "number" ? formatCurrency(balance) : "MX$0.00"}
          </p>
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              className="gap-1"
              onClick={onCollect}
              disabled={disabled}
            >
              Cobrar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={onTransfer}
              disabled={disabled}
            >
              Transferir
              <ArrowUpRight size={14} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
