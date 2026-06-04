import prisma from '../lib/prisma'
import { NotificationType } from '../types'

export const notificationService = {
  async createNotification(params: {
    userId: string
    type: NotificationType
    title: string
    content: string
    relatedId?: string
    relatedType?: string
  }) {
    return prisma.notification.create({
      data: params,
    })
  },

  async sendLowEnrollmentNotification(courseId: string, currentCount: number, minCount: number) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        teacher: true,
        department: true,
      },
    })

    if (!course) return

    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN' },
    })

    const title = `课程选课人数不足预警`
    const content = `课程【${course.name}】当前选课人数为 ${currentCount} 人，低于最低开课人数 ${minCount} 人，请及时处理。`

    const notifications = []

    notifications.push(
      this.createNotification({
        userId: course.teacherId,
        type: NotificationType.LOW_ENROLLMENT,
        title,
        content,
        relatedId: courseId,
        relatedType: 'Course',
      })
    )

    for (const admin of adminUsers) {
      notifications.push(
        this.createNotification({
          userId: admin.id,
          type: NotificationType.LOW_ENROLLMENT,
          title,
          content,
          relatedId: courseId,
          relatedType: 'Course',
        })
      )
    }

    return Promise.all(notifications)
  },

  async sendGradeDeadlineReminder(courseId: string, daysLeft: number) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        teacher: true,
        semester: true,
      },
    })

    if (!course) return

    const title = `成绩录入截止提醒`
    const content = `课程【${course.name}】的成绩录入还有 ${daysLeft} 天截止，请及时完成成绩录入。截止时间：${course.semester.gradeEntryDeadline.toLocaleDateString()}`

    return this.createNotification({
      userId: course.teacherId,
      type: NotificationType.GRADE_DEADLINE_REMINDER,
      title,
      content,
      relatedId: courseId,
      relatedType: 'Course',
    })
  },

  async sendGradeOverdueNotification(courseId: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        teacher: true,
        semester: true,
      },
    })

    if (!course) return

    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN' },
    })

    const title = `成绩录入逾期催报`
    const content = `课程【${course.name}】的成绩录入已逾期，请尽快完成录入工作。截止时间：${course.semester.gradeEntryDeadline.toLocaleDateString()}`

    const notifications = []

    notifications.push(
      this.createNotification({
        userId: course.teacherId,
        type: NotificationType.GRADE_OVERDUE,
        title,
        content,
        relatedId: courseId,
        relatedType: 'Course',
      })
    )

    for (const admin of adminUsers) {
      notifications.push(
        this.createNotification({
          userId: admin.id,
          type: NotificationType.GRADE_OVERDUE,
          title,
          content,
          relatedId: courseId,
          relatedType: 'Course',
        })
      )
    }

    return Promise.all(notifications)
  },

  async sendScheduleConflictNotification(scheduleId: string, conflictInfo: string) {
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        course: {
          include: {
            teacher: true,
          },
        },
      },
    })

    if (!schedule) return

    const academicSecretaries = await prisma.user.findMany({
      where: { role: 'ACADEMIC_SECRETARY' },
    })

    const title = `排课冲突警告`
    const content = `课程【${schedule.course.name}】排课时检测到冲突：${conflictInfo}，请教学秘书确认处理。`

    const notifications = []

    for (const secretary of academicSecretaries) {
      notifications.push(
        this.createNotification({
          userId: secretary.id,
          type: NotificationType.SCHEDULE_CONFLICT,
          title,
          content,
          relatedId: scheduleId,
          relatedType: 'Schedule',
        })
      )
    }

    return Promise.all(notifications)
  },

  async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    })
  },

  async markAsRead(notificationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: { isRead: true },
    })
  },

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    })
  },
}
