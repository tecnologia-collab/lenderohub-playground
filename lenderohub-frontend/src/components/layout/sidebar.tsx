"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth, UserProfileSummary } from "@/contexts/AuthContext";
import { normalizeUserProfileType, ROLE_LABELS } from "@/services/users.service";
import { toast } from "@/hooks/use-toast";
import {
  Home,
  LayoutGrid,
  Users,
  Building2,
  Send,
  Percent,
  FileBarChart,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Layers,
  ChevronUp,
  ChevronDown,
  User,
  Shield,
  Check,
  ArrowLeftRight,
} from "lucide-react";

// ============================================
// Profile type display helpers for sidebar
// ============================================
const SIDEBAR_PROFILE_CONFIG: Record<string, {
  label: string;
  icon: typeof Building2;
  color: string;
}> = {
  corporate: { label: "Corporativo", icon: Building2, color: "text-purple-500" },
  administrator: { label: "Administrador", icon: Users, color: "text-blue-500" },
  commissionAgent: { label: "Comisionista", icon: Percent, color: "text-amber-500" },
  subaccountManager: { label: "Subcuenta", icon: Wallet, color: "text-cyan-500" },
  subaccount: { label: "Subcuenta", icon: Wallet, color: "text-cyan-500" },
  system: { label: "Sistema", icon: Shield, color: "text-gray-500" },
};

