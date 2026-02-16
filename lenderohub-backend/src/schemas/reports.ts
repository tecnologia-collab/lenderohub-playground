// src/schemas/reports.ts
import Joi from 'joi'

export const reportSchemas = {
  transactions: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(),
    accountId: Joi.string()
  }),
  balance: Joi.object({
    date: Joi.date().iso(),
    accountId: Joi.string()
  })
}

export default reportSchemas
