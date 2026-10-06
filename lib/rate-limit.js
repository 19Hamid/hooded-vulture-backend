import { createHash } from "node:crypto";

const RATE_SCRIPT = `
for i = 1, #KEYS do
  local count = tonumber(redis.call('GET', KEYS[i]) or '0')
  if count >= tonumber(ARGV[(i - 1) * 2 + 1]) then
    return {0, math.max(1, redis.call('TTL', KEYS[i]))}
  end
end
for i = 1, #KEYS do
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then redis.call('EXPIRE', KEYS[i], tonumber(ARGV[(i - 1) * 2 + 2])) end
end
return {1, 0}`;

export function createRateLimiter({ env = process.env, now = Date.now, fetchImpl = fetch } = {}) {
  const buckets = new Map();
  const limits = [10, 120, 1000];
  const windows = [60, 60, 86400];
  return {
    async check(req) {
      // Vercel overwrites x-forwarded-for with the public client IP. Local servers use the socket.
      const ip = env.VERCEL ? req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() : req.socket?.remoteAddress;
      const hash = createHash("sha256").update(ip || "unknown").digest("hex");
      const keys = [`beakspeak:ip:${hash}`, "beakspeak:global:minute", "beakspeak:global:day"];
      const url = env.UPSTASH_REDIS_REST_URL;
      const token = env.UPSTASH_REDIS_REST_TOKEN;
      if (url || token) {
        try {
          if (!url || !token || new URL(url).protocol !== "https:") throw new Error("Invalid rate-limit configuration");
          const response = await fetchImpl(url.replace(/\/$/, ""), {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(["EVAL", RATE_SCRIPT, keys.length, ...keys, ...limits.flatMap((limit, index) => [limit, windows[index]])]),
            signal: AbortSignal.timeout(2000),
          });
          const result = await response.json();
          if (!response.ok || result.error || !Array.isArray(result.result) || result.result.length !== 2 || ![0, 1].includes(result.result[0]) || !Number.isFinite(result.result[1])) throw new Error("Invalid rate-limit response");
          return { allowed: result.result[0] === 1, retryAfter: Math.max(1, result.result[1]) };
        } catch {
          const error = new Error("Rate limiter unavailable");
          error.code = "RATE_LIMIT_UNAVAILABLE";
          throw error;
        }
      }
      // Bounded warm-instance fallback; configure Redis for production-wide budgets.
      const timestamp = now();
      for (const [key, bucket] of buckets) if (bucket.expires <= timestamp) buckets.delete(key);
      if (!buckets.has(keys[0]) && buckets.size >= 4096) return { allowed: false, retryAfter: 60 };
      const current = keys.map((key, index) => buckets.get(key) || { count: 0, expires: timestamp + windows[index] * 1000 });
      const blockedIndex = current.findIndex((bucket, index) => bucket.count >= limits[index]);
      if (blockedIndex !== -1) return { allowed: false, retryAfter: Math.max(1, Math.ceil((current[blockedIndex].expires - timestamp) / 1000)) };
      current.forEach((bucket, index) => buckets.set(keys[index], { ...bucket, count: bucket.count + 1 }));
      return { allowed: true, retryAfter: 0 };
    },
  };
}
