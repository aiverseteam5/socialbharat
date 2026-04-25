/**
 * Shared ioredis connection for BullMQ queues and workers.
 *
 * Uses self-hosted Redis on the VPS (REDIS_URL=redis://localhost:6379).
 * BullMQ requires `maxRetriesPerRequest: null` and `enableReadyCheck: false`
 * to avoid dropping blocking commands (BRPOP/XREAD) mid-flight.
 *
 * Rate-limiting (src/lib/ratelimit.ts) continues to use Upstash REST — we keep
 * those two Redis paths separate by design.
 */
import IORedis, { type RedisOptions } from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const baseOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
};

let sharedConnection: IORedis | null = null;

/**
 * Returns a lazily-initialized shared connection for queues/workers.
 * Tests substitute via `setRedisConnection(new IORedisMock())`.
 */
export function getRedisConnection(): IORedis {
  if (!sharedConnection) {
    sharedConnection = new IORedis(redisUrl, baseOptions);
  }
  return sharedConnection;
}

/**
 * Test hook — allows substitution with ioredis-mock.
 * Do not call this from production code.
 */
export function setRedisConnection(conn: IORedis): void {
  sharedConnection = conn;
}
