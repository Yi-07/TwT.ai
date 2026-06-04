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

/**
 * Fast block split for mobile / low-power devices.
 *
 * Splits by \n\n (paragraph delimiter).  This is a pure string scan that
 * completes in under a millisecond, vs 4-8ms for unified.parse() on the
 * same content on a mobile CPU.  The trade-off is that code blocks with
 * internal blank lines may be split across blocks — but only during
 * streaming.  Once the stream ends, the full ReactMarkdown path renders
 * the final content correctly.
 */
function partitionBlocksFast(content: string): {
  stable: BlockSpan[];
  unstable: string;
} {
  const parts = content.split("\n\n");
  if (parts.length <= 1) return { stable: [], unstable: content };

  const stable: BlockSpan[] = [];
  let pos = 0;
  for (let i = 0; i < parts.length - 1; i++) {
    const block = parts[i]!;
    stable.push({ id: i, content: block });
    pos += block.length + 2; // account for the \n\n delimiter
  }

  return { stable, unstable: content.slice(pos) };
}

function partitionBlocks(content: string): {
  stable: BlockSpan[];
  unstable: string;
} {
  if (!content) return { stable: [], unstable: "" };

  // On narrow viewports (mobile / tablet), skip the unified AST parse
  // to stay within the 16 ms frame budget during 60 fps streaming.
  if (typeof window !== "undefined" && window.innerWidth < 768) {
    return partitionBlocksFast(content);
  }

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
