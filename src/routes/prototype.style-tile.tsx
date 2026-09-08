// PROTOTYPE (issue #62) — throwaway code, not part of the real app.
//
// Question this answers: do these concrete design tokens + shadcn/ui
// component picks + a responsive nav shell match
// ~/tmp/hone-mockup-{1,2,3}.png closely enough for the pair to react to and
// settle on, ahead of /to-spec turning the wayfinder map into a spec?
//
// This is ONE faithful reconstruction, not several radically different
// variants — the mockups already pin the visual direction, so there's no
// design alternative to choose between here (departs from the prototype
// skill's default UI.md switcher pattern, which exists for choosing
// *between* designs, not for confirming a single one against a reference).
// The nav shell below is genuinely responsive (real `lg:` breakpoint, not a
// forced toggle) — resize the window to see the sidebar give way to the
// hamburger + drawer.
//
// Capture: see prototype/README.md on this branch, and the pointer left on
// issue #62.
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowRight, History, Home, ListChecks, LogOut, Menu, Send, Settings } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

export const Route = createFileRoute('/prototype/style-tile')({
  component: StyleTilePage,
})

function StyleTilePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PrototypeBanner />
      <div className="mx-auto max-w-6xl space-y-20 px-6 py-12">
        <TokensSection />
        <PrimitivesSection />
        <ShellSection />
      </div>
    </div>
  )
}

