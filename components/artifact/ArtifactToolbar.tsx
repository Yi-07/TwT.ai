"use client";

interface ArtifactToolbarProps {
  title: string;
  expanded: boolean;
  onRefresh: () => void;
  onToggleExpand: () => void;
}

export function ArtifactToolbar({
  title,
  expanded,
  onRefresh,
  onToggleExpand,
}: ArtifactToolbarProps) {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      <span className="min-w-0 flex-1 truncate text-xs text-muted dark:text-on-dark-soft">
        {title}
      </span>

      <button
        onClick={onRefresh}
        className="flex h-6 w-6 items-center justify-center rounded text-muted-soft opacity-40 transition-opacity hover:opacity-100 hover:text-muted dark:hover:text-on-dark-soft"
        aria-label="Refresh artifact"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
      </button>

      <button
        onClick={onToggleExpand}
        className="flex h-6 w-6 items-center justify-center rounded text-muted-soft opacity-40 transition-opacity hover:opacity-100 hover:text-muted dark:hover:text-on-dark-soft"
        aria-label={expanded ? "Collapse artifact" : "Expand artifact"}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={expanded ? "rotate-180" : ""}
        >
          <path d="M18 15l-6-6-6 6" />
        </svg>
      </button>
    </div>
  );
}
