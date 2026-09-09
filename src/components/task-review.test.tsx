// Tests for the Task Breakdown review cards (issues #25, #69). The
// component is pure — persistence arrives as injected callbacks returning
// a discriminated union, so the whole editing flow renders without a
// router, db, or network. Editing never touches Todoist: it only calls
// back, and failures surface as retryable alerts (plan.md §10).
//
// One card per task in a role="list" grid (mockup 3's card treatment);
// the add-task draft is a trailing visually-distinct listitem.
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

function cardFor(name: string | RegExp) {
  const card = screen.getByRole('listitem', { name })
  return within(card)
}

function draftCard() {
  return within(screen.getByRole('listitem', { name: /add a task/i }))
}

describe('TaskReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the project title and one editable card per task', () => {
    render(<TaskReview {...baseProps} />)
    expect(screen.getByRole('heading', { name: /garage cleanup/i })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3) // 2 tasks + add card
    expect(screen.getByRole('list')).toBeInTheDocument()

    const first = cardFor(/clear out old boxes/i)
    expect((first.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Clear out old boxes')
    expect((first.getByLabelText(/description/i) as HTMLInputElement).value).toBe('The green bags')
    expect((first.getByLabelText(/priority/i) as HTMLSelectElement).value).toBe('high')
    expect((first.getByLabelText(/due/i) as HTMLInputElement).value).toBe('this weekend')
  })

  it('renames a task on blur, through onUpdateTask with the full edited payload', async () => {
    render(<TaskReview {...baseProps} />)
    const title = cardFor(/clear out old boxes/i).getByLabelText(/title/i)
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

  it('never commits a title cleared to empty — the card keeps its last title', async () => {
    render(<TaskReview {...baseProps} />)
    const title = cardFor(/clear out old boxes/i).getByLabelText(/title/i)
    fireEvent.change(title, { target: { value: '' } })
    fireEvent.blur(title)

    await waitFor(() =>
      expect((title as HTMLInputElement).value).toBe('Clear out old boxes'),
    )
    expect(baseProps.onUpdateTask).not.toHaveBeenCalled()
  })

  it('changes a due date on blur, persisted as null when cleared', async () => {
    render(<TaskReview {...baseProps} />)
    const due = cardFor(/clear out old boxes/i).getByLabelText(/due/i)
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
    const select = cardFor(/take donations/i).getByLabelText(/priority/i)
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
    fireEvent.click(cardFor(/clear out old boxes/i).getByRole('button', { name: /remove/i }))

    await waitFor(() => expect(baseProps.onRemoveTask).toHaveBeenCalledWith('t1'))
  })

  it('adds a drafted task through onAddTask and clears the draft', async () => {
    render(<TaskReview {...baseProps} />)
    const draft = draftCard()
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
    const title = cardFor(/clear out old boxes/i).getByLabelText(/title/i)
    fireEvent.change(title, { target: { value: 'x' } })
    fireEvent.blur(title)

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/try again/i))
  })

  it('renders a failed edit as an alert under the field that failed', async () => {
    const onUpdateTask = vi.fn().mockResolvedValue({ ok: false, message: 'Something went wrong saving that task. Try again.' })
    render(<TaskReview {...baseProps} onUpdateTask={onUpdateTask} />)
    const due = cardFor(/clear out old boxes/i).getByLabelText(/due/i)
    fireEvent.change(due, { target: { value: 'neveruary 41st' } })
    fireEvent.blur(due)

    await waitFor(() => expect(cardFor(/clear out old boxes/i).getByRole('alert')).toHaveTextContent(/try again/i))
    expect(cardFor(/take donations/i).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a failed add as a retryable alert inside the draft card and keeps the draft', async () => {
    const onAddTask = vi.fn().mockResolvedValue({ ok: false, message: 'Something went wrong saving that task. Try again.' })
    render(<TaskReview {...baseProps} onAddTask={onAddTask} />)
    const draft = draftCard()
    fireEvent.change(draft.getByLabelText(/title/i), { target: { value: 'Sweep the floor' } })
    fireEvent.click(draft.getByRole('button', { name: /add task/i }))

    await waitFor(() => expect(draft.getByRole('alert')).toHaveTextContent(/try again/i))
    expect((draft.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Sweep the floor')
  })

  // --- Confirm to Todoist (issue #26) --------------------------------------

  it('offers no confirm button unless a confirm callback is provided', () => {
    render(<TaskReview {...baseProps} />)
    expect(screen.queryByRole('button', { name: /todoist/i })).not.toBeInTheDocument()
  })

  it('confirms the reviewed breakdown through onConfirmTask', async () => {
    const onConfirmTask = vi.fn().mockResolvedValue({ ok: true })
    render(<TaskReview {...baseProps} onConfirmTask={onConfirmTask} />)
    fireEvent.click(screen.getByRole('button', { name: /todoist/i }))

    await waitFor(() => expect(onConfirmTask).toHaveBeenCalledWith())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a failed confirm as a retryable alert — confirming again is the retry', async () => {
    const onConfirmTask = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, message: 'Something went wrong creating your tasks in Todoist. Try again.' })
      .mockResolvedValueOnce({ ok: true })
    render(<TaskReview {...baseProps} onConfirmTask={onConfirmTask} />)
    const confirm = screen.getByRole('button', { name: /todoist/i })
    fireEvent.click(confirm)

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/todoist/i))

    fireEvent.click(confirm)
    await waitFor(() => expect(onConfirmTask).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('disables the confirm button while pending', () => {
    const onConfirmTask = vi.fn()
    render(<TaskReview {...baseProps} pending onConfirmTask={onConfirmTask} />)
    expect(screen.getByRole('button', { name: /todoist/i })).toBeDisabled()
  })
})
