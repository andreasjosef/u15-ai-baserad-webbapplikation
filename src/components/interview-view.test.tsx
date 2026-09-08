// Tests for the Interview view (issue #24). The component is pure —
// persistence and the model call arrive as an injected onSubmit, and the
// hand-off to the review route (issue #56) arrives as an injected
// onBreakdownProposed — so the whole conversation UI renders without a
// router, db, or network.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { InterviewView } from './interview-view.tsx'
import type { Phase } from '../lib/phase.ts'

const baseProps = {
  messages: [],
  pending: false,
  phase: 'Defining' as Phase,
  projectSummary: null,
  onBreakdownProposed: vi.fn(),
  onSubmit: vi.fn(),
}

describe('InterviewView', () => {
  it('invites a vague idea before the conversation starts', () => {
    render(<InterviewView {...baseProps} />)
    expect(screen.getByRole('heading', { name: /hone/i })).toBeInTheDocument()
    expect(
      screen.getByText(/what.*(idea|working on)/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument()
  })

  it('renders the conversation in order, with the assistant questions and user answers', () => {
    render(
      <InterviewView
        {...baseProps}
        messages={[
          { role: 'user', content: 'I should sort out the garage' },
          { role: 'assistant', content: 'What does "sorted out" mean to you?' },
          { role: 'user', content: 'Everything out, floor swept' },
          { role: 'assistant', content: 'When do you want it done?' },
        ]}
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(items[0]).toHaveTextContent('I should sort out the garage')
    expect(items[1]).toHaveTextContent('What does "sorted out" mean to you?')
  })

  it('shows a persistent checkpoint hint once the summary exists, phrased as the project read-back', () => {
    render(
      <InterviewView
        {...baseProps}
        phase="Drilling"
        projectSummary="Sort out the garage before winter"
      />,
    )
    const hint = screen.getByRole('status')
    expect(hint).toHaveTextContent('Sort out the garage before winter')
  })

  it('submits the typed message and clears the box on success', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true })
    render(<InterviewView {...baseProps} onSubmit={onSubmit} />)
    const textarea = screen.getByLabelText(/idea/i)
    fireEvent.change(textarea, { target: { value: 'I should sort out the garage' } })
    fireEvent.click(screen.getByRole('button', { name: /start/i }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('I should sort out the garage'))
    await waitFor(() => expect(textarea).toHaveValue(''))
  })

  it('shows a failure as a retryable alert and keeps the typed message', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, message: 'Something went wrong reaching the interviewer. Try again.' })
    render(<InterviewView {...baseProps} onSubmit={onSubmit} />)
    const textarea = screen.getByLabelText(/idea/i)
    fireEvent.change(textarea, { target: { value: 'I should sort out the garage' } })
    fireEvent.click(screen.getByRole('button', { name: /start/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/try again/i))
    expect(textarea).toHaveValue('I should sort out the garage')
  })

  it('disables the submit button while a turn is pending', () => {
    render(<InterviewView {...baseProps} pending />)
    expect(screen.getByRole('button', { name: /start|send/i })).toBeDisabled()
  })

  it('labels the submit button Send once the conversation has started', () => {
    render(
      <InterviewView
        {...baseProps}
        messages={[
          { role: 'user', content: 'idea' },
          { role: 'assistant', content: 'question?' },
        ]}
      />,
    )
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /start/i })).not.toBeInTheDocument()
  })

  // --- Hand-off to the review route (issue #56) ---------------------------

  it('navigates to the review route the instant a turn proposes a breakdown', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true, breakdownProposed: true })
    const onBreakdownProposed = vi.fn()
    render(
      <InterviewView
        {...baseProps}
        messages={[
          { role: 'user', content: 'idea' },
          { role: 'assistant', content: 'question?' },
        ]}
        onSubmit={onSubmit}
        onBreakdownProposed={onBreakdownProposed}
      />,
    )
    fireEvent.change(screen.getByLabelText(/answer/i), { target: { value: 'that all sounds right' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(onBreakdownProposed).toHaveBeenCalledTimes(1))
  })

  it('does not navigate away on an ordinary turn that proposes nothing', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true })
    const onBreakdownProposed = vi.fn()
    render(
      <InterviewView
        {...baseProps}
        onSubmit={onSubmit}
        onBreakdownProposed={onBreakdownProposed}
      />,
    )
    fireEvent.change(screen.getByLabelText(/idea/i), { target: { value: 'sort out the garage' } })
    fireEvent.click(screen.getByRole('button', { name: /start/i }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onBreakdownProposed).not.toHaveBeenCalled()
  })

  it('never renders a review table or wrapped-up state of its own', () => {
    render(
      <InterviewView
        {...baseProps}
        phase="Drilling"
        projectSummary="Sort out the garage"
        messages={[
          { role: 'user', content: 'idea' },
          { role: 'assistant', content: 'question?' },
        ]}
      />,
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText(/tasks are in todoist/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/answer/i)).toBeInTheDocument()
  })
})
