# Prototype: Design tokens, shadcn primitives, nav shell chrome (issue #62)

**Question**: what are the concrete design tokens (brand purple + supporting
shades, typography incl. the "HONE" wordmark treatment, radius, spacing) and
shadcn/ui component picks (button, card, sheet/drawer, input) that best match
`~/tmp/hone-mockup-{1,2,3}.png`, and what does the responsive nav shell
(full sidebar ≥`lg`, hamburger-collapsed drawer below) look like wired up
with them?

**How to view**: `npm run dev`, then open `/prototype/style-tile`. No auth
required — the route sits outside the app's `beforeLoad` guards on purpose,
since it's a throwaway reference page, not a real screen.

## Not a set of variants

This departs from `prototype/UI.md`'s default (several radically different
variants behind a `?variant=` switcher). That pattern exists for choosing
*between* designs; here the mockups already pin one visual direction, so
there was nothing to choose between — the job was extracting concrete
tokens/components from a reference and confirming they read right in code,
not exploring alternatives. The nav shell section is a single, genuinely
responsive shell (real `lg:` breakpoint) rather than two static states behind
a toggle — resizing the window shows both, same as it would in production.

## How the tokens were derived

Colors were sampled directly from the three mockup PNGs
(`magick <file> -colors 12 -unique-colors txt:`), not eyeballed:

- Brand purple **`#be78ff`** (`#c17ffe` in a couple of samples — treated as
  the same color, likely antialiasing) repeats near-identically across all
  three mockups. It's the one actual finding; everything else in
  `--purple-50..900` is a derived supporting scale (hover/active shades,
  tints, dark-mode headroom) since the mockups only ever show the one hue.
- Neutrals were consistent too: `#171717` body text, `#6b6a6a` muted text,
  `#f8f8f8` panel background, `#e5e5e5` border.
- Base radius bumped from shadcn's default `0.625rem` to `0.75rem` — the
  mockups run rounder (pill buttons/inputs, generously rounded bubbles and
  cards) than stock shadcn.
- No custom spacing scale. Nothing in the mockups needed one; Tailwind's
  default (4px steps) already covers what's there.
- Dark mode tokens exist (shadcn scaffolds them by default) but are **not**
  derived from anything — none of the three mockups show a dark surface.
  Flagged as an open question below rather than guessed at.

All of this lives as CSS custom properties in `src/styles.css`, wired through
shadcn's usual `@theme inline` indirection — nothing here is prototype-only;
the token values are the real candidate for `dev`, only the style-tile route
itself is throwaway.

## What's installed

shadcn/ui itself, for real (`components.json`, `src/lib/utils.ts`,
`src/components/ui/{button,card,input,separator,avatar,sheet}.tsx`), plus the
`@/*` path alias in `tsconfig.json` and `vite.config.ts` it depends on. Style
`radix-nova`, base color `neutral` (overridden immediately by the mockup
palette above), Geist Variable for `--font-sans` (shadcn's default — nothing
in the mockups argues for a different typeface, just the wordmark's
uppercase/tracked treatment layered on top).

## Open questions surfaced while building this

- **Dark mode**: no mockup shows one. The scaffolded dark tokens in
  `styles.css` are a reasonable-looking guess, not a derived answer — worth
  an explicit decision (does Hone need dark mode for the Sep 11 defense, or
  is this dead code to strip?) before `/to-spec` treats it as settled.
- **Primary-on-white contrast**: `#be78ff` text/icons on white background is
  visually close to the mockups but hasn't been checked against WCAG AA —
  worth a contrast-checker pass before this is load-bearing for accessibility.
- **Pill CTA vs. token radius**: the one hero button ("start an interview →")
  is a full pill in the mockup, everything else uses the token radius scale
  as-is. Currently handled as a one-off `rounded-full` override on that single
  button rather than a second radius token — flag if that reads as
  inconsistent once more screens exist.

## Capture

Pending — this hasn't been reviewed yet. Once the pair reacts and settles on
it (per issue #62), record the verdict here: what changed from this first
pass, anything stolen from a rejected direction, and where the validated
tokens/shell land in `dev` (`src/styles.css` token values, the shadcn install
itself, and a real nav-shell component built from
`src/routes/prototype.style-tile.tsx`'s `NavShellDemo`). The full prototype
route stays on this branch, out of `dev`, per the prototype skill's cleanup
step.
