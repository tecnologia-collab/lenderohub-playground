'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  massBeneficiaryService,
  type MassBeneficiaryImport,
  type MassBeneficiaryRow,
} from '@/services/massBeneficiary.service';

// ============================================
// Types
// ============================================
interface MassImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  costCentreId?: string;
}

type Step = 'upload' | 'preview' | 'results';

// ============================================
// CSV Template
// ============================================
const CSV_TEMPLATE_HEADERS = 'nombre,alias,clabe,rfc,email';
const CSV_TEMPLATE_EXAMPLE =
  'Juan Perez Garcia,Proveedor Juan,012180012345678901,PEGJ800101ABC,juan@ejemplo.com';

function downloadTemplate() {
  const content = `${CSV_TEMPLATE_HEADERS}\n${CSV_TEMPLATE_EXAMPLE}\n`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'plantilla_beneficiarios.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================
// Row status badge helper
// ============================================
function RowStatusBadge({ row }: { row: MassBeneficiaryRow }) {
  switch (row.status) {
    case 'valid':
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle2 size={12} />
          Valido
        </Badge>
      );
    case 'invalid':
      return (
        <Badge variant="destructive" className="gap-1" title={row.errorMessage}>
          <XCircle size={12} />
          Invalido
        </Badge>
      );
    case 'created':
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle2 size={12} />
          Creado
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="destructive" className="gap-1" title={row.errorMessage}>
          <XCircle size={12} />
          Fallido
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          <AlertCircle size={12} />
          Pendiente
        </Badge>
      );
  }
}

