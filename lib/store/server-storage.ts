import type { StateStorage } from "zustand/middleware";

const secret =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_ACCESS_SECRET ?? ""
    : "";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${secret}`,
};

/** Tracks the most recent setItem call so callers can await persistence. */
let latestSetItem: Promise<void> | null = null;

// Serialise writes — older fetch responses cannot overwrite newer data.
let writeChain: Promise<void> = Promise.resolve();
// streaming, Zustand persist fires setItem on every token update (50+/s),
// which exhausts the connection pool → ECONNRESET.
// We allow one immediate write, then coalesce subsequent calls into a
// trailing timer at 1 Hz until the stream quiets down.
let lastWriteTime = 0;
let trailingTimer: ReturnType<typeof setTimeout> | null = null;
let trailingPromise: Promise<void> | null = null;
const THROTTLE_MS = 1000;
// Always holds the most recent parsed state so the trailing timer
// writes the latest value, not a stale closure snapshot.
let latestParsed: { conversations?: unknown[]; activeId?: string | null } | null = null;

/** Resolves when the latest queued setItem (immediate or trailing) has completed. */
export function waitForPersistence(): Promise<void> {
  return trailingPromise ?? latestSetItem ?? Promise.resolve();
}

export function createServerStorage(): StateStorage {
  // SSR guard — align with createIdbStorage() in storage.ts.
  // On the server there is no base URL for relative fetch(); hydration
  // happens on the client side after mount.
  if (typeof window === "undefined") {
    return {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    };
  }

  return {
    async getItem(name: string) {
      // Retry once on transient failures (e.g. Vercel cold start + Neon wake-up).
      // Without this, a single failed getItem causes Zustand to rehydrate as
      // empty, and the very next setItem overwrites existing DB data.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(`/api/conversations?key=${name}`, { headers });
          if (!res.ok) {
            if (attempt === 0) continue;
            return null;
          }
          const data = await res.json();
          if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
            return null;
          }
          return JSON.stringify(data);
        } catch {
          if (attempt === 0) continue;
          return null;
        }
      }
      return null;
    },
    async setItem(name: string, value: string) {
      const parsed: { conversations?: unknown[]; activeId?: string | null } =
        JSON.parse(value);
      latestParsed = parsed;
      // Never persist empty state — guards against overwriting existing data
      // when getItem failed and the store rehydrated with the initial state.
      if (
        Array.isArray(parsed.conversations) &&
        parsed.conversations.length === 0 &&
        !parsed.activeId
      ) {
        return;
      }

      const doWrite = async (v: NonNullable<typeof latestParsed>) => {
        if (!v) return;
        const p = fetch("/api/conversations", {
          method: "POST",
          headers,
          body: JSON.stringify({ key: name, value: v }),
        })
          .then(() => {})
          .catch(() => {});
        latestSetItem = p;
        await p;
      };

      const now = Date.now();
      if (now - lastWriteTime >= THROTTLE_MS) {
        lastWriteTime = now;
        if (latestParsed) {
          writeChain = writeChain.then(() => doWrite(latestParsed!));
          await writeChain;
        }
      } else {
        if (trailingTimer) clearTimeout(trailingTimer);
        trailingPromise = new Promise<void>((resolve) => {
          trailingTimer = setTimeout(async () => {
            lastWriteTime = Date.now();
            if (latestParsed) {
              writeChain = writeChain.then(() => doWrite(latestParsed!));
              await writeChain;
            }
            trailingTimer = null;
            trailingPromise = null;
            resolve();
          }, THROTTLE_MS);
        });
      }
    },
    async removeItem(name: string) {
      await fetch(`/api/conversations?key=${name}`, {
        method: "DELETE",
        headers,
      });
    },
  };
}
