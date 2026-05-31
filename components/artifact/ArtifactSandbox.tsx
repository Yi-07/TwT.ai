"use client";

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import type { ArtifactType } from "@/types/artifact";
import { logger } from "@/lib/utils/logger";

interface ArtifactSandboxProps {
  artifactType: ArtifactType;
  title: string;
  content: string;
  onSendPrompt?: (text: string) => void;
}

const REACT_HOOKS_INJECTION =
  "const { useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext, useId } = React;";

function prepareReactCode(code: string): string {
  const noModule = code
    .split("\n")
    .filter((line) => !/^\s*import\s/.test(line))
    .filter((line) => !/^\s*const\s*\{[^}]*\}\s*=\s*React\s*;?\s*$/.test(line.trim()))
    .join("\n")
    .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, "")
    .replace(/^\s*export\s+(default\s+)?/gm, "")
    .trim();

  const nameMatch = /(?:function|class)\s+(\w+)/.exec(noModule);
  const componentName = nameMatch ? nameMatch[1] : "App";

  return `const { LineChart, BarChart, PieChart, Line, Bar, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ScatterChart, Scatter, ComposedChart } = Recharts;
${REACT_HOOKS_INJECTION}
${noModule}
ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(${componentName})
);`;
}

const SENDPROMPT_SCRIPT =
  "<script>window.sendPrompt=function(t){window.parent.postMessage({type:'sendPrompt',text:t},'*')}<\/script>";

const RESIZE_SCRIPT =
  "<script>var _lh=0;function _rh(){var h=document.documentElement.scrollHeight;if(h!==_lh){_lh=h;parent.postMessage({type:'resize',height:Math.max(h,100)},'*');}}if(window.ResizeObserver){new ResizeObserver(function(){_rh();}).observe(document.documentElement);}_rh();<\/script>";

const CDN_WHITELIST = [
  "https://unpkg.com/",
  "https://cdn.jsdelivr.net/",
  "https://cdnjs.cloudflare.com/",
];

