import type { StateStorage } from "zustand/middleware";

const secret =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_ACCESS_SECRET ?? ""
    : "";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${secret}`,
};

export function createServerStorage(): StateStorage {
  return {
    async getItem(name: string) {
      const res = await fetch(`/api/conversations?key=${name}`, { headers });
      if (!res.ok) return null;
      const data = await res.json();
      return JSON.stringify(data);
    },
    async setItem(name: string, value: string) {
      await fetch("/api/conversations", {
        method: "POST",
        headers,
        body: JSON.stringify({ key: name, value: JSON.parse(value) }),
      });
    },
    async removeItem(name: string) {
      await fetch(`/api/conversations?key=${name}`, {
        method: "DELETE",
        headers,
      });
    },
  };
}