function PrototypeBanner() {
  return (
    <div className="border-b border-amber-300 bg-amber-50 px-6 py-3 text-sm text-amber-900">
      🧪 <strong>Prototype</strong> for issue #62 — matched against{' '}
      <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">
        ~/tmp/hone-mockup-{'{1,2,3}'}.png
      </code>
      . Throwaway: this route is dropped before merge, not linked from any real nav.
    </div>
  )
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        {eyebrow}
      </p>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <Separator className="mt-3" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

const PURPLE_SCALE = [
  { step: '50', swatch: 'bg-purple-50', hex: '—', note: 'tint backgrounds (accent, unread)' },
  { step: '100', swatch: 'bg-purple-100', hex: '—', note: '' },
  { step: '200', swatch: 'bg-purple-200', hex: '#e4cafd', note: 'lightest bubble tint (mockup-1)' },
  { step: '300', swatch: 'bg-purple-300', hex: '#ce9cfd', note: '(mockup-2/3)' },
  {
    step: '400',
    swatch: 'bg-purple-400',
    hex: '#be78ff',
    note: 'brand primary — sampled in all 3 mockups',
  },
  { step: '500', swatch: 'bg-purple-500', hex: '#a34ff0', note: 'derived hover/active shade' },
  { step: '600', swatch: 'bg-purple-600', hex: '#7c2fd4', note: '' },
  { step: '700', swatch: 'bg-purple-700', hex: '—', note: '' },
  { step: '800', swatch: 'bg-purple-800', hex: '—', note: '' },
  { step: '900', swatch: 'bg-purple-900', hex: '—', note: '' },
] as const

const SEMANTIC_SWATCHES = [
  { name: 'background', className: 'bg-background border' },
  { name: 'foreground', className: 'bg-foreground' },
  { name: 'muted / secondary', className: 'bg-muted border' },
  { name: 'muted-foreground', className: 'bg-muted-foreground' },
  { name: 'border', className: 'bg-border' },
  { name: 'card', className: 'bg-card border' },
  { name: 'primary', className: 'bg-primary' },
  { name: 'accent', className: 'bg-accent border' },
] as const

const RADII = [
  { label: 'sm', className: 'rounded-sm' },
  { label: 'md', className: 'rounded-md' },
  { label: 'lg', className: 'rounded-lg' },
  { label: 'xl', className: 'rounded-xl' },
  { label: '2xl', className: 'rounded-2xl' },
  { label: '3xl', className: 'rounded-3xl' },
  { label: 'full', className: 'rounded-full' },
] as const

function TokensSection() {
  return (
    <section className="space-y-10">
      <SectionHeading eyebrow="Design tokens" title="Colour, type, radius, spacing" />

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          Purple scale (supporting shades around the sampled brand purple)
        </h3>
        <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
          {PURPLE_SCALE.map(({ step, swatch, hex, note }) => (
            <div key={step} className="space-y-1">
              <div className={`h-14 rounded-lg border border-black/5 ${swatch}`} title={note} />
              <p className="text-xs font-medium">{step}</p>
              <p className="text-[10px] text-muted-foreground">{hex}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          400 is the one hue actually sampled from the mockups (
          <code>#be78ff</code>/<code>#c17ffe</code>, near-identical across all three); the rest of
          the scale is derived so we have somewhere to go for hover states, tints, and dark mode
          without inventing a second brand colour.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Semantic tokens</h3>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
          {SEMANTIC_SWATCHES.map(({ name, className }) => (
            <div key={name} className="space-y-1">
              <div className={`h-14 rounded-lg ${className}`} />
              <p className="text-xs text-muted-foreground">{name}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          Typography — incl. the &ldquo;HONE&rdquo; wordmark
        </h3>
        <div className="flex flex-wrap items-end gap-10 rounded-lg border p-6">
          <div className="space-y-1">
            <p className="text-6xl font-normal tracking-[0.2em] text-foreground uppercase">
              hone
            </p>
            <p className="text-xs text-muted-foreground">
              Hero (mockup-1): <code>text-6xl uppercase tracking-[0.2em] font-normal</code>
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xl font-bold tracking-[0.15em] text-primary uppercase">hone</p>
            <p className="text-xs text-muted-foreground">
              Sidebar (mockup-2): <code>text-xl uppercase tracking-[0.15em] font-bold text-primary</code>
            </p>
          </div>
        </div>
        <div className="space-y-2 rounded-lg border p-6">
          <p className="text-sm font-medium">
            Body text — <span className="text-muted-foreground">Geist Variable, the shadcn default</span>
          </p>
          <p className="text-2xl font-semibold">Preparing for a dinner party</p>
          <p className="text-base">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean.</p>
          <p className="text-sm text-muted-foreground">type something…</p>
        </div>
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Radius scale</h3>
          <div className="flex flex-wrap items-end gap-4">
            {RADII.map(({ label, className }) => (
              <div key={label} className="space-y-1 text-center">
                <div className={`size-14 border-2 border-primary/60 bg-purple-50 ${className}`} />
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Base <code>--radius</code> bumped to <code>0.75rem</code> (from shadcn&rsquo;s 0.625rem
            default) — the mockups run rounder than stock shadcn: pill buttons/inputs, generously
            rounded chat bubbles and cards.
          </p>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Spacing scale (Tailwind default)</h3>
          <div className="space-y-2">
            {[
              { step: '1', className: 'w-1' },
              { step: '2', className: 'w-2' },
              { step: '3', className: 'w-3' },
              { step: '4', className: 'w-4' },
              { step: '6', className: 'w-6' },
              { step: '8', className: 'w-8' },
              { step: '12', className: 'w-12' },
              { step: '16', className: 'w-16' },
            ].map(({ step, className }) => (
              <div key={step} className="flex items-center gap-3">
                <span className="w-8 text-xs text-muted-foreground">{step}</span>
                <div className={`h-3 rounded bg-primary/40 ${className}`} />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            No custom spacing scale — the mockups don&rsquo;t demand one and Tailwind&rsquo;s default
            (4px steps) already covers everything seen: tight 8px gaps inside bubbles/cards, 16–24px
            between blocks.
          </p>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function PrimitivesSection() {
  return (
    <section className="space-y-10">
      <SectionHeading eyebrow="shadcn/ui primitives" title="Styled to the mockups' palette" />

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Buttons</h3>
        <div className="flex flex-wrap items-center gap-4 rounded-lg border p-6">
          <Button className="rounded-full px-5">
            start an interview <ArrowRight className="ml-1 size-4" />
          </Button>
          <Button variant="link" className="text-muted-foreground">
            go to todos
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Settings">
            <Settings className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Log out">
            <LogOut className="size-5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          The primary CTA is a full pill (<code>rounded-full</code>), overriding the base radius
          token — that shape is specific to the one hero CTA in mockup-1, everything else
          (cards, inputs) uses the token scale as-is.
        </p>
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Card — todolist (mockup-3)</h3>
          <Card className="max-w-xs overflow-hidden py-0">
            <CardHeader className="rounded-t-xl bg-primary py-3 text-primary-foreground">
              <CardTitle className="text-sm font-medium">preparing for a dinner</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 py-4">
              {['Invite friends to dinner', 'Find a recipe that you like', 'Make a shopping list'].map(
                (item) => (
                  <label key={item} className="flex items-center gap-2 text-sm">
                    <span className="size-3.5 rounded-full border border-muted-foreground/50" />
                    {item}
                  </label>
                ),
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Input — chat composer (mockup-2)</h3>
          <div className="flex items-center gap-2 rounded-full border bg-background p-1.5 pl-4 shadow-sm">
            <Input
              placeholder="type something…"
              className="h-auto border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
            <Button size="icon" className="size-8 shrink-0 rounded-full" aria-label="Send">
              <Send className="size-4" />
            </Button>
          </div>

          <h3 className="pt-2 text-sm font-medium text-muted-foreground">Chat bubbles</h3>
          <div className="space-y-2">
            <p className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            </p>
            <p className="w-fit max-w-[80%] rounded-2xl rounded-bl-sm border bg-card px-4 py-2 text-sm">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Bubbles aren&rsquo;t a shadcn primitive — plain <code>div</code>s on top of the same{' '}
            <code>primary</code>/<code>card</code> tokens as everything else, included here since
            they&rsquo;re the dominant surface in 2 of 3 mockups.
          </p>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Nav shell
// ---------------------------------------------------------------------------

const NAV_LINKS = [
  { label: 'Home', icon: Home },
  { label: 'My todos', icon: ListChecks },
  { label: 'Chat history', icon: History },
] as const

function ShellSection() {
  return (
    <section className="space-y-4">
      <SectionHeading eyebrow="Nav shell" title="Sidebar ≥lg, hamburger + drawer below" />
      <p className="text-sm text-muted-foreground">
        This is a real, responsive shell — not two static states. Resize the window (or the
        preview pane) across the <code>lg</code> breakpoint (1024px) to watch the permanent
        sidebar (mockup-2) give way to the hamburger-triggered drawer (mockup-1/3).
      </p>
      <div className="overflow-hidden rounded-xl border shadow-sm">
        <NavShellDemo />
      </div>
    </section>
  )
}

function NavShellDemo() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex h-[520px] bg-background">
      {/* Permanent sidebar — lg and up */}
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-sidebar p-4 lg:flex">
        <Wordmark />
        <nav className="mt-8 flex flex-col gap-1">
          {NAV_LINKS.map(({ label, icon: Icon }) => (
            <NavLink key={label} label={label} icon={Icon} />
          ))}
        </nav>
        <Button
          variant="ghost"
          size="icon"
          className="mt-auto w-fit rounded-full text-muted-foreground"
          aria-label="Log out"
        >
          <LogOut className="size-5" />
        </Button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar — below lg only */}
        <header className="flex items-center gap-3 border-b px-4 py-3 lg:hidden">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <SheetContent side="left" className="w-64 p-4">
              <SheetHeader className="p-0">
                <SheetTitle asChild>
                  <Wordmark />
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1">
                {NAV_LINKS.map(({ label, icon: Icon }) => (
                  <NavLink key={label} label={label} icon={Icon} onClick={() => setDrawerOpen(false)} />
                ))}
              </nav>
              <Button
                variant="ghost"
                className="mt-auto w-fit gap-2 text-muted-foreground"
                onClick={() => setDrawerOpen(false)}
              >
                <LogOut className="size-4" /> Log out
              </Button>
            </SheetContent>
          </Sheet>
          <p className="font-medium">Preparing for a dinner party</p>
        </header>

        {/* Shared content — same on both sides of the breakpoint */}
        <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          <div className="hidden lg:block">
            <p className="text-lg font-medium">Preparing for a dinner party</p>
            <Separator className="mt-2" />
          </div>
          <div className="space-y-2">
            <p className="ml-auto w-fit max-w-[70%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            </p>
            <p className="w-fit max-w-[70%] rounded-2xl rounded-bl-sm border bg-card px-4 py-2 text-sm">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            </p>
          </div>
          <div className="mt-auto flex items-center gap-2 rounded-full border bg-background p-1.5 pl-4 shadow-sm">
            <Input
              placeholder="type something…"
              className="h-auto border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
            <Button size="icon" className="size-8 shrink-0 rounded-full" aria-label="Send">
              <Send className="size-4" />
            </Button>
          </div>
        </main>
      </div>
    </div>
  )
}

function Wordmark() {
  return <p className="text-xl font-bold tracking-[0.15em] text-primary uppercase">hone</p>
}

function NavLink({
  label,
  icon: Icon,
  onClick,
}: {
  label: string
  icon: typeof Home
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
    >
      <Icon className="size-4" />
      {label}
    </button>
  )
}
