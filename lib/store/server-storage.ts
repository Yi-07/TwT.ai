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

/** Resolves when the latest queued setItem has completed. */
export function waitForPersistence(): Promise<void> {
  return latestSetItem ?? Promise.resolve();
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
      const parsed = JSON.parse(value) as { conversations?: unknown[]; activeId?: string | null };
      // Never persist empty state — guards against overwriting existing data
      // when getItem failed and the store rehydrated with the initial state.
      if (
        Array.isArray(parsed.conversations) &&
        parsed.conversations.length === 0 &&
        !parsed.activeId
      ) {
        return;
      }
      latestSetItem = fetch("/api/conversations", {
        method: "POST",
        headers,
        body: JSON.stringify({ key: name, value: parsed }),
      })
        .then(() => {})
        .catch(() => {});
      await latestSetItem;
    },
    async removeItem(name: string) {
      await fetch(`/api/conversations?key=${name}`, {
        method: "DELETE",
        headers,
      });
    },
  };
}
