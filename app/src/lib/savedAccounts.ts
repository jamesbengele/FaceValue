"use client";
// Accounts used on this device, for one-tap switching. Kept in this browser's localStorage only:
// it is a convenience list (email, wallet, username), never sent anywhere, and it can be empty.
import { useCallback, useEffect, useState } from "react";

export type SavedAccount = { email: string; address: string; username?: string; lastUsed: number };
const KEY = "fv:accounts";
const EVENT = "fv:accounts-changed";

function read(): SavedAccount[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((a) => a && typeof a.email === "string" && typeof a.address === "string") : [];
  } catch { return []; }
}
function write(list: SavedAccount[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* private mode: just don't remember */ }
  window.dispatchEvent(new Event(EVENT));
}

export function useSavedAccounts() {
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  useEffect(() => {
    const sync = () => setAccounts(read().sort((a, b) => b.lastUsed - a.lastUsed));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync); // other tabs
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);

  const remember = useCallback((a: Omit<SavedAccount, "lastUsed">) => {
    const list = read();
    const i = list.findIndex((x) => x.address === a.address);
    const prev = i >= 0 ? list[i] : null;
    // Skip the write when nothing changed and it is already the most recent, so re-renders don't loop.
    const newest = list.reduce<SavedAccount | null>((m, x) => (!m || x.lastUsed > m.lastUsed ? x : m), null);
    if (prev && prev.email === a.email && (a.username ?? prev.username) === prev.username && newest?.address === a.address) return;
    const next = { ...prev, ...a, username: a.username ?? prev?.username, lastUsed: Date.now() };
    write(i >= 0 ? list.map((x, j) => (j === i ? next : x)) : [...list, next]);
  }, []);
  const forget = useCallback((address: string) => write(read().filter((x) => x.address !== address)), []);

  return { accounts, remember, forget };
}
