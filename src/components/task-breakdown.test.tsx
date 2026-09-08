// Tests for the extracted Task Breakdown review component (issue #54).
// Pure like the other form components: the phase arrives as a prop and
// persistence arrives as injected callbacks, so the whole review and
// wrapped-up flow renders without a router, db, or network.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TaskBreakdown, type TaskBreakdownProps } from './task-breakdown.tsx'
import type { TaskRow } from './task-review.tsx'

const tasks: ReadonlyArray<TaskRow> = [
  { id: 't1', title: 'Clear out old boxes', description: null, priority: 'high', dueString: null },
]

const baseProps = {
  phase: 'Proposed',
  projectTitle: 'Garage cleanup',
  tasks,
  pending: false,
  onUpdateTask: vi.fn(),
  onAddTask: vi.fn(),
  onRemoveTask: vi.fn(),
} satisfies TaskBreakdownProps

describe('TaskBreakdown', () => {
  it('renders the editable review table in the Proposed phase', () => {
    render(<TaskBreakdown {...baseProps} />)
    expect(screen.getByRole('heading', { name: /garage cleanup/i })).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('passes the editing callbacks through to the table', async () => {
    const onUpdateTask = vi.fn().mockResolvedValue({ ok: true })
    const onAddTask = vi.fn().mockResolvedValue({ ok: true })
    const onRemoveTask = vi.fn().mockResolvedValue({ ok: true })
    render(
      <TaskBreakdown {...baseProps} onUpdateTask={onUpdateTask} onAddTask={onAddTask} onRemoveTask={onRemoveTask} />,
    )
    const title = screen.getAllByLabelText('Title')[0]
    fireEvent.change(title, { target: { value: 'Empty the garage completely' } })
    fireEvent.blur(title)
    fireEvent.change(screen.getAllByLabelText('Title')[1], { target: { value: 'Sweep the floor' } })
    fireEvent.click(screen.getByRole('button', { name: /add task/i }))
    fireEvent.click(screen.getByRole('button', { name: /remove task/i }))

    await waitFor(() => expect(onUpdateTask).toHaveBeenCalledWith('t1', expect.objectContaining({ title: 'Empty the garage completely' })))
    await waitFor(() => expect(onAddTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sweep the floor' })))
    await waitFor(() => expect(onRemoveTask).toHaveBeenCalledWith('t1'))
  })

  it('offers the confirm action only when onConfirmTask is provided, and passes it through', async () => {
    const onConfirmTask = vi.fn().mockResolvedValue({ ok: true })
    render(<TaskBreakdown {...baseProps} onConfirmTask={onConfirmTask} />)
    fireEvent.click(screen.getByRole('button', { name: /todoist/i }))

    await waitFor(() => expect(onConfirmTask).toHaveBeenCalledWith())
  })

  it('renders no confirm button without onConfirmTask', () => {
    render(<TaskBreakdown {...baseProps} />)
    expect(screen.queryByRole('button', { name: /todoist/i })).not.toBeInTheDocument()
  })

  it('disables the confirm button while pending', () => {
    render(<TaskBreakdown {...baseProps} pending onConfirmTask={vi.fn()} />)
    const confirm = screen.getByRole('button', { name: /todoist/i })
    expect(confirm).toBeDisabled()
    expect(confirm).toHaveTextContent(/adding to todoist/i)
  })

  it('renders the fallback in the Proposed phase while any one review input is missing', () => {
    const cases: ReadonlyArray<TaskBreakdownProps> = [
      { ...baseProps, projectTitle: null },
      { ...baseProps, tasks: undefined },
      { ...baseProps, onUpdateTask: undefined },
      { ...baseProps, onAddTask: undefined },
      { ...baseProps, onRemoveTask: undefined },
    ]
    for (const props of cases) {
      const { unmount } = render(
        <TaskBreakdown {...props}>
          <p>still chatting</p>
        </TaskBreakdown>,
      )
      expect(screen.getByText('still chatting')).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      unmount()
    }
  })

  it('renders the wrapped-up state once Completed, with no table or fallback', () => {
    render(
      <TaskBreakdown {...baseProps} phase="Completed">
        <p>never shown</p>
      </TaskBreakdown>,
    )
    expect(screen.getByText(/tasks are in todoist/i)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('never shown')).not.toBeInTheDocument()
  })

  it('renders the fallback before the breakdown exists (Defining)', () => {
    render(
      <TaskBreakdown {...baseProps} phase="Defining" projectTitle={null} tasks={undefined}>
        <p>the conversation continues here</p>
      </TaskBreakdown>,
    )
    expect(screen.getByText('the conversation continues here')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText(/tasks are in todoist/i)).not.toBeInTheDocument()
  })

  it('renders the fallback in the Proposed phase until title, tasks, and handlers all exist', () => {
    render(
      <TaskBreakdown
        {...baseProps}
        projectTitle={null}
        onUpdateTask={undefined}
      >
        <p>still chatting</p>
      </TaskBreakdown>,
    )
    expect(screen.getByText('still chatting')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
