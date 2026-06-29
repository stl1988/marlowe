import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownContentProps {
  children: string;
  className?: string;
  /** 'light' | 'dark' — controls code block colors */
  theme?: 'light' | 'dark';
}

export const MarkdownContent = memo(function MarkdownContent({
  children,
  className,
  theme = 'light',
}: MarkdownContentProps) {
  const isDark = theme === 'dark';

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Code blocks
          code({ className: langClassName, children: codeChildren, ...props }) {
            const match = /language-(\w+)/.exec(langClassName ?? '');
            const lang = match ? match[1] : '';
            // react-markdown v10: inline code has no className
            const isBlock = Boolean(langClassName);
            const code = String(codeChildren).replace(/\n$/, '');

            if (!isBlock) {
              return (
                <code
                  className="bg-muted px-1 py-0.5 rounded text-[0.85em] font-mono"
                  {...props}
                >
                  {codeChildren}
                </code>
              );
            }

            return (
              <div className={`rounded-md overflow-hidden my-3 border text-sm ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-50 border-zinc-200'}`}>
                {lang && (
                  <div className={`px-3 py-1 text-xs font-mono border-b ${isDark ? 'text-zinc-400 border-zinc-700' : 'text-zinc-500 border-zinc-200'}`}>
                    {lang}
                  </div>
                )}
                <pre className="overflow-x-auto p-3 leading-relaxed m-0">
                  <code className="font-mono">{code}</code>
                </pre>
              </div>
            );
          },

          // Paragraphs
          p({ children: pChildren }) {
            return <p className="mb-3 last:mb-0 leading-relaxed">{pChildren}</p>;
          },

          // Headings
          h1({ children: hChildren }) {
            return <h1 className="text-xl font-bold mt-5 mb-3 first:mt-0">{hChildren}</h1>;
          },
          h2({ children: hChildren }) {
            return <h2 className="text-lg font-bold mt-4 mb-2 first:mt-0">{hChildren}</h2>;
          },
          h3({ children: hChildren }) {
            return <h3 className="text-base font-semibold mt-3 mb-2 first:mt-0">{hChildren}</h3>;
          },
          h4({ children: hChildren }) {
            return <h4 className="text-sm font-semibold mt-3 mb-1 first:mt-0">{hChildren}</h4>;
          },

          // Lists
          ul({ children: ulChildren }) {
            return <ul className="list-disc list-outside pl-5 mb-3 space-y-1">{ulChildren}</ul>;
          },
          ol({ children: olChildren }) {
            return <ol className="list-decimal list-outside pl-5 mb-3 space-y-1">{olChildren}</ol>;
          },
          li({ children: liChildren }) {
            return <li className="leading-relaxed">{liChildren}</li>;
          },

          // Blockquote
          blockquote({ children: bqChildren }) {
            return (
              <blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic text-muted-foreground my-3">
                {bqChildren}
              </blockquote>
            );
          },

          // Links
          a({ href, children: aChildren }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:opacity-80"
              >
                {aChildren}
              </a>
            );
          },

          // Horizontal rule
          hr() {
            return <hr className="my-4 border-border" />;
          },

          // Tables
          table({ children: tChildren }) {
            return (
              <div className="overflow-x-auto my-3">
                <table className="min-w-full border-collapse text-sm">{tChildren}</table>
              </div>
            );
          },
          thead({ children: thChildren }) {
            return <thead className="bg-muted/50">{thChildren}</thead>;
          },
          th({ children: thChildren }) {
            return <th className="border border-border px-3 py-2 text-left font-semibold">{thChildren}</th>;
          },
          td({ children: tdChildren }) {
            return <td className="border border-border px-3 py-2">{tdChildren}</td>;
          },

          // Strong / em
          strong({ children: sChildren }) {
            return <strong className="font-semibold">{sChildren}</strong>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
