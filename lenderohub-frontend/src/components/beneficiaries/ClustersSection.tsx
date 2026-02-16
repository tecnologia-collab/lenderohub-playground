'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
  X,
  Loader2,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  beneficiaryClustersService,
  CLUSTER_PRESET_COLORS,
  type BeneficiaryCluster,
  type CreateClusterRequest,
} from '@/services/beneficiaryClusters.service';
import { beneficiariesService } from '@/services/beneficiaries.service';
import type { Beneficiary } from '@/types/api.types';
import { LoadingOverlay } from '@/components/ui/loading-overlay';

// ============================================
// Types
// ============================================

interface ClustersSectionProps {
  costCentreId?: string;
}

type DialogMode = 'create' | 'edit' | 'addBeneficiaries' | null;

// ============================================
// Cluster Form Dialog
// ============================================

interface ClusterFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  cluster?: BeneficiaryCluster | null;
  beneficiaries: Beneficiary[];
  onClose: () => void;
  onSubmit: (data: CreateClusterRequest & { id?: string }) => Promise<void>;
  submitting: boolean;
}

function ClusterFormDialog({
  open,
  mode,
  cluster,
  beneficiaries,
  onClose,
  onSubmit,
  submitting,
}: ClusterFormDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(CLUSTER_PRESET_COLORS[0].hex);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && cluster) {
        setName(cluster.name);
        setDescription(cluster.description || '');
        setColor(cluster.color || CLUSTER_PRESET_COLORS[0].hex);
        setSelectedIds(new Set(cluster.beneficiaries));
      } else {
        setName('');
        setDescription('');
        setColor(CLUSTER_PRESET_COLORS[0].hex);
        setSelectedIds(new Set());
      }
      setSearchTerm('');
    }
  }, [open, mode, cluster]);

  const filteredBeneficiaries = beneficiaries.filter((b) => {
    const term = searchTerm.toLowerCase();
    return (
      b.name?.toLowerCase().includes(term) ||
      b.alias?.toLowerCase().includes(term) ||
      b.clabe?.includes(searchTerm)
    );
  });

  const toggleBeneficiary = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    await onSubmit({
      id: mode === 'edit' ? cluster?._id : undefined,
      name,
      description: description || undefined,
      costCentreId: cluster?.costCentreId || 'default',
      beneficiaryIds: Array.from(selectedIds),
      color,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Nuevo Grupo' : 'Editar Grupo'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Crea un grupo para organizar tus beneficiarios'
              : 'Modifica los datos del grupo'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Nombre *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Proveedores CDMX"
              maxLength={100}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Descripcion
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripcion breve (opcional)"
              maxLength={500}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {CLUSTER_PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.name}
                  onClick={() => setColor(c.hex)}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    color === c.hex
                      ? 'border-foreground scale-110'
                      : 'border-transparent hover:border-muted-foreground/50'
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* Beneficiary selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Beneficiarios ({selectedIds.size} seleccionados)
            </label>

            {/* Search */}
            <div className="relative mb-2">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Buscar beneficiarios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* List */}
            <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {filteredBeneficiaries.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3 text-center">
                  No se encontraron beneficiarios
                </p>
              ) : (
                filteredBeneficiaries.map((b) => {
                  const instrumentId = b.instrumentId || b.id;
                  const isSelected = selectedIds.has(instrumentId);
                  return (
                    <button
                      key={instrumentId}
                      type="button"
                      onClick={() => toggleBeneficiary(instrumentId)}
                      className={cn(
                        'w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted/50 transition-colors',
                        isSelected && 'bg-primary/5'
                      )}
                    >
                      <div
                        className={cn(
                          'w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center',
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-border'
                        )}
                      >
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path
                              d="M2 5L4 7L8 3"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {b.alias || b.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {b.clabe}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !name.trim()}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Crear Grupo' : 'Guardar Cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Add Beneficiaries Dialog
// ============================================

interface AddBeneficiariesDialogProps {
  open: boolean;
  cluster: BeneficiaryCluster | null;
  beneficiaries: Beneficiary[];
  onClose: () => void;
  onSubmit: (clusterId: string, beneficiaryIds: string[]) => Promise<void>;
  submitting: boolean;
}

function AddBeneficiariesDialog({
  open,
  cluster,
  beneficiaries,
  onClose,
  onSubmit,
  submitting,
}: AddBeneficiariesDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
      setSearchTerm('');
    }
  }, [open]);

  // Only show beneficiaries NOT already in the cluster
  const existingIds = new Set(cluster?.beneficiaries || []);
  const available = beneficiaries.filter((b) => {
    const instrumentId = b.instrumentId || b.id;
    return !existingIds.has(instrumentId);
  });

  const filtered = available.filter((b) => {
    const term = searchTerm.toLowerCase();
    return (
      b.name?.toLowerCase().includes(term) ||
      b.alias?.toLowerCase().includes(term) ||
      b.clabe?.includes(searchTerm)
    );
  });

  const toggleBeneficiary = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (cluster) {
      await onSubmit(cluster._id, Array.from(selectedIds));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Agregar Beneficiarios</DialogTitle>
          <DialogDescription>
            Selecciona beneficiarios para agregar a &ldquo;{cluster?.name}&rdquo;
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Buscar beneficiarios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="max-h-64 overflow-y-auto border border-border rounded-lg divide-y divide-border">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3 text-center">
                {available.length === 0
                  ? 'Todos los beneficiarios ya estan en este grupo'
                  : 'No se encontraron beneficiarios'}
              </p>
            ) : (
              filtered.map((b) => {
                const instrumentId = b.instrumentId || b.id;
                const isSelected = selectedIds.has(instrumentId);
                return (
                  <button
                    key={instrumentId}
                    type="button"
                    onClick={() => toggleBeneficiary(instrumentId)}
                    className={cn(
                      'w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted/50 transition-colors',
                      isSelected && 'bg-primary/5'
                    )}
                  >
                    <div
                      className={cn(
                        'w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center',
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-border'
                      )}
                    >
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path
                            d="M2 5L4 7L8 3"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {b.alias || b.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {b.clabe}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || selectedIds.size === 0}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agregar {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Cluster Card
// ============================================

interface ClusterCardProps {
  cluster: BeneficiaryCluster;
  beneficiaries: Beneficiary[];
  canEdit: boolean;
  onEdit: (cluster: BeneficiaryCluster) => void;
  onDelete: (cluster: BeneficiaryCluster) => void;
  onAddBeneficiaries: (cluster: BeneficiaryCluster) => void;
  onRemoveBeneficiary: (clusterId: string, beneficiaryId: string) => void;
}

function ClusterCard({
  cluster,
  beneficiaries,
  canEdit,
  onEdit,
  onDelete,
  onAddBeneficiaries,
  onRemoveBeneficiary,
}: ClusterCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Map instrument IDs to beneficiary data
  const clusterBeneficiaries = cluster.beneficiaries
    .map((instrumentId) => {
      const found = beneficiaries.find(
        (b) => (b.instrumentId || b.id) === instrumentId
      );
      return found
        ? { ...found, instrumentId: instrumentId }
        : { id: instrumentId, instrumentId, name: instrumentId, alias: '', clabe: '', bank: '' };
    });

  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-3">
          {/* Color indicator */}
          <div
            className="w-3 h-10 rounded-full flex-shrink-0"
            style={{ backgroundColor: cluster.color || '#3B82F6' }}
          />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-foreground truncate">
                {cluster.name}
              </h3>
              <Badge variant="secondary" className="gap-1 flex-shrink-0">
                <Users size={12} />
                {cluster.beneficiaries.length}
              </Badge>
            </div>
            {cluster.description && (
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {cluster.description}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {canEdit && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Editar grupo"
                  onClick={() => onEdit(cluster)}
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  title="Eliminar grupo"
                  onClick={() => onDelete(cluster)}
                >
                  <Trash2 size={14} />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={expanded ? 'Colapsar' : 'Expandir'}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded beneficiary list */}
      {expanded && (
        <div className="border-t border-border bg-muted/20">
          {clusterBeneficiaries.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Este grupo no tiene beneficiarios
            </div>
          ) : (
            <div className="divide-y divide-border">
              {clusterBeneficiaries.map((b) => (
                <div
                  key={b.instrumentId}
                  className="px-4 py-2 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {b.alias || b.name}
                    </p>
                    {b.clabe && (
                      <p className="text-xs text-muted-foreground font-mono">
                        {b.clabe}
                      </p>
                    )}
                  </div>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                      title="Remover del grupo"
                      onClick={() =>
                        onRemoveBeneficiary(cluster._id, b.instrumentId!)
                      }
                    >
                      <UserMinus size={14} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {canEdit && (
            <div className="p-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-1 text-primary"
                onClick={() => onAddBeneficiaries(cluster)}
              >
                <UserPlus size={14} />
                Agregar beneficiarios
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ============================================
// Main Component: ClustersSection
// ============================================

export function ClustersSection({ costCentreId }: ClustersSectionProps) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();

  const canCreate = hasPermission('beneficiaries:create');

  const [clusters, setClusters] = useState<BeneficiaryCluster[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog state
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedCluster, setSelectedCluster] =
    useState<BeneficiaryCluster | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Confirmation delete state
  const [deleteConfirm, setDeleteConfirm] = useState<BeneficiaryCluster | null>(
    null
  );

  const effectiveCostCentreId = costCentreId || 'default';

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [clustersData, beneficiariesData] = await Promise.all([
        beneficiaryClustersService.getAll(effectiveCostCentreId),
        beneficiariesService.getBeneficiaries(),
      ]);
      setClusters(clustersData);
      setBeneficiaries(beneficiariesData as any);
    } catch (err: any) {
      console.error('Error loading clusters data:', err);
      toast({
        title: 'Error',
        description: err.message || 'Error al cargar grupos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [effectiveCostCentreId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter clusters by search
  const filteredClusters = clusters.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.description?.toLowerCase().includes(term)
    );
  });

  // Handlers
  const handleCreateOrEdit = async (
    data: CreateClusterRequest & { id?: string }
  ) => {
    try {
      setSubmitting(true);
      if (data.id) {
        await beneficiaryClustersService.update(data.id, {
          name: data.name,
          description: data.description,
          beneficiaryIds: data.beneficiaryIds,
          color: data.color,
        });
        toast({
          title: 'Grupo actualizado',
          description: `El grupo "${data.name}" ha sido actualizado`,
          variant: 'success',
        });
      } else {
        await beneficiaryClustersService.create({
          ...data,
          costCentreId: effectiveCostCentreId,
        });
        toast({
          title: 'Grupo creado',
          description: `El grupo "${data.name}" ha sido creado`,
          variant: 'success',
        });
      }
      setDialogMode(null);
      setSelectedCluster(null);
      await loadData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Error al guardar grupo',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setSubmitting(true);
      await beneficiaryClustersService.delete(deleteConfirm._id);
      toast({
        title: 'Grupo eliminado',
        description: `El grupo "${deleteConfirm.name}" ha sido eliminado`,
        variant: 'success',
      });
      setDeleteConfirm(null);
      await loadData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Error al eliminar grupo',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddBeneficiaries = async (
    clusterId: string,
    beneficiaryIds: string[]
  ) => {
    try {
      setSubmitting(true);
      await beneficiaryClustersService.addBeneficiaries(
        clusterId,
        beneficiaryIds
      );
      toast({
        title: 'Beneficiarios agregados',
        description: `${beneficiaryIds.length} beneficiario(s) agregado(s) al grupo`,
        variant: 'success',
      });
      setDialogMode(null);
      setSelectedCluster(null);
      await loadData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Error al agregar beneficiarios',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveBeneficiary = async (
    clusterId: string,
    beneficiaryId: string
  ) => {
    try {
      await beneficiaryClustersService.removeBeneficiary(
        clusterId,
        beneficiaryId
      );
      toast({
        title: 'Beneficiario removido',
        description: 'El beneficiario ha sido removido del grupo',
      });
      await loadData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Error al remover beneficiario',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Buscar grupos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-muted/50 border border-border rounded-lg pl-9 pr-4 py-2 text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {canCreate && (
          <Button
            className="gap-2"
            onClick={() => {
              setSelectedCluster(null);
              setDialogMode('create');
            }}
          >
            <Plus size={16} />
            Nuevo Grupo
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="relative min-h-[200px]">
        <LoadingOverlay isLoading={loading} message="Cargando grupos..." />

        <div
          className={cn(
            loading && 'opacity-50 pointer-events-none',
            'space-y-3'
          )}
        >
          {filteredClusters.length === 0 && !loading ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-foreground mb-2">
                  {clusters.length === 0
                    ? 'No hay grupos creados'
                    : 'Sin resultados'}
                </p>
                <p className="text-muted-foreground mb-6 text-center">
                  {clusters.length === 0
                    ? canCreate
                      ? 'Crea tu primer grupo para organizar beneficiarios'
                      : 'No hay grupos de beneficiarios disponibles'
                    : 'Intenta con otro termino de busqueda'}
                </p>
                {clusters.length === 0 && canCreate && (
                  <Button
                    className="gap-2"
                    onClick={() => {
                      setSelectedCluster(null);
                      setDialogMode('create');
                    }}
                  >
                    <Plus size={16} />
                    Crear Grupo
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredClusters.map((cluster) => (
              <ClusterCard
                key={cluster._id}
                cluster={cluster}
                beneficiaries={beneficiaries}
                canEdit={canCreate}
                onEdit={(c) => {
                  setSelectedCluster(c);
                  setDialogMode('edit');
                }}
                onDelete={(c) => setDeleteConfirm(c)}
                onAddBeneficiaries={(c) => {
                  setSelectedCluster(c);
                  setDialogMode('addBeneficiaries');
                }}
                onRemoveBeneficiary={handleRemoveBeneficiary}
              />
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <ClusterFormDialog
        open={dialogMode === 'create' || dialogMode === 'edit'}
        mode={dialogMode === 'edit' ? 'edit' : 'create'}
        cluster={selectedCluster}
        beneficiaries={beneficiaries}
        onClose={() => {
          setDialogMode(null);
          setSelectedCluster(null);
        }}
        onSubmit={handleCreateOrEdit}
        submitting={submitting}
      />

      {/* Add Beneficiaries Dialog */}
      <AddBeneficiariesDialog
        open={dialogMode === 'addBeneficiaries'}
        cluster={selectedCluster}
        beneficiaries={beneficiaries}
        onClose={() => {
          setDialogMode(null);
          setSelectedCluster(null);
        }}
        onSubmit={handleAddBeneficiaries}
        submitting={submitting}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(v) => !v && setDeleteConfirm(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar Grupo</DialogTitle>
            <DialogDescription>
              Estas seguro de que quieres eliminar el grupo &ldquo;
              {deleteConfirm?.name}&rdquo;? Los beneficiarios no seran
              eliminados, solo se removera el grupo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={submitting}
            >
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
