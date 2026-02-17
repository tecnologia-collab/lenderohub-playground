import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RegistrationRequest, RegistrationRequestStatus, BusinessType } from '../models/registrationRequest.model';
import { UserModel } from '../models/user.model';
import { AuthRequest } from '../middlewares/auth.middleware';

// ============================================
// Zod Schemas
// ============================================

const submitRequestSchema = z.object({
  companyName: z.string().min(2, 'Nombre de empresa debe tener al menos 2 caracteres').max(200),
  rfc: z.string()
    .min(10, 'RFC debe tener entre 10 y 13 caracteres')
    .max(13, 'RFC debe tener entre 10 y 13 caracteres')
    .regex(/^[A-Za-z0-9]+$/, 'RFC solo puede contener letras y numeros'),
  businessType: z.nativeEnum(BusinessType, {
    error: 'Tipo de empresa invalido'
  }),
  firstName: z.string().min(2, 'Nombre debe tener al menos 2 caracteres').max(100),
  lastName: z.string().min(2, 'Apellido paterno debe tener al menos 2 caracteres').max(100),
  secondLastName: z.string().max(100).optional(),
  email: z.string().email('Email invalido').max(200),
  phone: z.string()
    .min(10, 'Telefono debe tener al menos 10 digitos')
    .max(15, 'Telefono no puede tener mas de 15 digitos')
    .regex(/^[0-9+\-\s()]+$/, 'Telefono solo puede contener numeros, +, -, espacios y parentesis'),
});

const reviewRequestSchema = z.object({
  status: z.enum(['approved', 'rejected'], {
    error: 'Status debe ser "approved" o "rejected"'
  }),
  reviewNotes: z.string().max(1000).optional(),
});

// ============================================
// PUBLIC: Submit Registration Request
// ============================================
export const submitRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate input
    const parsed = submitRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      res.status(400).json({
        success: false,
        message: firstIssue.message,
        errors: parsed.error.issues.map((e: z.ZodIssue) => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
      return;
    }

    const data = parsed.data;
    const emailLower = data.email.toLowerCase();

    // Check if email already exists in Users
    const existingUser = await UserModel.findOne({ email: emailLower }).lean();
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'Este email ya esta registrado en el sistema'
      });
      return;
    }

    // Check if email already has a pending request
    const existingRequest = await RegistrationRequest.findOne({
      email: emailLower,
      status: RegistrationRequestStatus.Pending
    }).lean();
    if (existingRequest) {
      res.status(409).json({
        success: false,
        message: 'Ya existe una solicitud pendiente con este email'
      });
      return;
    }

    // If there's a rejected request with same email, allow re-submission by removing old one
    await RegistrationRequest.deleteMany({
      email: emailLower,
      status: RegistrationRequestStatus.Rejected
    });

    // Create registration request
    const registrationRequest = await RegistrationRequest.create({
      companyName: data.companyName.trim(),
      rfc: data.rfc.trim().toUpperCase(),
      businessType: data.businessType,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      secondLastName: data.secondLastName?.trim(),
      email: emailLower,
      phone: data.phone.trim(),
      status: RegistrationRequestStatus.Pending,
      ipAddress: req.ip || req.socket.remoteAddress || ''
    });

    res.status(201).json({
      success: true,
      message: 'Solicitud de registro enviada exitosamente. Te contactaremos cuando sea revisada.',
      data: {
        id: registrationRequest._id,
        email: registrationRequest.email
      }
    });
  } catch (error: any) {
    // Handle duplicate key error (race condition on unique email index)
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        message: 'Ya existe una solicitud con este email'
      });
      return;
    }
    next(error);
  }
};

// ============================================
// ADMIN: Get Registration Requests (paginated)
// ============================================
export const getRequests = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status as string;

    const filter: Record<string, unknown> = {};
    if (statusFilter && Object.values(RegistrationRequestStatus).includes(statusFilter as RegistrationRequestStatus)) {
      filter.status = statusFilter;
    }

    const [requests, total] = await Promise.all([
      RegistrationRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('reviewedBy', 'firstName lastName email')
        .lean(),
      RegistrationRequest.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: requests,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// ADMIN: Get Single Registration Request
// ============================================
export const getRequest = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const request = await RegistrationRequest.findById(id)
      .populate('reviewedBy', 'firstName lastName email')
      .lean();

    if (!request) {
      res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada'
      });
      return;
    }

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// ADMIN: Review Registration Request (approve/reject)
// ============================================
export const reviewRequest = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    // Validate input
    const parsed = reviewRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      res.status(400).json({
        success: false,
        message: firstIssue.message
      });
      return;
    }

    const { status, reviewNotes } = parsed.data;

    // Find the request
    const registrationReq = await RegistrationRequest.findById(id);
    if (!registrationReq) {
      res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada'
      });
      return;
    }

    // Only pending requests can be reviewed
    if (registrationReq.status !== RegistrationRequestStatus.Pending) {
      res.status(400).json({
        success: false,
        message: `Esta solicitud ya fue ${registrationReq.status === 'approved' ? 'aprobada' : 'rechazada'}`
      });
      return;
    }

    // Update the request
    registrationReq.status = status as RegistrationRequestStatus;
    registrationReq.reviewedBy = req.user?._id;
    registrationReq.reviewNotes = reviewNotes;
    registrationReq.reviewedAt = new Date();
    await registrationReq.save();

    // TODO: If approved, create corporate client, cost centre, user, and send welcome email
    // This will be implemented in a follow-up task

    res.json({
      success: true,
      message: status === 'approved'
        ? 'Solicitud aprobada exitosamente'
        : 'Solicitud rechazada',
      data: registrationReq
    });
  } catch (error) {
    next(error);
  }
};
