import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Renders agent output as formatted Markdown (bold, lists, tables, code) so
 * replies read like a normal chat instead of showing raw `**`/`##`/`|` syntax.
 * react-markdown sanitizes by default (no raw HTML injection).
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`md ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _n, ...props }) => <a target="_blank" rel="noreferrer noopener" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
