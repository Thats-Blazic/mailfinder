'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, type LucideIcon } from 'lucide-react'

export type DarkSelectOption = {
  value: string
  label: string
  description?: string
  icon?: LucideIcon
}

export function DarkSelect({
  value,
  onChange,
  options,
  name,
  placeholder = 'Select',
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  options: DarkSelectOption[]
  name?: string
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find((option) => option.value === value)
  const SelectedIcon = selected?.icon

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-white/10 bg-[#0c1119] px-3 py-2 text-left text-sm text-white outline-none hover:border-white/20 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
      >
        {SelectedIcon && (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-cyan-300/10 text-cyan-300">
            <SelectedIcon className="size-4" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-white">{selected?.label || placeholder}</span>
          {selected?.description && (
            <span className="mt-0.5 block truncate text-[11px] text-slate-500">{selected.description}</span>
          )}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-slate-500 transition ${open ? 'rotate-180 text-cyan-300' : ''}`} />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-white/10 bg-[#121821] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,.45)]"
        >
          {options.map((option) => {
            const Icon = option.icon
            const active = option.value === value
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${
                    active ? 'bg-cyan-300/12 text-white' : 'text-slate-200 hover:bg-white/[.06]'
                  }`}
                >
                  {Icon && (
                    <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${active ? 'bg-cyan-300/15 text-cyan-300' : 'bg-white/[.04] text-slate-400'}`}>
                      <Icon className="size-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{option.label}</span>
                    {option.description && <span className="mt-0.5 block text-[11px] text-slate-500">{option.description}</span>}
                  </span>
                  {active && <Check className="size-4 shrink-0 text-cyan-300" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
