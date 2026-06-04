import prisma from '../lib/prisma'
import { AttendanceStatus } from '../types'

export const reportService = {
  async generateCourseReport(courseId: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        enrollments: {
          where: { status: 'ENROLLED' },
          include: {
            attendances: true,
          },
        },
        grades: {
          where: { totalScore: { not: null } },
        },
      },
    })

    if (!course) {
      throw new Error('课程不存在')
    }

    const totalStudents = course.enrollments.length

    const allAttendances = course.enrollments.flatMap((e) => e.attendances)
    const presentCount = allAttendances.filter(
      (a) => a.status === AttendanceStatus.PRESENT
    ).length
    const avgAttendance =
      allAttendances.length > 0
        ? Math.round((presentCount / allAttendances.length) * 100)
        : 0

    const scores = course.grades
      .filter((g) => g.totalScore !== null)
      .map((g) => g.totalScore as number)
    const avgScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0

    const distribution: Record<string, number> = {
      '0-59': 0,
      '60-69': 0,
      '70-79': 0,
      '80-89': 0,
      '90-100': 0,
    }

    for (const score of scores) {
      if (score < 60) distribution['0-59']++
      else if (score < 70) distribution['60-69']++
      else if (score < 80) distribution['70-79']++
      else if (score < 90) distribution['80-89']++
      else distribution['90-100']++
    }

    const passCount = course.grades.filter((g) => g.isPassed).length
    const passRate =
      course.grades.length > 0
        ? Math.round((passCount / course.grades.length) * 100)
        : 0

    const report = await prisma.courseReport.create({
      data: {
        courseId,
        totalStudents,
        avgAttendance,
        avgScore,
        scoreDistribution: JSON.stringify(distribution),
        passRate,
      },
      include: {
        course: {
          include: {
            teacher: true,
            semester: true,
          },
        },
      },
    })

    return report
  },

  async generateAttendanceReport(
    classId: string,
    year: number,
    month: number
  ) {
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)
    const monthStr = `${year}-${String(month).padStart(2, '0')}`

    const classInfo = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        enrollments: {
          where: { status: 'ENROLLED' },
          include: {
            attendances: {
              where: {
                date: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
          },
        },
      },
    })

    if (!classInfo) {
      throw new Error('班级不存在')
    }

    const reports = []

    for (const enrollment of classInfo.enrollments) {
      const attendances = enrollment.attendances
      const totalClasses = attendances.length
      const presentCount = attendances.filter(
        (a) => a.status === AttendanceStatus.PRESENT
      ).length
      const absentCount = attendances.filter(
        (a) => a.status === AttendanceStatus.ABSENT
      ).length
      const lateCount = attendances.filter(
        (a) => a.status === AttendanceStatus.LATE
      ).length
      const attendanceRate =
        totalClasses > 0
          ? Math.round((presentCount / totalClasses) * 100)
          : 0

      const report = await prisma.attendanceReport.create({
        data: {
          classId,
          studentId: enrollment.studentId,
          month: monthStr,
          totalClasses,
          presentCount,
          absentCount,
          lateCount,
          attendanceRate,
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
      })

      reports.push(report)
    }

    return reports
  },

  async getClassAttendanceStats(classId: string, year: number, month: number) {
    const reports = await this.generateAttendanceReport(classId, year, month)

    if (reports.length === 0) {
      return {
        classId,
        month: `${year}-${String(month).padStart(2, '0')}`,
        totalStudents: 0,
        avgAttendanceRate: 0,
        reports: [],
      }
    }

    const avgAttendanceRate = Math.round(
      reports.reduce((sum, r) => sum + r.attendanceRate, 0) / reports.length
    )

    return {
      classId,
      month: `${year}-${String(month).padStart(2, '0')}`,
      totalStudents: reports.length,
      avgAttendanceRate,
      reports,
    }
  },

  async getClassroomOccupancy(
    classroomId: string,
    startDate: Date,
    endDate: Date
  ) {
    const schedules = await prisma.schedule.findMany({
      where: {
        classroomId,
        AND: [
          { startDate: { lte: endDate } },
          { endDate: { gte: startDate } },
        ],
      },
      include: {
        course: {
          include: {
            teacher: true,
          },
        },
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startPeriod: 'asc' },
      ],
    })

    const weeklySlots = Array(7).fill(0).map(() => Array(12).fill(null))

    for (const schedule of schedules) {
      const dayIndex = [
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
        'SUNDAY',
      ].indexOf(schedule.dayOfWeek)

      for (let i = schedule.startPeriod; i <= schedule.endPeriod; i++) {
        weeklySlots[dayIndex][i - 1] = {
          courseId: schedule.courseId,
          courseName: schedule.course.name,
          teacherName: schedule.course.teacher.name,
        }
      }
    }

    return {
      classroomId,
      startDate,
      endDate,
      weeklySlots,
      schedules,
    }
  },

  async getAvailableClassrooms(
    semesterId: string,
    dayOfWeek: string,
    startPeriod: number,
    endPeriod: number,
    date: Date
  ) {
    const occupiedClassroomIds = await prisma.schedule.findMany({
      where: {
        semesterId,
        dayOfWeek: dayOfWeek as any,
        OR: [
          {
            AND: [
              { startPeriod: { lte: startPeriod } },
              { endPeriod: { gte: startPeriod } },
            ],
          },
          {
            AND: [
              { startPeriod: { lte: endPeriod } },
              { endPeriod: { gte: endPeriod } },
            ],
          },
        ],
        AND: [
          { startDate: { lte: date } },
          { endDate: { gte: date } },
        ],
      },
      select: { classroomId: true },
    })

    const occupiedIds = occupiedClassroomIds.map((s) => s.classroomId)

    return prisma.classroom.findMany({
      where: {
        id: { notIn: occupiedIds },
      },
      orderBy: [
        { building: 'asc' },
        { roomNumber: 'asc' },
      ],
    })
  },
}
