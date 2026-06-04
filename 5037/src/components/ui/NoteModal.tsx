import { useState } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface NoteModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (content: string) => void
}

export default function NoteModal({ isOpen, onClose, onSubmit }: NoteModalProps) {
  const [content, setContent] = useState('')

  if (!isOpen) return null

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(content.trim())
      setContent('')
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-md rounded-card bg-cream p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-warm-brown">撰写笔记</h3>
          <button type="button" onClick={onClose} className="text-warm-muted hover:text-warm-brown">
            <X size={20} />
          </button>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="记录你的烹饪心得..."
          className="w-full resize-none rounded-lg border border-warm-gray bg-white p-3 text-sm text-warm-brown placeholder:text-warm-muted focus:outline-none focus:ring-2 focus:ring-brand-300"
          rows={5}
        />
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-pill bg-warm-gray px-4 py-2 text-sm font-medium text-warm-brown transition-colors hover:bg-warm-gray/80"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!content.trim()}
            className="rounded-pill bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            提交
          </button>
        </div>
      </div>
    </div>
  )
}
