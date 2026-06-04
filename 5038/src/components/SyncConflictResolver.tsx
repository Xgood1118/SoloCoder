import React from 'react'
import { AlertTriangle, Check, X, Clock, Smartphone } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { formatDate } from '../utils/format'

export const SyncConflictResolver: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { syncConflicts, resolveConflict } = useApp()

  const unresolvedConflicts = syncConflicts.filter(c => !c.resolved)

  if (unresolvedConflicts.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-xl p-8 w-full max-w-md text-center" onClick={e => e.stopPropagation()}>
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-bold mb-2">同步状态良好</h3>
          <p className="text-gray-500 mb-6">所有设备的照片都已成功同步，没有冲突。</p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            关闭
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg">同步冲突处理</h3>
              <p className="text-sm text-gray-500">
                {unresolvedConflicts.length} 个照片存在多设备上传冲突
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-amber-50 border-b">
          <div className="flex items-start gap-2">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">同步优先级说明</p>
              <p className="mt-1">系统默认按以下优先级保留照片：</p>
              <ol className="list-decimal list-inside mt-1 text-amber-700">
                <li>修改时间最新的照片</li>
                <li>文件质量更高（分辨率/大小）的照片</li>
                <li>先上传的照片</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {unresolvedConflicts.map(conflict => (
            <div key={conflict.id} className="border rounded-xl overflow-hidden">
              <div className="bg-red-50 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="font-medium text-red-800">{conflict.photoName}</span>
                </div>
                <span className="text-sm text-red-600">{formatDate(conflict.createdAt)}</span>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-3">
                  以下设备同时上传了此照片，请选择要保留的版本：
                </p>
                <div className="space-y-2">
                  {conflict.devices.map((device, index) => (
                    <label
                      key={device}
                      className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <input
                        type="radio"
                        name={`conflict-${conflict.id}`}
                        className="sr-only"
                        onChange={() => resolveConflict(conflict.id, device)}
                      />
                      <Smartphone className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <div className="font-medium">{device}</div>
                        <div className="text-xs text-gray-500">
                          {index === 0 ? '推荐保留 - 最新修改时间' : '其他版本'}
                        </div>
                      </div>
                      <button
                        onClick={() => resolveConflict(conflict.id, device)}
                        className="px-3 py-1 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600"
                      >
                        保留此版本
                      </button>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
