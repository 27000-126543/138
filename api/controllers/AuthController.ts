import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { userRepository } from '../repositories/UserRepository.js'
import { signToken, type JwtPayload } from '../lib/jwt.js'
import { verifyPassword } from '../lib/password.js'
import { UnauthorizedError, NotFoundError } from '../lib/errors.js'
import type { User } from '../../shared/types.js'
import { getDb } from '../db/index.js'

export const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
})

export interface LoginResponse {
  token: string
  user: Omit<User, 'passwordHash'>
}

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { username, password } = req.body

    const db = getDb()
    const userWithPassword = db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username) as (User & { password_hash: string }) | undefined

    if (!userWithPassword) {
      throw new UnauthorizedError('用户名或密码错误')
    }

    const isValid = await verifyPassword(password, userWithPassword.password_hash)
    if (!isValid) {
      throw new UnauthorizedError('用户名或密码错误')
    }

    const user: User = {
      id: userWithPassword.id,
      username: userWithPassword.username,
      email: userWithPassword.email,
      role: userWithPassword.role,
      createdAt: userWithPassword.createdAt,
      lastLogin: userWithPassword.lastLogin,
    }

    const now = new Date().toISOString()
    userRepository.updateLastLogin(user.id, now)

    const payload: JwtPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    }

    const token = signToken(payload)

    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          lastLogin: now,
        },
      },
    })
  } catch (error) {
    next(error)
  }
}

export const getCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.id
    if (!userId) {
      throw new UnauthorizedError('未登录')
    }

    const user = userRepository.findById(userId)
    if (!user) {
      throw new NotFoundError('用户不存在')
    }

    res.status(200).json({
      success: true,
      data: user,
    })
  } catch (error) {
    next(error)
  }
}

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      message: '登出成功',
    })
  } catch (error) {
    next(error)
  }
}
