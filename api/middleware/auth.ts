import type { Request, Response, NextFunction } from 'express'
import { UserRole, type User } from '../../shared/types.js'
import { verifyToken, type JwtPayload } from '../lib/jwt.js'
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js'

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('No token provided'))
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = verifyToken(token)
    req.user = decoded
    next()
  } catch (error) {
    return next(new UnauthorizedError('Invalid or expired token'))
  }
}

export const requireRole = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'))
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError('Insufficient permissions', {
          required: roles,
          current: req.user.role,
        }),
      )
    }

    next()
  }
}
