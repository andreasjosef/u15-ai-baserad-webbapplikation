import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AuthForm } from './auth-form.tsx'
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

describe('AuthForm in log-in mode', () => {
  it('submits parsed email and password when valid', async () => {
    const { submit } = deferredSubmit()
    render(<AuthForm mode="log-in" onSubmit={submit} />)

    fireEvent.input(screen.getByLabelText('Email'), {
      target: { value: 'Person@Example.com' },
    })
    fireEvent.input(screen.getByLabelText('Password'), {
      target: { value: 'correct horse battery staple' },
    })
    fireEvent.submit((screen.getByRole('button', { name: 'Log in' }) as HTMLButtonElement).form!)

    await waitFor(() => {
      expect(submit).toHaveBeenCalledWith({
        name: '',
        email: 'person@example.com',
        password: 'correct horse battery staple',
      })
    })
  })

  it('shows a validation error and skips the submit action for a malformed email', async () => {
    const { submit } = deferredSubmit()
    render(<AuthForm mode="log-in" onSubmit={submit} />)

    fireEvent.input(screen.getByLabelText('Email'), {
      target: { value: 'not-an-email' },
    })
    fireEvent.input(screen.getByLabelText('Password'), {
      target: { value: 'whatever-8+' },
    })
    fireEvent.submit((screen.getByRole('button', { name: 'Log in' }) as HTMLButtonElement).form!)

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.')
    expect(submit).not.toHaveBeenCalled()
  })

  it('shows the failure message from a failed log-in', async () => {
    const { submit, resolve } = deferredSubmit()
    render(<AuthForm mode="log-in" onSubmit={submit} />)

    fireEvent.input(screen.getByLabelText('Email'), {
      target: { value: 'person@example.com' },
    })
    fireEvent.input(screen.getByLabelText('Password'), {
      target: { value: 'wrong-password' },
    })
    fireEvent.submit((screen.getByRole('button', { name: 'Log in' }) as HTMLButtonElement).form!)

    await waitFor(() => expect(submit).toHaveBeenCalled())
    resolve({ ok: false, message: 'Invalid email or password.' })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.')
    })
  })

  it('shows a retryable alert instead of crashing when the submit action throws', async () => {
    const submit = vi.fn(async () => {
      throw new Error('network gone')
    })
    render(<AuthForm mode="log-in" onSubmit={submit} />)

    fireEvent.input(screen.getByLabelText('Email'), {
      target: { value: 'person@example.com' },
    })
    fireEvent.input(screen.getByLabelText('Password'), {
      target: { value: 'whatever-8+' },
    })
    fireEvent.submit((screen.getByRole('button', { name: 'Log in' }) as HTMLButtonElement).form!)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Something went wrong. Please try again.',
      )
    })
  })

  it('disables the submit button while the action is pending', async () => {
    const { submit, resolve } = deferredSubmit()
    render(<AuthForm mode="log-in" onSubmit={submit} />)

    fireEvent.input(screen.getByLabelText('Email'), {
      target: { value: 'person@example.com' },
    })
    fireEvent.input(screen.getByLabelText('Password'), {
      target: { value: 'whatever-8+' },
    })
    const button = screen.getByRole('button', { name: 'Log in' })
    fireEvent.submit((button as HTMLButtonElement).form!)

    await waitFor(() => {
      expect((button as HTMLButtonElement).disabled).toBe(true)
    })
    resolve({ ok: true })
    await waitFor(() => {
      expect((button as HTMLButtonElement).disabled).toBe(false)
    })
  })
})

describe('AuthForm in sign-up mode', () => {
  it('has a name field and submits parsed name, email and password', async () => {
    const { submit } = deferredSubmit()
    render(<AuthForm mode="sign-up" onSubmit={submit} />)

    fireEvent.input(screen.getByLabelText('Name'), { target: { value: ' Test User ' } })
    fireEvent.input(screen.getByLabelText('Email'), {
      target: { value: 'person@example.com' },
    })
    fireEvent.input(screen.getByLabelText('Password'), {
      target: { value: 'long-enough-pass' },
    })
    fireEvent.submit((screen.getByRole('button', { name: 'Sign up' }) as HTMLButtonElement).form!)

    await waitFor(() => {
      expect(submit).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'person@example.com',
        password: 'long-enough-pass',
      })
    })
  })

  it('rejects a too-short password client-side without submitting', async () => {
    const { submit } = deferredSubmit()
    render(<AuthForm mode="sign-up" onSubmit={submit} />)

    fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Test User' } })
    fireEvent.input(screen.getByLabelText('Email'), {
      target: { value: 'person@example.com' },
    })
    fireEvent.input(screen.getByLabelText('Password'), { target: { value: 'short7' } })
    fireEvent.submit((screen.getByRole('button', { name: 'Sign up' }) as HTMLButtonElement).form!)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Password must be at least 8 characters.',
    )
    expect(submit).not.toHaveBeenCalled()
  })
})
