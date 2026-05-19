"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { ArtifactType } from "@/types/artifact";

interface ArtifactSandboxProps {
  artifactType: ArtifactType;
  title: string;
  content: string;
}

function prepareReactCode(code: string): string {
  const trimmed = code.trim();

  // Extract the component name from the default export
  const nameMatch = /export\s+default\s+(?:function\s+)?(\w+)/.exec(trimmed);
  const componentName = nameMatch ? nameMatch[1] : "App";

  // Remove "export default " prefix; keep the function/class/identifier
  const clean = trimmed
    .replace(/^export\s+default\s+/, "")
    .replace(/^export\s+default\s+/, ""); // double-pass for any edge case

  return `${clean}
ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(${componentName})
);`;
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
<head><meta charset="utf-8"><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;overflow:hidden;}</style></head>
<body>${code}</body>
</html>`;

    case "react": {
      const prepared = prepareReactCode(code);
      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<script src="https://unpkg.com/react@18/umd/react.development.min.js" crossorigin="anonymous"><\/script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.min.js" crossorigin="anonymous"><\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js" crossorigin="anonymous"><\/script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; }
  #root { min-height: 100vh; }
  #err { display:none; padding:16px; color:#dc2626; background:#fef2f2; font-family:monospace; font-size:13px; white-space:pre-wrap; word-break:break-all; }
</style>
<script>
  window.onerror = function(msg, src, line, col, err) {
    var el = document.getElementById('err');
    if (el) { el.style.display='block'; el.textContent = 'Error: ' + msg + '\\\nn at line ' + line; }
  };
<\/script>
</head>
<body>
<div id="root"></div>
<pre id="err"></pre>
<script type="text/babel" data-presets="react">
${prepared}
<\/script>
<script>
  setTimeout(function() {
    var h = document.documentElement.scrollHeight;
    parent.postMessage({ type: 'resize', height: Math.max(h, 100) }, '*');
  }, 150);
<\/script>
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
