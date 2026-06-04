import { useEffect, useState } from 'react'
import api from '../lib/axios'
import { ApiResponse, Department, Major, Class, Classroom, Semester, User } from '../types'
import { formatDate } from '../utils'

type ResourceType = 'departments' | 'majors' | 'classes' | 'classrooms' | 'semesters'

export default function Resources() {
  const [activeTab, setActiveTab] = useState<ResourceType>('departments')
  const [departments, setDepartments] = useState<Department[]>([])
  const [majors, setMajors] = useState<Major[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [teachers, setTeachers] = useState<User[]>([])
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const tabs = [
    { id: 'departments' as ResourceType, label: '院系管理', icon: '🏛️' },
    { id: 'majors' as ResourceType, label: '专业管理', icon: '📖' },
    { id: 'classes' as ResourceType, label: '班级管理', icon: '👥' },
    { id: 'classrooms' as ResourceType, label: '教室管理', icon: '🚪' },
    { id: 'semesters' as ResourceType, label: '学期管理', icon: '📅' },
  ]

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    try {
      const [
        deptRes,
        majorRes,
        classRes,
        classroomRes,
        semesterRes,
        teacherRes,
      ] = await Promise.all([
        api.get<ApiResponse<Department[]>>('/departments'),
        api.get<ApiResponse<Major[]>>('/majors'),
        api.get<ApiResponse<Class[]>>('/classes'),
        api.get<ApiResponse<Classroom[]>>('/classrooms'),
        api.get<ApiResponse<Semester[]>>('/semesters'),
        api.get<ApiResponse<User[]>>('/teachers'),
      ])

      setDepartments(deptRes.data.data || [])
      setMajors(majorRes.data.data || [])
      setClasses(classRes.data.data || [])
      setClassrooms(classroomRes.data.data || [])
      setSemesters(semesterRes.data.data || [])
      setTeachers(teacherRes.data.data || [])
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    const initialData: any = {}
    switch (activeTab) {
      case 'departments':
        initialData.name = ''
        initialData.code = ''
        initialData.description = ''
        break
      case 'majors':
        initialData.name = ''
        initialData.code = ''
        initialData.departmentId = ''
        break
      case 'classes':
        initialData.name = ''
        initialData.grade = new Date().getFullYear()
        initialData.majorId = ''
        initialData.counselorId = ''
        break
      case 'classrooms':
        initialData.building = ''
        initialData.roomNumber = ''
        initialData.seatCount = 50
        initialData.hasProjector = false
        initialData.description = ''
        break
      case 'semesters':
        initialData.name = ''
        initialData.academicYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
        initialData.startDate = ''
        initialData.endDate = ''
        initialData.courseSelectionStart = ''
        initialData.courseSelectionEnd = ''
        initialData.gradeEntryDeadline = ''
        initialData.isActive = false
        break
    }
    setFormData(initialData)
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      let endpoint = ''
      switch (activeTab) {
        case 'departments':
          endpoint = '/departments'
          break
        case 'majors':
          endpoint = '/majors'
          break
        case 'classes':
          endpoint = '/classes'
          break
        case 'classrooms':
          endpoint = '/classrooms'
          break
        case 'semesters':
          endpoint = '/semesters'
          break
      }

      await api.post(endpoint, formData)
      setShowModal(false)
      fetchAllData()
    } catch (error: any) {
      alert(error.response?.data?.error || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除吗？')) return

    try {
      let endpoint = ''
      switch (activeTab) {
        case 'departments':
          endpoint = `/departments/${id}`
          break
        case 'majors':
          endpoint = `/majors/${id}`
          break
        case 'classes':
          endpoint = `/classes/${id}`
          break
        case 'classrooms':
          endpoint = `/classrooms/${id}`
          break
        case 'semesters':
          endpoint = `/semesters/${id}`
          break
      }

      await api.delete(endpoint)
      fetchAllData()
    } catch (error: any) {
      alert(error.response?.data?.error || '删除失败')
    }
  }

  const handleSetActive = async (id: string) => {
    try {
      await api.put(`/semesters/${id}/set-active`)
      fetchAllData()
    } catch (error: any) {
      alert(error.response?.data?.error || '设置失败')
    }
  }

  const getModalTitle = () => {
    switch (activeTab) {
      case 'departments':
        return '新建院系'
      case 'majors':
        return '新建专业'
      case 'classes':
        return '新建班级'
      case 'classrooms':
        return '新建教室'
      case 'semesters':
        return '新建学期'
      default:
        return '新建'
    }
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">资源管理</h2>
        <button className="btn btn-primary" onClick={openCreateModal}>
          + 新建
        </button>
      </div>

      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`flex items-center space-x-2 px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'departments' && (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>院系名称</th>
                  <th>院系代码</th>
                  <th>专业数量</th>
                  <th>教师数量</th>
                  <th>课程数量</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {departments.map((dept) => (
                  <tr key={dept.id}>
                    <td className="font-medium">{dept.name}</td>
                    <td>{dept.code}</td>
                    <td>{dept._count?.majors || 0}</td>
                    <td>{dept._count?.users || 0}</td>
                    <td>{dept._count?.courses || 0}</td>
                    <td>
                      <button
                        className="text-red-600 hover:text-red-800 text-sm"
                        onClick={() => handleDelete(dept.id)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {departments.length === 0 && (
            <div className="text-center py-12 text-gray-500">暂该院系数据</div>
          )}
        </div>
      )}

      {activeTab === 'majors' && (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>专业名称</th>
                  <th>专业代码</th>
                  <th>所属院系</th>
                  <th>班级数量</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {majors.map((major) => (
                  <tr key={major.id}>
                    <td className="font-medium">{major.name}</td>
                    <td>{major.code}</td>
                    <td>{major.department?.name}</td>
                    <td>{major._count?.classes || 0}</td>
                    <td>
                      <button
                        className="text-red-600 hover:text-red-800 text-sm"
                        onClick={() => handleDelete(major.id)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {majors.length === 0 && (
            <div className="text-center py-12 text-gray-500">暂无专业数据</div>
          )}
        </div>
      )}

      {activeTab === 'classes' && (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>班级名称</th>
                  <th>年级</th>
                  <th>所属专业</th>
                  <th>所属院系</th>
                  <th>辅导员</th>
                  <th>学生人数</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {classes.map((cls) => (
                  <tr key={cls.id}>
                    <td className="font-medium">{cls.name}</td>
                    <td>{cls.grade}级</td>
                    <td>{cls.major?.name}</td>
                    <td>{cls.major?.department?.name}</td>
                    <td>{cls.counselor?.name || '-'}</td>
                    <td>{cls._count?.enrollments || 0}</td>
                    <td>
                      <button
                        className="text-red-600 hover:text-red-800 text-sm"
                        onClick={() => handleDelete(cls.id)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {classes.length === 0 && (
            <div className="text-center py-12 text-gray-500">暂无班级数据</div>
          )}
        </div>
      )}

      {activeTab === 'classrooms' && (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>楼栋</th>
                  <th>房间号</th>
                  <th>座位数</th>
                  <th>投影设备</th>
                  <th>排课数量</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {classrooms.map((classroom) => (
                  <tr key={classroom.id}>
                    <td className="font-medium">{classroom.building}</td>
                    <td>{classroom.roomNumber}</td>
                    <td>{classroom.seatCount}</td>
                    <td>
                      {classroom.hasProjector ? (
                        <span className="badge-green">有</span>
                      ) : (
                        <span className="badge-gray">无</span>
                      )}
                    </td>
                    <td>{classroom._count?.schedules || 0}</td>
                    <td>
                      {(classroom._count?.schedules || 0) > 0 ? (
                        <span className="badge-blue">使用中</span>
                      ) : (
                        <span className="badge-gray">空闲</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="text-red-600 hover:text-red-800 text-sm"
                        onClick={() => handleDelete(classroom.id)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {classrooms.length === 0 && (
            <div className="text-center py-12 text-gray-500">暂无教室数据</div>
          )}
        </div>
      )}

      {activeTab === 'semesters' && (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>学期名称</th>
                  <th>学年</th>
                  <th>开始日期</th>
                  <th>结束日期</th>
                  <th>选课期</th>
                  <th>成绩录入截止</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {semesters.map((semester) => (
                  <tr key={semester.id}>
                    <td className="font-medium">{semester.name}</td>
                    <td>{semester.academicYear}</td>
                    <td>{formatDate(semester.startDate)}</td>
                    <td>{formatDate(semester.endDate)}</td>
                    <td>
                      {formatDate(semester.courseSelectionStart)} ~{' '}
                      {formatDate(semester.courseSelectionEnd)}
                    </td>
                    <td>{formatDate(semester.gradeEntryDeadline)}</td>
                    <td>
                      {semester.isActive ? (
                        <span className="badge-green">当前学期</span>
                      ) : (
                        <span className="badge-gray">非活动</span>
                      )}
                    </td>
                    <td className="space-x-2">
                      {!semester.isActive && (
                        <button
                          className="text-blue-600 hover:text-blue-800 text-sm"
                          onClick={() => handleSetActive(semester.id)}
                        >
                          设为当前
                        </button>
                      )}
                      <button
                        className="text-red-600 hover:text-red-800 text-sm"
                        onClick={() => handleDelete(semester.id)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {semesters.length === 0 && (
            <div className="text-center py-12 text-gray-500">暂无学期数据</div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{getModalTitle()}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {activeTab === 'departments' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      院系名称 *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={formData.name || ''}
                      onChange={(e) =>
                        setFormData((prev: any) => ({ ...prev, name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      院系代码 *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={formData.code || ''}
                      onChange={(e) =>
                        setFormData((prev: any) => ({ ...prev, code: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      描述
                    </label>
                    <textarea
                      className="input"
                      rows={3}
                      value={formData.description || ''}
                      onChange={(e) =>
                        setFormData((prev: any) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                    />
                  </div>
                </>
              )}

              {activeTab === 'majors' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      专业名称 *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={formData.name || ''}
                      onChange={(e) =>
                        setFormData((prev: any) => ({ ...prev, name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      专业代码 *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={formData.code || ''}
                      onChange={(e) =>
                        setFormData((prev: any) => ({ ...prev, code: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      所属院系 *
                    </label>
                    <select
                      className="select"
                      value={formData.departmentId || ''}
                      onChange={(e) =>
                        setFormData((prev: any) => ({
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
                </>
              )}

              {activeTab === 'classes' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      班级名称 *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={formData.name || ''}
                      onChange={(e) =>
                        setFormData((prev: any) => ({ ...prev, name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      年级 *
                    </label>
                    <input
                      type="number"
                      className="input"
                      value={formData.grade || ''}
                      onChange={(e) =>
                        setFormData((prev: any) => ({
                          ...prev,
                          grade: parseInt(e.target.value),
                        }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      所属专业 *
                    </label>
                    <select
                      className="select"
                      value={formData.majorId || ''}
                      onChange={(e) =>
                        setFormData((prev: any) => ({ ...prev, majorId: e.target.value }))
                      }
                      required
                    >
                      <option value="">请选择专业</option>
                      {majors.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      辅导员
                    </label>
                    <select
                      className="select"
                      value={formData.counselorId || ''}
                      onChange={(e) =>
                        setFormData((prev: any) => ({
                          ...prev,
                          counselorId: e.target.value,
                        }))
                      }
                    >
                      <option value="">请选择辅导员</option>
                      {teachers
                        .filter((t) => t.role === 'COUNSELOR')
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              )}

              {activeTab === 'classrooms' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      楼栋 *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={formData.building || ''}
                      onChange={(e) =>
                        setFormData((prev: any) => ({
                          ...prev,
                          building: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      房间号 *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={formData.roomNumber || ''}
                      onChange={(e) =>
                        setFormData((prev: any) => ({
                          ...prev,
                          roomNumber: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      座位数 *
                    </label>
                    <input
                      type="number"
                      className="input"
                      value={formData.seatCount || ''}
                      onChange={(e) =>
                        setFormData((prev: any) => ({
                          ...prev,
                          seatCount: parseInt(e.target.value),
                        }))
                      }
                      min="1"
                      required
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="hasProjector"
                      className="w-4 h-4 text-blue-600 rounded"
                      checked={formData.hasProjector || false}
                      onChange={(e) =>
                        setFormData((prev: any) => ({
                          ...prev,
                          hasProjector: e.target.checked,
                        }))
                      }
                    />
                    <label
                      htmlFor="hasProjector"
                      className="ml-2 text-sm text-gray-700"
                    >
                      有投影设备
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      备注
                    </label>
                    <textarea
                      className="input"
                      rows={3}
                      value={formData.description || ''}
                      onChange={(e) =>
                        setFormData((prev: any) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                    />
                  </div>
                </>
              )}

              {activeTab === 'semesters' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      学期名称 *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={formData.name || ''}
                      onChange={(e) =>
                        setFormData((prev: any) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="如：2024-2025学年第一学期"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      学年 *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={formData.academicYear || ''}
                      onChange={(e) =>
                        setFormData((prev: any) => ({
                          ...prev,
                          academicYear: e.target.value,
                        }))
                      }
                      placeholder="如：2024-2025"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        开始日期 *
                      </label>
                      <input
                        type="date"
                        className="input"
                        value={formData.startDate || ''}
                        onChange={(e) =>
                          setFormData((prev: any) => ({
                            ...prev,
                            startDate: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        结束日期 *
                      </label>
                      <input
                        type="date"
                        className="input"
                        value={formData.endDate || ''}
                        onChange={(e) =>
                          setFormData((prev: any) => ({
                            ...prev,
                            endDate: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        选课开始 *
                      </label>
                      <input
                        type="date"
                        className="input"
                        value={formData.courseSelectionStart || ''}
                        onChange={(e) =>
                          setFormData((prev: any) => ({
                            ...prev,
                            courseSelectionStart: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        选课结束 *
                      </label>
                      <input
                        type="date"
                        className="input"
                        value={formData.courseSelectionEnd || ''}
                        onChange={(e) =>
                          setFormData((prev: any) => ({
                            ...prev,
                            courseSelectionEnd: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      成绩录入截止 *
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={formData.gradeEntryDeadline || ''}
                      onChange={(e) =>
                        setFormData((prev: any) => ({
                          ...prev,
                          gradeEntryDeadline: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isActive"
                      className="w-4 h-4 text-blue-600 rounded"
                      checked={formData.isActive || false}
                      onChange={(e) =>
                        setFormData((prev: any) => ({
                          ...prev,
                          isActive: e.target.checked,
                        }))
                      }
                    />
                    <label
                      htmlFor="isActive"
                      className="ml-2 text-sm text-gray-700"
                    >
                      设为当前学期
                    </label>
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
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
