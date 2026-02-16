"use client"

import { useEffect, useState, useCallback } from "react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, Check, X, Shield, ShieldCheck, ShieldOff } from "lucide-react"
import {
  userProfilesService,
  ProfilePermissionsResponse,
  PermissionGroup
} from "@/services/userProfiles.service"
import { useToast } from "@/hooks/use-toast"

// =============================================================================
// TYPES
// =============================================================================

interface PermissionsEditorProps {
  profileId: string
  readOnly?: boolean
  onPermissionsChange?: (permissions: Record<string, boolean>) => void
}

// =============================================================================
// GROUP ICONS
// =============================================================================

const groupIcons: Record<string, React.ReactNode> = {
  beneficiaries: <Shield className="h-4 w-4" />,
  transfers: <Shield className="h-4 w-4" />,
  reports: <Shield className="h-4 w-4" />,
  management: <Shield className="h-4 w-4" />,
  users: <Shield className="h-4 w-4" />,
  settings: <Shield className="h-4 w-4" />,
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PermissionsEditor({
  profileId,
  readOnly = false,
  onPermissionsChange
}: PermissionsEditorProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<ProfilePermissionsResponse | null>(null)
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [hasChanges, setHasChanges] = useState(false)

  // Load permissions
  const loadPermissions = useCallback(async () => {
    try {
      setLoading(true)
      const response = await userProfilesService.getProfilePermissions(profileId)
      setData(response)
      setPermissions(response.permissions)
      setHasChanges(false)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los permisos"
      })
    } finally {
      setLoading(false)
    }
  }, [profileId, toast])

  useEffect(() => {
    loadPermissions()
  }, [loadPermissions])

  // Toggle single permission
  const togglePermission = (key: string, value: boolean) => {
    const newPermissions = { ...permissions, [key]: value }
    setPermissions(newPermissions)
    setHasChanges(true)
    onPermissionsChange?.(newPermissions)
  }

  // Set all permissions
  const setAllPermissions = async (value: boolean) => {
    try {
      setSaving(true)
      await userProfilesService.setAllPermissions(profileId, value)
      await loadPermissions()
      toast({
        title: "Permisos actualizados",
        description: value ? "Todos los permisos activados" : "Todos los permisos desactivados"
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron actualizar los permisos"
      })
    } finally {
      setSaving(false)
    }
  }

  // Save changes
  const saveChanges = async () => {
    try {
      setSaving(true)
      await userProfilesService.updateProfilePermissions(profileId, permissions)
      setHasChanges(false)
      toast({
        title: "Permisos guardados",
        description: "Los cambios se han guardado correctamente"
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron guardar los permisos"
      })
    } finally {
      setSaving(false)
    }
  }

  // Discard changes
  const discardChanges = () => {
    if (data) {
      setPermissions(data.permissions)
      setHasChanges(false)
    }
  }

  // Get permissions for a group
  const getGroupPermissions = (group: PermissionGroup) => {
    return group.permissions.filter(p => data?.availablePermissions.includes(p))
  }

  // Check if all group permissions are enabled
  const isGroupFullyEnabled = (group: PermissionGroup) => {
    const groupPerms = getGroupPermissions(group)
    return groupPerms.length > 0 && groupPerms.every(p => permissions[p])
  }

  // Toggle all permissions in a group
  const toggleGroup = (group: PermissionGroup) => {
    const groupPerms = getGroupPermissions(group)
    const allEnabled = isGroupFullyEnabled(group)
    const newPermissions = { ...permissions }
    groupPerms.forEach(p => {
      newPermissions[p] = !allEnabled
    })
    setPermissions(newPermissions)
    setHasChanges(true)
    onPermissionsChange?.(newPermissions)
  }

  // Count enabled permissions
  const enabledCount = Object.values(permissions).filter(Boolean).length
  const totalCount = data?.availablePermissions.length || 0

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No se encontraron permisos para este perfil
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with stats and actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm">
            {enabledCount} / {totalCount} permisos activos
          </Badge>
          {hasChanges && (
            <Badge variant="outline" className="text-amber-600 border-amber-600">
              Cambios sin guardar
            </Badge>
          )}
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAllPermissions(false)}
              disabled={saving}
            >
              <ShieldOff className="h-4 w-4 mr-1" />
              Desactivar todos
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAllPermissions(true)}
              disabled={saving}
            >
              <ShieldCheck className="h-4 w-4 mr-1" />
              Activar todos
            </Button>
          </div>
        )}
      </div>

      {/* Permission groups */}
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(data.permissionGroups).map(([groupKey, group]) => {
          const groupPerms = getGroupPermissions(group)
          if (groupPerms.length === 0) return null

          const allEnabled = isGroupFullyEnabled(group)
          const enabledInGroup = groupPerms.filter(p => permissions[p]).length

          return (
            <Card key={groupKey}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {groupIcons[groupKey] || <Shield className="h-4 w-4" />}
                    <CardTitle className="text-base">{group.label}</CardTitle>
                  </div>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleGroup(group)}
                      disabled={saving}
                      className="h-7 text-xs"
                    >
                      {allEnabled ? "Desactivar" : "Activar"} grupo
                    </Button>
                  )}
                </div>
                <CardDescription className="text-xs">
                  {enabledInGroup} de {groupPerms.length} activos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {groupPerms.map(permKey => (
                  <div
                    key={permKey}
                    className="flex items-center justify-between py-1"
                  >
                    <label
                      htmlFor={`perm-${permKey}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {data.permissionLabels[permKey] || permKey}
                    </label>
                    <Switch
                      id={`perm-${permKey}`}
                      checked={permissions[permKey] || false}
                      onCheckedChange={(checked) => togglePermission(permKey, checked)}
                      disabled={readOnly || saving}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Save/Discard buttons */}
      {!readOnly && hasChanges && (
        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={discardChanges}
            disabled={saving}
          >
            <X className="h-4 w-4 mr-1" />
            Descartar
          </Button>
          <Button
            onClick={saveChanges}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            Guardar cambios
          </Button>
        </div>
      )}
    </div>
  )
}
