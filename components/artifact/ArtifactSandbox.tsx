"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { ArtifactType } from "@/types/artifact";

interface ArtifactSandboxProps {
  artifactType: ArtifactType;
  title: string;
  content: string;
  expanded: boolean;
  onSendPrompt?: (text: string) => void;
}

const REACT_HOOKS_INJECTION =
  "const { useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext, useId } = React;";

function prepareReactCode(code: string): string {
  // Strip import and export statements — React/ReactDOM/hooks are global UMD,
  // and Babel Standalone runs in non-module mode where export is a syntax error.
  const noModule = code
    .split("\n")
    .filter((line) => !/^\s*import\s/.test(line))
    .join("\n")
    // Remove export { ... } re-exports entirely
    .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, "")
    // Strip "export default" / "export" keyword, keep the declaration
    .replace(/^\s*export\s+(default\s+)?/gm, "")
    .trim();

  // Extract the component name from the default export
  const nameMatch = /(?:function|class)\s+(\w+)/.exec(noModule);
  const componentName = nameMatch ? nameMatch[1] : "App";

  // Auto-inject hook destructuring so models can use bare hook calls
  return `${REACT_HOOKS_INJECTION}
${noModule}
ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(${componentName})
);`;
}

const SENDPROMPT_SCRIPT =
  "<script>window.sendPrompt=function(t){window.parent.postMessage({type:'sendPrompt',text:t},'*')}<\/script>";

const CDN_WHITELIST = [
  "https://unpkg.com/",
  "https://cdn.jsdelivr.net/",
  "https://cdnjs.cloudflare.com/",
];

function buildSrcdoc(type: ArtifactType, code: string): string {
  switch (type) {
    case "html":
      return code.replace(
        /<body[^>]*>/i,
        (match) => `${match}${SENDPROMPT_SCRIPT}`,
      );

    case "svg":
      return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;overflow:hidden;}</style></head>
<body>${SENDPROMPT_SCRIPT}${code}</body>
</html>`;

    case "react": {
      const prepared = prepareReactCode(code);
      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
${SENDPROMPT_SCRIPT}
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.development.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.development.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.28.4/babel.min.js"><\/script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; }
  #root { min-height: 100vh; }
  #err { display:none; padding:16px; color:#dc2626; background:#fef2f2; font-family:monospace; font-size:13px; white-space:pre-wrap; word-break:break-all; }
</style>
<script>
  window.onerror = function(msg, src, line, col, err) {
    var el = document.getElementById('err');
    if (el) { el.style.display='block'; el.textContent = 'Error: ' + msg + '\\n at line ' + line; }
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
  expanded,
  onSendPrompt,
}: ArtifactSandboxProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [contentHeight, setContentHeight] = useState(300);

  const height = expanded ? Math.max(contentHeight, 800) : contentHeight;

  const srcdoc = buildSrcdoc(artifactType, content);

  const handleMessage = useCallback(
    (e: MessageEvent) => {
      if (!CDN_WHITELIST.some((origin) => e.origin.startsWith(origin.replace(/\/$/, "")))) {
        if (e.origin !== window.location.origin) return;
      }
      if (e.data?.type === "resize" && typeof e.data.height === "number") {
        setContentHeight(e.data.height);
      }
      if (e.data?.type === "sendPrompt" && typeof e.data.text === "string") {
        onSendPrompt?.(e.data.text);
      }
    },
    [onSendPrompt],
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
