// Tests for the History view (issue #27). The component is pure — the
// expanded row's data arrives through an injected onOpenSession loader
// — so the whole accordion renders without a router, db, or network.
// Read-only everywhere: every Phase shows, but nothing offers a way
// back into the Interview (plan.md §13's single-sitting decision).
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  HistoryView,
  type HistoryDetail,
  type HistoryDetailResult,
  type HistorySessionRow,
} from './history-view.tsx'

function row(overrides: Partial<HistorySessionRow>): HistorySessionRow {
  return {
    sessionId: 's1',
    createdAt: new Date('2026-09-01T12:00:00Z'),
    phase: 'Completed',
    projectSummary: null,
    projectTitle: 'Garage cleanup',
    taskCount: 3,
    ...overrides,
  }
}

const detail: HistoryDetail = {
  projectTitle: 'Garage cleanup',
  projectSummary: 'Sort out the garage',
  transcript: [
    { role: 'user', content: 'I should sort out the garage' },
    { role: 'assistant', content: 'What does sorting out look like to you?' },
  ],
  tasks: [
    { title: 'Clear out old boxes', description: 'The green bags', priority: 'high', dueString: 'this weekend' },
    { title: 'Take donations to the tip', description: null, priority: null, dueString: null },
  ],
}

const sessions: Array<HistorySessionRow> = [
  row({
    sessionId: 'newer',
    createdAt: new Date('2026-09-03T12:00:00Z'),
    phase: 'Drilling',
    projectTitle: null,
    projectSummary: 'Healthier eating',
    taskCount: 0,
  }),
  row({ sessionId: 'older', createdAt: new Date('2026-09-01T12:00:00Z'), phase: 'Completed' }),
]

const baseProps = {
  sessions,
  onOpenSession: vi.fn(async (): Promise<HistoryDetailResult> => ({ ok: true, detail })),
}

