// src/schemas/clients.ts
import Joi from 'joi'

export const clientSchemas = {
  create: Joi.object({
    name: Joi.string().required(),
    legalName: Joi.string().required(),
    rfc: Joi.string().required()
  }),
  update: Joi.object({
    name: Joi.string(),
    legalName: Joi.string(),
    rfc: Joi.string()
  }).min(1)
}

export default clientSchemas
