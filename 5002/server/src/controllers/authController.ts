import { Response } from 'express'
import { z } from 'zod'
import { AuthRequest, ApiResponse } from '../types'
import { authService } from '../services/authService'
import prisma from '../lib/prisma'

const loginSchema = z.object({
  body: z.object({
    username: z.string().min(1, '用户名不能为空'),
    password: z.string().min(1, '密码不能为空'),
  }),
})

export const authController = {
  login: [
    { schema: loginSchema },
    async (req: AuthRequest, res: Response<ApiResponse>) => {
      const { username, password } = req.body
      const result = await authService.login(username, password)
      res.json({
        success: true,
        data: result,
        message: '登录成功',
      })
    },
  ],

  async getCurrentUser(req: AuthRequest, res: Response<ApiResponse>) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: '未认证',
      })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        email: true,
        phone: true,
        employeeId: true,
        studentId: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    res.json({
      success: true,
      data: user,
    })
  },
}
