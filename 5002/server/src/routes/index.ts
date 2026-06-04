import { Router } from 'express'
import { authenticate, requireRoles } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { Role } from '../types'
import { authController } from '../controllers/authController'
import { courseController } from '../controllers/courseController'
import { createCourseSchema } from '../controllers/courseController'
import { enrollmentController } from '../controllers/enrollmentController'
import { attendanceController } from '../controllers/attendanceController'
import { resourceController } from '../controllers/resourceController'
import { notificationController } from '../controllers/notificationController'
import { reportController } from '../controllers/reportController'

const router = Router()

router.post('/auth/login', authController.login[1] as any)
router.get('/auth/me', authenticate, authController.getCurrentUser)

router.get('/departments', authenticate, resourceController.getDepartments)
router.post('/departments', authenticate, requireRoles(Role.ADMIN), resourceController.createDepartment)
router.delete('/departments/:id', authenticate, requireRoles(Role.ADMIN), resourceController.deleteDepartment)

router.get('/majors', authenticate, resourceController.getMajors)
router.post('/majors', authenticate, requireRoles(Role.ADMIN), resourceController.createMajor)
router.delete('/majors/:id', authenticate, requireRoles(Role.ADMIN), resourceController.deleteMajor)

router.get('/classes', authenticate, resourceController.getClasses)
router.get('/classes/my', authenticate, requireRoles(Role.COUNSELOR), resourceController.getMyClasses)
router.post('/classes', authenticate, requireRoles(Role.ADMIN), resourceController.createClass)
router.delete('/classes/:id', authenticate, requireRoles(Role.ADMIN), resourceController.deleteClass)

router.get('/classrooms', authenticate, resourceController.getClassrooms)
router.post('/classrooms', authenticate, requireRoles(Role.ADMIN, Role.ACADEMIC_SECRETARY), resourceController.createClassroom)
router.delete('/classrooms/:id', authenticate, requireRoles(Role.ADMIN, Role.ACADEMIC_SECRETARY), resourceController.deleteClassroom)
router.get('/classrooms/occupancy', authenticate, resourceController.getClassroomOccupancy)
router.get('/classrooms/available', authenticate, resourceController.getAvailableClassrooms)

router.get('/teachers', authenticate, resourceController.getTeachers)
router.get('/students', authenticate, resourceController.getStudents)

router.get('/semesters', authenticate, resourceController.getSemesters)
router.post('/semesters', authenticate, requireRoles(Role.ADMIN), resourceController.createSemester)
router.put('/semesters/:id/set-active', authenticate, requireRoles(Role.ADMIN), resourceController.setActiveSemester)
router.delete('/semesters/:id', authenticate, requireRoles(Role.ADMIN), resourceController.deleteSemester)

router.get('/courses', authenticate, courseController.getCourses)
router.get('/courses/my', authenticate, requireRoles(Role.TEACHER), courseController.getMyCourses)
router.get('/courses/:id', authenticate, courseController.getCourse)
router.post('/courses', authenticate, requireRoles(Role.ADMIN, Role.TEACHER, Role.ACADEMIC_SECRETARY), validate(createCourseSchema), courseController.createCourse)

router.get('/schedules', authenticate, courseController.getSchedules)
router.post('/schedules', authenticate, requireRoles(Role.ADMIN, Role.ACADEMIC_SECRETARY), courseController.createSchedule)
router.delete('/schedules/:id', authenticate, requireRoles(Role.ADMIN, Role.ACADEMIC_SECRETARY), courseController.deleteSchedule)
router.post('/schedules/check-conflict', authenticate, courseController.checkScheduleConflicts)
router.get('/schedules/conflict-strategy', authenticate, courseController.getConflictStrategy)
router.put('/schedules/conflict-strategy', authenticate, requireRoles(Role.ADMIN, Role.ACADEMIC_SECRETARY), courseController.setConflictStrategy)