// ============================================
// Component
// ============================================
export function MassImportDialog({
  open,
  onOpenChange,
  onComplete,
  costCentreId,
}: MassImportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [importData, setImportData] = useState<MassBeneficiaryImport | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  // Reset state when dialog closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Cleanup
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setStep('upload');
        setFile(null);
        setIsDragging(false);
        setUploading(false);
        setConfirming(false);
        setImportData(null);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  // ---- File handling ----
  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: 'Archivo invalido',
        description: 'Solo se permiten archivos CSV (.csv)',
        variant: 'destructive',
      });
      return;
    }
    setFile(selectedFile);
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFileSelect(selectedFile);
      }
    },
    [handleFileSelect]
  );

  // ---- Upload ----
  const handleUpload = useCallback(async () => {
    if (!file) return;

    const effectiveCostCentreId = costCentreId || 'default';

    try {
      setUploading(true);
      const result = await massBeneficiaryService.upload(file, effectiveCostCentreId);
      setImportData(result);
      setStep('preview');
      toast({
        title: 'Archivo procesado',
        description: `${result.totalRows} filas analizadas: ${result.validRows} validas, ${result.invalidRows} invalidas`,
        variant: 'success',
      });
    } catch (err: any) {
      console.error('Error uploading CSV:', err);
      toast({
        title: 'Error al procesar archivo',
        description: err.message || 'No se pudo procesar el archivo CSV',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  }, [file, costCentreId, toast]);

  // ---- Confirm ----
  const handleConfirm = useCallback(async () => {
    if (!importData) return;

    try {
      setConfirming(true);
      const result = await massBeneficiaryService.confirm(importData._id);
      setImportData(result);
      setStep('results');

      // Start polling if processing
      if (result.status === 'processing' || result.status === 'confirmed') {
        pollingRef.current = setInterval(async () => {
          try {
            const updated = await massBeneficiaryService.getById(importData._id);
            setImportData(updated);

            if (
              updated.status !== 'processing' &&
              updated.status !== 'confirmed'
            ) {
              // Done processing
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
            }
          } catch (pollErr) {
            console.error('Error polling import status:', pollErr);
          }
        }, 3000);
      }

      toast({
        title: 'Importacion confirmada',
        description: 'Los beneficiarios se estan creando...',
        variant: 'success',
      });
    } catch (err: any) {
      console.error('Error confirming import:', err);
      toast({
        title: 'Error al confirmar',
        description: err.message || 'No se pudo confirmar la importacion',
        variant: 'destructive',
      });
    } finally {
      setConfirming(false);
    }
  }, [importData, toast]);

  // ---- Close and refresh ----
  const handleClose = useCallback(() => {
    onComplete();
    handleOpenChange(false);
  }, [onComplete, handleOpenChange]);

  // ---- Computed values ----
  const isProcessing =
    importData?.status === 'processing' || importData?.status === 'confirmed';
  const isFinished =
    importData?.status === 'completed' ||
    importData?.status === 'partially_completed' ||
    importData?.status === 'failed';

  // ---- Render steps ----
  const renderUploadStep = () => (
    <div className="space-y-4">
      {/* Download template */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Descarga la plantilla CSV con el formato correcto
          </span>
        </div>
        <Button variant="ghost" size="sm" className="gap-2" onClick={downloadTemplate}>
          <Download size={14} />
          Plantilla
        </Button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-3 p-8 rounded-lg border-2 border-dashed cursor-pointer transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : file
              ? 'border-success bg-success/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/30'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleInputChange}
          className="hidden"
        />

        {file ? (
          <>
            <FileSpreadsheet size={32} className="text-success" />
            <div className="text-center">
              <p className="font-medium text-foreground">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
            >
              Cambiar archivo
            </Button>
          </>
        ) : (
          <>
            <Upload
              size={32}
              className={isDragging ? 'text-primary' : 'text-muted-foreground'}
            />
            <div className="text-center">
              <p className="font-medium text-foreground">
                Arrastra tu archivo CSV aqui
              </p>
              <p className="text-sm text-muted-foreground">
                o haz clic para seleccionar
              </p>
            </div>
          </>
        )}
      </div>

      {/* CSV format hint */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p className="font-medium">Formato esperado (columnas CSV):</p>
        <code className="block bg-muted/50 p-2 rounded text-xs">
          nombre, alias, clabe, rfc, email
        </code>
      </div>
    </div>
  );

  const renderPreviewStep = () => {
    if (!importData) return null;

    const { totalRows, validRows, invalidRows, rows } = importData;
    const hasValidRows = validRows > 0;

    return (
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50 border border-border">
            <span className="text-2xl font-bold text-foreground">{totalRows}</span>
            <span className="text-xs text-muted-foreground">Total filas</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-success/5 border border-success/20">
            <span className="text-2xl font-bold text-success">{validRows}</span>
            <span className="text-xs text-success">Validas</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <span className="text-2xl font-bold text-destructive">{invalidRows}</span>
            <span className="text-xs text-destructive">Invalidas</span>
          </div>
        </div>

        {/* Rows table */}
        <div className="max-h-[350px] overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
              <tr className="border-b border-border">
                <th className="text-left font-medium text-muted-foreground text-xs uppercase tracking-wider p-3">
                  #
                </th>
                <th className="text-left font-medium text-muted-foreground text-xs uppercase tracking-wider p-3">
                  Nombre
                </th>
                <th className="text-left font-medium text-muted-foreground text-xs uppercase tracking-wider p-3">
                  Alias
                </th>
                <th className="text-left font-medium text-muted-foreground text-xs uppercase tracking-wider p-3">
                  CLABE
                </th>
                <th className="text-left font-medium text-muted-foreground text-xs uppercase tracking-wider p-3">
                  RFC
                </th>
                <th className="text-left font-medium text-muted-foreground text-xs uppercase tracking-wider p-3">
                  Email
                </th>
                <th className="text-left font-medium text-muted-foreground text-xs uppercase tracking-wider p-3">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.rowNumber}
                  className={cn(
                    'border-b border-border/50 transition-colors',
                    row.status === 'invalid' && 'bg-destructive/5'
                  )}
                >
                  <td className="p-3 text-muted-foreground">{row.rowNumber}</td>
                  <td className="p-3 text-foreground">{row.name}</td>
                  <td className="p-3 text-foreground">{row.alias}</td>
                  <td className="p-3 font-mono text-xs text-foreground">
                    {row.clabeNumber}
                  </td>
                  <td className="p-3 font-mono text-xs text-foreground">{row.rfc}</td>
                  <td className="p-3 text-foreground">{row.email}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <RowStatusBadge row={row} />
                      {row.errorMessage && (
                        <span
                          className="text-xs text-destructive truncate max-w-[120px]"
                          title={row.errorMessage}
                        >
                          {row.errorMessage}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Warning if all invalid */}
        {!hasValidRows && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">
              Todas las filas tienen errores. Corrige el archivo CSV e intenta nuevamente.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderResultsStep = () => {
    if (!importData) return null;

    const { successCount, failCount, rows, status } = importData;

    return (
      <div className="space-y-4">
        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex items-center justify-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm text-primary font-medium">
              Procesando beneficiarios...
            </p>
          </div>
        )}

        {/* Final summary */}
        {isFinished && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center p-4 rounded-lg bg-success/5 border border-success/20">
              <CheckCircle2 size={24} className="text-success mb-1" />
              <span className="text-2xl font-bold text-success">{successCount}</span>
              <span className="text-xs text-success">Creados</span>
            </div>
            <div className="flex flex-col items-center p-4 rounded-lg bg-destructive/5 border border-destructive/20">
              <XCircle size={24} className="text-destructive mb-1" />
              <span className="text-2xl font-bold text-destructive">{failCount}</span>
              <span className="text-xs text-destructive">Fallidos</span>
            </div>
          </div>
        )}

        {/* Status message */}
        {isFinished && (
          <div
            className={cn(
              'flex items-center gap-2 p-3 rounded-lg',
              status === 'completed'
                ? 'bg-success/10 border border-success/20'
                : status === 'partially_completed'
                  ? 'bg-warning/10 border border-warning/20'
                  : 'bg-destructive/10 border border-destructive/20'
            )}
          >
            {status === 'completed' ? (
              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
            ) : (
              <AlertCircle
                className={cn(
                  'h-4 w-4 flex-shrink-0',
                  status === 'partially_completed'
                    ? 'text-warning'
                    : 'text-destructive'
                )}
              />
            )}
            <p
              className={cn(
                'text-sm',
                status === 'completed'
                  ? 'text-success'
                  : status === 'partially_completed'
                    ? 'text-warning'
                    : 'text-destructive'
              )}
            >
              {status === 'completed'
                ? 'Todos los beneficiarios fueron creados exitosamente.'
                : status === 'partially_completed'
                  ? 'Algunos beneficiarios no pudieron ser creados. Revisa los detalles abajo.'
                  : 'La importacion fallo. Por favor intenta nuevamente.'}
            </p>
          </div>
        )}

        {/* Updated rows table */}
        <div className="max-h-[300px] overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
              <tr className="border-b border-border">
                <th className="text-left font-medium text-muted-foreground text-xs uppercase tracking-wider p-3">
                  #
                </th>
                <th className="text-left font-medium text-muted-foreground text-xs uppercase tracking-wider p-3">
                  Nombre
                </th>
                <th className="text-left font-medium text-muted-foreground text-xs uppercase tracking-wider p-3">
                  Alias
                </th>
                <th className="text-left font-medium text-muted-foreground text-xs uppercase tracking-wider p-3">
                  CLABE
                </th>
                <th className="text-left font-medium text-muted-foreground text-xs uppercase tracking-wider p-3">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.rowNumber}
                  className={cn(
                    'border-b border-border/50 transition-colors',
                    row.status === 'failed' && 'bg-destructive/5',
                    row.status === 'created' && 'bg-success/5'
                  )}
                >
                  <td className="p-3 text-muted-foreground">{row.rowNumber}</td>
                  <td className="p-3 text-foreground">{row.name}</td>
                  <td className="p-3 text-foreground">{row.alias}</td>
                  <td className="p-3 font-mono text-xs text-foreground">
                    {row.clabeNumber}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <RowStatusBadge row={row} />
                      {row.errorMessage && (
                        <span
                          className="text-xs text-destructive truncate max-w-[150px]"
                          title={row.errorMessage}
                        >
                          {row.errorMessage}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ---- Dialog title per step ----
  const stepTitles: Record<Step, string> = {
    upload: 'Importar Beneficiarios desde CSV',
    preview: 'Vista Previa de Importacion',
    results: 'Resultado de Importacion',
  };

  const stepDescriptions: Record<Step, string> = {
    upload: 'Carga un archivo CSV con los beneficiarios a importar',
    preview: 'Revisa los datos antes de confirmar la importacion',
    results: 'Resumen del proceso de importacion',
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={20} />
            {stepTitles[step]}
          </DialogTitle>
          <DialogDescription>{stepDescriptions[step]}</DialogDescription>
        </DialogHeader>

        {/* Step content */}
        {step === 'upload' && renderUploadStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'results' && renderResultsStep()}

        {/* Footer actions */}
        <DialogFooter>
          {step === 'upload' && (
            <>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={uploading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Cargar y Validar
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStep('upload');
                  setImportData(null);
                  setFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                disabled={confirming}
              >
                Volver
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={confirming || (importData?.validRows ?? 0) === 0}
                className="gap-2"
              >
                {confirming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Confirmar Importacion
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'results' && (
            <Button onClick={handleClose} disabled={isProcessing} className="gap-2">
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                'Cerrar'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
