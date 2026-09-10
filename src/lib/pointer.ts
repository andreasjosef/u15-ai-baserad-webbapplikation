// Pointer-media module (issue #134): whether the device's primary input
// is fine (mouse/trackpad-class) rather than coarse (touch). The
// Interview composer's autofocus is gated on this — a coarse-pointer
// device would open its on-screen keyboard unsolicited on focus, so
// there the textarea must never be focused programmatically.
//
// Mirrors `theme.ts`'s shape: a pure read of the current media query,
// falling back to fine when `matchMedia` is unsupported (those browsers
// are desktop-class; the keyboard-first flow keeps working there).
export function prefersFinePointer(): boolean {
  if (typeof window.matchMedia !== 'function') {
    return true
  }
  return window.matchMedia('(pointer: fine)').matches
}
