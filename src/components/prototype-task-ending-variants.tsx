// PROTOTYPE, throw away — three structurally different directions for
// the Task Breakdown proposal review and its Completed confirmation
// (issue #107, see prototype/README.md). Mounted on the existing review
// route (`interview_.$sessionId.tsx`) behind `?variant=`, per
// prototype/UI.md sub-shape A. Each direction pairs a proposal layout
// with a completed layout so both read as one consistent ending, per the
// issue: "resolved together as one prototype so both read as a
// consistent ending to the Interview flow."
//
// What's real: all three variants render through the same
// useTaskEndingEditing hook (prototype-task-ending-logic.ts) as the
// shipped TaskReview — the same onUpdateTask/onAddTask/onRemoveTask/
// onConfirmTask callbacks the review route already wires to the real
// server functions. Nothing here is a functionality change (the issue is
// explicit about that); only the JSX differs per variant.
//
// What's stubbed: nothing needed stubbing for the proposal layouts — the
// route's real loader data (tasks, project title) feeds all three. The
// completed layouts use the route's real `todoistProjectId` when the
// session actually has one; a session still in the Proposed phase has
// none, so the "open in Todoist" link/button simply doesn't render for
// those — see prototype/README.md for how to preview a Completed
// session's payoff instead of only the placeholder.
import type { ChangeEvent } from 'react'

