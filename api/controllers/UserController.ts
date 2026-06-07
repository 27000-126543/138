import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { hashPassword } from '../lib/password.js'
import { NotFoundError, ForbiddenError, ConflictError } from '../lib/errors.js'
import type { User, PaginatedResponse } from '../../shared/types.js'
import { UserRole } from '../../shared/types.js'
import { getDb } from '../db/index.js'

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  role: z.nativeEnum(UserRole).optional(),
  search: z.string().optional(),
})

export const createUserSchema = z.object({
  username: z.string().min(3, '用户名至少3个字符'),
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少6个字符'),
  role: z.nativeEnum(UserRole),
})

export const updateUserSchema = z.object({
  username: z.string().min(3).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
})

export const updateRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
})

export const listUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const currentUser = req.user
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenError('需要管理员权限')
    }

    const { page, size, role, search } = req.query as z.infer<
      typeof listUsersQuerySchema
    >

    const db = getDb()

    const conditions: string[] = []
    const params: unknown[] = []

    if (role) {
      conditions.push('role = ?')
      params.push(role)
    }
    if (search) {
      conditions.push('(username LIKE ? OR email LIKE ?)')
      params.push(`%${search}%`, `%${search}%`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const countResult = db
      .prepare(`SELECT COUNT(*) as count FROM users ${whereClause}`)
      .get(...params) as { count: number }

    const total = countResult.count

    const offset = (page - 1) * size
    const items = db
      .prepare(
        `SELECT id, username, email, role, created_at as createdAt, last_login as lastLogin FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, size, offset) as User[]

    const response: PaginatedResponse<User> = {
      items,
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    }

    res.status(200).json({
      success: true,
      data: response,
    })
  } catch (error) {
    next(error)
  }
}

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const currentUser = req.user
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenError('需要管理员权限')
    }

    const body = req.body as z.infer<typeof createUserSchema>

    const db = getDb()

    const existingUsername = db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(body.username)
    if (existingUsername) {
      throw new ConflictError('用户名已存在')
    }

    const existingEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(body.email)
    if (existingEmail) {
      throw new ConflictError('邮箱已存在')
    }

    const id = nanoid()
    const passwordHash = await hashPassword(body.password)
    const now = new Date().toISOString()

    db.prepare(
      'INSERT INTO users (id, username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(id, body.username, body.email, passwordHash, body.role, now)

    const user = db
      .prepare(
        'SELECT id, username, email, role, created_at as createdAt, last_login as lastLogin FROM users WHERE id = ?',
      )
      .get(id) as User

    res.status(201).json({
      success: true,
      data: user,
    })
  } catch (error) {
    next(error)
  }
}

export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const currentUser = req.user
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenError('需要管理员权限')
    }

    const { id } = req.params
    const body = req.body as z.infer<typeof updateUserSchema>

    const db = getDb()
    const existingUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    if (!existingUser) {
      throw new NotFoundError('用户不存在')
    }

    const updateData: Record<string, unknown> = {}
    if (body.username !== undefined) {
      const sameUsername = db
        .prepare('SELECT * FROM users WHERE username = ? AND id != ?')
        .get(body.username, id)
      if (sameUsername) {
        throw new ConflictError('用户名已存在')
      }
      updateData.username = body.username
    }
    if (body.email !== undefined) {
      const sameEmail = db
        .prepare('SELECT * FROM users WHERE email = ? AND id != ?')
        .get(body.email, id)
      if (sameEmail) {
        throw new ConflictError('邮箱已存在')
      }
      updateData.email = body.email
    }
    if (body.password !== undefined) {
      updateData.password_hash = await hashPassword(body.password)
    }

    if (Object.keys(updateData).length > 0) {
      const setClause = Object.keys(updateData).map((k) => `${k} = ?`).join(', ')
      db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).run(
        ...Object.values(updateData),
        id,
      )
    }

    const updatedUser = db
      .prepare(
        'SELECT id, username, email, role, created_at as createdAt, last_login as lastLogin FROM users WHERE id = ?',
      )
      .get(id) as User

    res.status(200).json({
      success: true,
      data: updatedUser,
    })
  } catch (error) {
    next(error)
  }
}

export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const currentUser = req.user
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenError('需要管理员权限')
    }

    const { id } = req.params

    const db = getDb()
    const existingUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined
    if (!existingUser) {
      throw new NotFoundError('用户不存在')
    }

    if (existingUser.id === currentUser.id) {
      throw new ConflictError('不能删除自己的账户')
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id)

    res.status(200).json({
      success: true,
      message: '用户删除成功',
    })
  } catch (error) {
    next(error)
  }
}

export const updateRole = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const currentUser = req.user
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenError('需要管理员权限')
    }

    const { id } = req.params
    const { role } = req.body as z.infer<typeof updateRoleSchema>

    const db = getDb()
    const existingUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined
    if (!existingUser) {
      throw new NotFoundError('用户不存在')
    }

    if (existingUser.id === currentUser.id) {
      throw new ConflictError('不能修改自己的角色')
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id)

    const updatedUser = db
      .prepare(
        'SELECT id, username, email, role, created_at as createdAt, last_login as lastLogin FROM users WHERE id = ?',
      )
      .get(id) as User

    res.status(200).json({
      success: true,
      data: updatedUser,
      message: '角色更新成功',
    })
  } catch (error) {
    next(error)
  }
}
