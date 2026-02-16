"use client";

import React from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "./NotificationBell";
import {
  Search,
  Sun,
  Moon,
  Menu,
} from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
  sidebarCollapsed?: boolean;
}

export function Header({ title, subtitle, onMenuClick, sidebarCollapsed }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="h-full px-4 lg:px-6 flex items-center justify-between gap-4">
        {/* Left side - Menu button (mobile) + Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-accent lg:hidden"
          >
            <Menu size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground hidden sm:block">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right side - Search, Theme, Notifications, User */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Search - Hidden on mobile */}
          <div className="relative hidden md:block">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar transacciones, beneficiarios..."
              className={cn(
                "w-64 lg:w-80 bg-accent/50 border border-border rounded-xl",
                "pl-10 pr-4 py-2.5 text-sm",
                "placeholder-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50",
                "transition-all"
              )}
            />
          </div>

          {/* Search button - Mobile only */}
          <Button variant="ghost" size="icon" className="md:hidden">
            <Search size={20} />
          </Button>

          {/* Theme Toggle */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="relative"
            >
              <Sun size={20} className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon size={20} className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          )}

          {/* Notifications */}
          <NotificationBell />

          {/* Environment Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-warning/10 text-warning rounded-lg text-xs font-medium">
            <span className="w-2 h-2 bg-warning rounded-full animate-pulse" />
            Staging
          </div>
        </div>
      </div>
    </header>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        {description && (
          <p className="text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
