// PROTOTYPE, throw away — floating variant switcher for "what should the
// Task Breakdown proposal review and Completed confirmation look like"
// (issue #107, see prototype/README.md). Wired into the Task Breakdown
// review route behind `?variant=`. Hidden outside dev so a stray merge
// to `dev`/`main` can't ship this bar to real users.
//
// Follows the `?variant=` switcher pattern from prototype/UI.md, same
// shape as the home-redesign prototype's switcher
// (prototype-home-redesign-switcher.tsx on prototype/home-redesign-maturity).
// One addition specific to this prototype: each value names both a
// layout direction (a/b/c) *and* a flow state (proposed/completed), so
// the same six-value cycle lets a reviewer flip between "what does the
// review look like" and "what does the payoff look like" for one
// direction without leaving the route — issue #107 asks for both to be
// judged together, as one consistent ending.
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect } from 'react'

export const TASK_ENDING_VARIANTS = [
  'current',
  'a-proposed',
  'a-completed',
  'b-proposed',
  'b-completed',
  'c-proposed',
  'c-completed',
] as const
export type TaskEndingVariant = (typeof TASK_ENDING_VARIANTS)[number]

const VARIANT_LABELS: Record<TaskEndingVariant, string> = {
  current: 'Current (shipped)',
  'a-proposed': 'A — Ordered list · Proposed',
  'a-completed': 'A — Ordered list · Completed',
  'b-proposed': 'B — Lightweight cards · Proposed',
  'b-completed': 'B — Lightweight cards · Completed',
  'c-proposed': 'C — Grouped by priority · Proposed',
  'c-completed': 'C — Grouped by priority · Completed',
}

// Optional and omitted for the 'current' default, same reasoning as the
// home-redesign switcher: only this one route knows about the prototype,
// so nothing else needs to pass a `variant` search value.
export interface TaskEndingSearch {
  variant?: TaskEndingVariant
}

export function parseTaskEndingVariant(value: unknown): TaskEndingVariant {
  return typeof value === 'string' && (TASK_ENDING_VARIANTS as readonly string[]).includes(value)
    ? (value as TaskEndingVariant)
    : 'current'
}

export function validateTaskEndingSearch(search: Record<string, unknown>): TaskEndingSearch {
  const variant = parseTaskEndingVariant(search.variant)
  return variant === 'current' ? {} : { variant }
}

export function PrototypeTaskEndingSwitcher({
  variant,
  onChange,
}: {
  variant: TaskEndingVariant
  onChange: (next: TaskEndingVariant) => void
}) {
  function cycle(direction: 1 | -1) {
    const index = TASK_ENDING_VARIANTS.indexOf(variant)
    const nextIndex = (index + direction + TASK_ENDING_VARIANTS.length) % TASK_ENDING_VARIANTS.length
    onChange(TASK_ENDING_VARIANTS[nextIndex])
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      if (event.key === 'ArrowLeft') cycle(-1)
      if (event.key === 'ArrowRight') cycle(1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant])

  if (!import.meta.env.DEV) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-black/10 bg-black px-1.5 py-1.5 text-white shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
      <button
        type="button"
        aria-label="Previous variant"
        onClick={() => cycle(-1)}
        className="flex size-7 items-center justify-center rounded-full hover:bg-white/15"
      >
        <ArrowLeft className="size-4" />
      </button>
      <span className="px-2 text-xs font-medium whitespace-nowrap">{VARIANT_LABELS[variant]}</span>
      <button
        type="button"
        aria-label="Next variant"
        onClick={() => cycle(1)}
        className="flex size-7 items-center justify-center rounded-full hover:bg-white/15"
      >
        <ArrowRight className="size-4" />
      </button>
    </div>
  )
}
