'use client'

import { useMemo, type ReactNode } from 'react'
import { Streamdown } from 'streamdown'
import { cn } from '@/lib/utils'
import { CodeBlock, CodeBlockCopyButton } from '@/components/ai-elements/code-block'

/**
 * Props for the StreamingMarkdown component
 */
interface StreamingMarkdownProps {
  /** The markdown text to render */
  text: string
  /** Optional className for styling */
  className?: string
}

/**
 * StreamingMarkdown component renders markdown content with Trailhead theming.
 * 
 * This component uses Streamdown to progressively render markdown as it streams in,
 * with custom styling for all markdown elements to match the warm Trailhead aesthetic.
 * Supports headings, text formatting, links, lists, blockquotes, tables, and code blocks
 * with syntax highlighting.
 * 
 * @param props - The component props
 * @returns A React component that renders styled markdown content
 */
export function StreamingMarkdown({ text, className }: StreamingMarkdownProps) {
  // Memoize components map for performance
  const components = useMemo(() => ({
    // Headings
    h1: ({ children, ...props }: { children?: ReactNode }) => (
      <h1 className="mb-4 mt-6 text-3xl font-semibold text-foreground" {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }: { children?: ReactNode }) => (
      <h2 className="mb-3 mt-5 text-2xl font-semibold text-foreground" {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }: { children?: ReactNode }) => (
      <h3 className="mb-3 mt-4 text-xl font-semibold text-foreground" {...props}>{children}</h3>
    ),
    h4: ({ children, ...props }: { children?: ReactNode }) => (
      <h4 className="mb-2 mt-4 text-lg font-semibold text-foreground" {...props}>{children}</h4>
    ),
    h5: ({ children, ...props }: { children?: ReactNode }) => (
      <h5 className="mb-2 mt-3 text-base font-semibold text-foreground" {...props}>{children}</h5>
    ),
    h6: ({ children, ...props }: { children?: ReactNode }) => (
      <h6 className="mb-2 mt-3 text-sm font-semibold text-foreground/90" {...props}>{children}</h6>
    ),

    // Paragraphs
    p: ({ children, ...props }: { children?: ReactNode }) => (
      <p className="my-3 leading-relaxed text-foreground/90" {...props}>{children}</p>
    ),

    // Text formatting
    strong: ({ children, ...props }: { children?: ReactNode }) => (
      <strong className="font-semibold text-foreground" {...props}>{children}</strong>
    ),
    em: ({ children, ...props }: { children?: ReactNode }) => (
      <em className="italic text-foreground/90" {...props}>{children}</em>
    ),

    // Links
    a: ({ children, href, ...props }: { children?: ReactNode; href?: string }) => (
      <a
        href={href}
        className="rounded-sm text-primary underline decoration-primary/40 transition-colors hover:decoration-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    ),

    // Code (inline and blocks)
    code: ({ children, className, ...props }: { children?: ReactNode; className?: string }) => {
      const isInline = !className
      const match = /language-(\w+)/.exec(className || '')
      const language = match ? match[1] : 'plaintext'
      
      if (isInline) {
        return (
          <code
            className="rounded border border-primary/25 bg-primary/15 px-1.5 py-0.5 text-[13px] font-mono text-foreground"
            {...props}
          >
            {children}
          </code>
        )
      }

      // Block code with syntax highlighting
      const codeString = String(children).replace(/\n$/, '')
      return (
        <CodeBlock code={codeString} language={language} className="my-4">
          <CodeBlockCopyButton className="text-muted-foreground hover:bg-accent/30 hover:text-foreground" />
        </CodeBlock>
      )
    },

    // Pre wrapper (handled by code block above)
    pre: ({ children }: { children?: ReactNode }) => <>{children}</>,

    // Lists
    ul: ({ children, ...props }: { children?: ReactNode }) => (
      <ul className="my-3 space-y-1 pl-6 text-foreground/90 marker:text-primary/60" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: { children?: ReactNode }) => (
      <ol className="my-3 space-y-1 pl-6 text-foreground/90 marker:text-primary/60" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }: { children?: ReactNode }) => (
      <li className="text-foreground/90" {...props}>{children}</li>
    ),

    // Blockquote
    blockquote: ({ children, ...props }: { children?: ReactNode }) => (
      <blockquote
        className="my-4 rounded-r border-l-2 border-primary/35 bg-primary/10 px-4 py-3 italic text-foreground/85"
        {...props}
      >
        {children}
      </blockquote>
    ),

    // Horizontal rule
    hr: (props: object) => (
      <hr className="my-6 border-border/70" {...props} />
    ),

    // Tables
    table: ({ children, ...props }: { children?: ReactNode }) => (
      <div className="w-full overflow-x-auto my-4">
        <table className="min-w-full border-separate border-spacing-0 text-foreground/90" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }: { children?: ReactNode }) => (
      <thead {...props}>{children}</thead>
    ),
    tbody: ({ children, ...props }: { children?: ReactNode }) => (
      <tbody {...props}>{children}</tbody>
    ),
    tr: ({ children, ...props }: { children?: ReactNode }) => (
      <tr className="even:bg-accent/20" {...props}>{children}</tr>
    ),
    th: ({ children, ...props }: { children?: ReactNode }) => (
      <th className="border-b border-border/60 bg-accent/30 px-3 py-2 text-left font-semibold text-foreground" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }: { children?: ReactNode }) => (
      <td className="border-b border-border/60 px-3 py-2 text-foreground/90" {...props}>
        {children}
      </td>
    ),
  }), [])

  return (
    <div className={cn('text-foreground', className)} aria-live="polite">
      <Streamdown components={components}>{text}</Streamdown>
    </div>
  )
}
