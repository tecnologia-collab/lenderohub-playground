import * as dinero from 'dinero.js'
import mongoose from 'mongoose'

import * as accountsModels from './accounts.model'
import * as clientsModels from './clients.model'
import * as beneficiariesModels from './beneficiaries.model'
import * as commissionAgentAssignmentsModels from './commissionAgentAssignments.model'
import * as costCentreAccumulatorsModels from './costCentreAccumulators.model'
import * as monthlyChargesModels from './monthlyCharges.model'
import * as clustersModels from './clusters.model'
import { Provider, RuleType, IRule, ruleModel } from './shared/enums'

// Re-export for backwards compatibility
export { Provider, RuleType, IRule, ruleModel }

// ============================================================================
// Contact & Fiscal Data Interfaces (for Cost Centre)
// ============================================================================

interface ICostCentreContact {
  name?: string
  lastname?: string
  secondLastname?: string
  email?: string
  phoneNumbers?: string[]
}

interface ICostCentreFiscalAddress {
  street?: string
  exteriorNumber?: string
  interiorNumber?: string
  neighborhood?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

interface ICostCentreTransactionProfile {
  limitIn: any
  opsIn: number
  limitOut: any
  opsOut: number
}

interface ICostCentreCommercialRules {
  in: IRule
  out: IRule
  monthlyFee: IRule
  transactionFee: any
  minimumBalanceNewAccounts: dinero.Dinero
  maxCashBagsPerSubaccount: number
}

interface ICostCentre {
  // Fields - Identification
  _id: mongoose.Types.ObjectId
  alias: string
  client: mongoose.Types.ObjectId | mongoose.HydratedDocument<clientsModels.IClient>
  code: string
  shortName: string
  nextAccountCode: number
  default: boolean

  // Fields - Contact & Fiscal Data
  contact?: ICostCentreContact
  rfc?: string
  fiscalAddress?: ICostCentreFiscalAddress

  // Fields - Provider (NEW)
  provider: Provider

  // Fields - Finco Integration (NEW)
  fincoCustomerId?: string              // UUID del Customer/BU en Finco
  fincoCentralizerAccountId?: string    // UUID de la cuenta centralizadora
  fincoCentralizerInstrumentId?: string // Instrument de la cuenta centralizadora
  fincoClabeNumber?: string             // CLABE de la cuenta centralizadora

  // Fields - STP Integration (Future)
  stpCuentaOrdenante?: string
  stpClabeOrdenante?: string
  stpRfcOrdenante?: string

  // Fields - Configuration
  transactionProfile: ICostCentreTransactionProfile
  commercialRules: ICostCentreCommercialRules
  cashManagementEnabled: boolean
  disabled: boolean
  cluster?: mongoose.Types.ObjectId | mongoose.HydratedDocument<clustersModels.ICluster>
  lastModifiedBy?: mongoose.Types.ObjectId

  // Virtuals
  concentrationAccount: mongoose.HydratedDocument<accountsModels.IInternalAccount>
  accounts: mongoose.HydratedDocument<accountsModels.IInternalAccount>[]
  accumulators: mongoose.HydratedDocument<costCentreAccumulatorsModels.ICostCentreAccumulator>[]
  commissionAgentAssignment: mongoose.HydratedDocument<commissionAgentAssignmentsModels.ICommissionAgentAssignment>
  commissionAgentAssignments: mongoose.HydratedDocument<commissionAgentAssignmentsModels.ICommissionAgentAssignment>[]
  monthlyCharges: mongoose.HydratedDocument<monthlyChargesModels.IMonthlyCharge>[]
  virtualBags: mongoose.HydratedDocument<accountsModels.IVirtualBagAccount>[]

