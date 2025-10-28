'use client'

import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { motion, useAnimation, useReducedMotion } from 'framer-motion'
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
  /** Whether the markdown is actively streaming */
  isStreaming?: boolean
}

/**
 * StreamingMarkdown component renders markdown content with ethereal theming.
 * 
 * This component uses Streamdown to progressively render markdown as it streams in,
 * with custom styling for all markdown elements to match the ethereal aesthetic.
 * Supports headings, text formatting, links, lists, blockquotes, tables, and code blocks
 * with syntax highlighting.
 * 
 * @param props - The component props
 * @returns A React component that renders styled markdown content
 */
export function StreamingMarkdown({ text, className, isStreaming = false }: StreamingMarkdownProps) {
  const controls = useAnimation()
  const prefersReducedMotion = useReducedMotion()
  const previousLengthRef = useRef(0)
  const shouldAnimate = isStreaming && !prefersReducedMotion

  useEffect(() => {
    controls.set({ opacity: 1, y: 0 })
  }, [controls])

  useEffect(() => {
    if (!shouldAnimate) {
      controls.set({ opacity: 1, y: 0 })
      previousLengthRef.current = text.length
      return
    }

    if (text.length > previousLengthRef.current) {
      controls.set({ opacity: 0.72, y: 6 })
      controls.start({ opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } })
    }

    previousLengthRef.current = text.length
  }, [text, controls, shouldAnimate])

  // Memoize components map for performance
  const components = useMemo(() => ({
    // Headings
    h1: ({ children, ...props }: { children?: ReactNode }) => (
      <h1 className="text-white text-3xl font-light mb-4 mt-6" {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }: { children?: ReactNode }) => (
      <h2 className="text-white text-2xl font-light mb-3 mt-5" {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }: { children?: ReactNode }) => (
      <h3 className="text-white/95 text-xl font-light mb-3 mt-4" {...props}>{children}</h3>
    ),
    h4: ({ children, ...props }: { children?: ReactNode }) => (
      <h4 className="text-white/95 text-lg font-light mb-2 mt-4" {...props}>{children}</h4>
    ),
    h5: ({ children, ...props }: { children?: ReactNode }) => (
      <h5 className="text-white/90 text-base font-light mb-2 mt-3" {...props}>{children}</h5>
    ),
    h6: ({ children, ...props }: { children?: ReactNode }) => (
      <h6 className="text-white/90 text-sm font-light mb-2 mt-3" {...props}>{children}</h6>
    ),

    // Paragraphs
    p: ({ children, ...props }: { children?: ReactNode }) => (
      <p className="text-white/90 leading-relaxed my-3" {...props}>{children}</p>
    ),

    // Text formatting
    strong: ({ children, ...props }: { children?: ReactNode }) => (
      <strong className="text-white font-medium" {...props}>{children}</strong>
    ),
    em: ({ children, ...props }: { children?: ReactNode }) => (
      <em className="text-white/95 italic" {...props}>{children}</em>
    ),

    // Links
    a: ({ children, href, ...props }: { children?: ReactNode; href?: string }) => (
      <a
        href={href}
        className="text-white underline decoration-white/30 hover:decoration-white/60 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none rounded-sm transition-colors"
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
            className="text-[13px] rounded bg-white/10 border border-white/15 px-1.5 py-0.5 text-white font-mono"
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
          <CodeBlockCopyButton className="text-white/70 hover:text-white hover:bg-white/10" />
        </CodeBlock>
      )
    },

    // Pre wrapper (handled by code block above)
    pre: ({ children }: { children?: ReactNode }) => <>{children}</>,

    // Lists
    ul: ({ children, ...props }: { children?: ReactNode }) => (
      <ul className="pl-6 list-disc marker:text-white/50 text-white/90 my-3 space-y-1" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: { children?: ReactNode }) => (
      <ol className="pl-6 list-decimal marker:text-white/50 text-white/90 my-3 space-y-1" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }: { children?: ReactNode }) => (
      <li className="text-white/90" {...props}>{children}</li>
    ),

    // Blockquote
    blockquote: ({ children, ...props }: { children?: ReactNode }) => (
      <blockquote
        className="border-l-2 border-white/20 bg-white/5 text-white/80 italic rounded-r px-4 py-3 my-4"
        {...props}
      >
        {children}
      </blockquote>
    ),

    // Horizontal rule
    hr: (props: object) => (
      <hr className="border-white/15 my-6" {...props} />
    ),

    // Tables
    table: ({ children, ...props }: { children?: ReactNode }) => (
      <div className="w-full overflow-x-auto my-4">
        <table className="text-white/85 border-separate border-spacing-0 min-w-full" {...props}>
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
      <tr className="even:bg-white/5" {...props}>{children}</tr>
    ),
    th: ({ children, ...props }: { children?: ReactNode }) => (
      <th className="bg-white/10 text-white font-medium px-3 py-2 border-b border-white/15 text-left" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }: { children?: ReactNode }) => (
      <td className="text-white/85 px-3 py-2 border-b border-white/10" {...props}>
        {children}
      </td>
    ),
  }), [])

  return (
    <div className={cn('text-white/90', className)} aria-live="polite">
      <motion.div
        initial={false}
        animate={shouldAnimate ? controls : { opacity: 1, y: 0 }}
      >
        <Streamdown components={components}>{text}</Streamdown>
      </motion.div>
    </div>
  )
}
