"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Wallet, Layers, ChevronRight, Copy, Check, Building2 } from "lucide-react";
import { useState } from "react";
import type { SubaccountCategory } from "@/types/api.types";

interface SubaccountCardProps {
  id: string;
  name: string;
  costCentreAlias?: string;
  clabeNumber?: string;
  balance: number;
  tag: string;
  category?: SubaccountCategory;
  hasVirtualBags?: boolean;
  virtualBagsCount?: number;
  onClick?: () => void;
}

export function SubaccountCard({
  name,
  costCentreAlias,
  clabeNumber,
  balance,
  tag,
  category = "client",
  hasVirtualBags,
  virtualBagsCount,
  onClick,
}: SubaccountCardProps) {
  const [copied, setCopied] = useState(false);
  const isConcentration = tag === "concentration";
  const isInternal = category === "internal";

  const handleCopyClabe = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clabeNumber) {
      navigator.clipboard.writeText(clabeNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Determine badge text and style
  const getBadgeInfo = () => {
    if (isInternal) {
      return { text: "Interna", variant: "outline" as const, className: "border-warning text-warning" };
    }
    if (isConcentration) {
      return { text: "Concentradora", variant: "default" as const, className: "" };
    }
    return { text: "Regular", variant: "secondary" as const, className: "" };
  };

  const badgeInfo = getBadgeInfo();

  // Icon style based on type
  const getIconStyle = () => {
    if (isInternal) {
      return "bg-warning/10 text-warning";
    }
    if (isConcentration) {
      return "bg-primary/10 text-primary";
    }
    return "bg-muted text-muted-foreground";
  };

  return (
    <Card
      hover
      className={`cursor-pointer transition-all hover:shadow-md ${isInternal ? "border-warning/30" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getIconStyle()}`}>
              {isInternal ? <Building2 size={20} /> : <Wallet size={20} />}
            </div>
            <div>
              <p className="font-semibold text-foreground">{name}</p>
              <p className="text-sm text-muted-foreground">
                {costCentreAlias || "Sin CECO"}
              </p>
            </div>
          </div>
          <Badge
            variant={badgeInfo.variant}
            className={`text-xs ${badgeInfo.className}`}
          >
            {badgeInfo.text}
          </Badge>
        </div>

        {clabeNumber && (
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded flex-1">
              {clabeNumber}
            </code>
            <button
              type="button"
              onClick={handleCopyClabe}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Copiar CLABE"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        )}

        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Balance</p>
            <p className="text-xl font-bold text-foreground">
              {formatCurrency(balance)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasVirtualBags && (
              <div className="flex items-center gap-1.5 text-success">
                <Layers size={14} />
                <span className="text-sm font-medium">
                  {virtualBagsCount ?? 0} bolsas
                </span>
              </div>
            )}
            <ChevronRight size={18} className="text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
