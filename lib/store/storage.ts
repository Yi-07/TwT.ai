import type { StateStorage } from "zustand/middleware";

function noopStorage(): StateStorage {
  return {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  };
}

// Throttle: streaming updates fire ~60 writes/s into IndexedDB.
// Coalesce into ≤1 write/s — same pattern as server-storage.ts.
let lastWriteTime = 0;
let trailingTimer: ReturnType<typeof setTimeout> | null = null;
let latestValue: string | null = null;
const THROTTLE_MS = 1000;
// Serialise writes for browsers without navigator.locks
let writeChain: Promise<void> = Promise.resolve();

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
      latestValue = value;

      const doWrite = async () => {
        const v = latestValue;
        if (!v) return;
        try {
          await ensureDb();
          if (typeof navigator !== "undefined" && navigator.locks) {
            await navigator.locks.request("twt-conversations", async () => {
              await idbMod.set(name, v, db);
            });
          } else {
            writeChain = writeChain.then(() => idbMod.set(name, v, db));
            await writeChain;
          }
          lastWriteTime = Date.now();
        } catch {
          // silently ignore write errors
        }
      };

      const now = Date.now();
      if (now - lastWriteTime >= THROTTLE_MS) {
        // Enough time since last write — persist immediately
        lastWriteTime = now;
        if (latestValue) await doWrite();
      } else {
        // Streaming — coalesce into trailing timer.
        // Use module-level latestValue so the deferred write always
        // sees the most recent state, not a stale closure snapshot.
        if (trailingTimer) clearTimeout(trailingTimer);
        trailingTimer = setTimeout(async () => {
          trailingTimer = null;
          await doWrite();
        }, THROTTLE_MS);
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
