import type { ReactNode } from 'react'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import { themeInitScript } from '../lib/theme.ts'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Hone' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Applies (or doesn't apply) the `.dark` class before anything
            paints (issue #83) — a stored or system preference for dark
            must never flash light first. Runs first, as a plain
            synchronous script, because at this point hydration and React
            don't exist yet. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
        <HeadContent />
      </head>
      <body className="min-h-screen font-sans antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
