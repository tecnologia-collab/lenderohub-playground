/**
 * Beneficiary Clusters Controller
 *
 * CRUD operations for beneficiary groups (clusters).
 * Clusters allow users to group beneficiaries for quick selection
 * during mass dispersals.
 */

import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middlewares/auth.middleware';
import { BeneficiaryCluster } from '../models/beneficiaryCluster.model';
import { UserBeneficiary } from '../models/userBeneficiaries.model';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const PRESET_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

const createSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido').max(100, 'Nombre muy largo'),
  description: z.string().max(500, 'Descripcion muy larga').optional(),
  costCentreId: z.string().min(1, 'costCentreId es requerido'),
  beneficiaryIds: z.array(z.string().min(1)).default([]),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color debe ser hex valido (ej: #3B82F6)')
    .optional(),
});

const updateSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido').max(100, 'Nombre muy largo').optional(),
  description: z.string().max(500, 'Descripcion muy larga').optional(),
  beneficiaryIds: z.array(z.string().min(1)).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color debe ser hex valido')
    .optional(),
});

const getAllSchema = z.object({
  costCentreId: z.string().min(1, 'costCentreId es requerido'),
  search: z.string().optional(),
});

const addBeneficiariesSchema = z.object({
  beneficiaryIds: z
    .array(z.string().min(1))
    .min(1, 'Debes enviar al menos un beneficiario'),
});

const idParamSchema = z.object({
  id: z.string().min(1, 'id es requerido'),
});

// ============================================================================
// HELPERS
// ============================================================================

function zodErrors(error: z.ZodError): string {
  return error.issues.map((e: z.ZodIssue) => e.message).join(', ');
}

// ============================================================================
// CONTROLLER
// ============================================================================

