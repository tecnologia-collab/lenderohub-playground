"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, Shield } from "lucide-react"
import { PermissionsEditor } from "./PermissionsEditor"
import { userProfilesService, UserProfile } from "@/services/userProfiles.service"
import { useToast } from "@/hooks/use-toast"

// =============================================================================
// TYPES
// =============================================================================

interface User {
  id?: string
  _id?: string
  email: string
  firstName: string
  lastName: string
  profileType: string
}

interface PermissionsDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// =============================================================================
// PROFILE TYPE LABELS
// =============================================================================

const PROFILE_TYPE_LABELS: Record<string, string> = {
  corporate: "Corporativo",
  administrator: "Administrador",
  subaccountManager: "Gestor de Subcuentas",
  commissionAgent: "Comisionista",
  system: "Sistema",
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PermissionsDialog({ user, open, onOpenChange }: PermissionsDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)

  const userId = user?.id || user?._id

  // Load user profiles when dialog opens
  useEffect(() => {
    if (open && userId) {
      loadProfiles()
    }
  }, [open, userId])

  const loadProfiles = async () => {
    if (!userId) return

    try {
      setLoading(true)
      const userProfiles = await userProfilesService.getProfilesForUser(userId)
      setProfiles(userProfiles)

      // Auto-select first profile if available
      if (userProfiles.length > 0) {
        setSelectedProfileId(userProfiles[0]._id)
      } else {
        setSelectedProfileId(null)
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los perfiles del usuario"
      })
    } finally {
      setLoading(false)
    }
  }

  const selectedProfile = profiles.find(p => p._id === selectedProfileId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permisos de {user?.firstName} {user?.lastName}
          </DialogTitle>
          <DialogDescription>
            Gestiona los permisos granulares para este usuario
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Este usuario no tiene perfiles con permisos configurables
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Los permisos se configuran a través de perfiles asociados a clientes
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Profile selector (if multiple profiles) */}
            {profiles.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {profiles.map(profile => (
                  <button
                    key={profile._id}
                    onClick={() => setSelectedProfileId(profile._id)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors
                      ${selectedProfileId === profile._id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                      }
                    `}
                  >
                    <div className="text-left">
                      <div className="text-sm font-medium">
                        {profile.client?.name || "Sin cliente"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {PROFILE_TYPE_LABELS[profile.type] || profile.type}
                      </div>
                    </div>
                    {!profile.isActive && (
                      <Badge variant="secondary" className="text-xs">
                        Inactivo
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Single profile info */}
            {profiles.length === 1 && selectedProfile && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="text-sm font-medium">
                    {selectedProfile.client?.name || "Sin cliente"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {PROFILE_TYPE_LABELS[selectedProfile.type] || selectedProfile.type}
                  </div>
                </div>
                {!selectedProfile.isActive && (
                  <Badge variant="secondary">Inactivo</Badge>
                )}
              </div>
            )}

            {/* Permissions editor */}
            {selectedProfileId && (
              <PermissionsEditor
                key={selectedProfileId}
                profileId={selectedProfileId}
                readOnly={!selectedProfile?.isActive}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
