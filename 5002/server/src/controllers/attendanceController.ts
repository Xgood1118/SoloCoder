import { Response } from 'express'
import { AuthRequest, ApiResponse, AttendanceStatus } from '../types'
import prisma from '../lib/prisma'

export const attendanceController = {
  async recordAttendance(req: AuthRequest, res: Response<ApiResponse>) {
    const { scheduleId, records } = req.body

    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        course: {
          include: {
            enrollments: {
              where: { status: 'ENROLLED' },
            },
          },
        },
      },
    })

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: '排课不存在',
      })
    }

    const date = new Date()
    const results = []

    for (const record of records) {
      const enrollment = schedule.course.enrollments.find(
        (e) => e.studentId === record.studentId
      )

      if (!enrollment) continue

      const attendance = await prisma.attendance.upsert({
        where: {
          scheduleId_studentId_date: {
            scheduleId,
            studentId: record.studentId,
            date,
          },
        },
        create: {
          scheduleId,
          studentId: record.studentId,
          enrollmentId: enrollment.id,
          date,
          status: record.status as AttendanceStatus,
          remark: record.remark,
        },
        update: {
          status: record.status as AttendanceStatus,
          remark: record.remark,
        },
      })

      results.push(attendance)
    }

    res.json({
      success: true,
      data: results,
      message: `成功记录 ${results.length} 条考勤`,
    })
  },

  async getAttendanceBySchedule(req: AuthRequest, res: Response<ApiResponse>) {
    const { scheduleId } = req.params
    const { date } = req.query

    const attendances = await prisma.attendance.findMany({
      where: {
        scheduleId,
        date: date ? new Date(date as string) : undefined,
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            studentId: true,
          },
        },
      },
      orderBy: {
        student: {
          name: 'asc',
        },
      },
    })

    res.json({
      success: true,
      data: attendances,
    })
  },

  async getStudentAttendance(req: AuthRequest, res: Response<ApiResponse>) {
    const studentId = req.user!.userId
    const { courseId, startDate, endDate } = req.query

    const attendances = await prisma.attendance.findMany({
      where: {
        studentId,
        schedule: courseId ? { courseId: courseId as string } : undefined,
        date: {
          gte: startDate ? new Date(startDate as string) : undefined,
          lte: endDate ? new Date(endDate as string) : undefined,
        },
      },
      include: {
        schedule: {
          include: {
            course: true,
            classroom: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    })

    res.json({
      success: true,
      data: attendances,
    })
  },

  async getAttendance(req: AuthRequest, res: Response<ApiResponse>) {
    const { courseId, scheduleId, date, studentId } = req.query

    const attendances = await prisma.attendance.findMany({
      where: {
        scheduleId: scheduleId as string | undefined,
        studentId: studentId as string | undefined,
        schedule: courseId ? { courseId: courseId as string } : undefined,
        date: date ? new Date(date as string) : undefined,
      },
      include: {
        student: { select: { id: true, name: true, studentId: true } },
        schedule: {
          include: {
            course: { select: { id: true, name: true } },
            classroom: { select: { id: true, building: true, roomNumber: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    })

    res.json({ success: true, data: attendances })
  },

  async getClassAttendance(req: AuthRequest, res: Response<ApiResponse>) {
    const { classId, month, courseId } = req.query

    const classInfo = await prisma.class.findUnique({
      where: { id: classId as string },
      include: {
        enrollments: {
          where: { status: 'ENROLLED' },
          include: {
            student: { select: { id: true, name: true, studentId: true } },
          },
        },
      },
    })

    if (!classInfo) {
      return res.status(404).json({ success: false, error: '班级不存在' })
    }

    const studentIds = classInfo.enrollments.map((e) => e.studentId)
    const attendances = await prisma.attendance.findMany({
      where: {
        studentId: { in: studentIds },
        schedule: courseId ? { courseId: courseId as string } : undefined,
        date: month
          ? {
              gte: new Date(`${month}-01`),
              lt: new Date(new Date(`${month}-01`).setMonth(new Date(`${month}-01`).getMonth() + 1)),
            }
          : undefined,
      },
      include: {
        student: { select: { id: true, name: true, studentId: true } },
        schedule: {
          include: {
            course: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    })

    const stats = studentIds.map((studentId) => {
      const studentAttendances = attendances.filter((a) => a.studentId === studentId)
      const student = classInfo.enrollments.find((e) => e.studentId === studentId)?.student
      const total = studentAttendances.length
      const present = studentAttendances.filter((a) => a.status === AttendanceStatus.PRESENT).length
      const absent = studentAttendances.filter((a) => a.status === AttendanceStatus.ABSENT).length
      const late = studentAttendances.filter((a) => a.status === AttendanceStatus.LATE).length
      const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0

      return {
        student,
        total,
        present,
        absent,
        late,
        attendanceRate,
      }
    })

    res.json({ success: true, data: { className: classInfo.name, students: stats, records: attendances } })
  },

  async batchRecordAttendance(req: AuthRequest, res: Response<ApiResponse>) {
    const { courseId, date, records } = req.body

    const schedules = await prisma.schedule.findMany({
      where: {
        courseId,
        startDate: { lte: new Date(date) },
        endDate: { gte: new Date(date) },
      },
    })

    if (schedules.length === 0) {
      return res.status(404).json({ success: false, error: '该日期没有排课' })
    }

    const results = []
    for (const schedule of schedules) {
      for (const record of records) {
        const enrollment = await prisma.enrollment.findUnique({
          where: { studentId_courseId: { studentId: record.studentId, courseId } },
        })

        if (!enrollment) continue

        const attendance = await prisma.attendance.upsert({
          where: {
            scheduleId_studentId_date: {
              scheduleId: schedule.id,
              studentId: record.studentId,
              date: new Date(date),
            },
          },
          create: {
            scheduleId: schedule.id,
            studentId: record.studentId,
            enrollmentId: enrollment.id,
            date: new Date(date),
            status: record.status as AttendanceStatus,
            remark: record.remark,
          },
          update: {
            status: record.status as AttendanceStatus,
            remark: record.remark,
          },
        })
        results.push(attendance)
      }
    }

    res.json({
      success: true,
      data: results,
      message: `成功记录 ${results.length} 条考勤`,
    })
  },

  async getAttendanceStats(req: AuthRequest, res: Response<ApiResponse>) {
    const { courseId, studentId } = req.params

    const attendances = await prisma.attendance.findMany({
      where: {
        schedule: { courseId },
        studentId,
      },
    })

    const total = attendances.length
    const present = attendances.filter((a) => a.status === AttendanceStatus.PRESENT).length
    const absent = attendances.filter((a) => a.status === AttendanceStatus.ABSENT).length
    const late = attendances.filter((a) => a.status === AttendanceStatus.LATE).length
    const excused = attendances.filter((a) => a.status === AttendanceStatus.EXCUSED).length

    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0

    res.json({
      success: true,
      data: {
        total,
        present,
        absent,
        late,
        excused,
        attendanceRate,
      },
    })
  },
}
