const DEBUG = process.env.NEXT_PUBLIC_DEBUG === "true";

export const logger = {
  error: (...args: unknown[]) => console.error(...args),
  warn: (...args: unknown[]) => DEBUG && console.warn(...args),
  info: (...args: unknown[]) => DEBUG && console.info(...args),
  debug: (...args: unknown[]) => DEBUG && console.log(...args),
};
