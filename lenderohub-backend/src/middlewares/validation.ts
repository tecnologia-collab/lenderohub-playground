// src/middlewares/validation.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, z } from 'zod';
import { logger } from './logging';

export function validateRequest(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Simplemente pasar todo y dejar que Zod valide lo que necesita
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error: any) {
      logger.error('Validation error:', error);
      
      // Formatear mejor el error
      let errorDetails = 'Error de validación';
      if (error.errors && Array.isArray(error.errors)) {
        errorDetails = error.errors.map((e: any) => ({
          campo: e.path.join('.'),
          mensaje: e.message
        }));
      } else if (error.message) {
        errorDetails = error.message;
      }
      
      return res.status(400).json({
        error: 'Datos inválidos',
        details: errorDetails
      });
    }
  };
}