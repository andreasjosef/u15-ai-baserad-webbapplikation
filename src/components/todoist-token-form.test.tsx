import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TokenSettingsForm } from './todoist-token-form.tsx'
import type { AuthResult } from '../lib/auth-result.ts'
import { parseTodoistToken } from '../lib/token-input.ts'

// The form's parser and copy are now per-row props (issue #136); the
// Todoist tests pass the Todoist bundle explicitly.
const todoistProps = {
  label: 'Todoist API token',
  placeholder: 'Paste your Todoist personal API token',
  parse: parseTodoistToken,
}

function deferredSubmit(resolution: AuthResult = { ok: true }) {
  const deferred: { resolve?: (result: AuthResult) => void } = {}
  const submit = vi.fn(
    () =>
      new Promise<AuthResult>((res) => {
        deferred.resolve = res
      }),
  )
  return { submit, resolve: (result: AuthResult = resolution) => deferred.resolve?.(result) }
}

function pasteToken(value: string) {
  fireEvent.input(screen.getByLabelText('Todoist API token'), {
    target: { value },
  })
  fireEvent.submit((screen.getByRole('button', { name: 'Save token' }) as HTMLButtonElement).form!)
}

describe('TokenSettingsForm', () => {
  it('submits the pasted token when valid', async () => {
    const { submit } = deferredSubmit()
    render(<TokenSettingsForm {...todoistProps} onSubmit={submit} />)

    pasteToken('  a1b2c3d4e5f6  ')

    await waitFor(() => {
      expect(submit).toHaveBeenCalledWith({ token: 'a1b2c3d4e5f6' })
    })
  })

  it('shows a validation error and skips the submit action for empty input', () => {
    const { submit } = deferredSubmit()
    render(<TokenSettingsForm {...todoistProps} onSubmit={submit} />)

    pasteToken('   ')

    expect(screen.getByRole('alert')).toHaveTextContent('Paste your Todoist API token.')
    expect(submit).not.toHaveBeenCalled()
  })

  it('never displays the token as it is typed (password-style input)', () => {
    const { submit } = deferredSubmit()
    render(<TokenSettingsForm {...todoistProps} onSubmit={submit} />)

    const input = screen.getByLabelText('Todoist API token') as HTMLInputElement
    expect(input.type).toBe('password')
    expect(submit).not.toHaveBeenCalled()
  })

  it('clears the input and confirms without echoing the token on success', async () => {
    const { submit, resolve } = deferredSubmit()
    render(<TokenSettingsForm {...todoistProps} onSubmit={submit} />)

    pasteToken('a1b2c3d4e5f6')
    await waitFor(() => expect(submit).toHaveBeenCalled())
    resolve({ ok: true })

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Token saved.')
    })
    const button = screen.getByRole('button') as HTMLButtonElement
    expect(button.disabled).toBe(false)
    expect((screen.getByLabelText('Todoist API token') as HTMLInputElement).value).toBe('')
    expect(screen.queryByText('a1b2c3d4e5f6')).not.toBeInTheDocument()
  })

  it('shows the failure message from a failed save', async () => {
    const { submit, resolve } = deferredSubmit()
    render(<TokenSettingsForm {...todoistProps} onSubmit={submit} />)

    pasteToken('a1b2c3d4e5f6')
    await waitFor(() => expect(submit).toHaveBeenCalled())
    resolve({ ok: false, message: 'Something went wrong. Please try again.' })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Something went wrong. Please try again.',
      )
    })
  })

  it('shows a retryable alert instead of crashing when the submit action throws', async () => {
    const submit = vi.fn(async () => {
      throw new Error('network gone')
    })
    render(<TokenSettingsForm {...todoistProps} onSubmit={submit} />)

    pasteToken('a1b2c3d4e5f6')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Something went wrong. Please try again.',
      )
    })
  })

  it('disables the submit button while the action is pending', async () => {
    const { submit, resolve } = deferredSubmit()
    render(<TokenSettingsForm {...todoistProps} onSubmit={submit} />)

    const button = screen.getByRole('button', { name: 'Save token' }) as HTMLButtonElement
    fireEvent.input(screen.getByLabelText('Todoist API token'), {
      target: { value: 'a1b2c3d4e5f6' },
    })
    fireEvent.submit(button.form!)

    await waitFor(() => expect(button.disabled).toBe(true))
    resolve({ ok: true })
    await waitFor(() => expect(button.disabled).toBe(false))
  })
})
