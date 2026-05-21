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

  async function ensureDb() {
    if (ready) return;
    if (pending) {
      await pending;
      return;
    }
    pending = (async () => {
      const mod = await import("idb-keyval");
      db = mod.createStore(`twt-${storeName}`, "keyval");
      ready = true;
      pending = null;
    })();
    await pending;
  }

  return {
    async getItem(name: string) {
      try {
        await ensureDb();
        const { get } = await import("idb-keyval");
        const value = await get(name, db);
        return value ?? null;
      } catch {
        return null;
      }
    },
    async setItem(name: string, value: string) {
      try {
        await ensureDb();
        const { set } = await import("idb-keyval");
        await set(name, value, db);
      } catch {
        // silently ignore write errors
      }
    },
    async removeItem(name: string) {
      try {
        await ensureDb();
        const { del } = await import("idb-keyval");
        await del(name, db);
      } catch {
        // silently ignore
      }
    },
  };
}

export function createConversationStorage(): StateStorage {
  return createIdbStorage("conversations");
}

export const modelStorage: StateStorage =
  typeof window === "undefined"
    ? noopStorage()
    : {
        getItem(name: string) {
          return localStorage.getItem(name);
        },
        setItem(name: string, value: string) {
          localStorage.setItem(name, value);
        },
        removeItem(name: string) {
          localStorage.removeItem(name);
        },
      };
