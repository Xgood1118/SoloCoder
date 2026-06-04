import { Request, Response, NextFunction } from 'express'
import { ApiResponse } from '../types'

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  console.error('Error:', error)

  if (error.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as unknown as { code: string; meta?: { target?: string[] } }
    if (prismaError.code === 'P2002') {
      const target = prismaError.meta?.target?.join(', ') || '字段'
      return res.status(400).json({
        success: false,
        error: `${target}已存在`,
      })
    }
    if (prismaError.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: '记录不存在',
      })
    }
  }

  if (error.name === 'ZodError') {
    const zodError = error as unknown as { issues: { message: string; path: string[] }[] }
    const errors = zodError.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    )
    return res.status(400).json({
      success: false,
      error: '数据验证失败',
      message: errors.join('; '),
    })
  }

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
  })
}

export const notFoundHandler = (
  req: Request,
  res: Response<ApiResponse>
) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
  })
}
