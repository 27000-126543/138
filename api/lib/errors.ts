export class AppError extends Error {
  code: number
  details?: Record<string, unknown>

  constructor(message: string, code: number, details?: Record<string, unknown>) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.details = details
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: Record<string, unknown>) {
    super(message, 404, details)
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: Record<string, unknown>) {
    super(message, 400, details)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: Record<string, unknown>) {
    super(message, 401, details)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: Record<string, unknown>) {
    super(message, 403, details)
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: Record<string, unknown>) {
    super(message, 409, details)
  }
}
