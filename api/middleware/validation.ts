import type { Request, Response, NextFunction } from 'express'
import type { ZodSchema, ZodError } from 'zod'
import { ValidationError } from '../lib/errors.js'

type ValidationTarget = 'body' | 'query' | 'params'

export const validate = (
  schema: ZodSchema,
  target: ValidationTarget = 'body',
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[target]
      const validated = schema.parse(data)
      req[target] = validated
      next()
    } catch (error) {
      const zodError = error as ZodError
      const details = zodError.issues.reduce(
        (acc, issue) => {
          const path = issue.path.join('.') || 'root'
          acc[path] = issue.message
          return acc
        },
        {} as Record<string, string>,
      )

      next(new ValidationError('Validation failed', { fields: details }))
    }
  }
}

export const validateBody = (schema: ZodSchema) => validate(schema, 'body')
export const validateQuery = (schema: ZodSchema) => validate(schema, 'query')
export const validateParams = (schema: ZodSchema) => validate(schema, 'params')
