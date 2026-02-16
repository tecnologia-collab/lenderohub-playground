import mongoose from 'mongoose'

// ============================================================================
// ENUMS
// ============================================================================

enum ClientType {
  Corporate = 'corporate',
  Regular = 'regular'
}

enum MaxCostCentresDigits {
  One = 1,    // max 9 cost centres
  Two = 2,    // max 99 cost centres
  Three = 3,  // max 999 cost centres
  Four = 4    // max 9999 cost centres
}

// ============================================================================
// INTERFACES - Contact & Fiscal
// ============================================================================

interface IContactInfo {
  name?: string
  lastname?: string
  secondLastname?: string
  email?: string
  phoneNumbers?: string[]
}

interface IFiscalAddress {
  street?: string
  exteriorNumber?: string
  interiorNumber?: string
  neighborhood?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

// ============================================================================
// BASE CLIENT INTERFACE
// ============================================================================

interface IClient extends mongoose.Document {
  // Identification
  type: ClientType
  name: string
  alias?: string
  rfc?: string

  // Contact & Fiscal
  contact?: IContactInfo
  fiscalAddress?: IFiscalAddress

  // Status
  active: boolean

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// CORPORATE CLIENT INTERFACE
// ============================================================================

interface ICorporateClient extends IClient {
  // Cost Centre Configuration
  prefix: string                          // e.g., "LC" for Lendero Capital
  maxCostCentres: MaxCostCentresDigits    // 1-4 digits (9, 99, 999, 9999)

  // Finco Credentials (encrypted in production)
  fincoClientId?: string
  fincoClientSecret?: string              // Should be encrypted
  fincoClientBankAdapterId?: string
  fincoBankId?: string
  fincoAccountId?: string                 // Main account ID in Finco
  fincoInstrumentId?: string              // Main instrument for Money Out

  // STP Credentials (future - structure ready)
  stpEmpresa?: string
  stpClavePrivada?: string                // Should be encrypted
  stpCertificado?: string

  // Virtuals (populated)
  clients?: mongoose.HydratedDocument<IRegularClient>[]
  costCentres?: mongoose.Types.ObjectId[]
  clusters?: mongoose.Types.ObjectId[]
  commissionAgents?: mongoose.Types.ObjectId[]
}

// ============================================================================
// REGULAR CLIENT INTERFACE
// ============================================================================

interface IRegularClient extends IClient {
  // Parent reference
  corporateClient: mongoose.Types.ObjectId | mongoose.HydratedDocument<ICorporateClient>

