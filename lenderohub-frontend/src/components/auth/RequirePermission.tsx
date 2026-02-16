"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface RequirePermissionProps {
  children: React.ReactNode;
  permission?: string | string[];
  allowedRoles?: string[];
  fallbackUrl?: string;
}

export function RequirePermission({
  children,
  permission,
  allowedRoles,
  fallbackUrl = "/",
}: RequirePermissionProps) {
  const { user, hasPermission, loading } = useAuth();
  const router = useRouter();

  const hasAccess = (() => {
    if (!user) return false;
    if (allowedRoles && !allowedRoles.includes(user.profileType)) return false;
    if (permission && !hasPermission(permission)) return false;
    return true;
  })();

  useEffect(() => {
    if (!loading && !hasAccess) {
      router.replace(fallbackUrl);
    }
  }, [loading, hasAccess, router, fallbackUrl]);

  if (loading) return null;
  if (!hasAccess) return null;

  return <>{children}</>;
}
