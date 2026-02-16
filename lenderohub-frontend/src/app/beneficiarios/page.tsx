"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout, PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getInitials, truncateClabe } from "@/lib/utils";
import {
  Plus,
  Search,
  Building2,
  User,
  Users,
  CreditCard,
  Copy,
  Send,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  X,
  Upload,
} from "lucide-react";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { AddBeneficiaryForm } from "@/components/beneficiaries/AddBeneficiaryForm";
import { MassImportDialog } from "@/components/beneficiaries/MassImportDialog";
import { ClustersSection } from "@/components/beneficiaries/ClustersSection";
import { beneficiariesService } from "@/services/beneficiaries.service";
import { useToast } from "@/hooks/use-toast";

interface Beneficiary {
  id: string;
  name: string;
  alias?: string;
  type?: "person" | "company";
  clabe: string;
  bank: string;
  rfc?: string;
  status: "ACTIVE" | "INACTIVE" | "validated" | "pending" | "failed";
  lastUsed?: Date;
  transferCount?: number;
  createdAt?: Date;
}

const statusConfig = {
  ACTIVE: { label: "Activo", variant: "success" as const, icon: CheckCircle2 },
  validated: { label: "Validado", variant: "success" as const, icon: CheckCircle2 },
  pending: { label: "Pendiente", variant: "warning" as const, icon: Clock },
  INACTIVE: { label: "Inactivo", variant: "secondary" as const, icon: AlertCircle },
  failed: { label: "Fallido", variant: "destructive" as const, icon: AlertCircle },
};

type Tab = "beneficiarios" | "grupos";