  // Virtuals (populated)
  administratorProfiles?: mongoose.Types.ObjectId[]
}

// ============================================================================
// MODEL TYPES
// ============================================================================

type ClientModel = mongoose.Model<IClient>
type CorporateClientModel = mongoose.Model<ICorporateClient>
type RegularClientModel = mongoose.Model<IRegularClient>

// ============================================================================
// SCHEMAS - Contact & Fiscal (embedded)
// ============================================================================

const contactInfoSchema = new mongoose.Schema<IContactInfo>({
  name: { type: String },
  lastname: { type: String },
  secondLastname: { type: String },
  email: { type: String },
  phoneNumbers: [{ type: String }]
}, { _id: false })

const fiscalAddressSchema = new mongoose.Schema<IFiscalAddress>({
  street: { type: String },
  exteriorNumber: { type: String },
  interiorNumber: { type: String },
  neighborhood: { type: String },
  city: { type: String },
  state: { type: String },
  postalCode: { type: String },
  country: { type: String, default: 'México' }
}, { _id: false })

// ============================================================================
// BASE CLIENT SCHEMA
// ============================================================================

const clientSchema = new mongoose.Schema<IClient, ClientModel>({
  type: {
    type: String,
    enum: Object.values(ClientType),
    required: true
  },
  name: {
    type: String,
    required: true
  },
  alias: {
    type: String
  },
  rfc: {
    type: String,
    uppercase: true,
    trim: true
  },
  contact: {
    type: contactInfoSchema
  },
  fiscalAddress: {
    type: fiscalAddressSchema
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  collection: 'clients',
  discriminatorKey: 'type',
  timestamps: true
})

// Index for faster lookups
clientSchema.index({ type: 1, active: 1 })
clientSchema.index({ rfc: 1 }, { sparse: true })

const Client = mongoose.model<IClient, ClientModel>('Client', clientSchema)

// ============================================================================
// CORPORATE CLIENT SCHEMA (Discriminator)
// ============================================================================

const corporateClientSchema = new mongoose.Schema<ICorporateClient, CorporateClientModel>({
  // Cost Centre Configuration
  prefix: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    maxlength: 4
  },
  maxCostCentres: {
    type: Number,
    enum: Object.values(MaxCostCentresDigits).filter(v => typeof v === 'number'),
    required: true,
    default: MaxCostCentresDigits.Four
  },

  // Finco Credentials
  fincoClientId: {
    type: String,
    trim: true
  },
  fincoClientSecret: {
    type: String  // TODO: Encrypt in production
  },
  fincoClientBankAdapterId: {
    type: String,
    trim: true
  },
  fincoBankId: {
    type: String,
    trim: true
  },
  fincoAccountId: {
    type: String,
    trim: true
  },
  fincoInstrumentId: {
    type: String,
    trim: true
  },

  // STP Credentials (future)
  stpEmpresa: {
    type: String,
    trim: true
  },
  stpClavePrivada: {
    type: String  // TODO: Encrypt in production
  },
  stpCertificado: {
    type: String
  }
})

// Virtuals for Corporate Client
corporateClientSchema.virtual('clients', {
  ref: 'RegularClient',
  localField: '_id',
  foreignField: 'corporateClient'
})

corporateClientSchema.virtual('costCentres', {
  ref: 'CostCentre',
  localField: '_id',
  foreignField: 'client',
  match: { disabled: { $ne: true } }
})

corporateClientSchema.virtual('allCostCentres', {
  ref: 'CostCentre',
  localField: '_id',
  foreignField: 'client'
})

corporateClientSchema.virtual('defaultCostCentre', {
  ref: 'CostCentre',
  localField: '_id',
  foreignField: 'client',
  match: { default: true },
  justOne: true
})

corporateClientSchema.virtual('clusters', {
  ref: 'Cluster',
  localField: '_id',
  foreignField: 'client'
})

corporateClientSchema.virtual('commissionAgents', {
  ref: 'CommissionAgentUserProfile',
  localField: '_id',
  foreignField: 'client'
})

// Index for Finco lookup
corporateClientSchema.index({ fincoClientId: 1 }, { sparse: true })
corporateClientSchema.index({ prefix: 1 }, { unique: true })

const CorporateClient = Client.discriminator<ICorporateClient, CorporateClientModel>(
  'CorporateClient',
  corporateClientSchema,
  ClientType.Corporate
)

// ============================================================================
// REGULAR CLIENT SCHEMA (Discriminator)
// ============================================================================

const regularClientSchema = new mongoose.Schema<IRegularClient, RegularClientModel>({
  corporateClient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CorporateClient',
    required: true
  }
})

// Virtuals for Regular Client
regularClientSchema.virtual('administratorProfiles', {
  ref: 'AdministratorUserProfile',
  localField: '_id',
  foreignField: 'client'
})

// Index for parent lookup
regularClientSchema.index({ corporateClient: 1 })

const RegularClient = Client.discriminator<IRegularClient, RegularClientModel>(
  'RegularClient',
  regularClientSchema,
  ClientType.Regular
)

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the maximum number of cost centres based on maxCostCentres digits
 * @param digits - Number of digits (1-4)
 * @returns Maximum number of cost centres (9, 99, 999, 9999)
 */
function getMaxCostCentresCount(digits: MaxCostCentresDigits): number {
  return Math.pow(10, digits) - 1
}

/**
 * Format cost centre code with proper padding
 * @param prefix - Client prefix (e.g., "LC")
 * @param code - Numeric code
 * @param digits - Number of digits for padding
 * @returns Formatted code (e.g., "LC0001")
 */
function formatCostCentreCode(prefix: string, code: number, digits: MaxCostCentresDigits): string {
  return `${prefix}${code.toString().padStart(digits, '0')}`
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Enums
  ClientType,
  MaxCostCentresDigits,

  // Interfaces
  IContactInfo,
  IFiscalAddress,
  IClient,
  ICorporateClient,
  IRegularClient,

  // Models
  Client,
  CorporateClient,
  RegularClient,

  // Helper functions
  getMaxCostCentresCount,
  formatCostCentreCode
}
