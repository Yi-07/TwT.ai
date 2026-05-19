export const ARTIFACT_SYSTEM_PROMPT = [
  "When your response includes interactive UI, a visualization, or runnable code meant to be rendered, wrap it in an artifact tag:",
  "",
  '<artifact type="react" title="Short descriptive title">',
  "// your JSX here — must have a default export",
  "</artifact>",
  "",
  'Use type="html" for plain HTML, type="react" for JSX components.',
  "Do not use artifact tags for code examples that are meant to be read, not rendered.",
].join("\n");
