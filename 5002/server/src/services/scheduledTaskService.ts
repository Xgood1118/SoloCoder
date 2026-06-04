import cron from 'node-cron'
import prisma from '../lib/prisma'
import { notificationService } from './notificationService'
import { reportService } from './reportService'

export const scheduledTaskService = {
  start() {
    console.log('Starting scheduled tasks...')

    cron.schedule('0 9 * * *', async () => {
      console.log('Running daily grade reminder check...')
      await this.checkGradeDeadlines()
    })

    cron.schedule('0 10 * * 1', async () => {
      console.log('Running weekly low enrollment check...')
      await this.checkAllLowEnrollments()
    })

    cron.schedule('0 2 1 * *', async () => {
      console.log('Running monthly attendance report generation...')
      await this.generateMonthlyAttendanceReports()
    })

    console.log('Scheduled tasks started.')
  },

  async checkGradeDeadlines() {
    const now = new Date()

    const activeSemesters = await prisma.semester.findMany({
      where: {
        isActive: true,
        gradeEntryDeadline: {
          gte: now,
        },
      },
    })

    for (const semester of activeSemesters) {
      const courses = await prisma.course.findMany({
        where: { semesterId: semester.id },
        include: {
          grades: true,
        },
      })

      for (const course of courses) {
        const deadline = semester.gradeEntryDeadline
        const daysUntilDeadline = Math.ceil(
          (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )

        const allGradesEntered = course.grades.every(
          (g) => g.totalScore !== null
        )

        if (!allGradesEntered) {
          if (daysUntilDeadline === 7 || daysUntilDeadline === 3 || daysUntilDeadline === 1) {
            await notificationService.sendGradeDeadlineReminder(
              course.id,
              daysUntilDeadline
            )
          }
        }
      }
    }

    const overdueSemesters = await prisma.semester.findMany({
      where: {
        gradeEntryDeadline: {
          lt: now,
        },
        endDate: {
          gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    })

    for (const semester of overdueSemesters) {
      const courses = await prisma.course.findMany({
        where: { semesterId: semester.id },
        include: {
          grades: true,
        },
      })

      for (const course of courses) {
        const allGradesEntered = course.grades.every(
          (g) => g.totalScore !== null
        )

        if (!allGradesEntered) {
          const unnotifiedGrades = course.grades.filter(
            (g) => !g.isOverdueReminded && g.totalScore === null
          )

          if (unnotifiedGrades.length > 0) {
            await notificationService.sendGradeOverdueNotification(course.id)

            await prisma.grade.updateMany({
              where: {
                id: { in: unnotifiedGrades.map((g) => g.id) },
              },
              data: { isOverdueReminded: true },
            })
          }
        }
      }
    }
  },

  async checkAllLowEnrollments() {
    const now = new Date()
    const activeSemesters = await prisma.semester.findMany({
      where: { isActive: true },
    })

    for (const semester of activeSemesters) {
      if (
        now >= semester.courseSelectionStart &&
        now <= semester.courseSelectionEnd
      ) {
        const courses = await prisma.course.findMany({
          where: { semesterId: semester.id },
          include: {
            _count: {
              select: {
                enrollments: {
                  where: { status: 'ENROLLED' },
                },
              },
            },
          },
        })

        for (const course of courses) {
          const currentCount = course._count.enrollments
          if (currentCount < course.minStudents) {
            await notificationService.sendLowEnrollmentNotification(
              course.id,
              currentCount,
              course.minStudents
            )
          }
        }
      }
    }
  },

  async generateMonthlyAttendanceReports() {
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const year = lastMonth.getFullYear()
    const month = lastMonth.getMonth() + 1

    const classes = await prisma.class.findMany({
      include: {
        enrollments: {
          where: { status: 'ENROLLED' },
        },
      },
    })

    for (const classInfo of classes) {
      if (classInfo.enrollments.length > 0) {
        try {
          await reportService.generateAttendanceReport(
            classInfo.id,
            year,
            month
          )
          console.log(
            `Generated attendance report for class ${classInfo.name} for ${year}-${month}`
          )
        } catch (error) {
          console.error(
            `Failed to generate attendance report for class ${classInfo.name}:`,
            error
          )
        }
      }
    }
  },

  async generateCourseReportsForCompletedSemester(semesterId: string) {
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
      include: {
        courses: {
          include: {
            grades: true,
          },
        },
      },
    })

    if (!semester) {
      throw new Error('学期不存在')
    }

    const now = new Date()
    if (now <= semester.endDate) {
      throw new Error('学期尚未结束')
    }

    const reports = []
    for (const course of semester.courses) {
      const allGradesEntered = course.grades.every(
        (g) => g.totalScore !== null
      )
      if (allGradesEntered) {
        const report = await reportService.generateCourseReport(course.id)
        reports.push(report)
      }
    }

    return reports
  },
}
