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
      const res = await fetch(`/api/conversations?key=${name}`, { headers });
      if (!res.ok) return null;
      const data = await res.json();
      return JSON.stringify(data);
    },
    async setItem(name: string, value: string) {
      latestSetItem = fetch("/api/conversations", {
        method: "POST",
        headers,
        body: JSON.stringify({ key: name, value: JSON.parse(value) }),
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
