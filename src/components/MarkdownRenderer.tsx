"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const components: Partial<Components> = {
  // Headings
  h1: ({ children }) => (
    <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-4 mb-2 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-3 mb-1.5 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-2 mb-1 first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-2 mb-1 first:mt-0">
      {children}
    </h4>
  ),

  // Paragraphs
  p: ({ children }) => (
    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed mb-2 last:mb-0">
      {children}
    </p>
  ),

  // Lists
  ul: ({ children }) => (
    <ul className="list-disc list-inside space-y-0.5 mb-2 text-xs text-gray-700 dark:text-gray-300">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside space-y-0.5 mb-2 text-xs text-gray-700 dark:text-gray-300">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),

  // Inline formatting
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-gray-600 dark:text-gray-400">{children}</em>
  ),

  // Code
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className={`${className ?? ""} text-[11px] leading-relaxed`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="bg-gray-100 dark:bg-gray-800 text-[#A435F0] dark:text-purple-400 px-1 py-0.5 rounded text-[11px] font-mono">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-lg p-3 overflow-x-auto mb-2 text-[11px] leading-relaxed border border-gray-800">
      {children}
    </pre>
  ),

  // Block elements
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[#A435F0]/40 pl-3 my-2 text-gray-600 dark:text-gray-400 italic">
      {children}
    </blockquote>
  ),
  hr: () => (
    <hr className="border-gray-200 dark:border-gray-700 my-3" />
  ),

  // Tables
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2">
      <table className="w-full text-xs border-collapse border border-gray-200 dark:border-gray-700 rounded-lg">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="text-left px-2.5 py-1.5 font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-2.5 py-1.5 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
      {children}
    </td>
  ),

  // Links
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#A435F0] hover:underline"
    >
      {children}
    </a>
  ),
};

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
