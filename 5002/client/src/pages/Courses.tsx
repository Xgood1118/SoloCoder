import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/axios'
import { ApiResponse, Course, Semester, Department, User } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { Role } from '../types'
import { formatDate } from '../utils'

export default function Courses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [teachers, setTeachers] = useState<User[]>([])
  const [filters, setFilters] = useState({
    semesterId: '',
    departmentId: '',
    teacherId: '',
  })
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    credits: 4,
    departmentId: '',
    teacherId: '',
    semesterId: '',
    minStudents: 15,
    maxStudents: 100,
    description: '',
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const { user } = useAuthStore()
  const canCreate = user && [Role.ADMIN, Role.TEACHER, Role.ACADEMIC_SECRETARY].includes(user.role)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          coursesRes,
          semestersRes,
          departmentsRes,
          teachersRes,
        ] = await Promise.all([
          api.get<ApiResponse<Course[]>>('/courses', { params: filters }),
          api.get<ApiResponse<Semester[]>>('/semesters'),
          api.get<ApiResponse<Department[]>>('/departments'),
          api.get<ApiResponse<User[]>>('/teachers'),
        ])

        setCourses(coursesRes.data.data || [])
        setSemesters(semestersRes.data.data || [])
        setDepartments(departmentsRes.data.data || [])
        setTeachers(teachersRes.data.data || [])

        const activeSemester = semestersRes.data.data?.find((s) => s.isActive)
        if (activeSemester && !filters.semesterId) {
          setFilters((prev) => ({ ...prev, semesterId: activeSemester.id }))
          setFormData((prev) => ({ ...prev, semesterId: activeSemester.id }))
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [filters])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (!formData.teacherId || formData.teacherId.trim() === '') {
        alert('请选择授课教师')
        return
      }
      if (!formData.departmentId || formData.departmentId.trim() === '') {
        alert('请选择院系')
      }
      if (!formData.semesterId || formData.semesterId.trim() === '') {
        alert('请选择学期')
        return
      }

      await api.post<ApiResponse<Course>>('/courses', formData)
      setShowModal(false)
      setFormData({
        name: '',
        code: '',
        credits: 4,
        departmentId: '',
        teacherId: '',
        semesterId: filters.semesterId,
        minStudents: 15,
        maxStudents: 100,
        description: '',
      })

      const response = await api.get<ApiResponse<Course[]>>('/courses', { params: filters })
      setCourses(response.data.data || [])
    } catch (error: any) {
      alert(error.response?.data?.error || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">课程管理</h2>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + 新建课程
          </button>
        )}
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">学期</label>
            <select
              className="select w-48"
              value={filters.semesterId}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, semesterId: e.target.value }))
              }
            >
              <option value="">全部学期</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isActive && '(当前)'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">院系</label>
            <select
              className="select w-48"
              value={filters.departmentId}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, departmentId: e.target.value }))
              }
            >
              <option value="">全部院系</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">教师</label>
            <select
              className="select w-48"
              value={filters.teacherId}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, teacherId: e.target.value }))
              }
            >
              <option value="">全部教师</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>课程名称</th>
                <th>课程代码</th>
                <th>学分</th>
                <th>院系</th>
                <th>授课教师</th>
                <th>选课人数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {courses.map((course) => (
                <tr key={course.id}>
                  <td className="font-medium">{course.name}</td>
                  <td>{course.code}</td>
                  <td>{course.credits}</td>
                  <td>{course.department?.name}</td>
                  <td>{course.teacher?.name}</td>
                  <td>
                    <span
                      className={`font-semibold ${
                        (course._count?.enrollments || 0) < course.minStudents
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}
                    >
                      {course._count?.enrollments || 0}/{course.maxStudents}
                    </span>
                  </td>
                  <td>
                    <Link
                      to={`/courses/${course.id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {courses.length === 0 && (
          <div className="text-center py-12 text-gray-500">暂无课程数据</div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">新建课程</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  课程名称 *
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  课程代码 *
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, code: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    学分 *
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={formData.credits}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        credits: parseInt(e.target.value),
                      }))
                    }
                    min="1"
                    max="10"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    学期 *
                  </label>
                  <select
                    className="select"
                    value={formData.semesterId}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, semesterId: e.target.value }))
                    }
                    required
                  >
                    <option value="">请选择学期</option>
                    {semesters.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    院系 *
                  </label>
                  <select
                    className="select"
                    value={formData.departmentId}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        departmentId: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">请选择院系</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    授课教师 *
                  </label>
                  <select
                    className="select"
                    value={formData.teacherId}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, teacherId: e.target.value }))
                    }
                    required
                  >
                    <option value="">请选择教师</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    最低开课人数
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={formData.minStudents}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        minStudents: parseInt(e.target.value),
                      }))
                    }
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    最大选课人数
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={formData.maxStudents}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        maxStudents: parseInt(e.target.value),
                      }))
                    }
                    min="1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  课程描述
                </label>
                <textarea
                  className="input"
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  取消
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? '创建中...' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
