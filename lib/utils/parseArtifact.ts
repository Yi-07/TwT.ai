import type { ArtifactType, Segment } from "@/types/artifact";

const ARTIFACT_RE =
  /<artifact\s+type="(react|html|svg)"\s+title="([^"]*)"\s*>([\s\S]*?)<\/artifact>/g;

export function parseArtifact(raw: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  const re = new RegExp(ARTIFACT_RE.source, "g");

  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    const before = raw.slice(lastIndex, match.index);
    if (before) {
      segments.push({ type: "text", content: before });
    }

    segments.push({
      type: "artifact",
      artifactType: match[1] as ArtifactType,
      title: match[2],
      content: match[3],
    });

    lastIndex = match.index + match[0].length;
  }

  const remainder = raw.slice(lastIndex);
  if (remainder) {
    segments.push({ type: "text", content: remainder });
  }

  return segments;
}
