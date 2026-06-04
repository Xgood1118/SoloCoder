import { Response } from 'express'
import { z } from 'zod'
import { AuthRequest, ApiResponse, ScheduleConflictStrategy } from '../types'
import prisma from '../lib/prisma'
import { scheduleConflictService } from '../services/scheduleConflictService'
import { notificationService } from '../services/notificationService'

export const createCourseSchema = z.object({
  body: z.object({
    name: z.string().min(1, '课程名称不能为空'),
    code: z.string().min(1, '课程代码不能为空'),
    credits: z.number().int().min(1, '学分至少为1'),
    departmentId: z.string().min(1, '院系不能为空'),
    teacherId: z.string().min(1, '授课教师不能为空'),
    semesterId: z.string().min(1, '学期不能为空'),
    minStudents: z.number().int().min(1, '最低开课人数至少为1').optional(),
    maxStudents: z.number().int().min(1, '最大选课人数至少为1').optional(),
    description: z.string().optional(),
  }),
})

const createScheduleSchema = z.object({
  body: z.object({
    courseId: z.string().min(1, '课程不能为空'),
    classroomId: z.string().min(1, '教室不能为空'),
    dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
    startPeriod: z.number().int().min(1).max(12),
    endPeriod: z.number().int().min(1).max(12),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    forceCreate: z.boolean().optional(),
  }),
})

