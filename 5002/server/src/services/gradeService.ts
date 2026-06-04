import prisma from '../lib/prisma'
import { GRADE_FORMULA_CONFIG } from '../config'

export interface GradeEntryData {
  studentId: string
  courseId: string
  regularScore?: number
  finalScore?: number
  teacherId: string
}

export const gradeService = {
  calculateTotalScore(regularScore: number, finalScore: number): number {
    const { regularWeight, finalWeight } = GRADE_FORMULA_CONFIG
    return Math.round(regularScore * regularWeight + finalScore * finalWeight)
  },

  isPassed(totalScore: number): boolean {
    return totalScore >= GRADE_FORMULA_CONFIG.passThreshold
  },

  async enterGrade(data: GradeEntryData) {
    const { studentId, courseId, regularScore, finalScore, teacherId } = data

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { semester: true },
    })

    if (!course) {
      throw new Error('课程不存在')
    }

    const now = new Date()
    if (now > course.semester.gradeEntryDeadline) {
      throw new Error('成绩录入时间已截止')
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
      throw new Error('学生未选修该课程')
    }

    let totalScore: number | undefined
    let isPassed: boolean | undefined

    if (regularScore !== undefined && finalScore !== undefined) {
      totalScore = this.calculateTotalScore(regularScore, finalScore)
      isPassed = this.isPassed(totalScore)
    }

    const grade = await prisma.grade.upsert({
      where: {
        studentId_courseId: {
          studentId,
          courseId,
        },
      },
      create: {
        studentId,
        courseId,
        enrollmentId: enrollment.id,
        teacherId,
        regularScore,
        finalScore,
        totalScore,
        isPassed,
        enteredAt: new Date(),
      },
      update: {
        regularScore,
        finalScore,
        totalScore,
        isPassed,
        enteredAt: new Date(),
        teacherId,
      },
    })

    return grade
  },

  async batchEnterGrades(grades: GradeEntryData[]) {
    const results = []
    for (const gradeData of grades) {
      const result = await this.enterGrade(gradeData)
      results.push(result)
    }
    return results
  },

  async getGradesByCourse(courseId: string) {
    return prisma.grade.findMany({
      where: { courseId },
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
  },

  async getGradesByStudent(studentId: string, semesterId?: string) {
    return prisma.grade.findMany({
      where: {
        studentId,
        course: semesterId ? { semesterId } : undefined,
      },
      include: {
        course: {
          include: {
            semester: true,
          },
        },
      },
      orderBy: {
        course: {
          semester: {
            startDate: 'desc',
          },
        },
      },
    })
  },

  async getGradeStatistics(courseId: string) {
    const grades = await prisma.grade.findMany({
      where: {
        courseId,
        totalScore: { not: null },
      },
      select: { totalScore: true, isPassed: true },
    })

    if (grades.length === 0) {
      return {
        count: 0,
        avg: 0,
        max: 0,
        min: 0,
        passRate: 0,
        distribution: {},
      }
    }

    const scores = grades.map((g) => g.totalScore as number)
    const passedCount = grades.filter((g) => g.isPassed).length

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

    return {
      count: grades.length,
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      max: Math.max(...scores),
      min: Math.min(...scores),
      passRate: Math.round((passedCount / grades.length) * 100),
      distribution,
    }
  },
}
