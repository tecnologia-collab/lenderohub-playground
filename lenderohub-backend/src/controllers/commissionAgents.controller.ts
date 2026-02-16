import * as dinero from 'dinero.js'
import Dinero from 'dinero.js'
import mongoose from 'mongoose'
import { Response } from 'express'
import { z } from 'zod'

import { AuthRequest } from '../middlewares/auth.middleware'
import { CommissionRequest, CommissionRequestStatus } from '../models/commissionRequests.model'
import { CommissionAgentAssignment } from '../models/commissionAgentAssignments.model'
import { CommissionAgentBalance } from '../models/commissionAgentBalances.model'
import { CommissionAgentBeneficiary } from '../models/beneficiaries.model'
import { Upload } from '../models/uploads.model'
import { UserProfile } from '../models/userProfiles.model'
import { InternalAccount, InternalAccountTag, ExternalAccount } from '../models/accounts.model'
import { TransactionTransferOut, TransactionTransferOutStatus } from '../models/transactions.model'
import { dayjs } from '../utils/dayjs'
import { emailService } from '../services/email/email.service'
import { auditService, AuditAction } from '../services/audit'
import { notificationsService, NotificationType } from '../services/notifications'

function getMoneyAmount(value: any): number {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (typeof value.getAmount === 'function') return value.getAmount()
  if (typeof value === 'object' && typeof value.amount === 'number') return value.amount
  return 0
}

function toDinero(value: any): dinero.Dinero {
  if (!value) {
    return Dinero({ amount: 0, precision: 2, currency: 'MXN' })
  }
  if (typeof value.getAmount === 'function') {
    return value as dinero.Dinero
  }
  if (typeof value === 'number') {
    return Dinero({ amount: value, precision: 2, currency: 'MXN' })
  }
  if (typeof value === 'object' && typeof value.amount === 'number') {
    return Dinero({
      amount: value.amount,
      precision: value.precision ?? 2,
      currency: value.currency ?? 'MXN'
    })
  }
  return Dinero({ amount: 0, precision: 2, currency: 'MXN' })
}

function toMoneyObject(value: dinero.Dinero): dinero.DineroObject {
  return {
    amount: value.getAmount(),
    precision: 2,
    currency: 'MXN'
  }
}

function formatRequestDate(date?: Date): string {
  if (!date) return ''
  return dayjs(date).format('MMM D YYYY HH:mm:ss')
}

// Zod schemas
const createCommissionRequestSchema = z.object({
  amount: z.number().positive('El monto debe ser mayor a 0'),
  beneficiaryId: z.string().min(1, 'beneficiaryId es requerido')
})

const rejectCommissionRequestSchema = z.object({
  rejectionMessage: z.string().min(1, 'El motivo de rechazo es requerido').max(500, 'Máximo 500 caracteres')
})