describe('HistoryView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders one collapsed row per session, most-recent-first as given', () => {
    render(<HistoryView {...baseProps} />)

    const list = screen.getByRole('list')
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(2)

    const newer = within(rows[0]!)
    expect(newer.getByText(/healthier eating/i)).toBeInTheDocument()
    expect(newer.getByText('Drilling')).toBeInTheDocument()
    expect(newer.getByText(/2026/)).toBeInTheDocument()
    expect(newer.getByText(/no tasks/i)).toBeInTheDocument()

    const older = within(rows[1]!)
    expect(older.getByText(/garage cleanup/i)).toBeInTheDocument()
    expect(older.getByText('Completed')).toBeInTheDocument()
    expect(older.getByText(/3 tasks/i)).toBeInTheDocument()
  })

  it('falls back to Untitled interview when a row has no title or summary', () => {
    render(<HistoryView {...baseProps} sessions={[row({ projectTitle: null, projectSummary: null })]} />)
    expect(screen.getByText(/untitled interview/i)).toBeInTheDocument()
  })

  it('expands a row in place with the transcript when clicked', async () => {
    render(<HistoryView {...baseProps} />)
    fireEvent.click(screen.getByText(/garage cleanup/i))

    await waitFor(() => expect(baseProps.onOpenSession).toHaveBeenCalledWith('older'))
    expect(screen.getByText(/what does sorting out look like/i)).toBeInTheDocument()
    // Accordion, not a separate detail surface — the list is still there.
    expect(screen.getByRole('list')).toBeInTheDocument()
  })

  it('shows the task breakdown behind a Task Breakdown tab, read-only', async () => {
    render(<HistoryView {...baseProps} />)
    fireEvent.click(screen.getByText(/garage cleanup/i))
    await screen.findByText(/what does sorting out look like/i)

    fireEvent.click(screen.getByRole('tab', { name: /task breakdown/i }))

    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText(/clear out old boxes/i)).toBeInTheDocument()
    expect(within(panel).getByText(/the green bags/i)).toBeInTheDocument()
    expect(within(panel).getByText(/this weekend/i)).toBeInTheDocument()
    // Read-only: no editable inputs anywhere in the breakdown.
    expect(within(panel).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(panel).queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('switches back to the transcript tab', async () => {
    render(<HistoryView {...baseProps} />)
    fireEvent.click(screen.getByText(/garage cleanup/i))
    await screen.findByText(/what does sorting out look like/i)

    fireEvent.click(screen.getByRole('tab', { name: /task breakdown/i }))
    fireEvent.click(screen.getByRole('tab', { name: /transcript/i }))

    await waitFor(() =>
      expect(screen.getByText(/what does sorting out look like/i)).toBeInTheDocument(),
    )
  })

  it('expands and collapses the same row (accordion toggle)', async () => {
    render(<HistoryView {...baseProps} />)
    const rowTitle = screen.getByText(/garage cleanup/i)
    fireEvent.click(rowTitle)
    await screen.findByText(/what does sorting out look like/i)

    fireEvent.click(rowTitle)
    await waitFor(() =>
      expect(screen.queryByText(/what does sorting out look like/i)).not.toBeInTheDocument(),
    )
  })

  it('expands only one row at a time', async () => {
    render(<HistoryView {...baseProps} />)
    fireEvent.click(screen.getByText(/garage cleanup/i))
    await screen.findByText(/what does sorting out look like/i)

    fireEvent.click(screen.getByText(/healthier eating/i))
    await waitFor(() =>
      expect(screen.queryByText(/what does sorting out look like/i)).not.toBeInTheDocument(),
    )
  })

  it('reuses the loaded detail when a row is re-expanded', async () => {
    render(<HistoryView {...baseProps} />)
    const rowTitle = screen.getByText(/garage cleanup/i)
    fireEvent.click(rowTitle)
    await screen.findByText(/what does sorting out look like/i)

    fireEvent.click(rowTitle)
    fireEvent.click(rowTitle)

    await waitFor(() =>
      expect(screen.getByText(/what does sorting out look like/i)).toBeInTheDocument(),
    )
    expect(baseProps.onOpenSession).toHaveBeenCalledTimes(1)
  })

  it('shows an abandoned session expanded with no Continue/Resume entry point', async () => {
    const abandoned: HistoryDetail = {
      projectTitle: null,
      projectSummary: null,
      transcript: detail.transcript,
      tasks: [],
    }
    render(
      <HistoryView
        {...baseProps}
        sessions={[row({ sessionId: 'abandoned', phase: 'Defining', projectTitle: null, projectSummary: null, taskCount: 0 })]}
        onOpenSession={vi.fn(async (): Promise<HistoryDetailResult> => ({ ok: true, detail: abandoned }))}
      />,
    )
    fireEvent.click(screen.getByText(/untitled interview/i))
    await screen.findByText('I should sort out the garage')

    expect(screen.queryByRole('button', { name: /continue|resume/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /continue|resume/i })).not.toBeInTheDocument()
    const tabs = screen.getAllByRole('tab')
    for (const tab of tabs) {
      expect(tab.textContent).not.toMatch(/continue|resume/i)
    }
  })

  it('shows a failed load as a retryable alert — clicking the row again retries', async () => {
    const onOpenSession = vi.fn<(sessionId: string) => Promise<HistoryDetailResult>>()
      .mockResolvedValueOnce({ ok: false, message: 'Something went wrong loading that interview. Try again.' })
      .mockResolvedValueOnce({ ok: true, detail })
    render(<HistoryView {...baseProps} onOpenSession={onOpenSession} />)

    fireEvent.click(screen.getByText(/garage cleanup/i))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/try again/i))

    fireEvent.click(screen.getByText(/garage cleanup/i))
    await screen.findByText(/what does sorting out look like/i)
    expect(onOpenSession).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no sessions', () => {
    render(<HistoryView {...baseProps} sessions={[]} />)
    expect(screen.getByText(/no interviews yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('shows a loading state while the detail loads', () => {
    render(<HistoryView {...baseProps} onOpenSession={vi.fn(() => new Promise<HistoryDetailResult>(() => {}))} />)
    fireEvent.click(screen.getByText(/garage cleanup/i))
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})
