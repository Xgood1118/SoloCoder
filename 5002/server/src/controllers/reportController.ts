import { Response } from 'express'
import { AuthRequest, ApiResponse } from '../types'
import prisma from '../lib/prisma'
import { reportService } from '../services/reportService'

export const reportController = {
  async generateCourseReport(req: AuthRequest, res: Response<ApiResponse>) {
    const { courseId } = req.params

    const report = await reportService.generateCourseReport(courseId)

    res.json({
      success: true,
      data: report,
      message: '课程总结报告生成成功',
    })
  },

  async getCourseReports(req: AuthRequest, res: Response<ApiResponse>) {
    const { courseId, semesterId } = req.query

    const reports = await prisma.courseReport.findMany({
      where: {
        courseId: courseId as string | undefined,
        course: semesterId ? { semesterId: semesterId as string } : undefined,
      },
      include: {
        course: {
          include: {
            teacher: true,
            semester: true,
          },
        },
      },
      orderBy: { generatedAt: 'desc' },
    })

    res.json({
      success: true,
      data: reports,
    })
  },

  async getAttendanceReports(req: AuthRequest, res: Response<ApiResponse>) {
    const { classId, month, studentId } = req.query

    const reports = await prisma.attendanceReport.findMany({
      where: {
        classId: classId as string | undefined,
        month: month as string | undefined,
        studentId: studentId as string | undefined,
      },
      include: {
        class: {
          include: {
            major: true,
          },
        },
        student: {
          select: {
            id: true,
            name: true,
            studentId: true,
          },
        },
      },
      orderBy: [
        { month: 'desc' },
        { class: { name: 'asc' } },
      ],
    })

    res.json({
      success: true,
      data: reports,
    })
  },

  async getClassAttendanceStats(req: AuthRequest, res: Response<ApiResponse>) {
    const { classId } = req.params
    const { year, month } = req.query

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        error: '请指定年份和月份',
      })
    }

    const stats = await reportService.getClassAttendanceStats(
      classId as string,
      parseInt(year as string),
      parseInt(month as string)
    )

    res.json({
      success: true,
      data: stats,
    })
  },

  async getDashboardStats(req: AuthRequest, res: Response<ApiResponse>) {
    const [
      totalStudents,
      totalTeachers,
      totalCourses,
      totalClassrooms,
      activeSemester,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.user.count({ where: { role: 'TEACHER' } }),
      prisma.course.count({
        where: {
          semester: { isActive: true },
        },
      }),
      prisma.classroom.count(),
      prisma.semester.findFirst({
        where: { isActive: true },
        include: {
          _count: {
            select: { courses: true },
          },
        },
      }),
    ])

    const lowEnrollmentCourses = await prisma.course.findMany({
      where: {
        semester: { isActive: true },
      },
      include: {
        _count: {
          select: {
            enrollments: {
              where: { status: 'ENROLLED' },
            },
          },
        },
        teacher: {
          select: { name: true },
        },
      },
    }).then((courses) =>
      courses.filter((c) => c._count.enrollments < c.minStudents)
    )

    res.json({
      success: true,
      data: {
        totalStudents,
        totalTeachers,
        totalCourses,
        totalClassrooms,
        activeSemester,
        lowEnrollmentCourses,
      },
    })
  },

  async generateAttendanceReport(req: AuthRequest, res: Response<ApiResponse>) {
    const { classId, month } = req.body

    if (!classId || !month) {
      return res.status(400).json({ success: false, error: '参数不完整' })
    }

    const classInfo = await prisma.class.findUnique({
      where: { id: classId },
      include: { enrollments: { where: { status: 'ENROLLED' } } },
    })

    if (!classInfo) {
      return res.status(404).json({ success: false, error: '班级不存在' })
    }

    const startDate = new Date(`${month}-01`)
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 1)

    const reports = []
    for (const enrollment of classInfo.enrollments) {
      const attendances = await prisma.attendance.findMany({
        where: {
          studentId: enrollment.studentId,
          date: { gte: startDate, lt: endDate },
        },
      })

      const totalClasses = attendances.length
      const presentCount = attendances.filter((a) => a.status === 'PRESENT').length
      const absentCount = attendances.filter((a) => a.status === 'ABSENT').length
      const lateCount = attendances.filter((a) => a.status === 'LATE').length
      const attendanceRate = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0

      const report = await prisma.attendanceReport.upsert({
        where: {
          studentId_month: { studentId: enrollment.studentId, month },
        },
        create: {
          classId,
          studentId: enrollment.studentId,
          month,
          totalClasses,
          presentCount,
          absentCount,
          lateCount,
          attendanceRate,
        },
        update: {
          totalClasses,
          presentCount,
          absentCount,
          lateCount,
          attendanceRate,
        },
        include: {
          student: { select: { id: true, name: true, studentId: true } },
          class: true,
        },
      })
      reports.push(report)
    }

    res.json({
      success: true,
      data: reports,
      message: `成功生成 ${reports.length} 条考勤报表`,
    })
  },

  async getTimetable(req: AuthRequest, res: Response<ApiResponse>) {
    const { semesterId, classroomId, teacherId, studentId } = req.query

    let where: any = {}
    if (semesterId) where.semesterId = semesterId
    if (classroomId) where.classroomId = classroomId
    if (teacherId) where.course = { teacherId: teacherId as string }
    if (studentId) {
      const enrollments = await prisma.enrollment.findMany({
        where: { studentId: studentId as string, status: 'ENROLLED' },
        select: { courseId: true },
      })
      where.courseId = { in: enrollments.map((e) => e.courseId) }
    }

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        course: {
          include: {
            teacher: { select: { id: true, name: true } },
          },
        },
        classroom: true,
        semester: { select: { id: true, name: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startPeriod: 'asc' }],
    })

    res.json({ success: true, data: schedules })
  },
}
