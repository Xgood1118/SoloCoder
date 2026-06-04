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

export interface User {
  id: string
  username: string
  name: string
  role: Role
  email?: string
  phone?: string
  employeeId?: string
  studentId?: string
  department?: {
    id: string
    name: string
  }
}

export interface Department {
  id: string
  name: string
  code: string
  description?: string
  _count?: {
    majors: number
    users: number
    courses: number
  }
}

export interface Major {
  id: string
  name: string
  code: string
  departmentId: string
  department?: Department
  _count?: {
    classes: number
  }
}

export interface Class {
  id: string
  name: string
  grade: number
  majorId: string
  counselorId?: string
  major?: Major & { department: Department }
  counselor?: {
    id: string
    name: string
  }
  _count?: {
    enrollments: number
  }
}

export interface Classroom {
  id: string
  building: string
  roomNumber: string
  seatCount: number
  hasProjector: boolean
  description?: string
  _count?: {
    schedules: number
  }
}

export interface Semester {
  id: string
  name: string
  academicYear: string
  startDate: string
  endDate: string
  courseSelectionStart: string
  courseSelectionEnd: string
  gradeEntryDeadline: string
  isActive: boolean
  _count?: {
    courses: number
  }
}

export interface Course {
  id: string
  name: string
  code: string
  credits: number
  departmentId: string
  teacherId: string
  semesterId: string
  minStudents: number
  maxStudents: number
  description?: string
  department?: Department
  teacher?: User
  semester?: Semester
  schedules?: Schedule[]
  _count?: {
    enrollments: number
  }
}

export interface Schedule {
  id: string
  courseId: string
  classroomId: string
  semesterId: string
  dayOfWeek: WeekDay
  startPeriod: number
  endPeriod: number
  startDate: string
  endDate: string
  conflictChecked: boolean
  hasConflict: boolean
  conflictInfo?: string
  course?: Course & { teacher: User }
  classroom?: Classroom
  semester?: Semester
}

export interface Enrollment {
  id: string
  studentId: string
  courseId: string
  classId?: string
  status: string
  enrolledAt: string
  droppedAt?: string
  course?: Course & {
    teacher: User
    semester: Semester
    schedules: (Schedule & { classroom: Classroom })[]
  }
  student?: User
  class?: Class
}

export interface Attendance {
  id: string
  scheduleId: string
  studentId: string
  enrollmentId: string
  date: string
  status: AttendanceStatus
  remark?: string
  schedule?: Schedule & {
    course: Course
    classroom: Classroom
  }
  student?: User
}

export interface Grade {
  id: string
  studentId: string
  courseId: string
  regularScore?: number
  finalScore?: number
  totalScore?: number
  isPassed?: boolean
  enteredAt?: string
  student?: {
    id: string
    name: string
    studentId?: string
  }
  course?: Course & { semester: Semester }
}

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  content: string
  isRead: boolean
  relatedId?: string
  relatedType?: string
  createdAt: string
}

export interface CourseReport {
  id: string
  courseId: string
  totalStudents: number
  avgAttendance: number
  avgScore: number
  scoreDistribution: string
  passRate: number
  generatedAt: string
  course?: Course & { teacher: User; semester: Semester }
}

export interface AttendanceReport {
  id: string
  classId?: string
  studentId?: string
  month: string
  totalClasses: number
  presentCount: number
  absentCount: number
  lateCount: number
  attendanceRate: number
  generatedAt: string
  class?: Class & { major: Major }
  student?: {
    id: string
    name: string
    studentId?: string
  }
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}
