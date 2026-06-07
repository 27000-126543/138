import type { Request, Response, NextFunction } from 'express'
import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
} from '../lib/errors.js'

interface ErrorResponse {
  error: {
    code: number
    message: string
    details?: Record<string, unknown>
  }
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  let response: ErrorResponse

  if (error instanceof AppError) {
    response = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
    }
    res.status(error.code)
  } else {
    console.error('Unhandled error:', error)
    response = {
      error: {
        code: 500,
        message: 'Internal server error',
      },
    }
    res.status(500)
  }

  res.json(response)
}

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`))
}
