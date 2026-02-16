import mongoose from 'mongoose'

export interface IUserBeneficiary extends mongoose.Document {
  user: mongoose.Types.ObjectId
  instrumentId: string
  createdAt: Date
  updatedAt: Date
}

const userBeneficiarySchema = new mongoose.Schema<IUserBeneficiary>({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  instrumentId: {
    type: String,
    required: true,
    trim: true,
    index: true
  }
}, {
  collection: 'userBeneficiaries',
  timestamps: true
})

userBeneficiarySchema.index({ user: 1, instrumentId: 1 }, { unique: true })

export const UserBeneficiary = mongoose.model<IUserBeneficiary>('UserBeneficiary', userBeneficiarySchema)
