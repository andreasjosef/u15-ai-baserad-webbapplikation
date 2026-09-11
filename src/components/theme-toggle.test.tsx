// Tests for the light/dark toggle (issue #83, row + collapsed variants
// in issue #116).
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { THEME_STORAGE_KEY } from '@/lib/theme'

import { ThemeToggle } from './theme-toggle.tsx'

beforeEach(() => {
  document.documentElement.classList.remove('dark')
  localStorage.clear()
})

describe('ThemeToggle (uncollapsed row, the default)', () => {
  it('renders a NavRow-style row: Moon icon, static label, trailing switch', () => {
    render(<ThemeToggle />)
    expect(screen.getByText('Dark mode')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('keeps the existing aria-label wiring on the switch', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('switch', { name: 'Switch to dark mode' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('starts unchecked when the document has no dark class', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('switch')).not.toBeChecked()
  })

  it('starts checked when the blocking script already applied dark', () => {
    document.documentElement.classList.add('dark')
    render(<ThemeToggle />)
    expect(screen.getByRole('switch')).toBeChecked()
  })

  it('applies the dark class, persists it, and checks itself when toggled on', () => {
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('switch'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(screen.getByRole('switch')).toBeChecked()
  })

  it('removes the dark class and persists light when toggled back off', () => {
    document.documentElement.classList.add('dark')
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('switch'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(screen.getByRole('switch')).not.toBeChecked()
  })
})

describe('ThemeToggle (collapsed icon button)', () => {
  it('renders a button, not a switch, with the Sun icon in light mode', () => {
    render(<ThemeToggle collapsed />)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveAttribute('title', 'Switch to dark mode')
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  // Issue #120: unlike the Settings row's button, the collapsed toggle is
  // a fixed-size `size="icon"` button that can't stretch across the rail,
  // so it must center itself explicitly to line up with the Settings icon
  // above it. jsdom does no layout, so the centering is asserted as the
  // class that produces it.
  it('centers itself horizontally in the rail to line up with the Settings row', () => {
    render(<ThemeToggle collapsed />)
    expect(screen.getByRole('button')).toHaveClass('mx-auto')
  })

  it('shows the Moon icon in dark mode', () => {
    document.documentElement.classList.add('dark')
    render(<ThemeToggle collapsed />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Switch to light mode')
  })

  it('applies the dark class and persists it when clicked', () => {
    render(<ThemeToggle collapsed />)
    fireEvent.click(screen.getByRole('button'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('removes the dark class and persists light when clicked again', () => {
    document.documentElement.classList.add('dark')
    render(<ThemeToggle collapsed />)
    fireEvent.click(screen.getByRole('button'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })
})
