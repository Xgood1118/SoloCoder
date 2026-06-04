import { Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { AuthRequest, JwtPayload, Role } from '../types'
import prisma from '../lib/prisma'

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: '未提供认证令牌',
    })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, config.jwtSecret as string) as JwtPayload

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true, role: true },
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        error: '用户不存在',
      })
    }

    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: '认证令牌无效或已过期',
    })
  }
}

export const requireRoles = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: '未认证',
      })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: '权限不足',
      })
    }

    next()
  }
}
