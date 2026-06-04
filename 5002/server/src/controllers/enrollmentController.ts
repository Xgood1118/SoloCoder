import { Response } from 'express'
import { AuthRequest, ApiResponse } from '../types'
import { enrollmentService } from '../services/enrollmentService'
import { gradeService } from '../services/gradeService'
import prisma from '../lib/prisma'

export const enrollmentController = {
  async enrollCourse(req: AuthRequest, res: Response<ApiResponse>) {
    const { courseId, classId } = req.body
    const studentId = req.user!.userId

    const enrollment = await enrollmentService.enrollCourse(studentId, courseId, classId)

    res.json({
      success: true,
      data: enrollment,
      message: '选课成功',
    })
  },

  async dropCourse(req: AuthRequest, res: Response<ApiResponse>) {
    const { courseId } = req.body
    const { id } = req.params
    const studentId = req.user!.userId
    const actualCourseId = courseId || id

    const enrollment = await enrollmentService.dropCourse(studentId, actualCourseId)

    res.json({
      success: true,
      data: enrollment,
      message: '退课成功',
    })
  },

  async getEnrollmentStatus(req: AuthRequest, res: Response<ApiResponse>) {
    const activeSemester = await prisma.semester.findFirst({ where: { isActive: true } })
    if (!activeSemester) {
      return res.json({ success: true, data: { isOpen: false, message: '暂无活跃学期' } })
    }

    const now = new Date()
    const isOpen = now >= new Date(activeSemester.courseSelectionStart) && now <= new Date(activeSemester.courseSelectionEnd)

    res.json({
      success: true,
      data: {
        isOpen,
        semesterId: activeSemester.id,
        semesterName: activeSemester.name,
        startDate: activeSemester.courseSelectionStart,
        endDate: activeSemester.courseSelectionEnd,
      },
    })
  },

  async getStudentEnrollments(req: AuthRequest, res: Response<ApiResponse>) {
    const { studentId } = req.query
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: studentId as string | undefined, status: 'ENROLLED' },
      include: {
        course: {
          include: {
            teacher: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    })
    res.json({ success: true, data: enrollments })
  },

  async getEnrollments(req: AuthRequest, res: Response<ApiResponse>) {
    const { courseId, studentId, status } = req.query
    const enrollments = await prisma.enrollment.findMany({
      where: {
        courseId: courseId as string | undefined,
        studentId: studentId as string | undefined,
        status: status as string | undefined,
      },
      include: {
        student: { select: { id: true, name: true, studentId: true } },
        course: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true } },
      },
      orderBy: { enrolledAt: 'desc' },
    })
    res.json({ success: true, data: enrollments })
  },

  async getAllGrades(req: AuthRequest, res: Response<ApiResponse>) {
    const { studentId, courseId, semesterId } = req.query
    const grades = await prisma.grade.findMany({
      where: {
        studentId: studentId as string | undefined,
        courseId: courseId as string | undefined,
        course: semesterId ? { semesterId: semesterId as string } : undefined,
      },
      include: {
        student: { select: { id: true, name: true, studentId: true } },
        course: {
          include: {
            semester: { select: { id: true, name: true } },
            teacher: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })
    res.json({ success: true, data: grades })
  },

  async getGradeDeadlineInfo(req: AuthRequest, res: Response<ApiResponse>) {
    const { courseId } = req.query
    let semester
    if (courseId) {
      const course = await prisma.course.findUnique({
        where: { id: courseId as string },
        include: { semester: true },
      })
      semester = course?.semester
    } else {
      semester = await prisma.semester.findFirst({ where: { isActive: true } })
    }

    if (!semester) {
      return res.json({ success: true, data: null })
    }

    const now = new Date()
    const deadline = new Date(semester.gradeEntryDeadline)
    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const isOverdue = now > deadline

    res.json({
      success: true,
      data: {
        semesterId: semester.id,
        semesterName: semester.name,
        deadline,
        daysLeft: Math.max(0, daysLeft),
        isOverdue,
        totalScoreFormula: '平时成绩 × 40% + 期末成绩 × 60%',
      },
    })
  },

  async getMyCourses(req: AuthRequest, res: Response<ApiResponse>) {
    const studentId = req.user!.userId
    const { semesterId } = req.query

    const courses = await enrollmentService.getEnrolledCourses(
      studentId,
      semesterId as string | undefined
    )

    res.json({
      success: true,
      data: courses,
    })
  },

  async getAvailableCourses(req: AuthRequest, res: Response<ApiResponse>) {
    const studentId = req.user!.userId
    const { semesterId } = req.query

    if (!semesterId) {
      return res.status(400).json({
        success: false,
        error: '学期参数不能为空',
      })
    }

    const courses = await enrollmentService.getAvailableCourses(
      studentId,
      semesterId as string
    )

    res.json({
      success: true,
      data: courses,
    })
  },

  async getCourseStudents(req: AuthRequest, res: Response<ApiResponse>) {
    const { courseId } = req.params

    const students = await enrollmentService.getCourseStudents(courseId)

    res.json({
      success: true,
      data: students,
    })
  },

  async getMyStudents(req: AuthRequest, res: Response<ApiResponse>) {
    const teacherId = req.user!.userId
    const { courseId } = req.query

    const students = await enrollmentService.getCourseStudents(courseId as string)

    res.json({
      success: true,
      data: students,
    })
  },

  async enterGrade(req: AuthRequest, res: Response<ApiResponse>) {
    const { studentId, courseId, regularScore, finalScore } = req.body
    const teacherId = req.user!.userId

    const grade = await gradeService.enterGrade({
      studentId,
      courseId,
      regularScore,
      finalScore,
      teacherId,
    })

    res.json({
      success: true,
      data: grade,
      message: '成绩录入成功',
    })
  },

  async batchEnterGrades(req: AuthRequest, res: Response<ApiResponse>) {
    const { grades } = req.body
    const teacherId = req.user!.userId

    const results = await gradeService.batchEnterGrades(
      grades.map((g: any) => ({
        ...g,
        teacherId,
      }))
    )

    res.json({
      success: true,
      data: results,
      message: `成功录入 ${results.length} 条成绩`,
    })
  },

  async getCourseGrades(req: AuthRequest, res: Response<ApiResponse>) {
    const { courseId } = req.params

    const grades = await gradeService.getGradesByCourse(courseId)

    res.json({
      success: true,
      data: grades,
    })
  },

  async getMyGrades(req: AuthRequest, res: Response<ApiResponse>) {
    const studentId = req.user!.userId
    const { semesterId } = req.query

    const grades = await gradeService.getGradesByStudent(
      studentId,
      semesterId as string | undefined
    )

    res.json({
      success: true,
      data: grades,
    })
  },

  async getGradeStatistics(req: AuthRequest, res: Response<ApiResponse>) {
    const { courseId } = req.params

    const stats = await gradeService.getGradeStatistics(courseId)

    res.json({
      success: true,
      data: stats,
    })
  },
}
