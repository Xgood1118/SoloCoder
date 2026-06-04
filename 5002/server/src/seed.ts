import prisma from './lib/prisma'
import { authService } from './services/authService'
import { ScheduleConflictStrategy, Role, WeekDay, AttendanceStatus } from './types'

async function main() {
  console.log('开始初始化数据...')

  const departments = [
    { name: '计算机科学与技术学院', code: 'CS', description: '计算机科学与技术学院' },
    { name: '电子信息工程学院', code: 'EE', description: '电子信息工程学院' },
    { name: '经济管理学院', code: 'EM', description: '经济管理学院' },
    { name: '外国语学院', code: 'FL', description: '外国语学院' },
  ]

  const createdDepts = await Promise.all(
    departments.map((d) => prisma.department.create({ data: d }))
  )
  console.log('院系数据创建完成')

  const majors = [
    { name: '计算机科学与技术', code: 'CS01', departmentId: createdDepts[0].id },
    { name: '软件工程', code: 'CS02', departmentId: createdDepts[0].id },
    { name: '人工智能', code: 'CS03', departmentId: createdDepts[0].id },
    { name: '电子信息工程', code: 'EE01', departmentId: createdDepts[1].id },
    { name: '工商管理', code: 'EM01', departmentId: createdDepts[2].id },
    { name: '英语', code: 'FL01', departmentId: createdDepts[3].id },
  ]

  const createdMajors = await Promise.all(
    majors.map((m) => prisma.major.create({ data: m }))
  )
  console.log('专业数据创建完成')

  const admin = await authService.createUser({
    username: 'admin',
    password: 'admin123',
    name: '系统管理员',
    role: Role.ADMIN,
    employeeId: 'ADM001',
    email: 'admin@school.edu',
  })

  const secretary = await authService.createUser({
    username: 'secretary',
    password: '123456',
    name: '张秘书',
    role: Role.ACADEMIC_SECRETARY,
    employeeId: 'SEC001',
    email: 'secretary@school.edu',
  })

  const counselor = await authService.createUser({
    username: 'counselor',
    password: '123456',
    name: '李辅导员',
    role: Role.COUNSELOR,
    employeeId: 'COU001',
    email: 'counselor@school.edu',
  })

  const teachersData = [
    { username: 'teacher1', password: '123456', name: '王教授', employeeId: 'TCH001', departmentId: createdDepts[0].id },
    { username: 'teacher2', password: '123456', name: '刘教授', employeeId: 'TCH002', departmentId: createdDepts[0].id },
    { username: 'teacher3', password: '123456', name: '陈教授', employeeId: 'TCH003', departmentId: createdDepts[1].id },
    { username: 'teacher4', password: '123456', name: '赵教授', employeeId: 'TCH004', departmentId: createdDepts[2].id },
  ]

  const createdTeachers = await Promise.all(
    teachersData.map((t) =>
      authService.createUser({ ...t, role: Role.TEACHER, email: `${t.username}@school.edu` })
    )
  )
  console.log('用户数据创建完成')

  const classes = [
    { name: '计科2301班', grade: 2023, majorId: createdMajors[0].id, counselorId: counselor.id },
    { name: '计科2302班', grade: 2023, majorId: createdMajors[0].id, counselorId: counselor.id },
    { name: '软工2301班', grade: 2023, majorId: createdMajors[1].id, counselorId: counselor.id },
    { name: '计科2201班', grade: 2022, majorId: createdMajors[0].id, counselorId: counselor.id },
  ]

  const createdClasses = await Promise.all(
    classes.map((c) => prisma.class.create({ data: c }))
  )
  console.log('班级数据创建完成')

  const studentsData = []
  for (let i = 1; i <= 30; i++) {
    const classIndex = (i - 1) % 3
    studentsData.push({
      username: `student${String(i).padStart(2, '0')}`,
      password: '123456',
      name: `学生${i}`,
      role: Role.STUDENT,
      studentId: `2023${String(i).padStart(4, '0')}`,
      departmentId: createdDepts[0].id,
      email: `student${i}@school.edu`,
    })
  }

  const createdStudents = await Promise.all(
    studentsData.map((s) => authService.createUser(s))
  )
  console.log('学生数据创建完成')

  const classrooms = [
    { building: '教学楼A', roomNumber: '101', seatCount: 50, hasProjector: true },
    { building: '教学楼A', roomNumber: '102', seatCount: 50, hasProjector: true },
    { building: '教学楼A', roomNumber: '201', seatCount: 80, hasProjector: true },
    { building: '教学楼B', roomNumber: '101', seatCount: 40, hasProjector: false },
    { building: '教学楼B', roomNumber: '201', seatCount: 100, hasProjector: true },
    { building: '实验楼', roomNumber: '301', seatCount: 30, hasProjector: true, description: '计算机实验室' },
  ]

  await Promise.all(
    classrooms.map((c) => prisma.classroom.create({ data: c }))
  )
  console.log('教室数据创建完成')

  const now = new Date()
  const semesterStart = new Date(now.getFullYear(), 1, 20)
  const semesterEnd = new Date(now.getFullYear(), 6, 15)
  const selectionStart = new Date(now.getFullYear(), 1, 10)
  const selectionEnd = new Date(now.getFullYear(), 1, 25)
  const gradeDeadline = new Date(now.getFullYear(), 6, 25)

  const semester = await prisma.semester.create({
    data: {
      name: `${now.getFullYear()}-${now.getFullYear() + 1}学年第二学期`,
      academicYear: `${now.getFullYear()}-${now.getFullYear() + 1}`,
      startDate: semesterStart,
      endDate: semesterEnd,
      courseSelectionStart: selectionStart,
      courseSelectionEnd: selectionEnd,
      gradeEntryDeadline: gradeDeadline,
      isActive: true,
    },
  })
  console.log('学期数据创建完成')

  const courses = [
    {
      name: '数据结构与算法',
      code: 'CS101',
      credits: 4,
      departmentId: createdDepts[0].id,
      teacherId: createdTeachers[0].id,
      semesterId: semester.id,
      minStudents: 15,
      maxStudents: 60,
      description: '数据结构与算法基础课程',
    },
    {
      name: '数据库系统原理',
      code: 'CS102',
      credits: 3,
      departmentId: createdDepts[0].id,
      teacherId: createdTeachers[1].id,
      semesterId: semester.id,
      minStudents: 15,
      maxStudents: 50,
      description: '关系型数据库原理与应用',
    },
    {
      name: '计算机网络',
      code: 'CS103',
      credits: 4,
      departmentId: createdDepts[0].id,
      teacherId: createdTeachers[0].id,
      semesterId: semester.id,
      minStudents: 15,
      maxStudents: 55,
      description: '计算机网络基础与TCP/IP协议',
    },
    {
      name: '高等数学',
      code: 'MA101',
      credits: 5,
      departmentId: createdDepts[1].id,
      teacherId: createdTeachers[2].id,
      semesterId: semester.id,
      minStudents: 20,
      maxStudents: 100,
      description: '高等数学基础课程',
    },
    {
      name: '经济学原理',
      code: 'EM101',
      credits: 3,
      departmentId: createdDepts[2].id,
      teacherId: createdTeachers[3].id,
      semesterId: semester.id,
      minStudents: 15,
      maxStudents: 80,
      description: '微观经济学与宏观经济学基础',
    },
  ]

  const createdCourses = await Promise.all(
    courses.map((c) => prisma.course.create({ data: c }))
  )
  console.log('课程数据创建完成')

  const createdClassrooms = await prisma.classroom.findMany()

  const schedulesData = []
  const weekDays = [WeekDay.MONDAY, WeekDay.TUESDAY, WeekDay.WEDNESDAY, WeekDay.THURSDAY, WeekDay.FRIDAY]
  
  for (let i = 0; i < createdCourses.length; i++) {
    const course = createdCourses[i]
    const scheduleCount = i % 2 === 0 ? 2 : 1
    
    for (let j = 0; j < scheduleCount; j++) {
      const dayIndex = (i * 2 + j) % weekDays.length
      const startPeriod = (i + j) % 4 === 0 ? 1 : (i + j) % 4 === 1 ? 3 : (i + j) % 4 === 2 ? 5 : 7
      schedulesData.push({
        courseId: course.id,
        classroomId: createdClassrooms[i % createdClassrooms.length].id,
        semesterId: semester.id,
        dayOfWeek: weekDays[dayIndex],
        startPeriod,
        endPeriod: startPeriod + 1,
        startDate: semesterStart,
        endDate: semesterEnd,
      })
    }
  }

  const createdSchedules = await Promise.all(
    schedulesData.map((s) => prisma.schedule.create({ data: s }))
  )
  console.log(`排课数据创建完成，共 ${createdSchedules.length} 条`)

  const enrollmentsData = []
  for (let i = 0; i < createdStudents.length; i++) {
    const student = createdStudents[i]
    const classIndex = i % 3
    const studentClass = createdClasses[classIndex]
    
    const courseCount = 3 + (i % 2)
    for (let j = 0; j < courseCount; j++) {
      const courseIndex = (i + j) % createdCourses.length
      enrollmentsData.push({
        studentId: student.id,
        courseId: createdCourses[courseIndex].id,
        classId: studentClass.id,
        status: 'ENROLLED',
        enrolledAt: new Date(semesterStart.getTime() + 86400000 * (1 + j)),
      })
    }
  }

  const createdEnrollments = await Promise.all(
    enrollmentsData.map((e) => prisma.enrollment.create({ data: e }))
  )
  console.log(`选课数据创建完成，共 ${createdEnrollments.length} 条`)

  const gradesData = []
  for (const enrollment of createdEnrollments) {
    const regularScore = 60 + Math.floor(Math.random() * 40)
    const finalScore = 55 + Math.floor(Math.random() * 45)
    const totalScore = Math.round(regularScore * 0.4 + finalScore * 0.6)
    
    const course = createdCourses.find((c) => c.id === enrollment.courseId)
    
    gradesData.push({
      studentId: enrollment.studentId,
      courseId: enrollment.courseId,
      enrollmentId: enrollment.id,
      teacherId: course?.teacherId || createdTeachers[0].id,
      regularScore,
      finalScore,
      totalScore,
      isPassed: totalScore >= 60,
      enteredAt: new Date(gradeDeadline.getTime() - 86400000 * 2),
    })
  }

  const createdGrades = await Promise.all(
    gradesData.map((g) => prisma.grade.create({ data: g }))
  )
  console.log(`成绩数据创建完成，共 ${createdGrades.length} 条`)

  const attendanceData = []
  const attendanceStatuses = [AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.ABSENT, AttendanceStatus.EXCUSED]
  const weekDayOffsetMap: Record<string, number> = {
    [WeekDay.MONDAY]: 1,
    [WeekDay.TUESDAY]: 2,
    [WeekDay.WEDNESDAY]: 3,
    [WeekDay.THURSDAY]: 4,
    [WeekDay.FRIDAY]: 5,
    [WeekDay.SATURDAY]: 6,
    [WeekDay.SUNDAY]: 0,
  }
  
  for (const schedule of createdSchedules) {
    const courseEnrollments = createdEnrollments.filter((e) => e.courseId === schedule.courseId)
    
    for (let week = 1; week <= 8; week++) {
      const classDate = new Date(semesterStart.getTime())
      const dayOffset = weekDayOffsetMap[schedule.dayOfWeek] - (semesterStart.getDay() + 6) % 7
      classDate.setDate(semesterStart.getDate() + dayOffset + (week - 1) * 7)
      
      if (classDate > semesterEnd) continue
      
      for (const enrollment of courseEnrollments) {
        const statusIndex = Math.floor(Math.random() * attendanceStatuses.length)
        attendanceData.push({
          scheduleId: schedule.id,
          studentId: enrollment.studentId,
          enrollmentId: enrollment.id,
          date: classDate,
          status: attendanceStatuses[statusIndex],
          remark: statusIndex >= 4 ? (statusIndex === 4 ? '无故缺勤' : '病假') : undefined,
        })
      }
    }
  }

  const chunkSize = 500
  for (let i = 0; i < attendanceData.length; i += chunkSize) {
    const chunk = attendanceData.slice(i, i + chunkSize)
    await prisma.attendance.createMany({ data: chunk })
  }
  console.log(`考勤数据创建完成，共 ${attendanceData.length} 条`)

  await prisma.systemConfig.upsert({
    where: { key: 'schedule_conflict_strategy' },
    create: {
      key: 'schedule_conflict_strategy',
      value: ScheduleConflictStrategy.STRICT_BLOCK,
      description: '排课冲突处理策略',
    },
    update: {},
  })
  console.log('系统配置创建完成')

  console.log('数据初始化完成！')
  console.log('')
  console.log('测试账号：')
  console.log('  管理员: admin / admin123')
  console.log('  教学秘书: secretary / 123456')
  console.log('  辅导员: counselor / 123456')
  console.log('  教师: teacher1 / 123456')
  console.log('  学生: student01 / 123456')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
