// Tests for the Task Breakdown review screen (issues #25, #69, #109).
// The component is pure — persistence arrives as injected callbacks
// returning a discriminated union, so the whole editing flow renders
// without a router, db, or network. Editing never touches Todoist: it
// only calls back, and failures surface as retryable alerts (plan.md
// §10).
//
// Direction C's grouped layout: tasks in priority sections (Urgent →
// High → Medium → Normal, empty ones not rendered), each row carrying a
// `#n` chip for its overall flat-list position; the add-task draft is a
// trailing, ungrouped card.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TaskReview, type TaskRow } from './task-review.tsx'
import type { TaskEditInput } from '../lib/task-input.ts'

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

// A priority section, addressed by its label (the <section aria-label>).
function sectionFor(priority: string | RegExp) {
  return within(screen.getByRole('region', { name: priority }))
}

function draftCard() {
  return within(screen.getByRole('group', { name: /add a task/i }))
}

// The review route's optimistic-update wiring, so a priority change
// re-renders with the task in its new section, exactly like production.
function TaskReviewHarness({ initialTasks }: { initialTasks: Array<TaskRow> }) {
  const [tasks, setTasks] = useState(initialTasks)
  async function onUpdateTask(taskId: string, task: TaskEditInput) {
    setTasks((current) => current.map((row) => (row.id === taskId ? { ...row, ...task } : row)))
    return { ok: true } as const
  }
  return (
    <TaskReview
      projectTitle="Garage cleanup"
      tasks={tasks}
      pending={false}
      onUpdateTask={onUpdateTask}
      onAddTask={vi.fn().mockResolvedValue({ ok: true })}
      onRemoveTask={vi.fn().mockResolvedValue({ ok: true })}
    />
  )
}

describe('TaskReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the project title and one editable row per task', () => {
    render(<TaskReview {...baseProps} />)
    expect(screen.getByRole('heading', { name: /garage cleanup/i })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getAllByRole('list').length).toBeGreaterThan(0)

    const first = cardFor(/clear out old boxes/i)
    expect((first.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Clear out old boxes')
    expect((first.getByLabelText(/description/i) as HTMLInputElement).value).toBe('The green bags')
    expect((first.getByLabelText(/priority/i) as HTMLSelectElement).value).toBe('high')
    expect((first.getByLabelText(/due/i) as HTMLInputElement).value).toBe('this weekend')
  })

  it('groups tasks into Urgent, High, Medium, Normal sections in that fixed order', () => {
    render(
      <TaskReview
        {...baseProps}
        tasks={[
          { id: 't1', title: 'First', description: null, priority: 'normal', dueString: null },
          { id: 't2', title: 'Second', description: null, priority: 'urgent', dueString: null },
          { id: 't3', title: 'Third', description: null, priority: 'medium', dueString: null },
          { id: 't4', title: 'Fourth', description: null, priority: 'high', dueString: null },
        ]}
      />,
    )
    const sections = screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'))
    expect(sections).toEqual(['Urgent', 'High', 'Medium', 'Normal'])
  })

  it('renders a priority section only when it has tasks, with a pluralized count', () => {
    render(
      <TaskReview
        {...baseProps}
        tasks={[
          { id: 't1', title: 'First', description: null, priority: 'high', dueString: null },
          { id: 't2', title: 'Second', description: null, priority: 'high', dueString: null },
          { id: 't3', title: 'Third', description: null, priority: 'normal', dueString: null },
        ]}
      />,
    )
    expect(screen.getByRole('region', { name: 'High' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Normal' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Urgent' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Medium' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'High' })).getByText('2 tasks')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Normal' })).getByText('1 task')).toBeInTheDocument()
  })

  it('renders each section heading with a decorative color dot before the label', () => {
    render(<TaskReview {...baseProps} />)
    // The colors themselves are locked in task-priority-groups.test.ts;
    // here the heading is read structurally: dot, then label, then count.
    for (const label of ['High', 'Normal']) {
      const heading = within(screen.getByRole('region', { name: label })).getByRole('heading', { name: label })
      expect(heading.previousElementSibling).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('shows a task in the section matching its priority', () => {
    render(<TaskReview {...baseProps} />)
    expect(sectionFor('High').getByRole('listitem', { name: /clear out old boxes/i })).toBeInTheDocument()
    expect(sectionFor('Normal').getByRole('listitem', { name: /take donations/i })).toBeInTheDocument()
  })

  it('numbers each task with a #n chip matching its overall flat-list order', () => {
    render(
      <TaskReview
        {...baseProps}
        tasks={[
          { id: 't1', title: 'First', description: null, priority: 'normal', dueString: null },
          { id: 't2', title: 'Second', description: null, priority: 'urgent', dueString: null },
        ]}
      />,
    )
    // The Urgent section lists Second first, but the chip shows the
    // overall flat position: Second is #2.
    expect(cardFor(/first/i).getByText('#1')).toBeInTheDocument()
    expect(cardFor(/second/i).getByText('#2')).toBeInTheDocument()
  })

  it('recomputes the #n chips from the tasks prop as tasks are removed', () => {
    const { rerender } = render(
      <TaskReview
        {...baseProps}
        tasks={[
          { id: 't1', title: 'First', description: null, priority: 'normal', dueString: null },
          { id: 't2', title: 'Second', description: null, priority: 'normal', dueString: null },
        ]}
      />,
    )
    expect(cardFor(/second/i).getByText('#2')).toBeInTheDocument()
    rerender(
      <TaskReview
        {...baseProps}
        tasks={[{ id: 't2', title: 'Second', description: null, priority: 'normal', dueString: null }]}
      />,
    )
    expect(cardFor(/second/i).getByText('#1')).toBeInTheDocument()
  })

  it('moves a task to its new section immediately when its priority changes', async () => {
    render(<TaskReviewHarness initialTasks={rows} />)
    const select = cardFor(/take donations/i).getByLabelText(/priority/i)
    fireEvent.change(select, { target: { value: 'urgent' } })

    await waitFor(() =>
      expect(sectionFor('Urgent').getByRole('listitem', { name: /take donations/i })).toBeInTheDocument(),
    )
    // Normal had only this task, so its empty section is gone entirely.
    expect(screen.queryByRole('region', { name: 'Normal' })).not.toBeInTheDocument()
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
