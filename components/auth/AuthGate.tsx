"use client";

import { useState, useEffect, useCallback } from "react";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState(false);

  const verify = useCallback(async () => {
    try {
      const res = await fetch("/api/auth");
      setAuthed(res.ok);
    } catch {
      setAuthed(false);
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    verify();
  }, [verify]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const password = new FormData(form).get("password") as string;
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setError(false);
        verify();
      } else {
        setError(true);
      }
    },
    [verify],
  );

  if (checking) return null;
  if (authed) return children;

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 dark:bg-surface-dark">
      <div className="w-full max-w-sm rounded-xl border border-hairline bg-canvas-soft p-8 shadow-sm dark:border-hairline dark:bg-surface-dark">
        <h1 className="mb-2 text-center text-xl font-semibold tracking-tight text-ink dark:text-on-dark">
          TwT.ai
        </h1>
        <p className="mb-6 text-center text-sm text-muted-soft dark:text-on-dark-soft">
          This deployment is private. Enter the access password.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            name="password"
            type="password"
            autoFocus
            placeholder="Password"
            className="w-full rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink outline-none transition-[border-color] duration-200 focus:border-primary dark:border-hairline dark:bg-surface-dark-elevated dark:text-on-dark"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            Unlock
          </button>
          {error && (
            <p className="text-center text-xs text-red-500">
              Wrong password — try again
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