export const beneficiaryClustersController = {
  /**
   * GET /api/v1/beneficiary-clusters
   * List clusters for a cost centre. Query: costCentreId (required), search (optional).
   */
  async getAll(req: AuthRequest, res: Response) {
    try {
      const parsed = getAllSchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Parametros invalidos',
          message: zodErrors(parsed.error),
        });
      }

      const { costCentreId, search } = parsed.data;

      const filter: Record<string, unknown> = {
        costCentreId,
        isActive: true,
      };

      if (search) {
        filter.name = { $regex: search, $options: 'i' };
      }

      const clusters = await BeneficiaryCluster.find(filter)
        .sort({ name: 1 })
        .lean();

      return res.json({
        success: true,
        data: clusters,
        total: clusters.length,
      });
    } catch (error: any) {
      console.error('Error listing beneficiary clusters:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Error al listar grupos',
        message: error.message,
      });
    }
  },

  /**
   * GET /api/v1/beneficiary-clusters/:id
   * Get one cluster with full details.
   */
  async getById(req: AuthRequest, res: Response) {
    try {
      const parsed = idParamSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Parametros invalidos',
          message: zodErrors(parsed.error),
        });
      }

      const cluster = await BeneficiaryCluster.findOne({
        _id: parsed.data.id,
        isActive: true,
      }).lean();

      if (!cluster) {
        return res.status(404).json({
          success: false,
          error: 'Grupo no encontrado',
        });
      }

      return res.json({
        success: true,
        data: cluster,
      });
    } catch (error: any) {
      console.error('Error fetching beneficiary cluster:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Error al obtener grupo',
        message: error.message,
      });
    }
  },

  /**
   * POST /api/v1/beneficiary-clusters
   * Create a new cluster.
   */
  async create(req: AuthRequest, res: Response) {
    try {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Datos invalidos',
          message: zodErrors(parsed.error),
        });
      }

      const userId = req.user?._id?.toString();
      const clientId = req.user?.clientId?.toString();

      if (!userId || !clientId) {
        return res.status(401).json({
          success: false,
          error: 'No autenticado',
          message: 'No se pudo determinar el usuario o cliente',
        });
      }

      const { name, description, costCentreId, beneficiaryIds, color } = parsed.data;

      // Validate beneficiary IDs belong to this user (if provided)
      if (beneficiaryIds.length > 0) {
        const validMappings = await UserBeneficiary.find({
          user: userId,
          instrumentId: { $in: beneficiaryIds },
        })
          .select('instrumentId')
          .lean();

        const validIds = new Set(validMappings.map((m) => m.instrumentId));
        const invalidIds = beneficiaryIds.filter((id) => !validIds.has(id));

        if (invalidIds.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'Beneficiarios invalidos',
            message: `Los siguientes beneficiarios no existen o no tienes acceso: ${invalidIds.join(', ')}`,
          });
        }
      }

      const cluster = await BeneficiaryCluster.create({
        name,
        description,
        costCentreId,
        corporateClientId: clientId,
        createdBy: userId,
        beneficiaries: beneficiaryIds,
        color: color || PRESET_COLORS[0],
      });

      return res.status(201).json({
        success: true,
        data: cluster.toObject(),
        message: 'Grupo creado exitosamente',
      });
    } catch (error: any) {
      // Handle duplicate name
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          error: 'Nombre duplicado',
          message: 'Ya existe un grupo con ese nombre en este centro de costos',
        });
      }
      console.error('Error creating beneficiary cluster:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Error al crear grupo',
        message: error.message,
      });
    }
  },

  /**
   * PUT /api/v1/beneficiary-clusters/:id
   * Update a cluster.
   */
  async update(req: AuthRequest, res: Response) {
    try {
      const paramsParsed = idParamSchema.safeParse(req.params);
      if (!paramsParsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Parametros invalidos',
          message: zodErrors(paramsParsed.error),
        });
      }

      const bodyParsed = updateSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Datos invalidos',
          message: zodErrors(bodyParsed.error),
        });
      }

      const userId = req.user?._id?.toString();
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'No autenticado',
        });
      }

      const { name, description, beneficiaryIds, color } = bodyParsed.data;

      // Validate beneficiary IDs if updating them
      if (beneficiaryIds && beneficiaryIds.length > 0) {
        const validMappings = await UserBeneficiary.find({
          user: userId,
          instrumentId: { $in: beneficiaryIds },
        })
          .select('instrumentId')
          .lean();

        const validIds = new Set(validMappings.map((m) => m.instrumentId));
        const invalidIds = beneficiaryIds.filter((id) => !validIds.has(id));

        if (invalidIds.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'Beneficiarios invalidos',
            message: `Los siguientes beneficiarios no existen o no tienes acceso: ${invalidIds.join(', ')}`,
          });
        }
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (beneficiaryIds !== undefined) updateData.beneficiaries = beneficiaryIds;
      if (color !== undefined) updateData.color = color;

      const cluster = await BeneficiaryCluster.findOneAndUpdate(
        { _id: paramsParsed.data.id, isActive: true },
        { $set: updateData },
        { new: true }
      ).lean();

      if (!cluster) {
        return res.status(404).json({
          success: false,
          error: 'Grupo no encontrado',
        });
      }

      return res.json({
        success: true,
        data: cluster,
        message: 'Grupo actualizado exitosamente',
      });
    } catch (error: any) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          error: 'Nombre duplicado',
          message: 'Ya existe un grupo con ese nombre en este centro de costos',
        });
      }
      console.error('Error updating beneficiary cluster:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Error al actualizar grupo',
        message: error.message,
      });
    }
  },

  /**
   * DELETE /api/v1/beneficiary-clusters/:id
   * Soft delete (set isActive: false).
   */
  async delete(req: AuthRequest, res: Response) {
    try {
      const parsed = idParamSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Parametros invalidos',
          message: zodErrors(parsed.error),
        });
      }

      const cluster = await BeneficiaryCluster.findOneAndUpdate(
        { _id: parsed.data.id, isActive: true },
        { $set: { isActive: false } },
        { new: true }
      ).lean();

      if (!cluster) {
        return res.status(404).json({
          success: false,
          error: 'Grupo no encontrado',
        });
      }

      return res.json({
        success: true,
        message: 'Grupo eliminado exitosamente',
      });
    } catch (error: any) {
      console.error('Error deleting beneficiary cluster:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Error al eliminar grupo',
        message: error.message,
      });
    }
  },

  /**
   * POST /api/v1/beneficiary-clusters/:id/beneficiaries
   * Add beneficiaries to an existing cluster.
   */
  async addBeneficiaries(req: AuthRequest, res: Response) {
    try {
      const paramsParsed = idParamSchema.safeParse(req.params);
      if (!paramsParsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Parametros invalidos',
          message: zodErrors(paramsParsed.error),
        });
      }

      const bodyParsed = addBeneficiariesSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Datos invalidos',
          message: zodErrors(bodyParsed.error),
        });
      }

      const userId = req.user?._id?.toString();
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'No autenticado',
        });
      }

      const { beneficiaryIds } = bodyParsed.data;

      // Validate beneficiary IDs belong to this user
      const validMappings = await UserBeneficiary.find({
        user: userId,
        instrumentId: { $in: beneficiaryIds },
      })
        .select('instrumentId')
        .lean();

      const validIds = new Set(validMappings.map((m) => m.instrumentId));
      const invalidIds = beneficiaryIds.filter((id) => !validIds.has(id));

      if (invalidIds.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Beneficiarios invalidos',
          message: `Los siguientes beneficiarios no existen o no tienes acceso: ${invalidIds.join(', ')}`,
        });
      }

      const cluster = await BeneficiaryCluster.findOneAndUpdate(
        { _id: paramsParsed.data.id, isActive: true },
        { $addToSet: { beneficiaries: { $each: beneficiaryIds } } },
        { new: true }
      ).lean();

      if (!cluster) {
        return res.status(404).json({
          success: false,
          error: 'Grupo no encontrado',
        });
      }

      return res.json({
        success: true,
        data: cluster,
        message: `${beneficiaryIds.length} beneficiario(s) agregado(s) al grupo`,
      });
    } catch (error: any) {
      console.error('Error adding beneficiaries to cluster:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Error al agregar beneficiarios',
        message: error.message,
      });
    }
  },

  /**
   * DELETE /api/v1/beneficiary-clusters/:id/beneficiaries/:bid
   * Remove a single beneficiary from a cluster.
   */
  async removeBeneficiary(req: AuthRequest, res: Response) {
    try {
      const { id, bid } = req.params;

      if (!id || !bid) {
        return res.status(400).json({
          success: false,
          error: 'Parametros invalidos',
          message: 'id y bid son requeridos',
        });
      }

      const cluster = await BeneficiaryCluster.findOneAndUpdate(
        { _id: id, isActive: true },
        { $pull: { beneficiaries: bid } },
        { new: true }
      ).lean();

      if (!cluster) {
        return res.status(404).json({
          success: false,
          error: 'Grupo no encontrado',
        });
      }

      return res.json({
        success: true,
        data: cluster,
        message: 'Beneficiario removido del grupo',
      });
    } catch (error: any) {
      console.error('Error removing beneficiary from cluster:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Error al remover beneficiario',
        message: error.message,
      });
    }
  },

  /**
   * GET /api/v1/beneficiary-clusters/colors
   * Return the preset color palette for UI display.
   */
  async getColors(_req: AuthRequest, res: Response) {
    return res.json({
      success: true,
      data: PRESET_COLORS,
    });
  },
};
