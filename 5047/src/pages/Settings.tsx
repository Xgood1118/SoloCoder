import { useState } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import type { AudioQuality } from '@/types'
import {
  Settings as SettingsIcon, Headphones, Music, Wifi, CheckCircle, Smartphone,
  Link, Unlink, HardDrive, FolderPlus, Folder, X, RefreshCw, Loader2,
} from 'lucide-react'

const qualityOptions: { key: AudioQuality; icon: typeof Headphones; label: string; desc: string; size: string; badge?: string }[] = [
  { key: 'high', icon: Headphones, label: '高品质', desc: 'FLAC / 无损', size: '约 30-50 MB/首', badge: '最佳音质' },
  { key: 'medium', icon: Music, label: '中等', desc: 'AAC 256kbps', size: '约 8-15 MB/首' },
  { key: 'standard', icon: Wifi, label: '标准', desc: 'AAC 128kbps', size: '约 3-8 MB/首' },
]

export default function Settings() {
  const { audioQuality, setAudioQuality, appleMusicConnected, setAppleMusicConnected, localFolders, addLocalFolder, removeLocalFolder } = useSettingsStore()
  const [connecting, setConnecting] = useState(false)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [folderInput, setFolderInput] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)

  const handleConnect = () => {
    setConnecting(true)
    setTimeout(() => {
      setAppleMusicConnected(true)
      setConnecting(false)
    }, 2000)
  }

  const handleAddFolder = () => {
    if (folderInput.trim()) {
      addLocalFolder(folderInput.trim())
      setFolderInput('')
      setShowFolderModal(false)
    }
  }

  const handleScan = () => {
    setScanning(true)
    setScanResult(null)
    setTimeout(() => {
      setScanning(false)
      setScanResult(`已扫描 ${12 + localFolders.length * 8} 首歌曲`)
    }, 1500)
  }

  return (
    <div className="p-6 pb-32 overflow-y-auto h-full animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon className="w-8 h-8 text-amber" />
        <h1 className="font-display text-3xl font-bold text-gradient-amber">设置</h1>
      </div>

      {/* 音质偏好 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <Headphones className="w-5 h-5 text-amber" />
          <h2 className="font-display font-semibold text-lg text-white">音质偏好</h2>
        </div>
        <p className="text-zinc-400 text-sm mb-5">选择适合您的音质级别，高品质音频将消耗更多流量</p>
        <div className="grid grid-cols-3 gap-4">
          {qualityOptions.map(({ key, icon: Icon, label, desc, size, badge }) => (
            <button
              key={key}
              onClick={() => setAudioQuality(key)}
              className={`glass-card-hover p-5 text-center relative ${audioQuality === key ? 'border-amber border-2 amber-glow' : ''}`}
            >
              {audioQuality === key && <CheckCircle className="w-5 h-5 text-amber absolute top-2 right-2" />}
              <Icon className={`w-8 h-8 mx-auto mb-3 ${audioQuality === key ? 'text-amber' : 'text-zinc-400'}`} />
              <div className={`font-display font-semibold mb-1 ${audioQuality === key ? 'text-amber' : 'text-white'}`}>{label}</div>
              <div className="text-zinc-400 text-sm">{desc}</div>
              <div className="text-zinc-500 text-xs mt-1">{size}</div>
              {badge && <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-amber/10 text-amber rounded-full">{badge}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Apple Music */}
      <div className="glass-card p-6 mt-6">
        <div className="flex items-center gap-2 mb-1">
          <Smartphone className="w-5 h-5 text-amber" />
          <h2 className="font-display font-semibold text-lg text-white">Apple Music</h2>
        </div>
        <p className="text-zinc-400 text-sm mb-4">连接您的 Apple Music 订阅，同步您的音乐内容</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${appleMusicConnected ? 'bg-green-500' : 'bg-zinc-500'}`} />
            <span className={appleMusicConnected ? 'text-green-400' : 'text-zinc-500'}>{appleMusicConnected ? '已连接' : '未连接'}</span>
            {appleMusicConnected && <span className="text-zinc-500 text-sm ml-2">用户: melodia_user</span>}
          </div>
          {!appleMusicConnected ? (
            <button onClick={handleConnect} disabled={connecting} className="btn-primary flex items-center gap-2">
              {connecting ? <><Loader2 className="w-4 h-4 animate-spin" /> 正在连接 Apple Music...</> : <><Link className="w-4 h-4" /> 连接 Apple Music</>}
            </button>
          ) : (
            <button onClick={() => setAppleMusicConnected(false)} className="btn-ghost flex items-center gap-2 text-coral">
              <Unlink className="w-4 h-4" /> 断开连接
            </button>
          )}
        </div>

        {connecting && (
          <div className="mt-4 flex items-center justify-center gap-3 py-6 bg-charcoal/40 rounded-xl">
            <Loader2 className="w-6 h-6 text-amber animate-spin" />
            <span className="text-zinc-300">正在连接 Apple Music...</span>
          </div>
        )}

        {appleMusicConnected && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <h3 className="font-display font-semibold text-white mb-3">同步内容</h3>
            <div className="space-y-2">
              {[['已购音乐', true], ['个人歌单', true], ['收藏歌曲', true]].map(([label, checked]) => (
                <label key={String(label)} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" defaultChecked={checked as boolean} className="w-4 h-4 rounded border-white/20 bg-charcoal/60 text-amber focus:ring-amber/30" />
                  <span className="text-zinc-300">{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 本地文件 */}
      <div className="glass-card p-6 mt-6">
        <div className="flex items-center gap-2 mb-1">
          <HardDrive className="w-5 h-5 text-amber" />
          <h2 className="font-display font-semibold text-lg text-white">本地文件</h2>
        </div>
        <p className="text-zinc-400 text-sm mb-4">导入本地音乐文件到播放器中</p>

        <button onClick={() => setShowFolderModal(true)} className="btn-ghost flex items-center gap-2 mb-4">
          <FolderPlus className="w-4 h-4" /> 添加文件夹
        </button>

        {localFolders.length > 0 && (
          <div className="space-y-2 mb-4">
            {localFolders.map((folder) => (
              <div key={folder} className="flex items-center gap-3 p-3 bg-charcoal/40 rounded-xl">
                <Folder className="w-4 h-4 text-amber shrink-0" />
                <span className="text-zinc-300 text-sm truncate flex-1">{folder}</span>
                <button onClick={() => removeLocalFolder(folder)} className="text-zinc-500 hover:text-coral transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-zinc-500 text-sm mb-4">支持格式：MP3, FLAC, WAV, AAC, OGG</p>

        <button onClick={handleScan} disabled={scanning} className="btn-primary flex items-center gap-2">
          {scanning ? <><Loader2 className="w-4 h-4 animate-spin" /> 扫描中...</> : <><RefreshCw className="w-4 h-4" /> 扫描本地文件</>}
        </button>
        {scanResult && <p className="text-amber text-sm mt-3">{scanResult}</p>}
      </div>

      {/* 添加文件夹弹窗 */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowFolderModal(false)}>
          <div className="glass-card p-6 w-full max-w-md mx-4 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-semibold text-lg text-white mb-4">选择文件夹</h3>
            <input
              type="text"
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              placeholder="请输入文件夹路径..."
              className="input-dark w-full mb-4"
              onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowFolderModal(false)} className="btn-ghost">取消</button>
              <button onClick={handleAddFolder} className="btn-primary">确认添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
