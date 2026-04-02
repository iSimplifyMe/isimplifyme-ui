'use client'

import { useState } from 'react'

interface SearchFilterProps {
  onSearch: (query: string) => void
  placeholder?: string
  accentColor?: 'cobalt' | 'hazard'
}

const accentMap = {
  cobalt: {
    focus: 'focus:border-[#4a77ff]/50 focus:ring-[#4a77ff]/20',
    icon: 'text-[#4a77ff]',
  },
  hazard: {
    focus: 'focus:border-[#0EA5D6]/50 focus:ring-[#0EA5D6]/20',
    icon: 'text-[#0EA5D6]',
  },
}

export function SearchFilter({ onSearch, placeholder = 'Search articles...', accentColor = 'cobalt' }: SearchFilterProps) {
  const [query, setQuery] = useState('')
  const accent = accentMap[accentColor]

  const handleChange = (value: string) => {
    setQuery(value)
    onSearch(value)
  }

  return (
    <div className="relative">
      <svg
        className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 ${query ? accent.icon : 'text-concrete-400'} transition-colors`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-concrete-700/30 bg-white pl-10 pr-4 py-2.5 font-mono text-sm text-concrete-50 placeholder:text-concrete-400 outline-none transition-all duration-300 ${accent.focus} focus:ring-1`}
      />
      {query && (
        <button
          onClick={() => handleChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-concrete-400 hover:text-concrete-200 transition-colors"
          aria-label="Clear search"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