function getSidebarProfileConfig(type: string) {
  return SIDEBAR_PROFILE_CONFIG[type] || {
    label: type,
    icon: User,
    color: "text-gray-500",
  };
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const menuItems = [
  { id: "inicio", href: "/", icon: Home, label: "Inicio" },
  { id: "hub", href: "/hub", icon: LayoutGrid, label: "HUB" },
  { id: "centros-costos", href: "/centros-costos", icon: Layers, label: "Centros de Costos", permissions: ["cost_centres:read"] },
  { id: "beneficiarios", href: "/beneficiarios", icon: Building2, label: "Beneficiarios", permissions: ["beneficiaries:read"] },
  { id: "dispersiones", href: "/dispersiones", icon: Send, label: "Dispersiones", permissions: ["transactions:read", "transactions:create"] },
  { id: "subcuentas", href: "/subcuentas", icon: Wallet, label: "Subcuentas", permissions: ["subaccounts:read"] },
  { id: "usuarios", href: "/usuarios", icon: Users, label: "Usuarios", permissions: ["users:read"] },
  { id: "comisiones", href: "/comisiones", icon: Percent, label: "Comisiones" },
  { id: "reportes", href: "/reportes", icon: FileBarChart, label: "Reportes", permissions: ["reports:view"] },
];

const costCentresChildren = [
  { id: "centros-costos-mi", href: "/centros-costos/mi", label: "Mi Centro de Costos" },
  { id: "centros-costos-lista", href: "/centros-costos", label: "Ver listado" },
  { id: "centros-costos-nuevo", href: "/centros-costos?new=true", label: "Agregar" },
];

// Configuración ahora está en el menú de usuario

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, hasPermission, logout, profiles, activeProfileId, switchProfile } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [costCentresOpen, setCostCentresOpen] = useState(false);
  const [switchingProfile, setSwitchingProfile] = useState(false);

  const hasMultipleProfiles = profiles.length > 1;

  const getRoleLabel = (role?: string) => {
    const normalizedRole = normalizeUserProfileType(role);
    return normalizedRole ? ROLE_LABELS[normalizedRole] : "Sin rol";
  };

  const visibleMenuItems = menuItems.filter((item) =>
    item.permissions ? hasPermission(item.permissions) : true
  );

  const handleLogout = async () => {
    await logout();
  };

  const handleSwitchProfile = async (profileId: string) => {
    if (profileId === activeProfileId || switchingProfile) return;
    setSwitchingProfile(true);
    try {
      await switchProfile(profileId);
      setUserMenuOpen(false);
      toast({
        title: "Perfil cambiado",
        description: `Ahora estas usando el perfil de ${getSidebarProfileConfig(
          profiles.find((p) => p.id === profileId)?.type || ""
        ).label}`,
      });
      router.push("/hub");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "No se pudo cambiar de perfil",
        variant: "destructive",
      });
    } finally {
      setSwitchingProfile(false);
    }
  };

  React.useEffect(() => {
    if (pathname.startsWith("/centros-costos")) {
      setCostCentresOpen(true);
    }
  }, [pathname]);


  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full z-50 flex flex-col transition-all duration-300",
        "bg-[#4F46E5] dark:bg-slate-900 border-r border-transparent dark:border-slate-800",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/10 dark:border-slate-800">
        <Link href="/" className="flex items-center gap-2">
          {/* Logo sin fondo */}
          <img 
            src="/logoGray.svg" 
            alt="Lendero" 
            className={cn(
              "brightness-0 invert object-contain",
              collapsed ? "h-8" : "h-9"
            )}
          />
          {/* Texto HUB al lado */}
          {!collapsed && (
            <span className="text-white text-2xl font-bold">
              HUB
            </span>
          )}
        </Link>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg bg-white/10 dark:bg-slate-800 text-white/70 hover:text-white hover:bg-white/20 dark:hover:bg-slate-700 transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleMenuItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname.startsWith(item.href));

          if (item.id === "centros-costos" && !collapsed) {
            return (
              <div key={item.id} className="space-y-1">
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                    isActive
                      ? "bg-white text-[#4F46E5] dark:text-slate-900"
                      : "text-white/70 hover:text-white hover:bg-white/10 dark:hover:bg-slate-800"
                  )}
                >
                  <Link href={item.href} className="flex items-center gap-3 flex-1">
                    <item.icon
                      size={20}
                      className={cn(
                        "flex-shrink-0 transition-colors",
                        isActive ? "text-[#4F46E5] dark:text-slate-900" : "group-hover:text-white"
                      )}
                    />
                    <span className="font-medium text-sm truncate">{item.label}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setCostCentresOpen(!costCentresOpen)}
                    className="text-white/70 hover:text-white"
                    aria-label="Toggle centros de costos"
                  >
                    {costCentresOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {costCentresOpen && (
                  <div className="ml-10 space-y-1">
                    {costCentresChildren.map((child) => {
                      const childActive = pathname === child.href;
                      return (
                        <Link
                          key={child.id}
                          href={child.href}
                          className={cn(
                            "block px-3 py-2 rounded-lg text-sm transition-colors",
                            childActive
                              ? "bg-white/90 text-[#4F46E5]"
                              : "text-white/60 hover:text-white hover:bg-white/10"
                          )}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                isActive
                  ? "bg-white text-[#4F46E5] dark:text-slate-900"
                  : "text-white/70 hover:text-white hover:bg-white/10 dark:hover:bg-slate-800"
              )}
            >
              <item.icon
                size={20}
                className={cn(
                  "flex-shrink-0 transition-colors",
                  isActive ? "text-[#4F46E5] dark:text-slate-900" : "group-hover:text-white"
                )}
              />
              {!collapsed && (
                <span className="font-medium text-sm truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section - User Menu */}
      <div className="p-3 border-t border-white/10 dark:border-slate-800 relative">
        {/* User Profile Button */}
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className={cn(
            "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200",
            "bg-white/5 hover:bg-white/10 dark:bg-slate-800 dark:hover:bg-slate-700",
            collapsed ? "justify-center" : ""
          )}
        >
          <Avatar className="h-9 w-9 flex-shrink-0">
            <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-cyan-400 text-slate-900 text-xs font-semibold">
              {(user?.firstName?.[0] || "U") + (user?.lastName?.[0] || "")}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-white text-sm font-medium truncate">
                  {user?.fullName || "Usuario"}
                </p>
                <p className="text-white/50 text-xs">{getRoleLabel(user?.profileType)}</p>
              </div>
              <ChevronUp 
                size={16} 
                className={cn(
                  "text-white/50 transition-transform",
                  userMenuOpen ? "" : "rotate-180"
                )} 
              />
            </>
          )}
        </button>

        {/* User Dropdown Menu */}
        {userMenuOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setUserMenuOpen(false)} 
            />
            
            {/* Menu */}
            <div className={cn(
              "absolute bottom-full mb-2 bg-background border border-border rounded-lg shadow-lg z-50",
              collapsed ? "left-3 w-56" : "left-3 right-3"
            )}>
              {/* User Info Header */}
              <div className="p-3 border-b border-border">
                <p className="text-sm font-medium text-foreground">{user?.fullName || "Usuario"}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded">
                  {getRoleLabel(user?.profileType)}
                </span>
              </div>

              {/* Profile Switcher (only when multiple profiles) */}
              {hasMultipleProfiles && (
                <div className="p-2 border-b border-border">
                  <p className="px-3 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <ArrowLeftRight size={12} />
                    Cambiar perfil
                  </p>
                  {profiles.map((profile) => {
                    const config = getSidebarProfileConfig(profile.type);
                    const ProfileIcon = config.icon;
                    const isActive = profile.id === activeProfileId;
                    return (
                      <button
                        key={profile.id}
                        onClick={() => handleSwitchProfile(profile.id)}
                        disabled={switchingProfile || isActive}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left",
                          isActive
                            ? "bg-primary/10 text-primary cursor-default"
                            : "hover:bg-accent text-foreground",
                          switchingProfile && !isActive ? "opacity-50" : ""
                        )}
                      >
                        <ProfileIcon size={16} className={config.color} />
                        <span className="text-sm flex-1">{config.label}</span>
                        {isActive && <Check size={14} className="text-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Menu Items */}
              <div className="p-2">
                <Link
                  href="/perfil"
                  onClick={() => setUserMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <User size={16} />
                  <span className="text-sm">Mi perfil</span>
                </Link>

                <Link
                  href="/configuracion"
                  onClick={() => setUserMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <Settings size={16} />
                  <span className="text-sm">Configuracion</span>
                </Link>

                <div className="my-2 border-t border-border" />

                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors text-left"
                >
                  <LogOut size={16} />
                  <span className="text-sm">Cerrar sesion</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

// Mobile Sidebar Overlay
export function MobileSidebar({ 
  open, 
  onClose 
}: { 
  open: boolean; 
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { hasPermission } = useAuth();
  const [costCentresOpen, setCostCentresOpen] = useState(false);
  const visibleMenuItems = menuItems.filter((item) =>
    item.permissions ? hasPermission(item.permissions) : true
  );

  React.useEffect(() => {
    if (pathname.startsWith("/centros-costos")) {
      setCostCentresOpen(true);
    }
  }, [pathname]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 z-50 bg-[#4F46E5] dark:bg-slate-900 border-r border-transparent dark:border-slate-800 lg:hidden animate-slide-in">
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10 dark:border-slate-800">
          <Link href="/" className="flex items-center gap-2" onClick={onClose}>
            {/* Logo sin fondo */}
            <img 
              src="/logoGray.svg" 
              alt="Lendero" 
              className="h-9 brightness-0 invert object-contain"
            />
            {/* Texto HUB al lado */}
            <span className="text-white text-2xl font-bold">
              HUB
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {visibleMenuItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

          if (item.id === "centros-costos") {
            return (
              <div key={item.id} className="space-y-1">
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                    isActive
                      ? "bg-white text-[#4F46E5] dark:text-slate-900"
                      : "text-white/70 hover:text-white hover:bg-white/10 dark:hover:bg-slate-800"
                  )}
                >
                  <Link href={item.href} onClick={onClose} className="flex-1 flex items-center gap-3">
                    <item.icon size={20} />
                    <span className="font-medium text-sm">{item.label}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setCostCentresOpen(!costCentresOpen)}
                    className="text-white/70 hover:text-white"
                    aria-label="Toggle centros de costos"
                  >
                    {costCentresOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {costCentresOpen && (
                  <div className="ml-10 space-y-1">
                    {costCentresChildren.map((child) => {
                      const childActive = pathname === child.href;
                      return (
                        <Link
                          key={child.id}
                          href={child.href}
                          onClick={onClose}
                          className={cn(
                            "block px-3 py-2 rounded-lg text-sm transition-colors",
                            childActive
                              ? "bg-white/90 text-[#4F46E5]"
                              : "text-white/60 hover:text-white hover:bg-white/10"
                          )}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
            
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-white text-[#4F46E5] dark:text-slate-900"
                    : "text-white/70 hover:text-white hover:bg-white/10 dark:hover:bg-slate-800"
                )}
              >
                <item.icon size={20} />
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
