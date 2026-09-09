// The near-bottom check behind the Interview's auto-scroll (issue #88):
// a newly appended message only pulls the scroll region down when the
// user was already reading at the bottom — never when they have scrolled
// up to reread earlier turns. Pure arithmetic on the three layout
// metrics a scroll container exposes, so the threshold logic is
// unit-testable without jsdom's (absent) layout engine.
export interface ScrollMetrics {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

// How close to the bottom still counts as "reading at the bottom" —
// generous enough to absorb sub-pixel rounding and a hair of drag, small
// enough that an obvious scroll-up is never interrupted.
export const NEAR_BOTTOM_THRESHOLD_PX = 48

export function isNearBottom(
  { scrollTop, scrollHeight, clientHeight }: ScrollMetrics,
  threshold: number = NEAR_BOTTOM_THRESHOLD_PX,
): boolean {
  return scrollHeight - scrollTop - clientHeight <= threshold
}
