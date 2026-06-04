import { WeekDay, AttendanceStatus, NotificationType, Role } from '@/types'

export const formatDate = (date: string | Date): string => {
  const d = new Date(date)
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export const formatDateTime = (date: string | Date): string => {
  const d = new Date(date)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const weekDayMap: Record<string, string> = {
  [WeekDay.MONDAY]: '周一',
  [WeekDay.TUESDAY]: '周二',
  [WeekDay.WEDNESDAY]: '周三',
  [WeekDay.THURSDAY]: '周四',
  [WeekDay.FRIDAY]: '周五',
  [WeekDay.SATURDAY]: '周六',
  [WeekDay.SUNDAY]: '周日',
}

export const attendanceStatusMap: Record<string, { label: string; className: string }> = {
  [AttendanceStatus.PRESENT]: { label: '出勤', className: 'badge-green' },
  [AttendanceStatus.ABSENT]: { label: '缺勤', className: 'badge-red' },
  [AttendanceStatus.LATE]: { label: '迟到', className: 'badge-yellow' },
  [AttendanceStatus.EXCUSED]: { label: '请假', className: 'badge-blue' },
}

export const notificationTypeMap: Record<string, { label: string; className: string }> = {
  [NotificationType.LOW_ENROLLMENT]: { label: '选课不足', className: 'badge-yellow' },
  [NotificationType.GRADE_DEADLINE_REMINDER]: { label: '成绩提醒', className: 'badge-blue' },
  [NotificationType.GRADE_OVERDUE]: { label: '成绩逾期', className: 'badge-red' },
  [NotificationType.SCHEDULE_CONFLICT]: { label: '排课冲突', className: 'badge-red' },
  [NotificationType.SYSTEM_ANNOUNCEMENT]: { label: '系统通知', className: 'badge-gray' },
}

export const roleMap: Record<string, string> = {
  [Role.ADMIN]: '管理员',
  [Role.TEACHER]: '教师',
  [Role.STUDENT]: '学生',
  [Role.COUNSELOR]: '辅导员',
  [Role.ACADEMIC_SECRETARY]: '教学秘书',
}

export const getRoleColor = (role: string): string => {
  const colors: Record<string, string> = {
    [Role.ADMIN]: 'text-red-600 bg-red-50',
    [Role.TEACHER]: 'text-blue-600 bg-blue-50',
    [Role.STUDENT]: 'text-green-600 bg-green-50',
    [Role.COUNSELOR]: 'text-purple-600 bg-purple-50',
    [Role.ACADEMIC_SECRETARY]: 'text-orange-600 bg-orange-50',
  }
  return colors[role]
}

export const periodTimeMap: Record<number, string> = {
  1: '08:00-08:45',
  2: '08:55-09:40',
  3: '10:00-10:45',
  4: '10:55-11:40',
  5: '14:00-14:45',
  6: '14:55-15:40',
  7: '16:00-16:45',
  8: '16:55-17:40',
  9: '19:00-19:45',
  10: '19:55-20:40',
  11: '20:50-21:35',
  12: '21:45-22:30',
}
