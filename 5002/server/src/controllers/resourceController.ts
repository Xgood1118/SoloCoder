import { Response } from 'express'
import { AuthRequest, ApiResponse } from '../types'
import prisma from '../lib/prisma'
import { reportService } from '../services/reportService'

export const resourceController = {
  async getDepartments(req: AuthRequest, res: Response<ApiResponse>) {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: {
            majors: true,
            users: true,
            courses: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    res.json({
      success: true,
      data: departments,
    })
  },

  async createDepartment(req: AuthRequest, res: Response<ApiResponse>) {
    const data = req.body
    const department = await prisma.department.create({ data })

    res.json({
      success: true,
      data: department,
      message: '院系创建成功',
    })
  },

  async getMajors(req: AuthRequest, res: Response<ApiResponse>) {
    const { departmentId } = req.query
    const majors = await prisma.major.findMany({
      where: {
        departmentId: departmentId as string | undefined,
      },
      include: {
        department: true,
        _count: {
          select: { classes: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    res.json({
      success: true,
      data: majors,
    })
  },

  async createMajor(req: AuthRequest, res: Response<ApiResponse>) {
    const data = req.body
    const major = await prisma.major.create({ data })

    res.json({
      success: true,
      data: major,
      message: '专业创建成功',
    })
  },

  async getClasses(req: AuthRequest, res: Response<ApiResponse>) {
    const { majorId, counselorId } = req.query
    const classes = await prisma.class.findMany({
      where: {
        majorId: majorId as string | undefined,
        counselorId: counselorId as string | undefined,
      },
      include: {
        major: {
          include: {
            department: true,
          },
        },
        counselor: {
          select: {
            id: true,
            name: true,
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
      orderBy: [
        { grade: 'desc' },
        { name: 'asc' },
      ],
    })

    res.json({
      success: true,
      data: classes,
    })
  },

  async createClass(req: AuthRequest, res: Response<ApiResponse>) {
    const data = req.body
    const classInfo = await prisma.class.create({ data })

    res.json({
      success: true,
      data: classInfo,
      message: '班级创建成功',
    })
  },

  async getClassrooms(req: AuthRequest, res: Response<ApiResponse>) {
    const { building, hasProjector, minSeats } = req.query
    const classrooms = await prisma.classroom.findMany({
      where: {
        building: building as string | undefined,
        hasProjector: hasProjector ? hasProjector === 'true' : undefined,
        seatCount: minSeats ? { gte: parseInt(minSeats as string) } : undefined,
      },
      include: {
        _count: {
          select: { schedules: true },
        },
      },
      orderBy: [
        { building: 'asc' },
        { roomNumber: 'asc' },
      ],
    })

    res.json({
      success: true,
      data: classrooms,
    })
  },

  async createClassroom(req: AuthRequest, res: Response<ApiResponse>) {
    const data = req.body
    const classroom = await prisma.classroom.create({ data })

    res.json({
      success: true,
      data: classroom,
      message: '教室创建成功',
    })
  },

  async getClassroomOccupancy(req: AuthRequest, res: Response<ApiResponse>) {
    const { classroomId, startDate, endDate } = req.query

    if (!classroomId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: '参数不完整',
      })
    }

    const occupancy = await reportService.getClassroomOccupancy(
      classroomId as string,
      new Date(startDate as string),
      new Date(endDate as string)
    )

    res.json({
      success: true,
      data: occupancy,
    })
  },

  async getAvailableClassrooms(req: AuthRequest, res: Response<ApiResponse>) {
    const { semesterId, dayOfWeek, startPeriod, endPeriod, date } = req.query

    if (!semesterId || !dayOfWeek || !startPeriod || !endPeriod || !date) {
      return res.status(400).json({
        success: false,
        error: '参数不完整',
      })
    }

    const classrooms = await reportService.getAvailableClassrooms(
      semesterId as string,
      dayOfWeek as string,
      parseInt(startPeriod as string),
      parseInt(endPeriod as string),
      new Date(date as string)
    )

    res.json({
      success: true,
      data: classrooms,
    })
  },

  async getTeachers(req: AuthRequest, res: Response<ApiResponse>) {
    const { departmentId } = req.query
    const teachers = await prisma.user.findMany({
      where: {
        role: 'TEACHER',
        departmentId: departmentId as string | undefined,
      },
      select: {
        id: true,
        name: true,
        employeeId: true,
        email: true,
        department: {
          select: { name: true },
        },
        _count: {
          select: {
            taughtCourses: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    res.json({
      success: true,
      data: teachers,
    })
  },

  async getStudents(req: AuthRequest, res: Response<ApiResponse>) {
    const { classId, departmentId } = req.query
    const students = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        departmentId: departmentId as string | undefined,
      },
      select: {
        id: true,
        name: true,
        studentId: true,
        email: true,
        department: {
          select: { name: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    res.json({
      success: true,
      data: students,
    })
  },

  async getSemesters(req: AuthRequest, res: Response<ApiResponse>) {
    const { isActive } = req.query
    const semesters = await prisma.semester.findMany({
      where: {
        isActive: isActive ? isActive === 'true' : undefined,
      },
      include: {
        _count: {
          select: { courses: true },
        },
      },
      orderBy: { startDate: 'desc' },
    })

    res.json({
      success: true,
      data: semesters,
    })
  },

  async createSemester(req: AuthRequest, res: Response<ApiResponse>) {
    const data = req.body

    if (data.isActive) {
      await prisma.semester.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      })
    }

    const semester = await prisma.semester.create({
      data: {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        courseSelectionStart: new Date(data.courseSelectionStart),
        courseSelectionEnd: new Date(data.courseSelectionEnd),
        gradeEntryDeadline: new Date(data.gradeEntryDeadline),
      },
    })

    res.json({
      success: true,
      data: semester,
      message: '学期创建成功',
    })
  },

  async deleteDepartment(req: AuthRequest, res: Response<ApiResponse>) {
    const { id } = req.params
    await prisma.department.delete({ where: { id } })
    res.json({ success: true, message: '院系删除成功' })
  },

  async deleteMajor(req: AuthRequest, res: Response<ApiResponse>) {
    const { id } = req.params
    await prisma.major.delete({ where: { id } })
    res.json({ success: true, message: '专业删除成功' })
  },

  async getMyClasses(req: AuthRequest, res: Response<ApiResponse>) {
    const counselorId = req.user!.userId
    const classes = await prisma.class.findMany({
      where: { counselorId },
      include: {
        major: { include: { department: true } },
        _count: { select: { enrollments: { where: { status: 'ENROLLED' } } } },
      },
      orderBy: [{ grade: 'desc' }, { name: 'asc' }],
    })
    res.json({ success: true, data: classes })
  },

  async deleteClass(req: AuthRequest, res: Response<ApiResponse>) {
    const { id } = req.params
    await prisma.class.delete({ where: { id } })
    res.json({ success: true, message: '班级删除成功' })
  },

  async deleteClassroom(req: AuthRequest, res: Response<ApiResponse>) {
    const { id } = req.params
    await prisma.classroom.delete({ where: { id } })
    res.json({ success: true, message: '教室删除成功' })
  },

  async setActiveSemester(req: AuthRequest, res: Response<ApiResponse>) {
    const { id } = req.params
    await prisma.semester.updateMany({ where: { isActive: true }, data: { isActive: false } })
    const semester = await prisma.semester.update({ where: { id }, data: { isActive: true } })
    res.json({ success: true, data: semester, message: '已设为当前学期' })
  },

  async deleteSemester(req: AuthRequest, res: Response<ApiResponse>) {
    const { id } = req.params
    await prisma.semester.delete({ where: { id } })
    res.json({ success: true, message: '学期删除成功' })
  },
}
