// Server-only username store: address -> name, names unique.
// Redis over REST when configured (Upstash, or Vercel's Redis integration), which works on serverless hosts.
// Otherwise a JSON file: fine on one machine; on Vercel it lands in /tmp and can be forgotten between requests.
import * as fs from "fs";
import * as path from "path";

export interface UsernameStore {
  get(addresses: string[]): Promise<Record<string, string>>;
  /** Saves `name` for `address`; returns false if another address already has that name. */
  set(address: string, name: string): Promise<boolean>;
}

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const BY_ADDR = "fv:username:by-address";
const BY_NAME = "fv:username:by-name";

function redisStore(url: string, token: string): UsernameStore {
  const cmd = async (...args: string[]): Promise<any> => {
    const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(args), cache: "no-store" });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error("Username store: " + (j.error ?? r.status));
    return j.result;
  };
  return {
    async get(addresses) {
      if (!addresses.length) return {};
      const names: (string | null)[] = await cmd("HMGET", BY_ADDR, ...addresses);
      return Object.fromEntries(addresses.flatMap((a, i) => (names[i] ? [[a, names[i]!]] : [])));
    },
    async set(address, name) {
      // Claim the name first (atomic), so two wallets can't take it at once.
      if (!(await cmd("HSETNX", BY_NAME, name, address)) && (await cmd("HGET", BY_NAME, name)) !== address) return false;
      const old: string | null = await cmd("HGET", BY_ADDR, address);
      await cmd("HSET", BY_ADDR, address, name);
      if (old && old !== name) await cmd("HDEL", BY_NAME, old);
      return true;
    },
  };
}

function fileStore(file: string): UsernameStore {
  const read = (): Record<string, string> => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return {}; } };
  return {
    async get(addresses) {
      const all = read();
      return Object.fromEntries(addresses.filter((a) => all[a]).map((a) => [a, all[a]]));
    },
    async set(address, name) {
      const all = read();
      if (Object.entries(all).some(([a, n]) => n === name && a !== address)) return false;
      all[address] = name;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(all, null, 2));
      return true;
    },
  };
}

const defaultFile = process.env.VERCEL ? "/tmp/usernames.json" : path.resolve(process.cwd(), ".data/usernames.json");
export const usernameStore: UsernameStore =
  REDIS_URL && REDIS_TOKEN ? redisStore(REDIS_URL, REDIS_TOKEN) : fileStore(process.env.USERNAMES_FILE || defaultFile);