export default function BeneficiariosPage() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("beneficiarios");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "person" | "company">("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [isMassImportOpen, setIsMassImportOpen] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canCreate = hasPermission("beneficiaries:create");
  const canDelete = hasPermission("beneficiaries:delete");

  // Load beneficiaries on mount
  useEffect(() => {
    loadBeneficiaries();
  }, []);

  const loadBeneficiaries = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await beneficiariesService.getBeneficiaries();
      setBeneficiaries(data as any);
    } catch (err: any) {
      console.error('Error loading beneficiaries:', err);
      setError(err.message || 'Error al cargar beneficiarios');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSuccess = (beneficiary: any) => {
    toast({
      title: "Beneficiario creado",
      description: `Beneficiario "${beneficiary.alias}" creado exitosamente`,
      variant: "success",
    });
    setShowAddForm(false);
    loadBeneficiaries();
  };

  const handleAddError = (error: Error) => {
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive",
    });
  };

  const filteredBeneficiaries = beneficiaries.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.alias?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.clabe.includes(searchTerm);
    const matchesType = filterType === "all" || b.type === filterType;
    return matchesSearch && matchesType;
  });

  const stats = {
    total: beneficiaries.length,
    validated: beneficiaries.filter((b) => b.status === "ACTIVE" || b.status === "validated").length,
    pending: beneficiaries.filter((b) => b.status === "pending").length,
  };

  const copyClabe = (clabe: string) => {
    navigator.clipboard.writeText(clabe);
    toast({
      title: "CLABE copiada",
      description: clabe,
    });
  };

  return (
    <DashboardLayout title="Beneficiarios" subtitle="Gestion de cuentas destino">
      <div className="space-y-6">
        <PageHeader
          title="Beneficiarios"
          description="Administra las cuentas destino para tus transferencias"
          actions={
            canCreate && activeTab === "beneficiarios" && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setIsMassImportOpen(true)}
                >
                  <Upload size={16} />
                  Importar CSV
                </Button>
                <Button
                  className="gap-2"
                  onClick={() => setShowAddForm(!showAddForm)}
                >
                  {showAddForm ? (
                    <>
                      <X size={16} />
                      Cancelar
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Agregar Beneficiario
                    </>
                  )}
                </Button>
              </div>
            )
          }
        />

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab("beneficiarios")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === "beneficiarios"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            <Building2 size={16} />
            Beneficiarios
          </button>
          <button
            onClick={() => setActiveTab("grupos")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === "grupos"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            <Users size={16} />
            Grupos
          </button>
        </div>

        {/* Tab Content: Beneficiarios */}
        {activeTab === "beneficiarios" && (
          <>
            {/* Error Alert */}
            {error && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                <p className="flex-1 text-destructive">{error}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setError(null)}
                  className="text-destructive hover:text-destructive"
                >
                  <X size={16} />
                </Button>
              </div>
            )}

            {/* Add Beneficiary Form */}
            {showAddForm && (
              <AddBeneficiaryForm
                onSuccess={handleAddSuccess}
                onError={handleAddError}
                onCancel={() => setShowAddForm(false)}
              />
            )}

            {/* Content with Loading Overlay */}
            <div className="relative min-h-[300px]">
              <LoadingOverlay isLoading={loading} message="Cargando beneficiarios..." />

              <div className={loading ? 'opacity-50 pointer-events-none space-y-6' : 'space-y-6'}>
                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card hover>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Building2 className="text-primary" size={24} />
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">Total Beneficiarios</p>
                          <p className="text-3xl font-bold">{stats.total}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card hover>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                          <CheckCircle2 className="text-success" size={24} />
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">Activos</p>
                          <p className="text-3xl font-bold text-success">{stats.validated}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card hover>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                          <Clock className="text-warning" size={24} />
                        </div>
                        <div>
                          <p className="text-muted-foreground text-sm">Pendientes</p>
                          <p className="text-3xl font-bold text-warning">{stats.pending}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Filters */}
                {beneficiaries.length > 0 && (
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1 max-w-md">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre, alias o CLABE..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-muted/50 border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="flex gap-2">
                      {[
                        { value: "all", label: "Todos" },
                        { value: "person", label: "Personas" },
                        { value: "company", label: "Empresas" },
                      ].map((option) => (
                        <Button
                          key={option.value}
                          variant={filterType === option.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFilterType(option.value as typeof filterType)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Beneficiaries List */}
                {beneficiaries.length > 0 && (
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left text-muted-foreground font-medium text-xs uppercase tracking-wider p-4">
                                Beneficiario
                              </th>
                              <th className="text-left text-muted-foreground font-medium text-xs uppercase tracking-wider p-4">
                                CLABE
                              </th>
                              <th className="text-left text-muted-foreground font-medium text-xs uppercase tracking-wider p-4">
                                Banco
                              </th>
                              <th className="text-left text-muted-foreground font-medium text-xs uppercase tracking-wider p-4">
                                Estado
                              </th>
                              <th className="text-right text-muted-foreground font-medium text-xs uppercase tracking-wider p-4">
                                Acciones
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredBeneficiaries.map((beneficiary) => {
                              const status = beneficiary.status === 'ACTIVE' ? 'ACTIVE' : beneficiary.status;
                              const StatusIcon = statusConfig[status]?.icon || CheckCircle2;

                              return (
                                <tr
                                  key={beneficiary.id}
                                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                                >
                                  <td className="p-4">
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-10 w-10">
                                        <AvatarFallback className={cn(
                                          beneficiary.type === "company"
                                            ? "bg-violet-500/10 text-violet-500"
                                            : "bg-primary/10 text-primary"
                                        )}>
                                          {beneficiary.type === "company" ? (
                                            <Building2 size={18} />
                                          ) : (
                                            getInitials(beneficiary.name)
                                          )}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <p className="font-medium text-foreground">
                                          {beneficiary.alias || beneficiary.name}
                                        </p>
                                        {beneficiary.alias && (
                                          <p className="text-muted-foreground text-sm">{beneficiary.name}</p>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <div className="flex items-center gap-2">
                                      <code className="text-sm font-mono">
                                        {truncateClabe(beneficiary.clabe)}
                                      </code>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => copyClabe(beneficiary.clabe)}
                                      >
                                        <Copy size={12} />
                                      </Button>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <span className="text-foreground">{beneficiary.bank}</span>
                                  </td>
                                  <td className="p-4">
                                    <Badge variant={statusConfig[status]?.variant || 'success'} className="gap-1">
                                      <StatusIcon size={12} />
                                      {statusConfig[status]?.label || 'Activo'}
                                    </Badge>
                                  </td>
                                  <td className="p-4">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        disabled={beneficiary.status !== "ACTIVE" && beneficiary.status !== "validated"}
                                        onClick={() => window.location.href = '/dispersiones'}
                                      >
                                        <Send size={14} />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <Edit size={14} />
                                      </Button>
                                      {canDelete && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-destructive hover:text-destructive"
                                        >
                                          <Trash2 size={14} />
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Empty State */}
                {beneficiaries.length === 0 && !showAddForm && (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-lg font-medium text-foreground mb-2">
                        No hay beneficiarios registrados
                      </p>
                      <p className="text-muted-foreground mb-6">
                        {canCreate
                          ? "Agrega tu primer beneficiario para comenzar a enviar transferencias"
                          : "No hay beneficiarios disponibles"}
                      </p>
                      {canCreate && (
                        <Button onClick={() => setShowAddForm(true)} className="gap-2">
                          <Plus size={16} />
                          Agregar Beneficiario
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </>
        )}

        {/* Tab Content: Grupos */}
        {activeTab === "grupos" && <ClustersSection />}
      </div>

      {/* Mass Import Dialog */}
      <MassImportDialog
        open={isMassImportOpen}
        onOpenChange={setIsMassImportOpen}
        onComplete={loadBeneficiaries}
      />
    </DashboardLayout>
  );
}
