"use client";

import { usePathname } from "next/navigation";
import { DashboardLayout } from "@/components/layout";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

const AUTH_ROUTES = ["/login", "/setup-2fa", "/setup-password", "/reset-password"];

export default function Loading() {
  const pathname = usePathname();
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname?.startsWith(route));

  if (isAuthRoute) {
    return (
      <LoadingOverlay
        isLoading
        fullScreen
        message="Cargando información..."
        className="bg-background/70"
      />
    );
  }

  return (
    <DashboardLayout title="Cargando..." subtitle="Preparando la vista">
      <div className="relative min-h-[60vh]">
        <LoadingOverlay isLoading message="Cargando información..." className="bg-background/70" />
      </div>
    </DashboardLayout>
  );
}