export const commissionAgentsController = {
  async getCommissionRequests (req: AuthRequest, res: Response) {
    try {
      const status = (req.query.status as string) || CommissionRequestStatus.New
      const mine = req.query.mine === 'true'
      const filter: any = {}
      if (status) {
        filter.status = status
      }

      // If mine=true, filter by the requester's commission agent profile
      if (mine && req.user) {
        const profile = await UserProfile.findOne({
          user: req.user._id,
          type: 'commissionAgent',
          isActive: true
        })
        if (profile) {
          filter.userProfile = profile._id
        } else {
          // No commission agent profile found, return empty
          return res.json({
            success: true,
            data: { requests: [] }
          })
        }
      }

      const requests = await CommissionRequest.find(filter)
        .sort({ createdAt: -1 })
        .populate({
          path: 'userProfile',
          populate: {
            path: 'user'
          }
        })
        .populate('beneficiary')
        .populate('invoicePDF')
        .populate('invoiceXML')

      const data = requests.map((request) => {
        const userProfile = request.userProfile as any
        const user = userProfile?.user as any
        const amount = getMoneyAmount(request.amount)
        const amountTransfer = getMoneyAmount(request.amountTransfer)
        const amountWithheldVAT = getMoneyAmount(request.amountWithheldVAT)
        const withheldIncomeTax = getMoneyAmount(request.withheldIncomeTax)
        const transactionFeeWithVAT = getMoneyAmount(request.transactionFeeWithVAT)
        const beneficiary = request.beneficiary as any
        return {
          date: formatRequestDate(request.createdAt),
          folio: request._id.toString(),
          status: request.status,
          amount: amount / 100,
          amountTransfer: amountTransfer / 100,
          amountWithheldVAT: amountWithheldVAT / 100,
          withheldIncomeTax: withheldIncomeTax / 100,
          transactionFeeWithVAT: transactionFeeWithVAT / 100,
          commissionAgent: user?.fullName || user?.email || userProfile?.rfc || '',
          beneficiaryName: beneficiary?.name || beneficiary?.alias || '',
          hasInvoicePDF: !!request.invoicePDF,
          hasInvoiceXML: !!request.invoiceXML,
          rejectionMessage: request.rejectionMessage || undefined
        }
      })

      return res.json({
        success: true,
        data: { requests: data }
      })
    } catch (error: any) {
      console.error('Error fetching commission requests:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch commission requests',
        message: error.message
      })
    }
  },

  async approveCommissionRequest (req: AuthRequest, res: Response) {
    const session = await mongoose.startSession()
    try {
      const { id } = req.params

      let responseData: any
      let agentEmail: string | undefined
      let agentName: string | undefined
      let requestAmount: number | undefined
      let requestAmountTransfer: number | undefined
      let requestFolio: string | undefined

      await session.withTransaction(async () => {
        const request = await CommissionRequest.findById(id)
          .populate({
            path: 'userProfile',
            populate: {
              path: 'user'
            }
          })
          .session(session)

        if (!request) {
          throw new Error('Commission request not found')
        }

        if (request.status !== CommissionRequestStatus.New) {
          throw new Error('Commission request is not pending approval')
        }

        if (!request.invoicePDF || !request.invoiceXML) {
          throw new Error('Invoice PDF y XML son requeridos')
        }

        const assignment = await CommissionAgentAssignment.findOne({
          userProfile: request.userProfile,
          isEnabled: true
        }).session(session)

        if (!assignment) {
          throw new Error('Comisionista sin asignación activa')
        }

        // Get agent info for email
        const userProfile = request.userProfile as any
        const user = userProfile?.user as any
        agentEmail = user?.email
        agentName = user?.fullName || user?.email || userProfile?.rfc || 'Comisionista'
        requestAmount = getMoneyAmount(request.amount) / 100
        requestFolio = request._id.toString()

        const fromAccount = await InternalAccount.findOne({
          costCentre: assignment.costCentre,
          tag: InternalAccountTag.TransferInCommissionAgentPayment
        }).session(session)

        if (!fromAccount) {
          throw new Error('Cuenta de pago a comisionista no encontrada')
        }

        const beneficiaryAccount = await ExternalAccount.findOne({
          beneficiary: request.beneficiary
        }).session(session)

        if (!beneficiaryAccount) {
          throw new Error('Beneficiario no encontrado')
        }

        const amountTransfer = toDinero(request.amountTransfer)
        const amountWithheldVAT = toDinero(request.amountWithheldVAT)
        const withheldIncomeTax = toDinero(request.withheldIncomeTax)
        const transactionFeeWithVAT = toDinero(request.transactionFeeWithVAT)
        const amountEarnings = toDinero(request.amountEarnings)

        let amountCommission = Dinero({ amount: 0, precision: 2, currency: 'MXN' })
        const commissionBreakdown = new Map<string, dinero.DineroObject>()

        const breakdownEntries = [
          { tag: InternalAccountTag.VatToPayCommissionAgent, amount: amountWithheldVAT },
          { tag: InternalAccountTag.IncomeTaxToPayCommissionAgent, amount: withheldIncomeTax },
          { tag: InternalAccountTag.TransferOut, amount: transactionFeeWithVAT },
          { tag: InternalAccountTag.TransferOutEarnings, amount: amountEarnings }
        ]

        for (const entry of breakdownEntries) {
          if (!entry.amount.isZero()) {
            commissionBreakdown.set(entry.tag, toMoneyObject(entry.amount))
            amountCommission = amountCommission.add(entry.amount)
          }
        }

        const amountTotal = amountTransfer.add(amountCommission)

        const transaction = new TransactionTransferOut({
          fromAccount,
          toAccount: beneficiaryAccount,
          addVAT: false,
          balanceAvailableBefore: fromAccount.balanceAvailable,
          amount: toMoneyObject(amountTransfer),
          amountVAT: { amount: 0, precision: 2, currency: 'MXN' },
          amountTransfer: toMoneyObject(amountTransfer),
          amountCommission: toMoneyObject(amountCommission),
          amountTotal: toMoneyObject(amountTotal),
          commissionBreakdown,
          status: TransactionTransferOutStatus.New,
          executionDate: dayjs().format('YYYY-MM-DD'),
          beneficiaryEmail: '',
          notificationEmail: '',
          reference: `${Date.now()}`.slice(-7),
          description: 'Pago de comisiones',
          trackingCode: `${Date.now()}`,
          transactedAt: new Date(),
          commissionRequest: request._id
        })

        await transaction.save({ session })

        const reserveMovement = fromAccount.movement({
          type: 'capture',
          balanceWithheldDelta: amountTotal,
          transaction,
          comment: `Reserva comisiones ${transaction.reference}`
        })

        await reserveMovement.save({ session })
        await fromAccount.save({ session })

        request.status = CommissionRequestStatus.Approved
        await request.save({ session })

        requestAmountTransfer = amountTransfer.getAmount() / 100

        responseData = {
          requestId: request._id.toString(),
          transactionId: transaction._id.toString()
        }
      })

      // Send email notification after successful transaction
      if (agentEmail && agentName && requestAmount && requestAmountTransfer && requestFolio) {
        await emailService.sendCommissionRequestApproved({
          to: agentEmail,
          agentName,
          amount: requestAmount,
          amountTransfer: requestAmountTransfer,
          folio: requestFolio
        }).catch(err => {
          console.error('❌ Error sending approval email:', err)
          // Don't fail the request if email fails
        })
      }

      // Audit commission request approval
      auditService.log({
        action: AuditAction.CommissionRequestApproved,
        userId: req.user._id.toString(),
        userEmail: req.user.email,
        targetId: responseData.requestId,
        targetType: 'CommissionRequest',
        details: { transactionId: responseData.transactionId },
        req
      })

      // In-app notification for the commission agent
      if (agentEmail) {
        const userProfile = (await CommissionRequest.findById(responseData.requestId)
          .populate({ path: 'userProfile', populate: { path: 'user' } }))?.userProfile as any
        const agentUserId = userProfile?.user?._id?.toString()
        if (agentUserId) {
          notificationsService.create({
            userId: agentUserId,
            type: NotificationType.CommissionApproved,
            title: 'Solicitud de comision aprobada',
            message: `Tu solicitud de comision por $${requestAmount?.toLocaleString('es-MX')} ha sido aprobada.`,
            link: '/comisiones',
            metadata: { requestId: responseData.requestId, transactionId: responseData.transactionId },
          })
        }
      }

      return res.json({
        success: true,
        data: responseData,
        message: 'Solicitud aprobada'
      })
    } catch (error: any) {
      console.error('❌ Error approving commission request:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to approve commission request',
        message: error.message
      })
    } finally {
      session.endSession()
    }
  },

  async createCommissionRequest (req: AuthRequest, res: Response) {
    const session = await mongoose.startSession()
    try {
      // Parse and validate body
      const parsed = createCommissionRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Datos inválidos',
          message: parsed.error.issues.map((e: z.ZodIssue) => e.message).join(', ')
        })
      }

      const { amount, beneficiaryId } = parsed.data

      // Find the requester's commission agent profile
      const profile = await UserProfile.findOne({
        user: req.user._id,
        type: 'commissionAgent',
        isActive: true
      })

      if (!profile) {
        return res.status(403).json({
          success: false,
          error: 'No se encontró perfil de comisionista activo'
        })
      }

      // Find their active assignment
      const assignment = await CommissionAgentAssignment.findOne({
        userProfile: profile._id,
        isEnabled: true
      })

      if (!assignment) {
        return res.status(400).json({
          success: false,
          error: 'Comisionista sin asignación activa'
        })
      }

      // Find current month balance (or most recent)
      const currentMonth = dayjs().format('YYYY-MM')
      let balance = await CommissionAgentBalance.findOne({
        commissionAgentUserProfile: profile._id,
        key: currentMonth
      })

      if (!balance) {
        // Try to find the most recent balance
        balance = await CommissionAgentBalance.findOne({
          commissionAgentUserProfile: profile._id
        }).sort({ key: -1 })
      }

      if (!balance) {
        return res.status(400).json({
          success: false,
          error: 'No se encontró balance de comisiones'
        })
      }

      // Validate: amount <= available balance
      const amountCents = Math.round(amount * 100)
      const amountDinero = Dinero({ amount: amountCents, precision: 2, currency: 'MXN' })
      const availableBalance = toDinero(balance.requestableAmount).subtract(toDinero(balance.requestableAmountWithheld))

      if (amountDinero.greaterThan(availableBalance)) {
        return res.status(400).json({
          success: false,
          error: 'El monto solicitado excede el balance disponible',
          message: `Disponible: $${availableBalance.getAmount() / 100}, Solicitado: $${amount}`
        })
      }

      // Validate beneficiary belongs to this commission agent
      const beneficiary = await CommissionAgentBeneficiary.findOne({
        _id: beneficiaryId,
        userProfile: profile._id,
        status: 'active'
      })

      if (!beneficiary) {
        return res.status(400).json({
          success: false,
          error: 'Beneficiario no encontrado o no pertenece al comisionista'
        })
      }

      // Handle file uploads
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined

      let responseData: any
      await session.withTransaction(async () => {
        let invoicePDFId: mongoose.Types.ObjectId | undefined
        let invoiceXMLId: mongoose.Types.ObjectId | undefined

        if (files?.invoicePDF?.[0]) {
          const file = files.invoicePDF[0]
          const upload = new Upload({
            filename: file.originalname,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            path: `uploads/invoices/${Date.now()}-${file.originalname}`,
            uploadedBy: req.user._id
          })
          await upload.save({ session })
          invoicePDFId = upload._id as mongoose.Types.ObjectId
        }

        if (files?.invoiceXML?.[0]) {
          const file = files.invoiceXML[0]
          const upload = new Upload({
            filename: file.originalname,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            path: `uploads/invoices/${Date.now()}-${file.originalname}`,
            uploadedBy: req.user._id
          })
          await upload.save({ session })
          invoiceXMLId = upload._id as mongoose.Types.ObjectId
        }

        // Calculate amounts
        const amountWithheldVAT = Dinero({ amount: Math.round(amountCents * 0.16), precision: 2, currency: 'MXN' })
        const withheldIncomeTax = Dinero({ amount: Math.round(amountCents * 0.10), precision: 2, currency: 'MXN' })
        const transactionFeeWithVAT = Dinero({ amount: 800, precision: 2, currency: 'MXN' })
        const amountEarnings = Dinero({ amount: 0, precision: 2, currency: 'MXN' })
        const amountTransfer = amountDinero
          .subtract(amountWithheldVAT)
          .subtract(withheldIncomeTax)
          .subtract(transactionFeeWithVAT)

        const commissionRequest = new CommissionRequest({
          userProfile: profile._id,
          beneficiary: beneficiaryId,
          status: CommissionRequestStatus.New,
          amount: toMoneyObject(amountDinero),
          amountTransfer: toMoneyObject(amountTransfer),
          amountWithheldVAT: toMoneyObject(amountWithheldVAT),
          withheldIncomeTax: toMoneyObject(withheldIncomeTax),
          transactionFeeWithVAT: toMoneyObject(transactionFeeWithVAT),
          amountEarnings: toMoneyObject(amountEarnings),
          invoicePDF: invoicePDFId,
          invoiceXML: invoiceXMLId,
          commissionAgentBalance: balance!._id,
          createdAt: new Date()
        })

        await commissionRequest.save({ session })

        responseData = {
          requestId: commissionRequest._id.toString(),
          amount: amount,
          amountTransfer: amountTransfer.getAmount() / 100,
          amountWithheldVAT: amountWithheldVAT.getAmount() / 100,
          withheldIncomeTax: withheldIncomeTax.getAmount() / 100,
          transactionFeeWithVAT: transactionFeeWithVAT.getAmount() / 100,
          status: CommissionRequestStatus.New
        }
      })

      // Audit commission request creation
      auditService.log({
        action: AuditAction.CommissionRequestCreated,
        userId: req.user._id.toString(),
        userEmail: req.user.email,
        targetId: responseData.requestId,
        targetType: 'CommissionRequest',
        details: { amount, beneficiaryId },
        req
      })

      return res.status(201).json({
        success: true,
        data: responseData,
        message: 'Solicitud de comisión creada'
      })
    } catch (error: any) {
      console.error('Error creating commission request:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to create commission request',
        message: error.message
      })
    } finally {
      session.endSession()
    }
  },

  async rejectCommissionRequest (req: AuthRequest, res: Response) {
    try {
      const { id } = req.params

      const parsed = rejectCommissionRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Datos inválidos',
          message: parsed.error.issues.map((e: z.ZodIssue) => e.message).join(', ')
        })
      }

      const { rejectionMessage } = parsed.data

      const request = await CommissionRequest.findById(id)
        .populate({
          path: 'userProfile',
          populate: {
            path: 'user'
          }
        })

      if (!request) {
        return res.status(404).json({
          success: false,
          error: 'Solicitud no encontrada'
        })
      }

      if (request.status !== CommissionRequestStatus.New) {
        return res.status(400).json({
          success: false,
          error: 'Solo se pueden rechazar solicitudes con estatus "new"',
          message: `Estatus actual: ${request.status}`
        })
      }

      request.status = CommissionRequestStatus.Rejected
      request.rejectionMessage = rejectionMessage
      await request.save()

      // Get agent info for email
      const userProfile = request.userProfile as any
      const user = userProfile?.user as any
      const agentEmail = user?.email
      const agentName = user?.fullName || user?.email || userProfile?.rfc || 'Comisionista'
      const requestAmount = getMoneyAmount(request.amount) / 100
      const requestFolio = request._id.toString()

      // Send email notification
      if (agentEmail) {
        await emailService.sendCommissionRequestRejected({
          to: agentEmail,
          agentName,
          amount: requestAmount,
          folio: requestFolio,
          rejectionMessage
        }).catch(err => {
          console.error('❌ Error sending rejection email:', err)
          // Don't fail the request if email fails
        })
      }

      // Audit commission request rejection
      auditService.log({
        action: AuditAction.CommissionRequestRejected,
        userId: req.user._id.toString(),
        userEmail: req.user.email,
        targetId: request._id.toString(),
        targetType: 'CommissionRequest',
        details: { rejectionMessage },
        req
      })

      // In-app notification for the commission agent
      const agentUserId = user?._id?.toString()
      if (agentUserId) {
        notificationsService.create({
          userId: agentUserId,
          type: NotificationType.CommissionRejected,
          title: 'Solicitud de comision rechazada',
          message: `Tu solicitud de comision por $${requestAmount.toLocaleString('es-MX')} fue rechazada. Motivo: ${rejectionMessage}`,
          link: '/comisiones',
          metadata: { requestId: request._id.toString(), rejectionMessage },
        })
      }

      return res.json({
        success: true,
        data: {
          requestId: request._id.toString(),
          status: request.status
        },
        message: 'Solicitud rechazada'
      })
    } catch (error: any) {
      console.error('Error rejecting commission request:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to reject commission request',
        message: error.message
      })
    }
  }
}
