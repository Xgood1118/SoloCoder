import prisma from '../lib/prisma'
import { WeekDay, ScheduleConflictStrategy } from '../types'

export interface ConflictCheckResult {
  hasConflict: boolean
  conflicts: ConflictInfo[]
  strategy: ScheduleConflictStrategy
}

export interface ConflictInfo {
  type: 'CLASSROOM' | 'TEACHER' | 'CLASS'
  scheduleId: string
  courseName: string
  classroomName: string
  dayOfWeek: WeekDay
  startPeriod: number
  endPeriod: number
}

export interface ScheduleCheckParams {
  courseId: string
  classroomId: string
  semesterId: string
  dayOfWeek: WeekDay
  startPeriod: number
  endPeriod: number
  startDate: Date
  endDate: Date
  excludeScheduleId?: string
}

export const scheduleConflictService = {
  async getConflictStrategy(): Promise<ScheduleConflictStrategy> {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'schedule_conflict_strategy' },
    })
    return (config?.value as ScheduleConflictStrategy) || ScheduleConflictStrategy.STRICT_BLOCK
  },

  async setConflictStrategy(strategy: ScheduleConflictStrategy) {
    await prisma.systemConfig.upsert({
      where: { key: 'schedule_conflict_strategy' },
      create: {
        key: 'schedule_conflict_strategy',
        value: strategy,
        description: '排课冲突处理策略：AUTO_AVOID-自动避开，ALLOW_WITH_WARNING-允许但警告，STRICT_BLOCK-严格阻止',
      },
      update: {
        value: strategy,
      },
    })
  },

  async checkConflicts(params: ScheduleCheckParams): Promise<ConflictCheckResult> {
    const strategy = await this.getConflictStrategy()
    const conflicts: ConflictInfo[] = []

    const { classroomId, semesterId, dayOfWeek, startPeriod, endPeriod, startDate, endDate, courseId, excludeScheduleId } = params

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { teacher: true },
    })

    if (!course) {
      throw new Error('课程不存在')
    }

    const classroomConflicts = await this.checkClassroomConflicts(
      classroomId, semesterId, dayOfWeek, startPeriod, endPeriod, startDate, endDate, excludeScheduleId
    )
    conflicts.push(...classroomConflicts)

    const teacherConflicts = await this.checkTeacherConflicts(
      course.teacherId, semesterId, dayOfWeek, startPeriod, endPeriod, startDate, endDate, excludeScheduleId
    )
    conflicts.push(...teacherConflicts)

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
      strategy,
    }
  },

  async checkClassroomConflicts(
    classroomId: string,
    semesterId: string,
    dayOfWeek: WeekDay,
    startPeriod: number,
    endPeriod: number,
    startDate: Date,
    endDate: Date,
    excludeScheduleId?: string
  ): Promise<ConflictInfo[]> {
    const existingSchedules = await prisma.schedule.findMany({
      where: {
        id: excludeScheduleId ? { not: excludeScheduleId } : undefined,
        classroomId,
        semesterId,
        dayOfWeek,
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
          {
            AND: [
              { startPeriod: { gte: startPeriod } },
              { endPeriod: { lte: endPeriod } },
            ],
          },
        ],
        AND: [
          { startDate: { lte: endDate } },
          { endDate: { gte: startDate } },
        ],
      },
      include: {
        course: true,
        classroom: true,
      },
    })

    return existingSchedules.map((s) => ({
      type: 'CLASSROOM' as const,
      scheduleId: s.id,
      courseName: s.course.name,
      classroomName: `${s.classroom.building}${s.classroom.roomNumber}`,
      dayOfWeek: s.dayOfWeek as WeekDay,
      startPeriod: s.startPeriod,
      endPeriod: s.endPeriod,
    }))
  },

  async checkTeacherConflicts(
    teacherId: string,
    semesterId: string,
    dayOfWeek: WeekDay,
    startPeriod: number,
    endPeriod: number,
    startDate: Date,
    endDate: Date,
    excludeScheduleId?: string
  ): Promise<ConflictInfo[]> {
    const existingSchedules = await prisma.schedule.findMany({
      where: {
        id: excludeScheduleId ? { not: excludeScheduleId } : undefined,
        semesterId,
        dayOfWeek,
        course: {
          teacherId,
        },
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
          {
            AND: [
              { startPeriod: { gte: startPeriod } },
              { endPeriod: { lte: endPeriod } },
            ],
          },
        ],
        AND: [
          { startDate: { lte: endDate } },
          { endDate: { gte: startDate } },
        ],
      },
      include: {
        course: true,
        classroom: true,
      },
    })

    return existingSchedules.map((s) => ({
      type: 'TEACHER' as const,
      scheduleId: s.id,
      courseName: s.course.name,
      classroomName: `${s.classroom.building}${s.classroom.roomNumber}`,
      dayOfWeek: s.dayOfWeek as WeekDay,
      startPeriod: s.startPeriod,
      endPeriod: s.endPeriod,
    }))
  },

  async findAvailableClassrooms(
    semesterId: string,
    dayOfWeek: WeekDay,
    startPeriod: number,
    endPeriod: number,
    startDate: Date,
    endDate: Date,
    minSeats?: number,
    needsProjector?: boolean
  ) {
    const occupiedClassroomIds = await prisma.schedule.findMany({
      where: {
        semesterId,
        dayOfWeek,
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
          { startDate: { lte: endDate } },
          { endDate: { gte: startDate } },
        ],
      },
      select: { classroomId: true },
    })

    const occupiedIds = occupiedClassroomIds.map((s) => s.classroomId)

    return prisma.classroom.findMany({
      where: {
        id: { notIn: occupiedIds },
        seatCount: minSeats ? { gte: minSeats } : undefined,
        hasProjector: needsProjector ? true : undefined,
      },
      orderBy: [
        { building: 'asc' },
        { roomNumber: 'asc' },
      ],
    })
  },
}