router.get('/enrollment/status', authenticate, enrollmentController.getEnrollmentStatus)
router.get('/enrollment/available', authenticate, requireRoles(Role.STUDENT), enrollmentController.getAvailableCourses)
router.get('/enrollment/my', authenticate, requireRoles(Role.STUDENT), enrollmentController.getMyCourses)
router.get('/enrollment/student', authenticate, requireRoles(Role.ADMIN), enrollmentController.getStudentEnrollments)
router.post('/enrollment/enroll', authenticate, requireRoles(Role.STUDENT), enrollmentController.enrollCourse)
router.post('/enrollment/drop/:id', authenticate, requireRoles(Role.STUDENT, Role.ADMIN), enrollmentController.dropCourse)

router.get('/enrollments', authenticate, enrollmentController.getEnrollments)
router.post('/enrollments', authenticate, requireRoles(Role.STUDENT), enrollmentController.enrollCourse)
router.get('/courses/:courseId/students', authenticate, requireRoles(Role.TEACHER, Role.ADMIN), enrollmentController.getCourseStudents)
router.get('/teacher/students', authenticate, requireRoles(Role.TEACHER), enrollmentController.getMyStudents)

router.get('/grades/my', authenticate, requireRoles(Role.STUDENT), enrollmentController.getMyGrades)
router.get('/grades', authenticate, requireRoles(Role.ADMIN), enrollmentController.getAllGrades)
router.post('/grades', authenticate, requireRoles(Role.TEACHER), enrollmentController.enterGrade)
router.get('/grades/course/:courseId', authenticate, requireRoles(Role.TEACHER, Role.ADMIN), enrollmentController.getCourseGrades)
router.get('/grades/deadline-info', authenticate, enrollmentController.getGradeDeadlineInfo)
router.post('/grades/batch', authenticate, requireRoles(Role.TEACHER), enrollmentController.batchEnterGrades)
router.post('/grades/enter', authenticate, requireRoles(Role.TEACHER), enrollmentController.enterGrade)
router.get('/courses/:courseId/grades/statistics', authenticate, enrollmentController.getGradeStatistics)

router.get('/attendance', authenticate, attendanceController.getAttendance)
router.post('/attendance', authenticate, requireRoles(Role.TEACHER), attendanceController.recordAttendance)
router.get('/attendance/my', authenticate, requireRoles(Role.STUDENT), attendanceController.getStudentAttendance)
router.get('/attendance/class', authenticate, requireRoles(Role.COUNSELOR, Role.ADMIN), attendanceController.getClassAttendance)
router.post('/attendance/batch', authenticate, requireRoles(Role.TEACHER), attendanceController.batchRecordAttendance)
router.post('/attendance/record', authenticate, requireRoles(Role.TEACHER), attendanceController.recordAttendance)
router.get('/schedules/:scheduleId/attendance', authenticate, attendanceController.getAttendanceBySchedule)
router.get('/courses/:courseId/students/:studentId/attendance', authenticate, attendanceController.getAttendanceStats)

router.get('/notifications', authenticate, notificationController.getMyNotifications)
router.get('/notifications/unread-count', authenticate, notificationController.getUnreadCount)
router.put('/notifications/:id/read', authenticate, notificationController.markAsRead)
router.put('/notifications/read-all', authenticate, notificationController.markAllAsRead)

router.post('/reports/course/:courseId', authenticate, requireRoles(Role.TEACHER, Role.ADMIN), reportController.generateCourseReport)
router.get('/reports/course', authenticate, reportController.getCourseReports)
router.post('/reports/attendance', authenticate, requireRoles(Role.COUNSELOR, Role.ADMIN), reportController.generateAttendanceReport)
router.get('/reports/attendance', authenticate, reportController.getAttendanceReports)
router.get('/reports/timetable', authenticate, reportController.getTimetable)
router.get('/reports/attendance/class/:classId', authenticate, requireRoles(Role.COUNSELOR, Role.ADMIN), reportController.getClassAttendanceStats)
router.get('/reports/dashboard', authenticate, reportController.getDashboardStats)

export default router
