import { Request } from 'express'

export enum Role {
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  COUNSELOR = 'COUNSELOR',
  ACADEMIC_SECRETARY = 'ACADEMIC_SECRETARY',
}

export enum WeekDay {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  EXCUSED = 'EXCUSED',
}

export enum NotificationType {
  LOW_ENROLLMENT = 'LOW_ENROLLMENT',
  GRADE_DEADLINE_REMINDER = 'GRADE_DEADLINE_REMINDER',
  GRADE_OVERDUE = 'GRADE_OVERDUE',
  SCHEDULE_CONFLICT = 'SCHEDULE_CONFLICT',
  SYSTEM_ANNOUNCEMENT = 'SYSTEM_ANNOUNCEMENT',
}

export enum ScheduleConflictStrategy {
  AUTO_AVOID = 'AUTO_AVOID',
  ALLOW_WITH_WARNING = 'ALLOW_WITH_WARNING',
  STRICT_BLOCK = 'STRICT_BLOCK',
}

export interface JwtPayload {
  userId: string
  username: string
  role: Role
}

export interface AuthRequest extends Request {
  user?: JwtPayload
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginationResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
