export type ArtifactType = "react" | "html" | "svg";

export type Segment =
  | { type: "text"; content: string }
  | {
      type: "artifact";
      artifactType: ArtifactType;
      title: string;
      content: string;
    };
