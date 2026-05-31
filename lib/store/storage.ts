import type { StateStorage } from "zustand/middleware";

function noopStorage(): StateStorage {
  return {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  };
}

function createIdbStorage(storeName: string): StateStorage {
  if (typeof window === "undefined") {
    return noopStorage();
  }

  let ready = false;
  let pending: Promise<void> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let idbMod: any = null;

  async function ensureDb() {
    if (ready) return;
    if (pending) {
      await pending;
      return;
    }
    pending = (async () => {
      idbMod = await import("idb-keyval");
      db = idbMod.createStore(`twt-${storeName}`, "keyval");
      ready = true;
      pending = null;
    })().catch((err) => {
      console.error("Failed to initialize IDB storage:", err);
      pending = null; // allow retry on next call
      throw err;
    });
    await pending;
  }

  return {
    async getItem(name: string) {
      try {
        await ensureDb();
        const value = await idbMod.get(name, db);
        return value ?? null;
      } catch {
        return null;
      }
    },
    async setItem(name: string, value: string) {
      try {
        await ensureDb();
        await idbMod.set(name, value, db);
      } catch {
        // silently ignore write errors
      }
    },
    async removeItem(name: string) {
      try {
        await ensureDb();
        await idbMod.del(name, db);
      } catch {
        // silently ignore
      }
    },
  };
}

export function createConversationStorage(): StateStorage {
  return createIdbStorage("conversations");
}
