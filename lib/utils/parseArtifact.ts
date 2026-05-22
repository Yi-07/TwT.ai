import type { ArtifactType, Segment } from "@/types/artifact";

type State = "text" | "tag_open" | "body";

export class ArtifactParser {
  private state: State = "text";
  private segments: Segment[] = [];
  private textIdx = 0;
  private artIdx = 0;

  // Buffers for partial content not yet emitted
  private textBuf = "";
  private tagBuf = "";
  private bodyBuf = "";
  private tagType = "";
  private tagTitle = "";

  // Track placeholder so it can be replaced when </artifact> arrives
  private placeholderIndex = -1;

  // Monotonic position tracking
  private processed = 0;

  parse(raw: string): Segment[] {
    if (raw.length < this.processed) {
      this.reset();
    }

    const delta = raw.slice(this.processed);
    this.processed = raw.length;

    let i = 0;
    while (i < delta.length) {
      if (this.state === "text") {
        const tagStart = delta.indexOf("<artifact", i);
        if (tagStart === -1) {
          this.textBuf += delta.slice(i);
          break;
        }
        if (tagStart > i) {
          this.textBuf += delta.slice(i, tagStart);
        }
        this.flushTextBuf();
        this.state = "tag_open";
        this.tagBuf = "<artifact";
        i = tagStart + "<artifact".length;
      } else if (this.state === "tag_open") {
        const tagEnd = delta.indexOf(">", i);
        if (tagEnd === -1) {
          this.tagBuf += delta.slice(i);
          break;
        }
        this.tagBuf += delta.slice(i, tagEnd + 1);
        i = tagEnd + 1;

        const typeMatch = /type="(react|html|svg)"/.exec(this.tagBuf);
        const titleMatch = /title="([^"]*)"/.exec(this.tagBuf);

        if (typeMatch && titleMatch) {
          this.tagType = typeMatch[1];
          this.tagTitle = titleMatch[1];
          this.state = "body";
          this.bodyBuf = "";
          // Emit placeholder on first body content so the user sees
          // a loading indicator instead of a blank page.
          this.placeholderIndex = this.segments.length;
          this.segments.push({
            type: "placeholder",
            id: `placeholder-${this.artIdx}`,
            title: this.tagTitle,
          });
        } else {
          this.textBuf += this.tagBuf;
          this.state = "text";
        }
      } else {
        // body
        const closeTag = delta.indexOf("</artifact>", i);
        if (closeTag === -1) {
          this.bodyBuf += delta.slice(i);
          break;
        }
        this.bodyBuf += delta.slice(i, closeTag);

        // Replace placeholder with the completed artifact
        const artifactSeg: Segment = {
          type: "artifact",
          id: `artifact-${this.tagType}-${this.artIdx++}`,
          artifactType: this.tagType as ArtifactType,
          title: this.tagTitle,
          content: this.bodyBuf,
        };

        if (this.placeholderIndex >= 0) {
          // Create a new array so React detects the structural change
          this.segments = [
            ...this.segments.slice(0, this.placeholderIndex),
            artifactSeg,
            ...this.segments.slice(this.placeholderIndex + 1),
          ];
          this.placeholderIndex = -1;
        } else {
          this.segments.push(artifactSeg);
        }

        i = closeTag + "</artifact>".length;
        this.state = "text";
      }
    }

    return this.segments;
  }

  /** Call when the stream ends — flush any buffered content as text. */
  flush(): Segment[] {
    if (this.state === "tag_open") {
      this.textBuf += this.tagBuf;
      this.state = "text";
    }
    if (this.state === "body") {
      // Replace placeholder with the body content as a code block
      if (this.placeholderIndex >= 0) {
        const bodyText = this.bodyBuf || "(empty artifact)";
        const textSeg: Segment = {
          type: "text",
          id: `text-${this.textIdx++}`,
          content: "```\n" + bodyText + "\n```",
        };
        this.segments = [
          ...this.segments.slice(0, this.placeholderIndex),
          textSeg,
          ...this.segments.slice(this.placeholderIndex + 1),
        ];
        this.placeholderIndex = -1;
      }
      this.state = "text";
    }
    this.flushTextBuf();
    return this.segments;
  }

  private flushTextBuf() {
    if (this.textBuf) {
      this.segments.push({
        type: "text",
        id: `text-${this.textIdx++}`,
        content: this.textBuf,
      });
      this.textBuf = "";
    }
  }

  private reset() {
    this.state = "text";
    this.segments = [];
    this.textIdx = 0;
    this.artIdx = 0;
    this.textBuf = "";
    this.tagBuf = "";
    this.bodyBuf = "";
    this.placeholderIndex = -1;
    this.processed = 0;
  }
}

// --- Module-level parser management ---

let currentParser: ArtifactParser | null = null;
let lastRaw = "";

/**
 * Parse a (possibly partial) raw string into an ordered array of segments.
 * Maintains a single parser instance keyed by monotonic prefix growth:
 * if raw does NOT start with the previous raw, a new parser is created
 * (handles switching between different messages during rendering).
 */
export function parseArtifact(raw: string): Segment[] {
  if (!currentParser || !raw.startsWith(lastRaw)) {
    currentParser = new ArtifactParser();
  }
  lastRaw = raw;
  return currentParser.parse(raw);
}

/** Flush the current parser — call when streaming ends. */
export function flushArtifact(): Segment[] {
  if (!currentParser) return [];
  return currentParser.flush();
}
