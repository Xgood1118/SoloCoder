import { Response } from 'express'
import { AuthRequest, ApiResponse } from '../types'
import prisma from '../lib/prisma'
import { notificationService } from '../services/notificationService'

export const notificationController = {
  async getMyNotifications(req: AuthRequest, res: Response<ApiResponse>) {
    const userId = req.user!.userId
    const { page = 1, pageSize = 20, isRead } = req.query

    const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string)
    const take = parseInt(pageSize as string)

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId,
          isRead: isRead !== undefined ? isRead === 'true' : undefined,
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({
        where: {
          userId,
          isRead: isRead !== undefined ? isRead === 'true' : undefined,
        },
      }),
    ])

    const unreadCount = await notificationService.getUnreadCount(userId)

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          total,
          page: parseInt(page as string),
          pageSize: take,
          totalPages: Math.ceil(total / take),
        },
        unreadCount,
      },
    })
  },

  async getUnreadCount(req: AuthRequest, res: Response<ApiResponse>) {
    const userId = req.user!.userId
    const count = await notificationService.getUnreadCount(userId)

    res.json({
      success: true,
      data: { count },
    })
  },

  async markAsRead(req: AuthRequest, res: Response<ApiResponse>) {
    const { id } = req.params
    const userId = req.user!.userId

    await notificationService.markAsRead(id, userId)

    res.json({
      success: true,
      message: '已标记为已读',
    })
  },

  async markAllAsRead(req: AuthRequest, res: Response<ApiResponse>) {
    const userId = req.user!.userId

    await notificationService.markAllAsRead(userId)

    res.json({
      success: true,
      message: '全部标记为已读',
    })
  },
}
