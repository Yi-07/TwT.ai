"use client";

import { useMemo, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import rehypeKatex from "rehype-katex";
import { unified } from "unified";

// ---------------------------------------------------------------------------
// Block-level partitioner
// ---------------------------------------------------------------------------

interface BlockSpan {
  id: number;
  content: string;
}

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

function partitionBlocks(content: string): {
  stable: BlockSpan[];
  unstable: string;
} {
  if (!content) return { stable: [], unstable: "" };

  const ast = processor.parse(content);
  const children = ast.children;
  const n = children.length;

  if (n === 0) return { stable: [], unstable: "" };

  // All children except the last are stable — they're preceded by block-level
  // delimiters that guarantee their content will not change on subsequent frames.
  const stable: BlockSpan[] = [];
  for (let i = 0; i < n - 1; i++) {
    const child = children[i];
    const start = child.position?.start?.offset;
    const end = child.position?.end?.offset;
    if (start != null && end != null) {
      stable.push({ id: i, content: content.slice(start, end) });
    }
  }

  // The last child is unstable (still growing)
  const lastChild = children[n - 1];
  const lastStart = lastChild.position?.start?.offset ?? 0;
  const unstable = content.slice(lastStart);

  return { stable, unstable };
}

// ---------------------------------------------------------------------------
// Stable block — memo'd by content, never re-renders once settled
// ---------------------------------------------------------------------------

const StableBlock = memo(function StableBlock({
  content,
}: {
  content: string;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
    >
      {content}
    </ReactMarkdown>
  );
});

// ---------------------------------------------------------------------------
// shieldUnclosedMath — duplicate of the one in MessageBubble to keep
// StreamingMarkdown self-contained.  Applied to the unstable block only.
// ---------------------------------------------------------------------------

function shieldUnclosedMath(content: string): string {
  const dollars = content.match(/\$/g);
  if (!dollars || dollars.length % 2 === 0) return content;
  const idx = content.lastIndexOf("$");
  if (idx < 0) return content;
  if (idx > 0 && content[idx - 1] === "\\") return content;
  return content.slice(0, idx) + "\\$" + content.slice(idx + 1);
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface StreamingMarkdownProps {
  content: string;
  className: string;
}

export function StreamingMarkdown({
  content,
  className,
}: StreamingMarkdownProps) {
  const { stable, unstable } = useMemo(
    () => partitionBlocks(content),
    [content],
  );

  const safeUnstable = shieldUnclosedMath(unstable);

  return (
    <div className={className}>
      {stable.map((b) => (
        <StableBlock key={b.id} content={b.content} />
      ))}
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {safeUnstable}
      </ReactMarkdown>
    </div>
  );
}
