// Tests for the Interview view (issue #24). The component is pure —
// persistence and the model call arrive as an injected onSubmit, and the
// hand-off to the review route (issue #56) arrives as an injected
// onBreakdownProposed — so the whole conversation UI renders without a
// router, db, or network.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { InterviewView, type InterviewMessage } from './interview-view.tsx'
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
    expect(screen.getByText('What should we Hone?')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument()
  })

  // --- Full-height layout & empty-state placeholder (issue #87) -----------

  // Gated on `started` (messages.length > 0), not on draft content, so it
  // stays up while the user is still drafting their first message.
  it('keeps the placeholder visible while the first message is being drafted', () => {
    render(<InterviewView {...baseProps} />)
    fireEvent.change(screen.getByLabelText(/idea/i), {
      target: { value: 'I should sort out the garage' },
    })
    expect(screen.getByText('What should we Hone?')).toBeInTheDocument()
  })

  // It clears the moment the first message is actually sent — rerendering
  // with one message is what a successful turn looks like from the route.
  it('clears the placeholder once the first message is sent', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true })
    const { rerender } = render(
      <InterviewView {...baseProps} onSubmit={onSubmit} />,
    )
    fireEvent.change(screen.getByLabelText(/idea/i), {
      target: { value: 'I should sort out the garage' },
    })
    fireEvent.click(screen.getByRole('button', { name: /start/i }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())

    rerender(
      <InterviewView
        {...baseProps}
        messages={[{ role: 'user', content: 'I should sort out the garage' }]}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.queryByText('What should we Hone?')).not.toBeInTheDocument()
    expect(screen.getByText('I should sort out the garage')).toBeInTheDocument()
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
    // Relocated into the pinned footer (issue #87), not the scrolling
    // conversation region.
    expect(hint.closest('footer')).not.toBeNull()
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

  // --- Typing indicator (issue #89) ----------------------------------------

  // The indicator is the reply's placeholder bubble: appended at the end
  // of the message list, where the next interviewer turn will land. It
  // shares the interviewer bubble's shape and fill but holds three
  // animated dots instead of text — no "typing…" label and no spinner
  // anywhere else on the screen.
  it('appends a typing-indicator bubble to the message list while a turn is pending', () => {
    render(
      <InterviewView
        {...baseProps}
        pending
        messages={[
          { role: 'user', content: 'idea' },
          { role: 'assistant', content: 'question?' },
        ]}
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    const indicator = items[2]
    // Acceptance criterion: it shares INTERVIEWER_BUBBLE_CLASS's shape
    // and fill — class membership is the only honest check of that.
    expect(indicator).toHaveClass('rounded-2xl', 'bg-primary')
    // No text — just the three animated dots.
    expect(indicator).toHaveTextContent('')
    expect(indicator.querySelectorAll('span')).toHaveLength(3)
  })

  // Covers the "Starting…" case: the very first turn is pending and the
  // message list is still empty, so the indicator takes the invitation's
  // place at the spot where the first reply will land.
  it('shows the typing indicator alone while the first turn is starting', () => {
    render(<InterviewView {...baseProps} pending />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(1)
    expect(items[0].querySelectorAll('span')).toHaveLength(3)
    expect(screen.queryByText('What should we Hone?')).not.toBeInTheDocument()
  })

  it('hides the typing indicator when no turn is pending', () => {
    render(
      <InterviewView
        {...baseProps}
        messages={[
          { role: 'user', content: 'idea' },
          { role: 'assistant', content: 'question?' },
        ]}
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items.every((item) => item.textContent !== '')).toBe(true)
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

  // --- Auto-scroll to the newest message (issue #88) -----------------------

  // jsdom has no layout engine, so the scroll region's metrics are
  // pinned with property overrides and the behavior is observed through
  // the scrollTo call. The "was near bottom" judgement itself is unit
  // tested in scroll-near-bottom.test.ts with plain numbers.
  function pinScrollRegion(
    region: HTMLElement,
    metrics: { scrollTop: number; scrollHeight: number; clientHeight: number },
  ) {
    for (const [key, value] of Object.entries(metrics)) {
      Object.defineProperty(region, key, { value, configurable: true })
    }
  }

  function getScrollRegion(container: HTMLElement): HTMLElement {
    const region = container.querySelector('main > section')
    if (region === null) throw new Error('scroll region not found')
    return region as HTMLElement
  }

  it('scrolls the conversation region to the bottom when a message arrives while already near the bottom', () => {
    const initialMessages: InterviewMessage[] = [
      { role: 'user', content: 'idea' },
      { role: 'assistant', content: 'question?' },
    ]
    const { container, rerender } = render(
      <InterviewView {...baseProps} messages={initialMessages} />,
    )
    const region = getScrollRegion(container)
    pinScrollRegion(region, {
      scrollTop: 500,
      scrollHeight: 1000,
      clientHeight: 500,
    })
    const scrollTo = vi.fn()
    region.scrollTo = scrollTo
    scrollTo.mockClear() // discard any mount-time call

    rerender(
      <InterviewView
        {...baseProps}
        messages={[...initialMessages, { role: 'assistant', content: 'follow-up?' }]}
      />,
    )

    expect(scrollTo).toHaveBeenCalledWith({ top: 1000 })
  })

  it('leaves the scroll position untouched when the user has scrolled up and a message arrives', () => {
    const initialMessages: InterviewMessage[] = [
      { role: 'user', content: 'idea' },
      { role: 'assistant', content: 'question?' },
    ]
    const { container, rerender } = render(
      <InterviewView {...baseProps} messages={initialMessages} />,
    )
    const region = getScrollRegion(container)
    pinScrollRegion(region, {
      scrollTop: 0,
      scrollHeight: 1000,
      clientHeight: 500,
    })
    const scrollTo = vi.fn()
    region.scrollTo = scrollTo
    scrollTo.mockClear()

    // The user scrolled up to reread the first turn — the scroll event
    // is what tells the view they are no longer near the bottom.
    fireEvent.scroll(region)

    rerender(
      <InterviewView
        {...baseProps}
        messages={[...initialMessages, { role: 'assistant', content: 'follow-up?' }]}
      />,
    )

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('returns to auto-scrolling once the user scrolls back down to the bottom', () => {
    const initialMessages: InterviewMessage[] = [
      { role: 'user', content: 'idea' },
      { role: 'assistant', content: 'question?' },
    ]
    const { container, rerender } = render(
      <InterviewView {...baseProps} messages={initialMessages} />,
    )
    const region = getScrollRegion(container)
    pinScrollRegion(region, {
      scrollTop: 0,
      scrollHeight: 1000,
      clientHeight: 500,
    })
    const scrollTo = vi.fn()
    region.scrollTo = scrollTo
    scrollTo.mockClear()

    fireEvent.scroll(region) // scrolled up
    // Scrolled back down to the bottom.
    pinScrollRegion(region, {
      scrollTop: 500,
      scrollHeight: 1000,
      clientHeight: 500,
    })
    fireEvent.scroll(region)

    rerender(
      <InterviewView
        {...baseProps}
        messages={[...initialMessages, { role: 'assistant', content: 'follow-up?' }]}
      />,
    )

    expect(scrollTo).toHaveBeenCalledWith({ top: 1000 })
  })
})
