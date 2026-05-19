"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { ArtifactType } from "@/types/artifact";

interface ArtifactSandboxProps {
  artifactType: ArtifactType;
  title: string;
  content: string;
}

function prepareReactCode(code: string): string {
  let prepared = code;

  // Strip "export default" and capture the exported name
  const defaultExportRe = /export\s+default\s+(?:function\s+)?(\w+)\s*;?/g;
  const match = defaultExportRe.exec(prepared);
  const exportedName = match ? match[1] : null;

  // Remove "export default X;" or "export default function X() { ... }"
  prepared = prepared
    .replace(/export\s+default\s+/, "")
    .trim();

  // Auto-render: if there's a named export, render it; otherwise render the first component
  if (exportedName) {
    return `${prepared}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(${exportedName}));`;
  }

  // Fallback: try to find a component-like identifier
  return `${prepared}
(function() {
  var root = document.getElementById('root');
  if (typeof App !== 'undefined') {
    ReactDOM.createRoot(root).render(React.createElement(App));
  }
})();`;
}

const CDN_WHITELIST = [
  "https://unpkg.com/",
  "https://cdn.jsdelivr.net/",
  "https://cdnjs.cloudflare.com/",
];

function buildSrcdoc(type: ArtifactType, code: string): string {
  switch (type) {
    case "html":
      return code;

    case "svg":
      return `<!DOCTYPE html>
<html>
<head><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;}</style></head>
<body>${code}</body>
</html>`;

    case "react": {
      const prepared = prepareReactCode(code);
      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<script src="https://unpkg.com/react@18/umd/react.development.min.js" crossorigin="anonymous"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.min.js" crossorigin="anonymous"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js" crossorigin="anonymous"></script>
<style>
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
  #root { min-height: 100vh; }
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
${prepared}
</script>
</body>
</html>`;
    }

    default:
      return "";
  }
}

export function ArtifactSandbox({
  artifactType,
  title,
  content,
}: ArtifactSandboxProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(300);

  const srcdoc = buildSrcdoc(artifactType, content);

  const handleMessage = useCallback(
    (e: MessageEvent) => {
      if (!CDN_WHITELIST.some((origin) => e.origin.startsWith(origin.replace(/\/$/, "")))) {
        // Allow messages only from CDN origins (scripts) and same origin
        if (e.origin !== window.location.origin) return;
      }
      if (e.data?.type === "resize" && typeof e.data.height === "number") {
        setHeight(e.data.height);
      }
    },
    [],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts"
      srcDoc={srcdoc}
      title={title}
      className="w-full rounded-b-lg border border-zinc-200 dark:border-zinc-700"
      style={{ height, borderTop: "none" }}
    />
  );
}
