export type ArtifactType = "react" | "html" | "svg";

export type Segment =
  | { type: "text"; id: string; content: string }
  | { type: "placeholder"; id: string; title: string; preview?: string }
  | {
      type: "artifact";
      id: string;
      artifactType: ArtifactType;
      title: string;
      content: string;
    };
