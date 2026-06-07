import jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'
import { config } from '../config/index.js'
import type { User } from '../../shared/types.js'

export interface JwtPayload extends Omit<User, 'createdAt' | 'lastLogin'> {
  iat?: number
  exp?: number
}

export const signToken = (user: JwtPayload): string => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
    config.jwtSecret,
    {
      expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
    },
  )
}

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwtSecret) as JwtPayload
}