export const courseController = {
  async createCourse(req: AuthRequest, res: Response<ApiResponse>) {
    const data = req.body
    const course = await prisma.course.create({
      data: {
        ...data,
        minStudents: data.minStudents || 15,
        maxStudents: data.maxStudents || 100,
      },
      include: {
        teacher: true,
        department: true,
        semester: true,
      },
    })

    res.json({
      success: true,
      data: course,
      message: '课程创建成功',
    })
  },

  async getCourses(req: AuthRequest, res: Response<ApiResponse>) {
    const { semesterId, departmentId, teacherId } = req.query

    const courses = await prisma.course.findMany({
      where: {
        semesterId: semesterId as string | undefined,
        departmentId: departmentId as string | undefined,
        teacherId: teacherId as string | undefined,
      },
      include: {
        teacher: true,
        department: true,
        semester: true,
        schedules: {
          include: {
            classroom: true,
          },
        },
        _count: {
          select: {
            enrollments: {
              where: { status: 'ENROLLED' },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    res.json({
      success: true,
      data: courses,
    })
  },

  async getMyCourses(req: AuthRequest, res: Response<ApiResponse>) {
    const teacherId = req.user!.userId
    const { semesterId } = req.query

    const courses = await prisma.course.findMany({
      where: {
        teacherId,
        semesterId: semesterId as string | undefined,
      },
      include: {
        department: true,
        semester: true,
        schedules: { include: { classroom: true } },
        _count: { select: { enrollments: { where: { status: 'ENROLLED' } } } },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: courses })
  },

  async getCourse(req: AuthRequest, res: Response<ApiResponse>) {
    const { id } = req.params
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        teacher: true,
        department: true,
        semester: true,
        schedules: {
          include: {
            classroom: true,
          },
        },
        _count: {
          select: {
            enrollments: {
              where: { status: 'ENROLLED' },
            },
          },
        },
      },
    })

    if (!course) {
      return res.status(404).json({
        success: false,
        error: '课程不存在',
      })
    }

    res.json({
      success: true,
      data: course,
    })
  },

  async createSchedule(req: AuthRequest, res: Response<ApiResponse>) {
    const data = req.body
    const { forceCreate, ...scheduleData } = data

    const course = await prisma.course.findUnique({
      where: { id: scheduleData.courseId },
    })

    if (!course) {
      return res.status(404).json({
        success: false,
        error: '课程不存在',
      })
    }

    const conflictResult = await scheduleConflictService.checkConflicts({
      ...scheduleData,
      semesterId: course.semesterId,
    })

    if (conflictResult.hasConflict) {
      const conflictInfo = conflictResult.conflicts
        .map((c) => `${c.type}冲突：${c.courseName}在${c.classroomName}教室，${c.dayOfWeek}第${c.startPeriod}-${c.endPeriod}节`)
        .join('; ')

      if (conflictResult.strategy === ScheduleConflictStrategy.STRICT_BLOCK && !forceCreate) {
        return res.status(400).json({
          success: false,
          error: '排课冲突',
          message: conflictInfo,
          data: {
            conflicts: conflictResult.conflicts,
            strategy: conflictResult.strategy,
          },
        })
      }

      if (conflictResult.strategy === ScheduleConflictStrategy.AUTO_AVOID && !forceCreate) {
        const availableClassrooms = await scheduleConflictService.findAvailableClassrooms(
          course.semesterId,
          scheduleData.dayOfWeek,
          scheduleData.startPeriod,
          scheduleData.endPeriod,
          scheduleData.startDate,
          scheduleData.endDate
        )

        return res.status(400).json({
          success: false,
          error: '排课冲突',
          message: conflictInfo,
          data: {
            conflicts: conflictResult.conflicts,
            strategy: conflictResult.strategy,
            availableClassrooms,
          },
        })
      }

      if (conflictResult.strategy === ScheduleConflictStrategy.ALLOW_WITH_WARNING || forceCreate) {
        const schedule = await prisma.schedule.create({
          data: {
            ...scheduleData,
            semesterId: course.semesterId,
            conflictChecked: true,
            hasConflict: true,
            conflictInfo,
          },
          include: {
            course: true,
            classroom: true,
          },
        })

        await notificationService.sendScheduleConflictNotification(schedule.id, conflictInfo)

        return res.json({
          success: true,
          data: schedule,
          message: `排课成功，但存在冲突：${conflictInfo}`,
        })
      }
    }

    const schedule = await prisma.schedule.create({
      data: {
        ...scheduleData,
        semesterId: course.semesterId,
        conflictChecked: true,
        hasConflict: false,
      },
      include: {
        course: true,
        classroom: true,
      },
    })

    res.json({
      success: true,
      data: schedule,
      message: '排课成功',
    })
  },

  async getSchedules(req: AuthRequest, res: Response<ApiResponse>) {
    const { courseId, semesterId, classroomId, teacherId } = req.query

    const schedules = await prisma.schedule.findMany({
      where: {
        courseId: courseId as string | undefined,
        semesterId: semesterId as string | undefined,
        classroomId: classroomId as string | undefined,
        course: teacherId ? { teacherId: teacherId as string } : undefined,
      },
      include: {
        course: {
          include: {
            teacher: true,
          },
        },
        classroom: true,
        semester: true,
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startPeriod: 'asc' },
      ],
    })

    res.json({
      success: true,
      data: schedules,
    })
  },

  async checkScheduleConflicts(req: AuthRequest, res: Response<ApiResponse>) {
    const data = req.body

    const course = await prisma.course.findUnique({
      where: { id: data.courseId },
    })

    if (!course) {
      return res.status(404).json({
        success: false,
        error: '课程不存在',
      })
    }

    const result = await scheduleConflictService.checkConflicts({
      ...data,
      semesterId: course.semesterId,
    })

    res.json({
      success: true,
      data: result,
    })
  },

  async getConflictStrategy(req: AuthRequest, res: Response<ApiResponse>) {
    const strategy = await scheduleConflictService.getConflictStrategy()
    res.json({
      success: true,
      data: { strategy },
    })
  },

  async setConflictStrategy(req: AuthRequest, res: Response<ApiResponse>) {
    const { strategy } = req.body
    await scheduleConflictService.setConflictStrategy(strategy as ScheduleConflictStrategy)
    res.json({
      success: true,
      message: '排课冲突策略已更新',
    })
  },

  async deleteSchedule(req: AuthRequest, res: Response<ApiResponse>) {
    const { id } = req.params
    await prisma.schedule.delete({
      where: { id },
    })

    res.json({
      success: true,
      message: '排课已删除',
    })
  },
}
