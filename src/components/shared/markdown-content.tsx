"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { cn } from "@/src/lib/utils";

const components: Components = {
  h1: ({ children }) => (
    <h3 className="mb-2 mt-3 text-base font-bold first:mt-0 lg:text-lg">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="mb-2 mt-3 text-base font-bold first:mt-0 lg:text-lg">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="mb-2 mt-4 border-b border-blue-200/60 pb-1.5 text-sm font-bold first:mt-0 dark:border-blue-800/40 lg:text-base">
      {children}
    </h4>
  ),
  h4: ({ children }) => (
    <h5 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h5>
  ),
  p: ({ children }) => (
    <p className="mb-2 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 ml-4 list-outside list-disc space-y-1.5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 ml-4 list-outside list-decimal space-y-1.5 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="pl-1 leading-relaxed">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic">{children}</em>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <pre className="my-2 overflow-x-auto rounded-lg bg-muted/60 p-3 text-xs">
          <code>{children}</code>
        </pre>
      );
    }
    return (
      <code className="rounded bg-muted/60 px-1 py-0.5 text-[0.85em] font-mono">
        {children}
      </code>
    );
  },
  hr: () => <hr className="my-3 border-border/50" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/40 text-left text-xs font-semibold">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-1.5">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-t px-3 py-1.5">{children}</td>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
      {children}
    </a>
  ),
};

type Props = {
  content: string;
  className?: string;
};

export function MarkdownContent({ content, className }: Props) {
  return (
    <div className={cn("pharmacy-md space-y-1", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
