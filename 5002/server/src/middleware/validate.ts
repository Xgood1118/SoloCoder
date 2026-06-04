import { Request, Response, NextFunction } from 'express'
import { Schema, ZodError } from 'zod'
import { ApiResponse } from '../types'

export const validate = (schema: Schema) => {
  return (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      })
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map(
          (issue) => `${issue.path.join('.')}: ${issue.message}`
        )
        return res.status(400).json({
          success: false,
          error: '数据验证失败',
          message: errors.join('; '),
        })
      }
      next(error)
    }
  }
}
