import { useEffect, useState } from 'react'
import api from '../lib/axios'
import { ApiResponse, Notification, NotificationType } from '../types'
import { formatDateTime, notificationTypeMap } from '../utils'

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<NotificationType | 'all'>('all')
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [loading, setLoading] = useState(true)
  const [markingRead, setMarkingRead] = useState<string | null>(null)

  useEffect(() => {
    fetchNotifications()
  }, [filter, readFilter])

  const fetchNotifications = async () => {
    try {
      const params: any = {}
      if (filter !== 'all') {
        params.type = filter
      }
      if (readFilter === 'unread') {
        params.isRead = false
      } else if (readFilter === 'read') {
        params.isRead = true
      }

      const response = await api.get<ApiResponse<Notification[]>>('/notifications', { params })
      setNotifications(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (id: string) => {
    setMarkingRead(id)
    try {
      await api.put(`/notifications/${id}/read`)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      )
    } catch (error) {
      console.error('Failed to mark as read:', error)
    } finally {
      setMarkingRead(null)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all')
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  const getUnreadCount = () => {
    return notifications.filter((n) => !n.isRead).length
  }

  const getNotificationIcon = (type: NotificationType) => {
    const icons: Record<NotificationType, string> = {
      [NotificationType.LOW_ENROLLMENT]: '⚠️',
      [NotificationType.GRADE_DEADLINE_REMINDER]: '📝',
      [NotificationType.GRADE_OVERDUE]: '🔴',
      [NotificationType.SCHEDULE_CONFLICT]: '⚡',
      [NotificationType.SYSTEM_ANNOUNCEMENT]: '📢',
    }
    return icons[type] || '📬'
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">通知中心</h2>
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-500">
            未读：<span className="font-bold text-red-500">{getUnreadCount()}</span> 条
          </span>
          {getUnreadCount() > 0 && (
            <button className="btn btn-secondary text-sm" onClick={handleMarkAllAsRead}>
              全部标记已读
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">通知类型</label>
            <select
              className="select w-40"
              value={filter}
              onChange={(e) => setFilter(e.target.value as NotificationType | 'all')}
            >
              <option value="all">全部类型</option>
              {Object.values(NotificationType).map((type) => (
                <option key={type} value={type}>
                  {notificationTypeMap[type].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">阅读状态</label>
            <select
              className="select w-40"
              value={readFilter}
              onChange={(e) => setReadFilter(e.target.value as 'all' | 'unread' | 'read')}
            >
              <option value="all">全部</option>
              <option value="unread">未读</option>
              <option value="read">已读</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 rounded-lg border transition-all cursor-pointer ${
                notification.isRead
                  ? 'bg-white border-gray-200 opacity-75'
                  : 'bg-blue-50 border-blue-200'
              }`}
              onClick={() => {
                if (!notification.isRead) {
                  handleMarkAsRead(notification.id)
                }
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-semibold text-gray-800">{notification.title}</h4>
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${notificationTypeMap[notification.type].className}`}
                      >
                        {notificationTypeMap[notification.type].label}
                      </span>
                      {!notification.isRead && (
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm whitespace-pre-line">
                      {notification.content}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {formatDateTime(notification.createdAt)}
                    </p>
                  </div>
                </div>
                {!notification.isRead && (
                  <button
                    className="text-blue-600 hover:text-blue-800 text-sm ml-4"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMarkAsRead(notification.id)
                    }}
                    disabled={markingRead === notification.id}
                  >
                    {markingRead === notification.id ? '处理中...' : '标记已读'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {notifications.length === 0 && (
          <div className="text-center py-16">
            <span className="text-6xl">📭</span>
            <p className="mt-4 text-gray-500">暂无通知</p>
          </div>
        )}
      </div>

      {notifications.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">通知统计</h3>
          <div className="grid grid-cols-5 gap-4">
            {Object.values(NotificationType).map((type) => {
              const count = notifications.filter((n) => n.type === type).length
              const unread = notifications.filter(
                (n) => n.type === type && !n.isRead
              ).length
              return (
                <div
                  key={type}
                  className="text-center p-4 bg-gray-50 rounded-lg"
                >
                  <div className="text-2xl mb-1">{getNotificationIcon(type)}</div>
                  <div className="text-sm text-gray-500 mb-1">
                    {notificationTypeMap[type].label}
                  </div>
                  <div className="text-xl font-bold text-gray-800">
                    {count}
                    {unread > 0 && (
                      <span className="text-red-500 text-sm ml-1">({unread})</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
