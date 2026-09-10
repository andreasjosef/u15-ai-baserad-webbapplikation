// Tests for the extracted Task Breakdown review component (issue #54).
// Pure like the other form components: the phase arrives as a prop and
// persistence arrives as injected callbacks, so the whole review and
// wrapped-up flow renders without a router, db, or network.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TaskBreakdown, type TaskBreakdownProps } from './task-breakdown.tsx'
import type { TaskRow } from './task-review.tsx'

const tasks: ReadonlyArray<TaskRow> = [
  { id: 't1', title: 'Clear out old boxes', description: null, priority: 'high', dueString: null },
]

const baseProps = {
  phase: 'Proposed',
  projectTitle: 'Garage cleanup',
  todoistProjectId: null,
  tasks,
  pending: false,
  onUpdateTask: vi.fn(),
  onAddTask: vi.fn(),
  onRemoveTask: vi.fn(),
} satisfies TaskBreakdownProps

describe('TaskBreakdown', () => {
  it('renders the editable review cards in the Proposed phase', () => {
    render(<TaskBreakdown {...baseProps} />)
    expect(screen.getByRole('heading', { name: /garage cleanup/i })).toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
  })

  it('passes the editing callbacks through to the cards', async () => {
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
      expect(screen.queryByRole('list')).not.toBeInTheDocument()
      unmount()
    }
  })

  it('renders the wrapped-up state once Completed, with no fallback', () => {
    render(
      <TaskBreakdown {...baseProps} phase="Completed">
        <p>never shown</p>
      </TaskBreakdown>,
    )
    expect(screen.getByRole('heading', { name: 'Wrapped up' })).toBeInTheDocument()
    expect(screen.queryByText('never shown')).not.toBeInTheDocument()
  })

  describe('Completed receipt', () => {
    const completedProps = { ...baseProps, phase: 'Completed' as const }

    const receiptTasks: ReadonlyArray<TaskRow> = [
      { id: 't1', title: 'First', description: null, priority: 'urgent', dueString: null },
      { id: 't2', title: 'Second', description: null, priority: 'high', dueString: null },
      { id: 't3', title: 'Third', description: null, priority: 'high', dueString: null },
      { id: 't4', title: 'Fourth', description: null, priority: 'normal', dueString: null },
    ]

    function renderReceipt(overrides: Partial<TaskBreakdownProps> = {}) {
      return render(<TaskBreakdown {...completedProps} {...overrides} />)
    }

    it('renders a circular checkmark over a Wrapped up heading, in a bare centered column', () => {
      renderReceipt({ children: <p>never shown</p> })
      const receipt = screen.getByRole('status')
      // The checkmark leads the receipt, read structurally like the
      // review screen's dots: a decorative svg ahead of the copy. It is
      // the prototype's circled check (CheckCircle2), not the bare
      // CheckIcon the receipt shipped with.
      expect(receipt.querySelector('svg.lucide-circle-check')).toBeInTheDocument()
      expect(within(receipt).getByRole('heading', { name: 'Wrapped up' })).toBeInTheDocument()
      // The prototype's bare centered column: no boxed-card treatment,
      // content center-aligned with the prototype's py-10 breathing
      // room from the top of the viewport.
      expect(receipt).toHaveClass('items-center', 'py-10')
      expect(receipt).not.toHaveClass('border')
      expect(receipt).not.toHaveClass('bg-card')
      expect(screen.queryByRole('button', { name: /todoist/i })).not.toBeInTheDocument()
      expect(screen.queryByText('never shown')).not.toBeInTheDocument()
    })

    it('shows a per-priority count breakdown for non-empty priorities only, in review order', () => {
      renderReceipt({ tasks: receiptTasks })
      const receipt = screen.getByRole('status')
      expect(within(receipt).getByText('Urgent')).toBeInTheDocument()
      expect(within(receipt).getByText('High')).toBeInTheDocument()
      expect(within(receipt).getByText('Normal')).toBeInTheDocument()
      expect(within(receipt).queryByText('Medium')).not.toBeInTheDocument()
      // Urgent → High → Normal, the review screen's section order.
      const labels = ['Urgent', 'High', 'Normal'].map((label) => within(receipt).getByText(label))
      for (const [first, second] of labels.slice(0, -1).map((label, index) => [label, labels[index + 1]])) {
        expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      }
    })

    it('pluralizes each per-priority count like the review sections', () => {
      renderReceipt({ tasks: receiptTasks })
      const receipt = screen.getByRole('status')
      const urgentRow = within(receipt).getByText('Urgent').closest('li')
      const highRow = within(receipt).getByText('High').closest('li')
      const normalRow = within(receipt).getByText('Normal').closest('li')
      expect(urgentRow).toHaveTextContent('1 task')
      expect(highRow).toHaveTextContent('2 tasks')
      expect(normalRow).toHaveTextContent('1 task')
    })

    it('shows per-priority counts that sum to the total task count', () => {
      renderReceipt({
        tasks: [
          ...receiptTasks,
          { id: 't5', title: 'Fifth', description: null, priority: 'medium', dueString: null },
        ],
      })
      const counts = within(screen.getByRole('status'))
        .getAllByText(/\d+ tasks?/)
        .map((el) => Number.parseInt(el.textContent ?? '', 10))
      expect(counts.reduce((total, count) => total + count, 0)).toBe(5)
    })

    it('renders each count row with a decorative color dot before the label', () => {
      renderReceipt({ tasks: receiptTasks })
      const receipt = screen.getByRole('status')
      // The colors themselves are locked in task-priority-groups.test.ts;
      // here each row is read structurally: dot, then label, then count.
      for (const label of ['Urgent', 'High', 'Normal']) {
        const row = within(receipt).getByText(label).closest('li')
        expect(row?.querySelector('span[aria-hidden="true"]')).toBeInTheDocument()
      }
    })

    it('links to the created Todoist project, opening in a new tab', () => {
      renderReceipt({ todoistProjectId: 'proj_abc123' })
      const link = screen.getByRole('link', { name: /open.*todoist/i })
      expect(link).toHaveAttribute('href', 'https://app.todoist.com/app/project/proj_abc123')
      expect(link).toHaveAttribute('target', '_blank')
    })

    it('threads todoistProjectId through as a prop into the confirmation link', () => {
      const { rerender } = renderReceipt({ todoistProjectId: 'proj_one' })
      expect(screen.getByRole('link')).toHaveAttribute('href', 'https://app.todoist.com/app/project/proj_one')
      rerender(<TaskBreakdown {...completedProps} todoistProjectId="proj_two" />)
      expect(screen.getByRole('link')).toHaveAttribute('href', 'https://app.todoist.com/app/project/proj_two')
    })

    it('shows no project title on the receipt', () => {
      renderReceipt({ todoistProjectId: 'proj_abc123' })
      expect(screen.queryByText(/garage cleanup/i)).not.toBeInTheDocument()
    })
  })

  it('renders the fallback before the breakdown exists (Defining)', () => {
    render(
      <TaskBreakdown {...baseProps} phase="Defining" projectTitle={null} tasks={undefined}>
        <p>the conversation continues here</p>
      </TaskBreakdown>,
    )
    expect(screen.getByText('the conversation continues here')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
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
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
