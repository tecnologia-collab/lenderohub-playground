// src/models/shared/enums.ts
// Shared enums and schema helpers to avoid circular dependencies between models

import mongoose from 'mongoose'

/**
 * Provider enum - defines which payment provider handles operations
 * Used by CostCentre and InternalAccount
 */
export enum Provider {
  Finco = 'finco',
  STP = 'stp'
}

/**
 * Rule type for commercial rules
 */
export enum RuleType {
  NotApplicable = 'na',
  Percentage = 'percentage',
  Fixed = 'fixed'
}

/**
 * Rule interface for commercial rules
 */
export interface IRule {
  type: RuleType
  amount?: any
  value?: number
}

/**
 * Rule schema definition for mongoose
 * Used in CostCentre and Transaction models
 */
export const ruleModel = {
  type: {
    type: String,
    enum: Object.values(RuleType),
    default: RuleType.NotApplicable
  },
  amount: {
    type: mongoose.Schema.Types.Mixed
  },
  value: {
    type: Number
  }
}
