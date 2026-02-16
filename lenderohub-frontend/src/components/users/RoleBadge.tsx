"use client";

import { cn } from "@/lib/utils";
import {
  normalizeUserProfileType,
  ROLE_COLORS,
  ROLE_LABELS,
} from "@/services/users.service";

interface RoleBadgeProps {
  role?: string;
  className?: string;
}

const ROLE_FALLBACK =
  "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300";

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const normalizedRole = normalizeUserProfileType(role);
  const label = normalizedRole ? ROLE_LABELS[normalizedRole] : "Sin rol";
  const color = normalizedRole ? ROLE_COLORS[normalizedRole] : ROLE_FALLBACK;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold",
        color,
        className
      )}
    >
      {label}
    </span>
  );
}