function buildSrcdoc(type: ArtifactType, code: string): string {
  switch (type) {
    case "html":
      if (!/<body/i.test(code)) {
        code = `<body style="overflow:hidden;margin:0">${code}</body>`;
      }
      if (/<body[^>]*style=/.test(code)) {
        code = code.replace(
          /(<body[^>]*style=")([^"]*)(")/i,
          "$1overflow:hidden;$2$3",
        );
      } else {
        code = code.replace(
          /<body([^>]*)>/i,
          (_, attrs) => `<body${attrs} style="overflow:hidden">`,
        );
      }
      return code.replace(
        /<\/body>/i,
        `<style>body{height:auto!important}</style>${SENDPROMPT_SCRIPT}${RESIZE_SCRIPT}</body>`,
      );

    case "svg":
      return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;overflow:hidden;}</style></head>
<body>${SENDPROMPT_SCRIPT}${code}${RESIZE_SCRIPT}</body>
</html>`;

    case "react": {
      const prepared = prepareReactCode(code);
      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
${SENDPROMPT_SCRIPT}
<script src="/vendor/react.umd.js"><\/script>
<script src="/vendor/react-dom.umd.js"><\/script>
<script src="/vendor/babel.min.js"><\/script>
<script src="/vendor/prop-types.umd.js"><\/script>
<script src="/vendor/recharts.umd.js"><\/script>
<script src="/vendor/lodash.umd.js"><\/script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; overflow: hidden; }
  #root { min-height: 100vh; }
  #err { display:none; padding:16px; color:#dc2626; background:#fef2f2; font-family:monospace; font-size:13px; white-space:pre-wrap; word-break:break-all; }
</style>
<script>
  window.addEventListener('error', function(e) {
    var d = {
      message: e.message || 'unknown',
      filename: e.filename || '',
      lineno: e.lineno,
      colno: e.colno
    };
    try { d.stack = (e.error && e.error.stack) ? e.error.stack : ''; } catch(_) {}
    parent.postMessage({ type: 'sandbox-error', error: d }, '*');
    var el = document.getElementById('err');
    if (el) {
      el.style.display = 'block';
      el.textContent = 'Error: ' + d.message +
        (d.stack ? '\\n\\n' + d.stack : '') +
        (d.lineno ? '\\n(at line ' + d.lineno + ')' : '');
    }
  });
  var _ce = console.error;
  console.error = function() {
    _ce.apply(console, arguments);
    try {
      parent.postMessage({ type: 'sandbox-error', error: {
        message: Array.from(arguments).map(function(a) {
          return typeof a === 'object' ? JSON.stringify(a) : String(a);
        }).join(' ')
      }}, '*');
    } catch(e2) {}
  };
<\/script>
</head>
<body>
<div id="root"></div>
<pre id="err"></pre>
<script id="user-code" type="text/plain">
${prepared}
<\/script>
<script>
(function() {
  var codeEl = document.getElementById('user-code');
  if (!codeEl) return;
  var code = codeEl.textContent;
  var compiled;
  try {
    compiled = Babel.transform(code, { presets: ['react'] }).code;
  } catch(e) {
    parent.postMessage({ type: 'sandbox-error', error: {
      message: 'Babel compile: ' + (e.message || String(e)),
      stack: e.stack || ''
    }}, '*');
    var el2 = document.getElementById('err');
    if (el2) {
      el2.style.display = 'block';
      el2.textContent = 'Compile Error: ' + (e.message || String(e)) +
        (e.stack ? '\\n\\n' + e.stack : '');
    }
    return;
  }
  try {
    eval(compiled);
  } catch(e) {
    parent.postMessage({ type: 'sandbox-error', error: {
      message: e.message || String(e),
      stack: e.stack || '',
      lineno: e.lineNumber,
      colno: e.columnNumber
    }}, '*');
    var el3 = document.getElementById('err');
    if (el3) {
      el3.style.display = 'block';
      el3.textContent = 'Runtime Error: ' + (e.message || String(e)) +
        (e.stack ? '\\n\\n' + e.stack : '');
    }
  }
})();
<\/script>
${RESIZE_SCRIPT}
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
  onSendPrompt,
}: ArtifactSandboxProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [contentHeight, setContentHeight] = useState(300);
  const resizeRafRef = useRef(0);

  const height = contentHeight;

  const srcdoc = useMemo(
    () => buildSrcdoc(artifactType, content),
    [artifactType, content],
  );

  const handleMessage = useCallback(
    (e: MessageEvent) => {
      const isSrcdoc = e.origin === "null";
      const isSameOrigin = e.origin === window.location.origin;
      const isCDN = CDN_WHITELIST.some((origin) =>
        e.origin.startsWith(origin.replace(/\/$/, "")),
      );
      if (!isSrcdoc && !isSameOrigin && !isCDN) return;

      if (e.data?.type === "resize" && typeof e.data.height === "number") {
        cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = requestAnimationFrame(() =>
          setContentHeight(e.data.height),
        );
      }
      if (e.data?.type === "sendPrompt" && typeof e.data.text === "string") {
        onSendPrompt?.(e.data.text);
      }
      if (e.data?.type === "sandbox-error" && e.data.error) {
        logger.error(
          "[Sandbox Error]",
          e.data.error.message,
          e.data.error.stack || "",
          e.data.error.lineno ? `(line ${e.data.error.lineno})` : "",
        );
      }
      if (
        e.data?.type === "sandbox-error" ||
        e.data?.type === "sendPrompt" ||
        e.data?.type === "resize"
      ) {
        logger.debug("sandbox event", {
          type: e.data.type,
          height: e.data.height,
          text: typeof e.data.text === "string" ? e.data.text.slice(0, 80) : undefined,
        });
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
      className="w-full overflow-hidden border-t border-hairline dark:border-hairline"
      style={{ height }}
    />
  );
}
