// Tests for the light/dark toggle (issue #83).
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { THEME_STORAGE_KEY } from '@/lib/theme'

import { ThemeToggle } from './theme-toggle.tsx'

beforeEach(() => {
  document.documentElement.classList.remove('dark')
  localStorage.clear()
})

describe('ThemeToggle', () => {
  it('renders a labeled switch and no visible text', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('switch')).toHaveAccessibleName()
    expect(screen.queryByText(/light|dark/i)).not.toBeInTheDocument()
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
