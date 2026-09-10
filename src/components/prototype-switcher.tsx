// PROTOTYPE SCAFFOLDING — not production UI. Shared floating bottom bar
// for any `/prototype`-style `?variant=` switcher on an existing route
// (see .claude/skills/prototype/UI.md). Reusable across prototypes; keep
// it generic rather than settings-specific.
//
// Hidden outside dev builds (`import.meta.env.PROD`) so a stray merge to
// main can't ship the bar to real users.
import { useEffect } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

export interface PrototypeVariant {
  key: string
  label: string
}

export interface PrototypeSwitcherProps {
  variants: ReadonlyArray<PrototypeVariant>
  current: string
  onChange: (key: string) => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  )
}

export function PrototypeSwitcher({ variants, current, onChange }: PrototypeSwitcherProps) {
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current),
  )

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return
      if (event.key === 'ArrowLeft') {
        onChange(variants[(index - 1 + variants.length) % variants.length].key)
      } else if (event.key === 'ArrowRight') {
        onChange(variants[(index + 1) % variants.length].key)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [index, variants, onChange])

  if (import.meta.env.PROD) return null

  const activeVariant = variants[index]

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex items-center gap-1 rounded-full bg-neutral-900 px-2 py-1.5 text-white shadow-lg ring-1 ring-white/10 dark:bg-neutral-100 dark:text-neutral-900">
        <button
          type="button"
          aria-label="Previous variant"
          onClick={() => onChange(variants[(index - 1 + variants.length) % variants.length].key)}
          className="rounded-full p-1.5 hover:bg-white/10 dark:hover:bg-black/10"
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
        </button>
        <span className="min-w-40 px-2 text-center text-xs font-medium tracking-wide">
          {activeVariant.key} — {activeVariant.label}
        </span>
        <button
          type="button"
          aria-label="Next variant"
          onClick={() => onChange(variants[(index + 1) % variants.length].key)}
          className="rounded-full p-1.5 hover:bg-white/10 dark:hover:bg-black/10"
        >
          <ChevronRightIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
