// Tests for the Task Breakdown review table (issue #25). The component
// is pure — persistence arrives as injected callbacks returning a
// discriminated union, so the whole editing flow renders without a
// router, db, or network. Editing never touches Todoist: it only calls
// back, and failures surface as retryable alerts (plan.md §10).
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TaskReview, type TaskRow } from './task-review.tsx'

const rows: Array<TaskRow> = [
  { id: 't1', title: 'Clear out old boxes', description: 'The green bags', priority: 'high', dueString: 'this weekend' },
  { id: 't2', title: 'Take donations to the tip', description: null, priority: 'normal', dueString: null },
]

const baseProps = {
  projectTitle: 'Garage cleanup',
  tasks: rows,
  pending: false,
  onUpdateTask: vi.fn().mockResolvedValue({ ok: true }),
  onAddTask: vi.fn().mockResolvedValue({ ok: true }),
  onRemoveTask: vi.fn().mockResolvedValue({ ok: true }),
}

function rowFor(name: string | RegExp) {
  const row = screen.getByRole('row', { name })
  return within(row)
}

describe('TaskReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the project title and one editable row per task', () => {
    render(<TaskReview {...baseProps} />)
    expect(screen.getByRole('heading', { name: /garage cleanup/i })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(4) // header + 2 tasks + add row

    const first = rowFor(/clear out old boxes/i)
    expect((first.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Clear out old boxes')
    expect((first.getByLabelText(/description/i) as HTMLInputElement).value).toBe('The green bags')
    expect((first.getByLabelText(/priority/i) as HTMLSelectElement).value).toBe('high')
    expect((first.getByLabelText(/due/i) as HTMLInputElement).value).toBe('this weekend')
  })

  it('renames a task on blur, through onUpdateTask with the full edited payload', async () => {
    render(<TaskReview {...baseProps} />)
    const title = rowFor(/clear out old boxes/i).getByLabelText(/title/i)
    fireEvent.change(title, { target: { value: 'Empty the old boxes' } })
    expect(baseProps.onUpdateTask).not.toHaveBeenCalled()
    fireEvent.blur(title)

    await waitFor(() =>
      expect(baseProps.onUpdateTask).toHaveBeenCalledWith('t1', {
        title: 'Empty the old boxes',
        description: 'The green bags',
        priority: 'high',
        dueString: 'this weekend',
      }),
    )
  })

  it('never commits a title cleared to empty — the row keeps its last title', async () => {
    render(<TaskReview {...baseProps} />)
    const title = rowFor(/clear out old boxes/i).getByLabelText(/title/i)
    fireEvent.change(title, { target: { value: '' } })
    fireEvent.blur(title)

    await waitFor(() =>
      expect((title as HTMLInputElement).value).toBe('Clear out old boxes'),
    )
    expect(baseProps.onUpdateTask).not.toHaveBeenCalled()
  })

  it('changes a due date on blur, persisted as null when cleared', async () => {
    render(<TaskReview {...baseProps} />)
    const due = rowFor(/clear out old boxes/i).getByLabelText(/due/i)
    fireEvent.change(due, { target: { value: '' } })
    fireEvent.blur(due)

    await waitFor(() =>
      expect(baseProps.onUpdateTask).toHaveBeenCalledWith('t1', {
        title: 'Clear out old boxes',
        description: 'The green bags',
        priority: 'high',
        dueString: null,
      }),
    )
  })

  it('changes a priority through onUpdateTask', async () => {
    render(<TaskReview {...baseProps} />)
    const select = rowFor(/take donations/i).getByLabelText(/priority/i)
    fireEvent.change(select, { target: { value: 'urgent' } })

    await waitFor(() =>
      expect(baseProps.onUpdateTask).toHaveBeenCalledWith('t2', {
        title: 'Take donations to the tip',
        description: null,
        priority: 'urgent',
        dueString: null,
      }),
    )
  })

  it('removes a task through onRemoveTask', async () => {
    render(<TaskReview {...baseProps} />)
    fireEvent.click(rowFor(/clear out old boxes/i).getByRole('button', { name: /remove/i }))

    await waitFor(() => expect(baseProps.onRemoveTask).toHaveBeenCalledWith('t1'))
  })

  it('adds a drafted task through onAddTask and clears the draft', async () => {
    render(<TaskReview {...baseProps} />)
    const draft = within(screen.getByRole('row', { name: /add a task/i }))
    fireEvent.change(draft.getByLabelText(/title/i), { target: { value: 'Sweep the floor' } })
    fireEvent.change(draft.getByLabelText(/description/i), { target: { value: 'After the boxes' } })
    fireEvent.change(draft.getByLabelText(/priority/i), { target: { value: 'medium' } })
    fireEvent.change(draft.getByLabelText(/due/i), { target: { value: 'tomorrow' } })
    fireEvent.click(draft.getByRole('button', { name: /add task/i }))

    await waitFor(() =>
      expect(baseProps.onAddTask).toHaveBeenCalledWith({
        title: 'Sweep the floor',
        description: 'After the boxes',
        priority: 'medium',
        dueString: 'tomorrow',
      }),
    )
    await waitFor(() =>
      expect((draft.getByLabelText(/title/i) as HTMLInputElement).value).toBe(''),
    )
  })

  it('shows a failed edit as a retryable alert', async () => {
    const onUpdateTask = vi.fn().mockResolvedValue({ ok: false, message: 'Something went wrong saving that task. Try again.' })
    render(<TaskReview {...baseProps} onUpdateTask={onUpdateTask} />)
    const title = rowFor(/clear out old boxes/i).getByLabelText(/title/i)
    fireEvent.change(title, { target: { value: 'x' } })
    fireEvent.blur(title)

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/try again/i))
  })

  it('shows a failed add as a retryable alert and keeps the draft', async () => {
    const onAddTask = vi.fn().mockResolvedValue({ ok: false, message: 'Something went wrong saving that task. Try again.' })
    render(<TaskReview {...baseProps} onAddTask={onAddTask} />)
    const draft = within(screen.getByRole('row', { name: /add a task/i }))
    fireEvent.change(draft.getByLabelText(/title/i), { target: { value: 'Sweep the floor' } })
    fireEvent.click(draft.getByRole('button', { name: /add task/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/try again/i))
    expect((draft.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Sweep the floor')
  })
})
