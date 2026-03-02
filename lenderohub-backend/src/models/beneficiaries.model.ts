import mongoose from 'mongoose'

import * as models from './index'
import * as accountsModels from './accounts.model'
import * as uploadsModels from './uploads'
import * as usersModels from './user.model'
import { logError, logger } from '../middlewares/logging'

/******************************************************************************
 * Common
 *****************************************************************************/

enum BeneficiaryType {
  CostCentre = 'costCentre',
  CommissionAgent = 'commissionAgent'
}

enum BeneficiaryStatus {
  Active = 'active',
  Deleted = 'deleted'
}

interface IBeneficiary {
  type: string
  name: string
  alias: string
  email: string
  rfc: string
  account: mongoose.Types.ObjectId | mongoose.HydratedDocument<accountsModels.IExternalAccount>
  userProfile: mongoose.Types.ObjectId | mongoose.HydratedDocument<any>
  status: BeneficiaryStatus
  lastModifiedBy?: mongoose.Types.ObjectId
}

type BeneficiaryModel = mongoose.Model<IBeneficiary>

const beneficiarySchema = new mongoose.Schema<IBeneficiary, BeneficiaryModel>({
  type: {
    type: String,
    enum: Object.values(BeneficiaryType),
    required: true
  },
  alias: {
    type: String,
    required: true
  },
  userProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserProfile'
  },
  status: {
    type: String,
    enum: Object.values(BeneficiaryStatus),
    required: true,
    default: BeneficiaryStatus.Active
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  collection: 'beneficiaries',
  discriminatorKey: 'type',
  timestamps: true
})

beneficiarySchema.virtual('account', {
  ref: 'ExternalAccount',
  localField: '_id',
  foreignField: 'beneficiary',
  justOne: true
})

const Beneficiary = mongoose.model<IBeneficiary, BeneficiaryModel>('Beneficiary', beneficiarySchema)

/******************************************************************************
 * CostCentre
 *****************************************************************************/

interface ICostCentreBeneficiary extends IBeneficiary {
  phoneNumber: string
  isProvider: boolean
  fiscalAddress: models.IFiscalAddress
  costCentre: mongoose.Types.ObjectId
  documentUpload: mongoose.Types.ObjectId | mongoose.HydratedDocument<uploadsModels.IUpload>
}

type CostCentreBeneficiaryModel = mongoose.Model<ICostCentreBeneficiary>

const costCentreBeneficiarySchema = new mongoose.Schema<ICostCentreBeneficiary, CostCentreBeneficiaryModel>({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  rfc: {
    type: String
  },
  phoneNumber: {
    type: String,
    match: /^\d{10}$/
  },
  isProvider: {
    type: Boolean,
    required: true
  },
  fiscalAddress: models.fiscalAddressDocument,
  costCentre: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CostCentre'
  },
  documentUpload: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Upload'
  }
})

const CostCentreBeneficiary = Beneficiary.discriminator(
  'CostCentreBeneficiary',
  costCentreBeneficiarySchema,
  BeneficiaryType.CostCentre
)

/******************************************************************************
 * CommissionAgent
 *****************************************************************************/

interface ICommissionAgentBeneficiary extends IBeneficiary {
  userProfile: mongoose.Types.ObjectId | mongoose.HydratedDocument<any>
}

type CommissionAgentBeneficiaryModel = mongoose.Model<ICommissionAgentBeneficiary>

const commissionAgentBeneficiarySchema = new mongoose.Schema<ICommissionAgentBeneficiary, CommissionAgentBeneficiaryModel>({
  userProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommissionAgentUserProfile'
  }
})

commissionAgentBeneficiarySchema.pre('find', function () {
  this.populate({ path: 'userProfile', populate: 'user' }).catch(error => logger.error(error))
})

commissionAgentBeneficiarySchema.virtual('name')
  .get(function () {
    if (this.populated('userProfile') === undefined) {
      logError('Cannot read name from beneficiary userProfile is not populated')
      return ''
    }
    const commissionAgentProfile = this.userProfile as mongoose.HydratedDocument<any>
    if (commissionAgentProfile.populated('user') === undefined) {
      logError('Cannot read name from beneficiary userProfile.user is not populated')
      return ''
    }
    const associatedUser = commissionAgentProfile.user as mongoose.HydratedDocument<usersModels.IUser>
    return associatedUser.fullName
  })

commissionAgentBeneficiarySchema.virtual('email')
  .get(function () {
    if (this.populated('userProfile') === undefined) {
      logError('Cannot read email from beneficiary userProfile is not populated')
      return ''
    }
    const commissionAgentProfile = this.userProfile as mongoose.HydratedDocument<any>
    if (commissionAgentProfile.populated('user') === undefined) {
      logError('Cannot read email from beneficiary userProfile.user is not populated')
      return ''
    }
    const associatedUser = commissionAgentProfile.user as mongoose.HydratedDocument<usersModels.IUser>
    return associatedUser.email
  })

commissionAgentBeneficiarySchema.virtual('rfc')
  .get(function () {
    if (this.populated('userProfile') === undefined) {
      return undefined
    }
    const commissionAgentProfile = this.userProfile as mongoose.HydratedDocument<any>
    return commissionAgentProfile.rfc
  })

const CommissionAgentBeneficiary = Beneficiary.discriminator(
  'CommissionAgentBeneficiary',
  commissionAgentBeneficiarySchema,
  BeneficiaryType.CommissionAgent
)

export {
  IBeneficiary,
  BeneficiaryType,
  BeneficiaryStatus,
  Beneficiary,
  ICostCentreBeneficiary,
  CostCentreBeneficiary,
  ICommissionAgentBeneficiary,
  CommissionAgentBeneficiary
}

