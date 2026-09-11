import { describe, expect, it } from 'vitest'

import { buildPrNotification, type PullRequestEventPayload } from './discord-pr-notification.ts'

function payload(overrides: {
  action: string
  draft?: boolean
  merged?: boolean
  authorType?: string
}): PullRequestEventPayload {
  return {
    action: overrides.action,
    pull_request: {
      number: 42,
      title: 'Add frobnicator support',
      html_url: 'https://github.com/andreasjosef/u15-ai-baserad-webbapplikation/pull/42',
      draft: overrides.draft ?? false,
      merged: overrides.merged ?? false,
      user: {
        login: 'octocat',
        type: overrides.authorType ?? 'User',
      },
    },
  }
}

describe('buildPrNotification', () => {
  it('builds an "opened" notification with the PR title, link, and author', () => {
    const message = buildPrNotification(payload({ action: 'opened' }))

    expect(message).not.toBeNull()
    const embed = message?.embeds[0]
    expect(embed?.title).toContain('Add frobnicator support')
    expect(embed?.url).toBe('https://github.com/andreasjosef/u15-ai-baserad-webbapplikation/pull/42')
    expect(embed?.description).toContain('octocat')
  })

  it('visibly distinguishes a merged PR from an opened one', () => {
    const opened = buildPrNotification(payload({ action: 'opened' }))
    const merged = buildPrNotification(payload({ action: 'closed', merged: true }))

    expect(merged).not.toBeNull()
    expect(merged?.embeds[0]?.description).toMatch(/merged/i)
    expect(merged?.embeds[0]?.color).not.toBe(opened?.embeds[0]?.color)
  })

  it('visibly distinguishes a closed-unmerged PR from a merged one', () => {
    const merged = buildPrNotification(payload({ action: 'closed', merged: true }))
    const closed = buildPrNotification(payload({ action: 'closed', merged: false }))

    expect(closed).not.toBeNull()
    expect(closed?.embeds[0]?.description).toMatch(/closed/i)
    expect(closed?.embeds[0]?.description).not.toMatch(/merged/i)
    expect(closed?.embeds[0]?.color).not.toBe(merged?.embeds[0]?.color)
  })

  it('skips draft PRs', () => {
    expect(buildPrNotification(payload({ action: 'opened', draft: true }))).toBeNull()
  })

  it('skips bot-authored PRs', () => {
    expect(buildPrNotification(payload({ action: 'opened', authorType: 'Bot' }))).toBeNull()
  })
})