import { CheckCircle2, ExternalLinkIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { TaskPriority } from '../lib/task-input.ts'
import { TASK_PRIORITIES } from '../lib/task-input.ts'
import { useTaskEndingEditing, type TaskEndingEditingProps } from './prototype-task-ending-logic.ts'
import type { TaskRow } from './task-review.tsx'

export interface TaskEndingVariantProps extends TaskEndingEditingProps {
  projectTitle: string | null
  tasks: ReadonlyArray<TaskRow>
  state: 'proposed' | 'completed'
  // #61's confirmed (if unofficial) URL shape; null while the session
  // hasn't been confirmed yet.
  todoistProjectId: string | null
}

function todoistProjectUrl(id: string): string {
  return `https://app.todoist.com/app/project/${id}`
}

// Shared across all three layouts — not a layout decision, a content
// decision (what does each priority mean, visually), so sharing it here
// doesn't defeat the "structurally different" requirement the way
// sharing a <Layout> would.
const PRIORITY_META: Record<TaskPriority, { label: string; dot: string; text: string }> = {
  normal: { label: 'Normal', dot: 'bg-muted-foreground/40', text: 'text-muted-foreground' },
  medium: { label: 'Medium', dot: 'bg-primary', text: 'text-primary' },
  high: { label: 'High', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  urgent: { label: 'Urgent', dot: 'bg-destructive', text: 'text-destructive' },
}

const PRIORITY_SELECT_CLASS =
  'h-8 rounded-lg border border-input bg-transparent px-2 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'

function PriorityField({
  value,
  onChange,
}: {
  value: TaskPriority
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void
}) {
  return (
    <select aria-label="Priority" value={value} onChange={onChange} className={PRIORITY_SELECT_CLASS}>
      {TASK_PRIORITIES.map((priority) => (
        <option key={priority} value={priority}>
          {PRIORITY_META[priority].label}
        </option>
      ))}
    </select>
  )
}

function FailureAlert({ message }: { message: string }) {
  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  )
}

function TodoistLink({ todoistProjectId, className }: { todoistProjectId: string | null; className?: string }) {
  if (todoistProjectId === null) {
    return (
      <p className="text-xs text-muted-foreground italic">
        (No Todoist project linked yet — this Interview hasn't been confirmed.)
      </p>
    )
  }
  return (
    <a
      href={todoistProjectUrl(todoistProjectId)}
      target="_blank"
      rel="noreferrer"
      className={className}
    >
      Open in Todoist
      <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
    </a>
  )
}

// ---------------------------------------------------------------------
// Variant A — Ordered list. Bet: the grid's real problem is that nothing
// makes order or priority scannable — a single-column list with an
// explicit index number and a priority dot on every row fixes both
// without needing cards at all.
// ---------------------------------------------------------------------

export function TaskEndingVariantA(props: TaskEndingVariantProps) {
  const editing = useTaskEndingEditing(props)
  const { projectTitle, tasks, pending, state, todoistProjectId } = props

  if (state === 'completed') {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <CheckCircle2 aria-hidden="true" className="size-8 text-primary" />
        <p className="text-sm text-muted-foreground">
          {tasks.length} task{tasks.length === 1 ? '' : 's'} in Todoist — this Interview is wrapped up.
        </p>
        <TodoistLink
          todoistProjectId={todoistProjectId}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
        />
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight">{projectTitle}</h2>
        <p className="text-sm text-muted-foreground">
          Your task list is ready — rename anything, set priorities and due dates, add or remove tasks.
        </p>
      </header>
      <ul role="list" className="flex list-none flex-col divide-y divide-border rounded-xl border border-border p-0">
        {tasks.map((task, index) => (
          <li key={task.id} aria-label={task.title} className="flex flex-col gap-2 p-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
              >
                {index + 1}
              </span>
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${PRIORITY_META[task.priority].dot}`}
                title={PRIORITY_META[task.priority].label}
              />
              <input
                aria-label="Title"
                value={editing.editValue(task, 'title')}
                onChange={(event) => editing.setEdit(task, 'title', event.target.value)}
                onBlur={editing.blurCommit(task, 'title')}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
              />
              <PriorityField value={task.priority} onChange={(event) => editing.changePriority(task, event)} />
              <Input
                aria-label="Due date"
                value={editing.editValue(task, 'dueString')}
                onChange={(event) => editing.setEdit(task, 'dueString', event.target.value)}
                onBlur={editing.blurCommit(task, 'dueString')}
                placeholder="Due date…"
                className="w-36"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => void editing.handleRemove(task)}
                aria-label={`Remove task ${task.title}`}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </div>
            <div className="flex flex-col gap-1 pl-9">
              <Input
                aria-label="Description"
                value={editing.editValue(task, 'description')}
                onChange={(event) => editing.setEdit(task, 'description', event.target.value)}
                onBlur={editing.blurCommit(task, 'description')}
                placeholder="Add a description…"
              />
              {editing.failure?.at === `${task.id}:title` && <FailureAlert message={editing.failure.message} />}
              {editing.failure?.at === `${task.id}:description` && (
                <FailureAlert message={editing.failure.message} />
              )}
              {editing.failure?.at === `${task.id}:priority` && <FailureAlert message={editing.failure.message} />}
              {editing.failure?.at === `${task.id}:dueString` && <FailureAlert message={editing.failure.message} />}
              {editing.failure?.at === `${task.id}:remove` && <FailureAlert message={editing.failure.message} />}
            </div>
          </li>
        ))}
        <li className="flex flex-col gap-2 bg-muted/50 p-3">
          <div className="flex items-center gap-3 pl-9">
            <Input
              aria-label="Title"
              value={editing.draft.title}
              onChange={(event) => editing.setDraftField('title', event.target.value)}
              placeholder="New task"
              className="min-w-0 flex-1"
            />
            <PriorityField value={editing.draft.priority} onChange={editing.handleDraftPriority} />
            <Input
              aria-label="Due date"
              value={editing.draft.dueString}
              onChange={(event) => editing.setDraftField('dueString', event.target.value)}
              placeholder="e.g. tomorrow"
              className="w-36"
            />
          </div>
          <div className="pl-9">
            {editing.failure?.at === 'draft' && <FailureAlert message={editing.failure.message} />}
            <Button
              type="button"
              variant="outline"
              onClick={() => void editing.handleAdd()}
              disabled={pending || editing.draft.title.trim() === ''}
              size="sm"
            >
              Add task
            </Button>
          </div>
        </li>
      </ul>
      {props.onConfirmTask && (
        <>
          <Button type="button" onClick={() => void editing.handleConfirm()} disabled={pending} className="self-start">
            {pending ? 'Adding to Todoist…' : 'Add these tasks to Todoist'}
          </Button>
          {editing.failure?.at === 'confirm' && <FailureAlert message={editing.failure.message} />}
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------
// Variant B — Lightweight cards. Bet: the grid format itself is fine,
// it's the `bg-primary` header band that reads too heavy. Drop the band,
// add a slim priority-colored top edge and an order badge per card
// instead — same density, lighter ceremony.
// ---------------------------------------------------------------------

export function TaskEndingVariantB(props: TaskEndingVariantProps) {
  const editing = useTaskEndingEditing(props)
  const { projectTitle, tasks, pending, state, todoistProjectId } = props

  if (state === 'completed') {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-xl bg-card p-8 text-center ring-1 ring-foreground/10">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 aria-hidden="true" className="size-7 text-primary" />
        </div>
        <h2 className="text-lg font-bold tracking-tight">All set — tasks are in Todoist</h2>
        <p className="text-sm text-muted-foreground">
          This Interview is wrapped up. {tasks.length} task{tasks.length === 1 ? '' : 's'}{' '}
          {tasks.length === 1 ? 'is' : 'are'} waiting for you in Todoist.
        </p>
        {todoistProjectId === null ? (
          <TodoistLink todoistProjectId={null} />
        ) : (
          <Button asChild>
            <a href={todoistProjectUrl(todoistProjectId)} target="_blank" rel="noreferrer">
              Open in Todoist
              <ExternalLinkIcon aria-hidden="true" />
            </a>
          </Button>
        )}
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight">{projectTitle}</h2>
        <p className="text-sm text-muted-foreground">
          Your task list is ready — rename anything, set priorities and due dates, add or remove tasks.
        </p>
      </header>
      <ul role="list" className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
        {tasks.map((task, index) => (
          <li
            key={task.id}
            aria-label={task.title}
            className="relative flex flex-col gap-3 overflow-hidden rounded-xl bg-card p-3 pt-4 text-sm ring-1 ring-foreground/10"
          >
            <span
              aria-hidden="true"
              className={`absolute inset-x-0 top-0 h-1 ${PRIORITY_META[task.priority].dot}`}
            />
            <div className="flex items-center gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[0.65rem] font-medium text-muted-foreground">
                {index + 1}
              </span>
              <input
                aria-label="Title"
                value={editing.editValue(task, 'title')}
                onChange={(event) => editing.setEdit(task, 'title', event.target.value)}
                onBlur={editing.blurCommit(task, 'title')}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => void editing.handleRemove(task)}
                aria-label={`Remove task ${task.title}`}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </div>
            {editing.failure?.at === `${task.id}:title` && <FailureAlert message={editing.failure.message} />}
            <Input
              aria-label="Description"
              value={editing.editValue(task, 'description')}
              onChange={(event) => editing.setEdit(task, 'description', event.target.value)}
              onBlur={editing.blurCommit(task, 'description')}
              placeholder="Add a description…"
            />
            {editing.failure?.at === `${task.id}:description` && <FailureAlert message={editing.failure.message} />}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <PriorityField value={task.priority} onChange={(event) => editing.changePriority(task, event)} />
                {editing.failure?.at === `${task.id}:priority` && <FailureAlert message={editing.failure.message} />}
              </div>
              <div className="flex flex-col gap-1">
                <Input
                  aria-label="Due date"
                  value={editing.editValue(task, 'dueString')}
                  onChange={(event) => editing.setEdit(task, 'dueString', event.target.value)}
                  onBlur={editing.blurCommit(task, 'dueString')}
                  placeholder="e.g. this weekend"
                />
                {editing.failure?.at === `${task.id}:dueString` && (
                  <FailureAlert message={editing.failure.message} />
                )}
              </div>
            </div>
            {editing.failure?.at === `${task.id}:remove` && <FailureAlert message={editing.failure.message} />}
          </li>
        ))}
        <li
          aria-label="Add a task"
          className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-muted/50 p-3"
        >
          <Input
            aria-label="Title"
            value={editing.draft.title}
            onChange={(event) => editing.setDraftField('title', event.target.value)}
            placeholder="New task"
          />
          <Input
            aria-label="Description"
            value={editing.draft.description}
            onChange={(event) => editing.setDraftField('description', event.target.value)}
            placeholder="Optional note"
          />
          <div className="grid grid-cols-2 gap-3">
            <PriorityField value={editing.draft.priority} onChange={editing.handleDraftPriority} />
            <Input
              aria-label="Due date"
              value={editing.draft.dueString}
              onChange={(event) => editing.setDraftField('dueString', event.target.value)}
              placeholder="e.g. tomorrow"
            />
          </div>
          {editing.failure?.at === 'draft' && <FailureAlert message={editing.failure.message} />}
          <Button
            type="button"
            variant="outline"
            onClick={() => void editing.handleAdd()}
            disabled={pending || editing.draft.title.trim() === ''}
            className="self-start"
          >
            Add task
          </Button>
        </li>
      </ul>
      {props.onConfirmTask && (
        <>
          <Button type="button" onClick={() => void editing.handleConfirm()} disabled={pending} className="self-start">
            {pending ? 'Adding to Todoist…' : 'Add these tasks to Todoist'}
          </Button>
          {editing.failure?.at === 'confirm' && <FailureAlert message={editing.failure.message} />}
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------
// Variant C — Grouped by priority. Bet: priority reads best from
// grouping, not from a per-row label — four sections (Urgent → Normal),
// each holding its tasks in order. A small "#n" chip keeps the original
// overall order traceable even once tasks are split across sections.
// ---------------------------------------------------------------------

const PRIORITY_GROUPS = [...TASK_PRIORITIES].reverse() // urgent, high, medium, normal

export function TaskEndingVariantC(props: TaskEndingVariantProps) {
  const editing = useTaskEndingEditing(props)
  const { projectTitle, tasks, pending, state, todoistProjectId } = props

  if (state === 'completed') {
    const counts: Record<TaskPriority, number> = { normal: 0, medium: 0, high: 0, urgent: 0 }
    for (const task of tasks) {
      counts[task.priority] += 1
    }
    return (
      <div className="mx-auto flex max-w-xs flex-col items-center gap-4 py-10 text-center">
        <CheckCircle2 aria-hidden="true" className="size-8 text-primary" />
        <h2 className="text-lg font-bold tracking-tight">Wrapped up</h2>
        <ul role="list" className="w-full list-none divide-y divide-border rounded-lg border border-border p-0 text-sm">
          {PRIORITY_GROUPS.filter((priority) => counts[priority] > 0).map((priority) => (
            <li key={priority} className="flex items-center justify-between px-3 py-2">
              <span className={`flex items-center gap-2 ${PRIORITY_META[priority].text}`}>
                <span aria-hidden="true" className={`size-2 rounded-full ${PRIORITY_META[priority].dot}`} />
                {PRIORITY_META[priority].label}
              </span>
              <span className="text-muted-foreground">{counts[priority]}</span>
            </li>
          ))}
        </ul>
        <TodoistLink
          todoistProjectId={todoistProjectId}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
        />
      </div>
    )
  }

  const overallOrder = new Map(tasks.map((task, index) => [task.id, index + 1]))

  function editRow(task: TaskRow) {
    return (
      <li key={task.id} aria-label={task.title} className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
          >
            #{overallOrder.get(task.id)}
          </span>
          <input
            aria-label="Title"
            value={editing.editValue(task, 'title')}
            onChange={(event) => editing.setEdit(task, 'title', event.target.value)}
            onBlur={editing.blurCommit(task, 'title')}
            className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
          />
          <PriorityField value={task.priority} onChange={(event) => editing.changePriority(task, event)} />
          <Input
            aria-label="Due date"
            value={editing.editValue(task, 'dueString')}
            onChange={(event) => editing.setEdit(task, 'dueString', event.target.value)}
            onBlur={editing.blurCommit(task, 'dueString')}
            placeholder="Due date…"
            className="w-36"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => void editing.handleRemove(task)}
            aria-label={`Remove task ${task.title}`}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
        <div className="flex flex-col gap-1 pl-9">
          <Input
            aria-label="Description"
            value={editing.editValue(task, 'description')}
            onChange={(event) => editing.setEdit(task, 'description', event.target.value)}
            onBlur={editing.blurCommit(task, 'description')}
            placeholder="Add a description…"
          />
          {editing.failure?.at === `${task.id}:title` && <FailureAlert message={editing.failure.message} />}
          {editing.failure?.at === `${task.id}:description` && <FailureAlert message={editing.failure.message} />}
          {editing.failure?.at === `${task.id}:priority` && <FailureAlert message={editing.failure.message} />}
          {editing.failure?.at === `${task.id}:dueString` && <FailureAlert message={editing.failure.message} />}
          {editing.failure?.at === `${task.id}:remove` && <FailureAlert message={editing.failure.message} />}
        </div>
      </li>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight">{projectTitle}</h2>
        <p className="text-sm text-muted-foreground">
          Your task list is ready — rename anything, set priorities and due dates, add or remove tasks.
        </p>
      </header>
      <div className="flex flex-col gap-4">
        {PRIORITY_GROUPS.map((priority) => {
          const rows = tasks.filter((task) => task.priority === priority)
          if (rows.length === 0) {
            return null
          }
          return (
            <div key={priority} className="flex flex-col rounded-xl border border-border">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <span aria-hidden="true" className={`size-2 rounded-full ${PRIORITY_META[priority].dot}`} />
                <h3 className={`text-sm font-semibold ${PRIORITY_META[priority].text}`}>
                  {PRIORITY_META[priority].label}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {rows.length} task{rows.length === 1 ? '' : 's'}
                </span>
              </div>
              <ul role="list" className="flex list-none flex-col divide-y divide-border p-0">
                {rows.map((task) => editRow(task))}
              </ul>
            </div>
          )
        })}
      </div>
      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/50 p-3">
        <div className="flex items-center gap-3">
          <Input
            aria-label="Title"
            value={editing.draft.title}
            onChange={(event) => editing.setDraftField('title', event.target.value)}
            placeholder="New task"
            className="min-w-0 flex-1"
          />
          <PriorityField value={editing.draft.priority} onChange={editing.handleDraftPriority} />
          <Input
            aria-label="Due date"
            value={editing.draft.dueString}
            onChange={(event) => editing.setDraftField('dueString', event.target.value)}
            placeholder="e.g. tomorrow"
            className="w-36"
          />
        </div>
        {editing.failure?.at === 'draft' && <FailureAlert message={editing.failure.message} />}
        <Button
          type="button"
          variant="outline"
          onClick={() => void editing.handleAdd()}
          disabled={pending || editing.draft.title.trim() === ''}
          size="sm"
          className="self-start"
        >
          Add task
        </Button>
      </div>
      {props.onConfirmTask && (
        <>
          <Button type="button" onClick={() => void editing.handleConfirm()} disabled={pending} className="self-start">
            {pending ? 'Adding to Todoist…' : 'Add these tasks to Todoist'}
          </Button>
          {editing.failure?.at === 'confirm' && <FailureAlert message={editing.failure.message} />}
        </>
      )}
    </section>
  )
}
