"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  usersService,
  UserProfileType,
  ROLE_LABELS,
  CreateUserRequest,
  AssignRoleRequest,
  User,
  COMMISSION_TYPE_LABELS,
  TRANSFER_IN_COMMISSION_PERCENTAGES,
  CommissionDocumentsInput,
} from "@/services/users.service";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  Check, 
  Mail, 
  User as UserIcon, 
  Shield, 
  Building2, 
  Wallet, 
  FileText, 
  Receipt,
  Upload,
  AlertCircle,
  Send
} from "lucide-react";

interface AddUserFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AddUserForm({ onSuccess, onCancel }: AddUserFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [availableRoles, setAvailableRoles] = useState<UserProfileType[]>([]);
  const [formOptions, setFormOptions] = useState<{
    costCentres: { id: string; alias: string; shortName: string; code: string }[];
    virtualBags: { id: string; name: string; description?: string }[];
  }>({ costCentres: [], virtualBags: [] });
  const [step, setStep] = useState<"email" | "new" | "existing" | "success">("email");
  const [emailInput, setEmailInput] = useState("");
  const [existingUser, setExistingUser] = useState<User | null>(null);
  const [reactivateUser, setReactivateUser] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [createdUserEmail, setCreatedUserEmail] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<
    Omit<CreateUserRequest, "profileType"> & { profileType: UserProfileType | "" }
  >({
    email: "",
    firstName: "",
    lastName: "",
    secondLastName: "",
    phone: "",
    profileType: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const normalizeRoleValue = (value: string): UserProfileType | null => {
    const normalized = value.replace(/[\s-_]/g, "").toLowerCase();
    if (normalized === "admin" || normalized === "administrator") return "administrator";
    if (normalized === "corporate" || normalized === "corporativo") return "corporate";
    if (normalized === "commissionagent" || normalized === "commission_agent") return "commissionAgent";
    if (normalized === "subaccount" || normalized === "subaccountmanager") return "subaccount";
    return null;
  };

  // Load available roles for current user
  useEffect(() => {
    const loadRoles = async () => {
      setRolesLoading(true);
      try {
        const response = await usersService.getCreatableRoles();
        console.log("[AddUserForm] Roles recibidos:", response.data);
        const normalizedRoles = response.data
          .map((role) => normalizeRoleValue(role))
          .filter((role): role is UserProfileType => role !== null);
        console.log("[AddUserForm] Roles normalizados:", normalizedRoles);
        setAvailableRoles(normalizedRoles);
      } catch (error) {
        console.error("Error loading roles:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudieron cargar los roles.",
        });
      } finally {
        setRolesLoading(false);
      }
    };
    loadRoles();
  }, [toast]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const response = await usersService.getFormOptions();
        setFormOptions(response.data);
      } catch (error) {
        console.error("Error loading form options:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudieron cargar los centros de costos.",
        });
      }
    };
    loadOptions();
  }, [toast]);

  useEffect(() => {
    const loadCashBags = async () => {
      if (!formData.costCentreId) {
        setFormOptions((prev) => ({ ...prev, virtualBags: [] }));
        return;
      }
      try {
        const response = await usersService.getFormOptions(formData.costCentreId);
        setFormOptions((prev) => ({ ...prev, virtualBags: response.data.virtualBags }));
      } catch (error) {
        console.error("Error loading cash bags:", error);
      }
    };
    loadCashBags();
  }, [formData.costCentreId]);

  useEffect(() => {
    setFormData((prev) => {
      const next = { ...prev };

      if (next.profileType !== "administrator") {
        next.costCentreIds = undefined;
      }

      if (next.profileType !== "subaccount" && next.profileType !== "commissionAgent") {
        next.costCentreId = undefined;
        next.virtualBagIds = undefined;
      }

      if (next.profileType !== "commissionAgent") {
        next.commissionType = undefined;
        next.rfc = undefined;
        next.commissionTransferOutFee = undefined;
        next.transferInCommissionPercentage = undefined;
        next.commissionDocuments = undefined;
      }

      return next;
    });
  }, [formData.profileType]);

  useEffect(() => {
    setErrors({});
  }, [step]);

  const validateEmailStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!emailInput) {
      newErrors.email = "El email es requerido";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      newErrors.email = "Email inválido";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateRoleFields = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.profileType) {
      newErrors.profileType = "El rol es requerido";
    }

    if (formData.profileType === "administrator") {
      if (!formData.costCentreIds || formData.costCentreIds.length === 0) {
        newErrors.costCentreIds = "Selecciona al menos un CECO";
      }
    }

    if (formData.profileType === "subaccount") {
      if (!formData.costCentreId) {
        newErrors.costCentreId = "Selecciona un CECO";
      }
      if (!formData.virtualBagIds || formData.virtualBagIds.length === 0) {
        newErrors.virtualBagIds = "Selecciona al menos una bolsa virtual";
      }
    }

    if (formData.profileType === "commissionAgent") {
      if (!formData.commissionType) {
        newErrors.commissionType = "Selecciona el régimen";
      }
      if (!formData.rfc) {
        newErrors.rfc = "RFC requerido";
      }
      if (formData.commissionTransferOutFee === undefined || formData.commissionTransferOutFee === null || Number.isNaN(formData.commissionTransferOutFee)) {
        newErrors.commissionTransferOutFee = "Cobro SPEI OUT requerido";
      }
      if (formData.transferInCommissionPercentage === undefined || formData.transferInCommissionPercentage === null) {
        newErrors.transferInCommissionPercentage = "Comisión SPEI IN requerida";
      }
      if (!formData.costCentreId) {
        newErrors.costCentreId = "Selecciona un CECO";
      }
      if (!formData.commissionDocuments?.identificationDocumentFile) {
        newErrors.identificationDocumentFile = "INE requerida";
      }
      if (!formData.commissionDocuments?.financialStatementFile) {
        newErrors.financialStatementFile = "Constancia requerida";
      }
      if (!formData.commissionDocuments?.proofOfAddressFile) {
        newErrors.proofOfAddressFile = "Comprobante requerido";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateNewUserStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName) {
      newErrors.firstName = "El nombre es requerido";
    }

    if (!formData.lastName) {
      newErrors.lastName = "El apellido es requerido";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return false;

    return validateRoleFields();
  };

  const validateExistingStep = (): boolean => {
    return validateRoleFields();
  };

  const updateCommissionDocument = (key: keyof CommissionDocumentsInput, file?: File) => {
    setFormData((prev) => ({
      ...prev,
      commissionDocuments: {
        ...(prev.commissionDocuments || {}),
        [key]: file,
      },
    }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: "" }));
    }
  };

  const toggleCostCentreId = (id: string) => {
    setFormData((prev) => {
      const current = new Set(prev.costCentreIds || []);
      if (current.has(id)) {
        current.delete(id);
      } else {
        current.add(id);
      }
      return { ...prev, costCentreIds: Array.from(current) };
    });
  };

  const toggleCashBagId = (id: string) => {
    setFormData((prev) => {
      const current = new Set(prev.virtualBagIds || []);
      if (current.has(id)) {
        current.delete(id);
      } else {
        current.add(id);
      }
      return { ...prev, virtualBagIds: Array.from(current) };
    });
  };

  const roleDescription = useMemo(() => ({
    corporate: "Acceso completo a todas las funciones de la plataforma. Puede marcar como 'solo consulta' si solo requiere visualización.",
    administrator: "Administra CECOs y usuarios con permisos operativos.",
    subaccount: "Opera subcuentas asignadas dentro de un CECO.",
    commissionAgent: "Gestiona comisiones y requiere documentación fiscal.",
  }), []);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmailStep()) return;

    setLoading(true);
    try {
      const response = await usersService.findByEmail(emailInput.trim());
      if (response?.data) {
        setExistingUser(response.data);
        setFormData((prev) => ({
          ...prev,
          email: response.data.email,
          profileType: response.data.profileType,
        }));
        setStep("existing");
      }
    } catch (error: any) {
      if (error?.status === 404) {
        setFormData((prev) => ({ ...prev, email: emailInput.trim() }));
        setStep("new");
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Error al validar el email",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateNewUserStep()) return;

    setLoading(true);
    try {
      const payload: CreateUserRequest = {
        ...formData,
        profileType: formData.profileType as UserProfileType,
      };
      const response = await usersService.createUser(payload);
      
      // Nuevo flujo: mostrar mensaje de éxito con envío de correo
      setEmailSent(response.emailSent ?? true);
      setCreatedUserEmail(formData.email);
      setStep("success");
      
      toast({
        variant: "success",
        title: "Usuario creado",
        description: response.emailSent 
          ? "Se ha enviado un correo para establecer la contraseña"
          : "Usuario creado, pero no se pudo enviar el correo",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Error al crear el usuario",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingUser) return;
    if (!validateExistingStep()) return;

    setLoading(true);
    try {
      const payload: AssignRoleRequest = {
        profileType: formData.profileType as UserProfileType,
        reactivate: reactivateUser,
        costCentreIds: formData.costCentreIds,
        costCentreId: formData.costCentreId,
        virtualBagIds: formData.virtualBagIds,
        commissionType: formData.commissionType,
        rfc: formData.rfc,
        commissionTransferOutFee: formData.commissionTransferOutFee,
        transferInCommissionPercentage: formData.transferInCommissionPercentage,
        commissionDocuments: formData.commissionDocuments,
      };
      await usersService.assignRole(existingUser.id || existingUser._id || "", payload);
      toast({
        variant: "success",
        title: "Rol actualizado",
        description: "El rol del usuario fue actualizado correctamente.",
      });
      onSuccess();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Error al actualizar el rol",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof CreateUserRequest, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value as any }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  // Solo mostrar roles que el usuario actual puede crear
  const roleOptions = useMemo(() => {
    return availableRoles.map((role) => (
      <SelectItem key={role} value={role}>
        {ROLE_LABELS[role] || role}
      </SelectItem>
    ));
  }, [availableRoles]);

  const renderRoleFields = () => {
    // Corporativo - opción de solo consulta
    if (formData.profileType === "corporate") {
      return (
        <div className="space-y-3">
          <label 
            className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
              formData.readOnly 
                ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20" 
                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            <input
              type="checkbox"
              checked={formData.readOnly || false}
              onChange={(e) => setFormData(prev => ({ ...prev, readOnly: e.target.checked }))}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
              formData.readOnly ? "bg-purple-500 text-white" : "border-2 border-slate-300 dark:border-slate-600"
            }`}>
              {formData.readOnly && <Check className="h-3 w-3" />}
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Solo consulta</p>
              <p className="text-xs text-slate-500">
                Este usuario podrá ver información pero no realizar operaciones ni modificaciones.
              </p>
            </div>
          </label>
        </div>
      );
    }

    if (formData.profileType === "administrator") {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <Building2 className="h-4 w-4" />
            <span>Asignación de Centros de Costos</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {formOptions.costCentres.length === 0 ? (
              <div className="col-span-full flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>No hay centros de costos disponibles.</span>
              </div>
            ) : (
              formOptions.costCentres.map((cc) => {
                const selected = formData.costCentreIds?.includes(cc.id);
                return (
                  <label 
                    key={cc.id} 
                    className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition-all ${
                      selected 
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected || false}
                      onChange={() => toggleCostCentreId(cc.id)}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                      selected ? "bg-blue-500 text-white" : "border-2 border-slate-300 dark:border-slate-600"
                    }`}>
                      {selected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white truncate">{cc.alias}</p>
                      <p className="text-xs text-slate-500 truncate">{cc.code}</p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
          {errors.costCentreIds && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.costCentreIds}
            </p>
          )}
        </div>
      );
    }

    if (formData.profileType === "subaccount") {
      return (
        <div className="space-y-5">
          {/* CECO Selection */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Building2 className="h-4 w-4" />
              <span>Centro de Costos</span>
            </div>
            <Select
              value={formData.costCentreId || ""}
              onValueChange={(value) => handleChange("costCentreId", value)}
            >
              <SelectTrigger className={errors.costCentreId ? "border-red-500" : ""}>
                <SelectValue placeholder="Selecciona un CECO" />
              </SelectTrigger>
              <SelectContent>
                {formOptions.costCentres.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>
                    <span className="font-medium">{cc.alias}</span>
                    <span className="text-slate-500 ml-2">· {cc.code}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formOptions.costCentres.length === 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>No hay centros de costos disponibles.</span>
              </div>
            )}
            {errors.costCentreId && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.costCentreId}
              </p>
            )}
          </div>

          {/* Subcuentas Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Wallet className="h-4 w-4" />
              <span>Subcuentas (Bolsas)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {formOptions.virtualBags.length === 0 ? (
                <div className="col-span-full flex items-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{formData.costCentreId ? "Este CECO no tiene subcuentas." : "Selecciona un CECO para ver subcuentas."}</span>
                </div>
              ) : (
                formOptions.virtualBags.map((bag) => {
                  const selected = formData.virtualBagIds?.includes(bag.id);
                  return (
                    <label 
                      key={bag.id} 
                      className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition-all ${
                        selected 
                          ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20" 
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected || false}
                        onChange={() => toggleCashBagId(bag.id)}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                        selected ? "bg-cyan-500 text-white" : "border-2 border-slate-300 dark:border-slate-600"
                      }`}>
                        {selected && <Check className="h-3 w-3" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white truncate">{bag.name}</p>
                        {bag.description && <p className="text-xs text-slate-500 truncate">{bag.description}</p>}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
            {errors.virtualBagIds && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.virtualBagIds}
              </p>
            )}
          </div>
        </div>
      );
    }

    if (formData.profileType === "commissionAgent") {
      return (
        <div className="space-y-6">
          {/* Datos Fiscales */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-200 dark:border-slate-700">
              <FileText className="h-4 w-4" />
              <span>Datos Fiscales</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Régimen fiscal</Label>
                <Select
                  value={formData.commissionType || ""}
                  onValueChange={(value) => handleChange("commissionType", value)}
                >
                  <SelectTrigger className={errors.commissionType ? "border-red-500" : ""}>
                    <SelectValue placeholder="Selecciona el régimen" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMMISSION_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.commissionType && (
                  <p className="text-xs text-red-500">{errors.commissionType}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm">RFC</Label>
                <Input
                  value={formData.rfc || ""}
                  onChange={(e) => handleChange("rfc", e.target.value.toUpperCase())}
                  placeholder="XAXX010101000"
                  maxLength={13}
                  className={`font-mono uppercase ${errors.rfc ? "border-red-500" : ""}`}
                />
                {errors.rfc && (
                  <p className="text-xs text-red-500">{errors.rfc}</p>
                )}
              </div>
            </div>
          </div>

          {/* Centro de Costos */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-200 dark:border-slate-700">
              <Building2 className="h-4 w-4" />
              <span>Centro de Costos</span>
            </div>
            <Select
              value={formData.costCentreId || ""}
              onValueChange={(value) => handleChange("costCentreId", value)}
            >
              <SelectTrigger className={errors.costCentreId ? "border-red-500" : ""}>
                <SelectValue placeholder="Selecciona un CECO" />
              </SelectTrigger>
              <SelectContent>
                {formOptions.costCentres.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>
                    <span className="font-medium">{cc.alias}</span>
                    <span className="text-slate-500 ml-2">· {cc.code}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formOptions.costCentres.length === 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>No hay centros de costos disponibles.</span>
              </div>
            )}
            {errors.costCentreId && (
              <p className="text-xs text-red-500">{errors.costCentreId}</p>
            )}
          </div>

          {/* Comisiones */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-200 dark:border-slate-700">
              <Receipt className="h-4 w-4" />
              <span>Esquema de Comisiones</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Cobro por SPEI OUT</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.commissionTransferOutFee ?? ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, commissionTransferOutFee: Number(e.target.value) }))}
                    placeholder="4.50"
                    className={`pl-7 ${errors.commissionTransferOutFee ? "border-red-500" : ""}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">MXN</span>
                </div>
                <p className="text-xs text-slate-500">Monto fijo cobrado por cada transferencia saliente</p>
                {errors.commissionTransferOutFee && (
                  <p className="text-xs text-red-500">{errors.commissionTransferOutFee}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Comisión SPEI IN</Label>
                <Select
                  value={formData.transferInCommissionPercentage !== undefined ? String(formData.transferInCommissionPercentage) : ""}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, transferInCommissionPercentage: Number(value) }))}
                >
                  <SelectTrigger className={errors.transferInCommissionPercentage ? "border-red-500" : ""}>
                    <SelectValue placeholder="Selecciona el %" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSFER_IN_COMMISSION_PERCENTAGES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">Porcentaje sobre depósitos recibidos</p>
                {errors.transferInCommissionPercentage && (
                  <p className="text-xs text-red-500">{errors.transferInCommissionPercentage}</p>
                )}
              </div>
            </div>
          </div>

          {/* Documentación */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-200 dark:border-slate-700">
              <Upload className="h-4 w-4" />
              <span>Documentación</span>
              <span className="text-xs font-normal text-slate-500 ml-auto">PDF o DOCX · Máx 5MB</span>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {/* INE */}
              <div className={`rounded-lg border-2 border-dashed p-4 transition-colors ${
                formData.commissionDocuments?.identificationDocumentFile 
                  ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20" 
                  : errors.identificationDocumentFile 
                    ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                    : "border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      formData.commissionDocuments?.identificationDocumentFile 
                        ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400" 
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                    }`}>
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-slate-900 dark:text-white">INE (ambos lados)</p>
                      <p className="text-xs text-slate-500">
                        {formData.commissionDocuments?.identificationDocumentFile 
                          ? formData.commissionDocuments.identificationDocumentFile.name 
                          : "Identificación oficial vigente"}
                      </p>
                    </div>
                  </div>
                  <label className="cursor-pointer">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      formData.commissionDocuments?.identificationDocumentFile 
                        ? "bg-green-600 text-white hover:bg-green-700" 
                        : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                    }`}>
                      {formData.commissionDocuments?.identificationDocumentFile ? <Check className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                      {formData.commissionDocuments?.identificationDocumentFile ? "Cambiar" : "Subir"}
                    </span>
                    <Input
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => updateCommissionDocument("identificationDocumentFile", e.target.files?.[0])}
                      className="sr-only"
                    />
                  </label>
                </div>
                {errors.identificationDocumentFile && (
                  <p className="text-xs text-red-500 mt-2">{errors.identificationDocumentFile}</p>
                )}
              </div>

              {/* Constancia Fiscal */}
              <div className={`rounded-lg border-2 border-dashed p-4 transition-colors ${
                formData.commissionDocuments?.financialStatementFile 
                  ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20" 
                  : errors.financialStatementFile 
                    ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                    : "border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      formData.commissionDocuments?.financialStatementFile 
                        ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400" 
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                    }`}>
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-slate-900 dark:text-white">Constancia de situación fiscal</p>
                      <p className="text-xs text-slate-500">
                        {formData.commissionDocuments?.financialStatementFile 
                          ? formData.commissionDocuments.financialStatementFile.name 
                          : "Documento emitido por el SAT"}
                      </p>
                    </div>
                  </div>
                  <label className="cursor-pointer">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      formData.commissionDocuments?.financialStatementFile 
                        ? "bg-green-600 text-white hover:bg-green-700" 
                        : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                    }`}>
                      {formData.commissionDocuments?.financialStatementFile ? <Check className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                      {formData.commissionDocuments?.financialStatementFile ? "Cambiar" : "Subir"}
                    </span>
                    <Input
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => updateCommissionDocument("financialStatementFile", e.target.files?.[0])}
                      className="sr-only"
                    />
                  </label>
                </div>
                {errors.financialStatementFile && (
                  <p className="text-xs text-red-500 mt-2">{errors.financialStatementFile}</p>
                )}
              </div>

              {/* Comprobante de domicilio */}
              <div className={`rounded-lg border-2 border-dashed p-4 transition-colors ${
                formData.commissionDocuments?.proofOfAddressFile 
                  ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20" 
                  : errors.proofOfAddressFile 
                    ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                    : "border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      formData.commissionDocuments?.proofOfAddressFile 
                        ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400" 
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                    }`}>
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-slate-900 dark:text-white">Comprobante de domicilio</p>
                      <p className="text-xs text-slate-500">
                        {formData.commissionDocuments?.proofOfAddressFile 
                          ? formData.commissionDocuments.proofOfAddressFile.name 
                          : "No mayor a 3 meses de antigüedad"}
                      </p>
                    </div>
                  </div>
                  <label className="cursor-pointer">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      formData.commissionDocuments?.proofOfAddressFile 
                        ? "bg-green-600 text-white hover:bg-green-700" 
                        : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                    }`}>
                      {formData.commissionDocuments?.proofOfAddressFile ? <Check className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                      {formData.commissionDocuments?.proofOfAddressFile ? "Cambiar" : "Subir"}
                    </span>
                    <Input
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => updateCommissionDocument("proofOfAddressFile", e.target.files?.[0])}
                      className="sr-only"
                    />
                  </label>
                </div>
                {errors.proofOfAddressFile && (
                  <p className="text-xs text-red-500 mt-2">{errors.proofOfAddressFile}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  if (step === "success") {
    return (
      <div className="space-y-6">
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
            {emailSent ? (
              <Send className="h-8 w-8 text-green-600 dark:text-green-400" />
            ) : (
              <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Usuario creado exitosamente
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {emailSent 
              ? "Se ha enviado un correo para establecer la contraseña"
              : "Usuario creado, pero no se pudo enviar el correo"
            }
          </p>
        </div>
        
        <div className={`rounded-xl border p-5 ${
          emailSent 
            ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20" 
            : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20"
        }`}>
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
              emailSent 
                ? "bg-green-100 dark:bg-green-900" 
                : "bg-amber-100 dark:bg-amber-900"
            }`}>
              <Mail className={`h-5 w-5 ${
                emailSent 
                  ? "text-green-600 dark:text-green-400" 
                  : "text-amber-600 dark:text-amber-400"
              }`} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                {emailSent ? "Correo enviado a:" : "No se pudo enviar correo a:"}
              </p>
              <p className="text-base font-mono text-slate-700 dark:text-slate-300">
                {createdUserEmail}
              </p>
              {emailSent ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  El usuario recibirá un enlace para establecer su contraseña. 
                  El enlace expira en 24 horas.
                </p>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
                  El usuario necesitará que un administrador le reenvíe el correo de configuración 
                  o genere una nueva invitación.
                </p>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex justify-center pt-2">
          <Button type="button" onClick={onSuccess} className="px-8">
            Finalizar
          </Button>
        </div>
      </div>
    );
  }

  if (step === "existing" && existingUser) {
    return (
      <form onSubmit={handleAssignRole} className="space-y-6">
        {/* Usuario encontrado card */}
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 p-4 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <UserIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 font-medium">Usuario existente</p>
              <p className="font-semibold text-slate-900 dark:text-white truncate">{existingUser.fullName}</p>
              <p className="text-sm text-slate-500 truncate">{existingUser.email}</p>
            </div>
            {!existingUser.isActive && (
              <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-xs font-medium">
                Inactivo
              </span>
            )}
          </div>
        </div>

        {/* Selección de rol */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-slate-500" />
            <Label htmlFor="profileType" className="text-sm font-medium">Asignar Rol</Label>
          </div>
          <Select
            value={formData.profileType}
            onValueChange={(value) => handleChange("profileType", value)}
            disabled={rolesLoading}
          >
            <SelectTrigger className={`h-11 ${errors.profileType ? "border-red-500" : ""}`}>
              <SelectValue placeholder={rolesLoading ? "Cargando roles..." : "Selecciona un rol"} />
            </SelectTrigger>
            <SelectContent>
              {roleOptions}
            </SelectContent>
          </Select>
          {rolesLoading && (
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Cargando roles disponibles...
            </p>
          )}
          {!rolesLoading && availableRoles.length === 0 && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              No tienes permisos para crear usuarios con ningún rol.
            </p>
          )}
          {errors.profileType && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.profileType}
            </p>
          )}
        </div>

        {/* Campos específicos del rol */}
        {formData.profileType && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5 bg-slate-50/50 dark:bg-slate-900/50">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
              {roleDescription[formData.profileType as keyof typeof roleDescription] || "Configura los detalles del rol seleccionado."}
            </p>
            {renderRoleFields()}
          </div>
        )}

        {/* Reactivar usuario */}
        {!existingUser.isActive && (
          <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <input
              type="checkbox"
              checked={reactivateUser}
              onChange={(e) => setReactivateUser(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">Reactivar usuario</p>
              <p className="text-xs text-slate-500">El usuario podrá acceder nuevamente al sistema</p>
            </div>
          </label>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button type="button" variant="outline" onClick={() => setStep("email")} disabled={loading}>
            Regresar
          </Button>
          <Button type="submit" disabled={loading || rolesLoading || availableRoles.length === 0}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Asignar rol
          </Button>
        </div>
      </form>
    );
  }

  if (step === "new") {
    return (
      <form onSubmit={handleCreateUser} className="space-y-6">
        {/* Información personal */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-200 dark:border-slate-700">
            <UserIcon className="h-4 w-4" />
            <span>Información Personal</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-sm">Nombre <span className="text-red-500">*</span></Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                placeholder="Juan"
                className={`h-10 ${errors.firstName ? "border-red-500" : ""}`}
              />
              {errors.firstName && (
                <p className="text-xs text-red-500">{errors.firstName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-sm">Apellido paterno <span className="text-red-500">*</span></Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                placeholder="Pérez"
                className={`h-10 ${errors.lastName ? "border-red-500" : ""}`}
              />
              {errors.lastName && (
                <p className="text-xs text-red-500">{errors.lastName}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="secondLastName" className="text-sm">Apellido materno</Label>
              <Input
                id="secondLastName"
                value={formData.secondLastName || ""}
                onChange={(e) => handleChange("secondLastName", e.target.value)}
                placeholder="López"
                className="h-10"
              />
            </div>
          </div>
        </div>

        {/* Contacto */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-200 dark:border-slate-700">
            <Mail className="h-4 w-4" />
            <span>Datos de Contacto</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                readOnly
                className="h-10 bg-slate-50 dark:bg-slate-900 text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm">Teléfono</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone || ""}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="+52 55 1234 5678"
                className="h-10"
              />
            </div>
          </div>
        </div>

        {/* Rol */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-200 dark:border-slate-700">
            <Shield className="h-4 w-4" />
            <span>Rol y Permisos</span>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="profileType" className="text-sm">Tipo de usuario <span className="text-red-500">*</span></Label>
            <Select
              value={formData.profileType}
              onValueChange={(value) => handleChange("profileType", value)}
              disabled={rolesLoading}
            >
              <SelectTrigger className={`h-10 ${errors.profileType ? "border-red-500" : ""}`}>
                <SelectValue placeholder={rolesLoading ? "Cargando roles..." : "Selecciona un rol"} />
              </SelectTrigger>
              <SelectContent>
                {roleOptions}
              </SelectContent>
            </Select>
            {rolesLoading && (
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Cargando roles disponibles...
              </p>
            )}
            {!rolesLoading && availableRoles.length === 0 && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                No tienes permisos para crear usuarios con ningún rol.
              </p>
            )}
            {errors.profileType && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.profileType}
              </p>
            )}
          </div>
        </div>

        {/* Campos específicos del rol */}
        {formData.profileType && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5 bg-slate-50/50 dark:bg-slate-900/50">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
              {roleDescription[formData.profileType as keyof typeof roleDescription] || "Configura los detalles del rol seleccionado."}
            </p>
            {renderRoleFields()}
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button type="button" variant="outline" onClick={() => setStep("email")} disabled={loading}>
            Regresar
          </Button>
          <Button type="submit" disabled={loading || rolesLoading || availableRoles.length === 0}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crear Usuario
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleEmailSubmit} className="space-y-6">
      {/* Header */}
      <div className="text-center pb-4">
        <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
          <Mail className="h-7 w-7 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Agregar Usuario</h3>
        <p className="text-sm text-slate-500 mt-1">Ingresa el email del usuario a registrar</p>
      </div>

      {/* Input de email */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium">Correo electrónico</Label>
        <Input
          id="email"
          type="email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="usuario@empresa.com"
          className={`h-11 ${errors.email ? "border-red-500 focus:ring-red-500" : ""}`}
          autoFocus
        />
        {errors.email && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {errors.email}
          </p>
        )}
      </div>

      {/* Info box */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900">
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
            <UserIcon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            <p className="font-medium text-slate-900 dark:text-white mb-1">¿Cómo funciona?</p>
            <ul className="space-y-1 text-xs">
              <li>• Si el email ya existe, podrás asignarle un nuevo rol</li>
              <li>• Si es nuevo, completarás sus datos personales</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} className="min-w-[100px]">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Continuar"
          )}
        </Button>
      </div>
    </form>
  );
}
