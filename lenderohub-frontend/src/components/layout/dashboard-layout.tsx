"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Sidebar, MobileSidebar } from "./sidebar";
import { Header } from "./header";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Mobile Sidebar */}
      <MobileSidebar
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Content */}
      <main
        className={cn(
          "min-h-screen transition-all duration-300",
          "lg:ml-64",
          sidebarCollapsed && "lg:ml-[72px]"
        )}
      >
        <Header
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setMobileMenuOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
        />

        <div className="p-4 lg:p-6">
          {children}
        </div>

        {/* Footer simple */}
        <footer className="border-t border-border py-4 px-4 lg:px-6">
          <p className="text-center text-muted-foreground text-sm">
            © 2026 Lendero Capital SAPI de CV. Todos los derechos reservados.
          </p>
        </footer>
      </main>
    </div>
  );
}