  // Methods
  hasUnpaidMonthlyCharges: () => boolean
  getUserProfileBeneficiaries: (userProfileId: mongoose.Types.ObjectId) => Promise<mongoose.HydratedDocument<beneficiariesModels.ICostCentreBeneficiary>[]>
}

interface CostCentreModel extends mongoose.Model<ICostCentre> {
  formatCommercialRule: (type: RuleType, amount: mongoose.Schema.Types.Mixed, value: number) => IRule
}

// Embedded schemas for contact and fiscal data
const costCentreContactSchema = new mongoose.Schema<ICostCentreContact>({
  name: { type: String, trim: true },
  lastname: { type: String, trim: true },
  secondLastname: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  phoneNumbers: [{ type: String, trim: true }]
}, { _id: false })

const costCentreFiscalAddressSchema = new mongoose.Schema<ICostCentreFiscalAddress>({
  street: { type: String, trim: true },
  exteriorNumber: { type: String, trim: true },
  interiorNumber: { type: String, trim: true },
  neighborhood: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  postalCode: { type: String, trim: true },
  country: { type: String, trim: true, default: 'México' }
}, { _id: false })

const costCentreSchema = new mongoose.Schema<ICostCentre, CostCentreModel>({
  // Identification
  alias: {
    type: String,
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
  },
  code: {
    type: String,
    required: true
  },
  shortName: {
    type: String,
    required: true
  },
  nextAccountCode: {
    type: Number,
    required: true,
    default: 0
  },
  default: {
    type: Boolean,
    default: false
  },

  // Contact & Fiscal Data
  contact: {
    type: costCentreContactSchema
  },
  rfc: {
    type: String,
    trim: true,
    uppercase: true
  },
  fiscalAddress: {
    type: costCentreFiscalAddressSchema
  },

  // Provider (NEW)
  provider: {
    type: String,
    enum: Object.values(Provider),
    required: true,
    default: Provider.Finco
  },

  // Finco Integration (NEW)
  fincoCustomerId: {
    type: String,
    trim: true,
    sparse: true
  },
  fincoCentralizerAccountId: {
    type: String,
    trim: true
  },
  fincoCentralizerInstrumentId: {
    type: String,
    trim: true
  },
  fincoClabeNumber: {
    type: String,
    trim: true,
    minlength: 18,
    maxlength: 18
  },

  // STP Integration (Future)
  stpCuentaOrdenante: {
    type: String,
    trim: true
  },
  stpClabeOrdenante: {
    type: String,
    trim: true,
    minlength: 18,
    maxlength: 18
  },
  stpRfcOrdenante: {
    type: String,
    trim: true,
    uppercase: true
  },

  // Configuration
  transactionProfile: {
    limitIn: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    opsIn: {
      type: Number,
      required: true
    },
    limitOut: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    opsOut: {
      type: Number,
      required: true
    }
  },
  commercialRules: {
    in: ruleModel,
    out: ruleModel,
    monthlyFee: ruleModel,
    transactionFee: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: function (): dinero.DineroObject {
        return {
          amount: 450,
          precision: 2,
          currency: 'MXN'
        }
      }
    },
    minimumBalanceNewAccounts: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: function (): dinero.DineroObject {
        return {
          amount: 0,
          precision: 2,
          currency: 'MXN'
        }
      }
    },
    maxCashBagsPerSubaccount: {
      type: Number,
      default: 4
    }
  },
  cashManagementEnabled: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  cluster: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cluster'
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  methods: {
    hasUnpaidMonthlyCharges (): boolean {
      return this.monthlyCharges.some(monthlyCharge => monthlyCharge.status === monthlyChargesModels.MonthlyChargeStatus.Unpaid)
    },
    async getUserProfileBeneficiaries (userProfileId: mongoose.ObjectId): Promise<mongoose.HydratedDocument<beneficiariesModels.ICostCentreBeneficiary>[]> {
      return await beneficiariesModels.CostCentreBeneficiary.find({
        costCentre: this._id,
        userProfile: userProfileId,
        status: beneficiariesModels.BeneficiaryStatus.Active
      }).populate('account')
    }
  },
  collection: 'costCentres',
  timestamps: true
})

costCentreSchema.virtual('concentrationAccount', {
  ref: 'InternalAccount',
  localField: '_id',
  foreignField: 'costCentre',
  match: () => ({ tag: accountsModels.InternalAccountTag.Concentration }),
  justOne: true
})

costCentreSchema.virtual('accounts', {
  ref: 'InternalAccount',
  localField: '_id',
  foreignField: 'costCentre'
})

costCentreSchema.virtual('accumulators', {
  ref: 'CostCentreAccumulator',
  localField: '_id',
  foreignField: 'costCentre'
})

costCentreSchema.virtual('commissionAgentAssignment', {
  ref: 'CommissionAgentAssignment',
  localField: '_id',
  foreignField: 'costCentre',
  match: () => ({ isEnabled: true }),
  justOne: true
})

costCentreSchema.virtual('commissionAgentAssignments', {
  ref: 'CommissionAgentAssignment',
  localField: '_id',
  foreignField: 'costCentre',
  match: () => ({ isEnabled: true })
})

costCentreSchema.virtual('monthlyCharges', {
  ref: 'MonthlyCharge',
  localField: '_id',
  foreignField: 'costCentre'
})

costCentreSchema.virtual('virtualBags', {
  ref: 'VirtualBagAccount',
  localField: '_id',
  foreignField: 'costCentre'
})

costCentreSchema.static('formatCommercialRule', function (type: RuleType, amount: mongoose.Schema.Types.Mixed, value: number): IRule {
  const rule: IRule = { type }
  if (type === RuleType.Fixed) {
    rule.amount = amount
  }
  if (type === RuleType.Percentage) {
    rule.value = value
  }
  return rule
})

// Indexes for better query performance
costCentreSchema.index({ client: 1, disabled: 1 })
costCentreSchema.index({ client: 1, code: 1 }, { unique: true })
costCentreSchema.index({ provider: 1 })
costCentreSchema.index({ fincoCustomerId: 1 }, { sparse: true })
costCentreSchema.index({ fincoClabeNumber: 1 }, { sparse: true })

const CostCentre = mongoose.model<ICostCentre, CostCentreModel>('CostCentre', costCentreSchema)

export {
  // Interfaces
  ICostCentre,
  ICostCentreTransactionProfile,
  ICostCentreCommercialRules,
  ICostCentreContact,
  ICostCentreFiscalAddress,
  // Models
  CostCentre
}
// Note: Provider, RuleType, IRule, and ruleModel are exported at the top of the file

