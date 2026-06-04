import { Search, X } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

export default function SearchBar({
  value,
  onChange,
  placeholder = '搜索景点、城市...',
}: SearchBarProps) {
  return (
    <div className="relative flex items-center">
      <Search
        size={18}
        className="pointer-events-none absolute left-3.5 text-ocean-300"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-base pl-10 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 text-ocean-300 hover:text-ocean-500"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
