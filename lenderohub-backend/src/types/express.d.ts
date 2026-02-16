// src/types/express.d.ts
import { Types } from 'mongoose'
import { IUser } from '../models/user.model'

declare global {
  namespace Express {
    interface Request {
      // Usuario autenticado (agregado por auth middleware)
      user?: IUser & { _id: Types.ObjectId }
      
      // Sesión (agregado por auth middleware)
      session: {
        id?: string
        verified?: boolean
        activeUserProfile?: { _id: Types.ObjectId; type: string }
        activeCostCentre?: { _id: Types.ObjectId }
        activeClient?: { _id: Types.ObjectId }
      }
      
      // Request body validado por Joi (agregado por validation middleware)
      validBody?: Record<string, any>
      
      // Trace ID para logging (agregado por logging middleware)
      traceId?: string
    }
    
    // Tipos de archivos subidos con Multer
    namespace Multer {
      interface File {
        fieldname: string
        originalname: string
        encoding: string
        mimetype: string
        size: number
        buffer: Buffer
        path: string
      }
    }
  }
}

export {}
