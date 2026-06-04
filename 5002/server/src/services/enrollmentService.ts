import prisma from '../lib/prisma'
import { notificationService } from './notificationService'

export const enrollmentService = {
  async enrollCourse(studentId: string, courseId: string, classId?: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        semester: true,
        enrollments: {
          where: { status: 'ENROLLED' },
        },
      },
    })

    if (!course) {
      throw new Error('课程不存在')
    }

    const now = new Date()
    if (
      now < course.semester.courseSelectionStart ||
      now > course.semester.courseSelectionEnd
    ) {
      throw new Error(
        `不在选课时间范围内，选课时间：${course.semester.courseSelectionStart.toLocaleDateString()} 至 ${course.semester.courseSelectionEnd.toLocaleDateString()}`
      )
    }

    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId,
          courseId,
        },
      },
    })

    if (existingEnrollment) {
      if (existingEnrollment.status === 'ENROLLED') {
        throw new Error('已选修该课程')
      }
      if (existingEnrollment.status === 'DROPPED') {
        return prisma.enrollment.update({
          where: { id: existingEnrollment.id },
          data: {
            status: 'ENROLLED',
            enrolledAt: new Date(),
            droppedAt: null,
          },
        })
      }
    }

    if (course.enrollments.length >= course.maxStudents) {
      throw new Error('课程人数已满')
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        studentId,
        courseId,
        classId,
        status: 'ENROLLED',
      },
    })

    const currentCount = course.enrollments.length + 1
    if (currentCount >= course.minStudents) {
      const prevCount = currentCount - 1
      if (prevCount < course.minStudents) {
        console.log(`课程【${course.name}】选课人数已达到最低开课人数`)
      }
    }

    return enrollment
  },

  async dropCourse(studentId: string, courseId: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        semester: true,
      },
    })

    if (!course) {
      throw new Error('课程不存在')
    }

    const now = new Date()
    if (
      now < course.semester.courseSelectionStart ||
      now > course.semester.courseSelectionEnd
    ) {
      throw new Error(
        `不在退课时间范围内，退课时间：${course.semester.courseSelectionStart.toLocaleDateString()} 至 ${course.semester.courseSelectionEnd.toLocaleDateString()}`
      )
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId,
          courseId,
        },
      },
    })

    if (!enrollment || enrollment.status !== 'ENROLLED') {
      throw new Error('未选修该课程或已退课')
    }

    const droppedEnrollment = await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        status: 'DROPPED',
        droppedAt: new Date(),
      },
    })

    await this.checkLowEnrollment(courseId)

    return droppedEnrollment
  },

  async checkLowEnrollment(courseId: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
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

    if (!course) return

    const currentCount = course._count.enrollments
    if (currentCount < course.minStudents) {
      await notificationService.sendLowEnrollmentNotification(
        courseId,
        currentCount,
        course.minStudents
      )
    }
  },

  async getEnrolledCourses(studentId: string, semesterId?: string) {
    return prisma.enrollment.findMany({
      where: {
        studentId,
        status: 'ENROLLED',
        course: semesterId ? { semesterId } : undefined,
      },
      include: {
        course: {
          include: {
            teacher: true,
            semester: true,
            schedules: {
              include: {
                classroom: true,
              },
            },
          },
        },
      },
    })
  },

  async getCourseStudents(courseId: string) {
    return prisma.enrollment.findMany({
      where: {
        courseId,
        status: 'ENROLLED',
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            studentId: true,
            email: true,
            phone: true,
          },
        },
        class: {
          include: {
            major: true,
          },
        },
      },
      orderBy: {
        student: {
          name: 'asc',
        },
      },
    })
  },

  async getAvailableCourses(studentId: string, semesterId: string) {
    const enrolledCourseIds = await prisma.enrollment.findMany({
      where: {
        studentId,
        status: 'ENROLLED',
        course: { semesterId },
      },
      select: { courseId: true },
    }).then((enrollments) => enrollments.map((e) => e.courseId))

    return prisma.course.findMany({
      where: {
        semesterId,
        id: { notIn: enrolledCourseIds },
        enrollments: {
          some: {
            status: 'ENROLLED',
          },
        },
      },
      include: {
        teacher: true,
        department: true,
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
  },
}
