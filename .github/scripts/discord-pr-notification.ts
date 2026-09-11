// Pure message-building seam for the Discord PR-notification workflow
// (issue #41). GitHub's `pull_request` webhook payload in, a Discord
// message payload out (or `null` as the explicit "don't post" signal) —
// no network calls, no GitHub Actions plumbing, so it's covered by the
// same `vitest` suite as the rest of the app.

export interface PullRequestEventPayload {
  action: string
  pull_request: {
    number: number
    title: string
    html_url: string
    draft: boolean
    merged: boolean
    user: {
      login: string
      type: string
    }
  }
}

export interface DiscordEmbed {
  title: string
  url: string
  description: string
  color: number
}

export interface DiscordMessage {
  embeds: DiscordEmbed[]
}

// GitHub's own PR-state colors, reused here so the Discord embed reads as
// visibly "the same state" a team member would see on the PR itself.
const COLOR_OPENED = 0x238636
const COLOR_MERGED = 0x8957e5
const COLOR_CLOSED = 0xda3633

export function buildPrNotification(payload: PullRequestEventPayload): DiscordMessage | null {
  const pr = payload.pull_request

  // Belt-and-suspenders: the workflow's own `if:` condition is meant to
  // skip these before this function ever runs, but the function stays
  // correct on its own so it's directly unit-testable (issue #41 Testing
  // Decisions).
  if (pr.draft || pr.user.type === 'Bot') {
    return null
  }

  if (payload.action === 'opened') {
    return {
      embeds: [
        {
          title: `#${pr.number} ${pr.title}`,
          url: pr.html_url,
          description: `Opened by **${pr.user.login}**`,
          color: COLOR_OPENED,
        },
      ],
    }
  }

  if (payload.action === 'closed') {
    return {
      embeds: [
        {
          title: `#${pr.number} ${pr.title}`,
          url: pr.html_url,
          description: pr.merged
            ? `Merged by **${pr.user.login}**`
            : `Closed without merging by **${pr.user.login}**`,
          color: pr.merged ? COLOR_MERGED : COLOR_CLOSED,
        },
      ],
    }
  }

  return null
}
