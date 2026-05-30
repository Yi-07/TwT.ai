import type { ArtifactType, Segment } from "@/types/artifact";
import { logger } from "@/lib/utils/logger";

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
        logger.debug("parser → tag_open");
      } else if (this.state === "tag_open") {
        const tagEnd = delta.indexOf(">", i);
        if (tagEnd === -1) {
          // Model sometimes omits ">" — e.g. <artifact type="react" title="X"export...
          // Detect when the tag is complete but ">" is missing.
          const implicitEnd = /\s*(?=export\b|function\b|const\b|import\b|let\b|var\b|class\b|return\b|if\b|for\b)/.exec(
            delta.slice(i),
          );
          if (this.tagBuf.startsWith("<artifact") && implicitEnd) {
            // Tag end inferred — close the tag and enter body
            this.tagBuf += delta.slice(i, i + implicitEnd.index);
            i += implicitEnd.index;
          } else {
            this.tagBuf += delta.slice(i);
            break;
          }
        } else {
          this.tagBuf += delta.slice(i, tagEnd + 1);
          i = tagEnd + 1;
        }

        // Lenient matching — handles single/double/no quotes, any attribute order
        const typeMatch =
          /type\s*=\s*(?:"(react|html|svg)"|'(react|html|svg)'|(react|html|svg))/.exec(
            this.tagBuf,
          );
        const titleMatch =
          /title\s*=?\s*(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(this.tagBuf);

        if (typeMatch && titleMatch) {
          this.tagType = (typeMatch[1] || typeMatch[2] || typeMatch[3]) as string;
          this.tagTitle = titleMatch[1] || titleMatch[2] || titleMatch[3] || "";
          this.state = "body";
          this.bodyBuf = "";
          this.placeholderIndex = this.segments.length;
          logger.debug("parser → body", { type: this.tagType, title: this.tagTitle });
        } else if (this.tagBuf.startsWith("<artifact")) {
          // Malformed artifact tag — DeepSeek often writes type="中文"
          // instead of type="react". Fallback: sniff from body content.
          const rawType = (typeMatch?.[1] || typeMatch?.[2] || typeMatch?.[3] || "").trim();
          const rawTitle = (titleMatch?.[1] || titleMatch?.[2] || titleMatch?.[3] || "").trim();
          this.tagTitle = rawTitle || rawType || "Untitled";
          this.tagType = "";
          this.state = "body";
          this.bodyBuf = "";
          logger.debug("parser → body (fallback)", { type: this.tagType || "(sniff)", title: this.tagTitle });
        } else {
          this.textBuf += this.tagBuf;
          this.state = "text";
        }
      } else {
        // body
        const closeTag = delta.indexOf("</artifact>", i);
        if (closeTag === -1) {
          this.bodyBuf += delta.slice(i);

          // Sniff type for placeholder display (same logic as </artifact> handler)
          let artType = this.tagType as ArtifactType | undefined;
          if (!artType) {
            const t = this.bodyBuf.trimStart();
            if (/^<svg\b/i.test(t)) artType = "svg";
            else if (/^<!DOCTYPE|^<html\b|^<head\b|^<body\b/i.test(t)) artType = "html";
            else artType = "react";
          }

          // Emit or update placeholder with current preview
          const placeholder: Segment = {
            type: "placeholder",
            id: `placeholder-${this.artIdx}`,
            title: this.tagTitle,
            preview: this.bodyBuf,
            artifactType: artType,
          };
          if (this.placeholderIndex >= 0 && this.placeholderIndex < this.segments.length) {
            this.segments[this.placeholderIndex] = placeholder;
          } else {
            this.placeholderIndex = this.segments.length;
            this.segments.push(placeholder);
          }

          break;
        }
        this.bodyBuf += delta.slice(i, closeTag);

        // Sniff type from body content if tag had malformed attributes
        if (!this.tagType) {
          const trimmed = this.bodyBuf.trimStart();
          if (/^<svg\b/i.test(trimmed)) {
            this.tagType = "svg";
          } else if (/^<!DOCTYPE|^<html\b|^<head\b|^<body\b/i.test(trimmed)) {
            this.tagType = "html";
          } else {
            this.tagType = "react";
          }
        }

        // Artifact complete — replace placeholder with artifact
        const artifactSeg: Segment = {
          type: "artifact",
          id: `artifact-${this.tagType}-${this.artIdx++}`,
          artifactType: this.tagType as ArtifactType,
          title: this.tagTitle,
          content: this.bodyBuf,
        };

        if (this.placeholderIndex >= 0) {
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
        logger.debug("parser → text", { artifactType: this.tagType, contentLen: artifactSeg.content.length });
      }
    }

    return this.segments;
  }

  /** Call when the stream ends — flush any buffered content as text. */
  flush(hard = true): Segment[] {
    if (hard) {
      logger.info("parser flush(hard=true)", { state: this.state, bodyLen: this.bodyBuf.length });
      if (this.state === "tag_open") {
        this.textBuf += this.tagBuf;
        this.state = "text";
      }
      if (this.state === "body") {
        // Replace placeholder with the body content as a code block
        if (this.placeholderIndex >= 0) {
          const bodyText = this.bodyBuf || "(empty)";
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
