// Tests for the OpenRouter key form (issue #136), written the same way the
// Todoist-token form's tests are: the pure component renders with injected
// callbacks — no router, db, or network — so the component is the testable
// seam and the route stays thin.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { OpenRouterKeyForm } from './openrouter-key-form.tsx'
import type { AuthResult } from '../lib/auth-result.ts'

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

function pasteKey(value: string) {
  fireEvent.input(screen.getByLabelText('OpenRouter API key'), {
    target: { value },
  })
  fireEvent.submit((screen.getByRole('button', { name: 'Save key' }) as HTMLButtonElement).form!)
}

describe('OpenRouterKeyForm', () => {
  it('submits the pasted key when valid', async () => {
    const { submit } = deferredSubmit()
    render(<OpenRouterKeyForm onSubmit={submit} onClear={vi.fn()} />)

    pasteKey('  sk-or-v1-abc123  ')

    await waitFor(() => {
      expect(submit).toHaveBeenCalledWith({ token: 'sk-or-v1-abc123' })
    })
  })

  it('shows a validation error and skips the submit action for empty input', () => {
    const { submit } = deferredSubmit()
    render(<OpenRouterKeyForm onSubmit={submit} onClear={vi.fn()} />)

    pasteKey('   ')

    expect(screen.getByRole('alert')).toHaveTextContent('Paste your OpenRouter API key.')
    expect(submit).not.toHaveBeenCalled()
  })

  it('never displays the key as it is typed (password-style input)', () => {
    const { submit } = deferredSubmit()
    render(<OpenRouterKeyForm onSubmit={submit} onClear={vi.fn()} />)

    const input = screen.getByLabelText('OpenRouter API key') as HTMLInputElement
    expect(input.type).toBe('password')
    expect(submit).not.toHaveBeenCalled()
  })

  it('clears the input and confirms without echoing the key on save success', async () => {
    const { submit, resolve } = deferredSubmit()
    render(<OpenRouterKeyForm onSubmit={submit} onClear={vi.fn()} />)

    pasteKey('sk-or-v1-abc123')
    await waitFor(() => expect(submit).toHaveBeenCalled())
    resolve({ ok: true })

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Key saved.')
    })
    const saveButton = screen.getByRole('button', { name: 'Save key' }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(false)
    expect((screen.getByLabelText('OpenRouter API key') as HTMLInputElement).value).toBe('')
    expect(screen.queryByText('sk-or-v1-abc123')).not.toBeInTheDocument()
  })

  it('shows the failure message from a failed save', async () => {
    const { submit, resolve } = deferredSubmit()
    render(<OpenRouterKeyForm onSubmit={submit} onClear={vi.fn()} />)

    pasteKey('sk-or-v1-abc123')
    await waitFor(() => expect(submit).toHaveBeenCalled())
    resolve({ ok: false, message: 'Something went wrong. Please try again.' })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Something went wrong. Please try again.',
      )
    })
  })

  it('shows a retryable alert instead of crashing when the save action throws', async () => {
    const submit = vi.fn(async () => {
      throw new Error('network gone')
    })
    render(<OpenRouterKeyForm onSubmit={submit} onClear={vi.fn()} />)

    pasteKey('sk-or-v1-abc123')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Something went wrong. Please try again.',
      )
    })
  })

  it('calls the clear action and confirms without echoing anything', async () => {
    const { submit, resolve } = deferredSubmit()
    const onClear = vi.fn(
      () =>
        new Promise<AuthResult>((res) => {
          setTimeout(() => res({ ok: true }), 0)
        }),
    )
    render(<OpenRouterKeyForm onSubmit={submit} onClear={onClear} />)

    pasteKey('sk-or-v1-abc123')
    await waitFor(() => expect(submit).toHaveBeenCalled())
    resolve({ ok: true })
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Key saved.'))

    fireEvent.click(screen.getByRole('button', { name: 'Use shared key' }))

    await waitFor(() => {
      expect(onClear).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('status')).toHaveTextContent('Key cleared.')
    })
    expect((screen.getByLabelText('OpenRouter API key') as HTMLInputElement).value).toBe('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the failure message from a failed clear', async () => {
    const { submit } = deferredSubmit()
    const onClear = vi.fn(async () => ({ ok: false, message: 'Clear failed.' }) as const)
    render(<OpenRouterKeyForm onSubmit={submit} onClear={onClear} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use shared key' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Clear failed.')
    })
  })

  it('shows a retryable alert instead of crashing when the clear action throws', async () => {
    const { submit } = deferredSubmit()
    const onClear = vi.fn(async () => {
      throw new Error('network gone')
    })
    render(<OpenRouterKeyForm onSubmit={submit} onClear={onClear} />)

    fireEvent.click(screen.getByRole('button', { name: 'Use shared key' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Something went wrong. Please try again.',
      )
    })
  })

  it('disables both buttons while a save action is pending', async () => {
    const { submit, resolve } = deferredSubmit()
    const onClear = vi.fn(async () => ({ ok: true }) as const)
    render(<OpenRouterKeyForm onSubmit={submit} onClear={onClear} />)

    const saveButton = screen.getByRole('button', { name: 'Save key' }) as HTMLButtonElement
    const clearButton = screen.getByRole('button', {
      name: 'Use shared key',
    }) as HTMLButtonElement

    pasteKey('sk-or-v1-abc123')
    await waitFor(() => expect(saveButton.disabled).toBe(true))
    expect(clearButton.disabled).toBe(true)

    resolve({ ok: true })
    await waitFor(() => expect(saveButton.disabled).toBe(false))
    expect(clearButton.disabled).toBe(false)
  })

  it('disables both buttons while a clear action is pending', async () => {
    const { submit } = deferredSubmit()
    const deferredClear: { resolve?: (result: AuthResult) => void } = {}
    const onClear = vi.fn(
      () =>
        new Promise<AuthResult>((res) => {
          deferredClear.resolve = res
        }),
    )
    render(<OpenRouterKeyForm onSubmit={submit} onClear={onClear} />)

    const saveButton = screen.getByRole('button', { name: 'Save key' }) as HTMLButtonElement
    const clearButton = screen.getByRole('button', {
      name: 'Use shared key',
    }) as HTMLButtonElement

    fireEvent.click(clearButton)
    await waitFor(() => expect(clearButton.disabled).toBe(true))
    expect(saveButton.disabled).toBe(true)

    deferredClear.resolve?.({ ok: true })
    await waitFor(() => expect(clearButton.disabled).toBe(false))
    expect(saveButton.disabled).toBe(false)
  })
})
