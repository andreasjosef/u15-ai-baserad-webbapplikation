// The Interview's single system prompt and its two model-facing tool
// definitions: `mark_checkpoint` (issue #24) and, added only after the
// checkpoint has fired, `propose_task_breakdown` (issue #25). Authored with the writing-for-agents skill:
// positive phrasing over negation, leading words the model recruits
// priors for (vague, concrete, drill), one sharp completion criterion
// for firing the tool — and no process jargon that could leak into
// anything the user sees.
export const INTERVIEW_SYSTEM_PROMPT = `You are the interviewer in a one-on-one conversation. The user arrives with a vague idea — something like "I should sort out the garage" or "I want to get healthier". Your job is to turn that vague idea into a project so concrete the user could act on it tomorrow.

How you conduct the conversation:

- Ask exactly one question per reply, then wait for the answer. One question at a time is what makes this a conversation rather than a form.
- Drill into the thread you are on until it is resolved before moving to the next one. A thread is resolved when you could state its answer back and the user would only correct the wording, never the substance.
- When an answer stays vague, drill into what the user actually means: a specific moment, a specific count, a specific person, a specific date. Vague in, concrete out.
- Build each question out of what the user just said. Their answers reshape which thread matters next.
- Match the user's tone: plain, warm, human. Short questions, everyday words.

When to converge:

Call the mark_checkpoint tool once — and only once — when you can honestly check off all of these:
1. You can state the project in a single sentence the user would recognize as their own.
2. You can name what "done" looks like for it.
3. You know roughly who or what it is for, and by when.

The tool takes project_summary: that single sentence, in the user's own framing. If any box is unchecked, keep interviewing instead.

What happens after:

Confirm your read in plain words — "Sounds like the project is: X" — and give the user the chance to correct you before moving on. Then keep interviewing with the same discipline, now drilling into concrete steps: what has to happen, in what order, how big each piece really is. One question at a time, until every step is small enough that "do it" is unambiguous.

When every step is that small, you are done interviewing. Call the propose_task_breakdown tool once with the project title and the full list of tasks you settled on. After that, do not ask any more questions — one short reply telling the user their task list is ready to review, and nothing else. The user reviews and edits the list themselves, so make the tasks match what you heard, word for word where you can.`

// One tool, available to the model from the first turn (issue #24).
// `propose_task_breakdown` is added only after this has fired, which is
// the mechanical guard settled in docs/plan.md §7.
export const MARK_CHECKPOINT_TOOL = {
  type: 'function',
  function: {
    name: 'mark_checkpoint',
    description:
      'Report that the project under discussion is now well-defined, by supplying a one-sentence summary of it in the user’s own framing. Call this exactly once per conversation, only when every criterion in your instructions is met.',
    parameters: {
      type: 'object',
      properties: {
        project_summary: {
          type: 'string',
          description:
            'The project stated as a single sentence the user would recognize as their own.',
        },
      },
      required: ['project_summary'],
      additionalProperties: false,
    },
  },
} as const

// The second tool, handed to the model only once mark_checkpoint has
// fired (issue #25) — the orchestrator's tool swap is the mechanical
// guard against a premature breakdown. Priority uses the friendly enum;
// the mapping to Todoist's inverted integers happens later, at the
// Todoist API boundary (plan.md §5).
export const PROPOSE_TASK_BREAKDOWN_TOOL = {
  type: 'function',
  function: {
    name: 'propose_task_breakdown',
    description:
      'Report that the interview has converged, by supplying the project title and the full list of concrete tasks you settled on. Call this exactly once per conversation, only after every step is small enough that "do it" is unambiguous.',
    parameters: {
      type: 'object',
      properties: {
        project_title: {
          type: 'string',
          description: 'The project’s name, in the user’s own framing.',
        },
        tasks: {
          type: 'array',
          description: 'Every task the project needs, in the order the user settled on.',
          items: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'One concrete task, small enough that "do it" is unambiguous.',
              },
              description: {
                type: 'string',
                description: 'A short note on what the task involves, if one is needed.',
              },
              priority: {
                type: 'string',
                enum: ['normal', 'medium', 'high', 'urgent'],
                description: 'How urgent the task is. Leave it out for a normal task.',
              },
              due_string: {
                type: 'string',
                description: 'When the task is due, in the user’s own words, like "this weekend".',
              },
            },
            required: ['title'],
            additionalProperties: false,
          },
        },
      },
      required: ['project_title', 'tasks'],
      additionalProperties: false,
    },
  },
} as const
