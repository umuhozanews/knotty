const Redis = require('ioredis');

let redis;
let isFallback = false;

// Pure in-memory fallback — no disk I/O, never blocks the event loop
const store = new Map();
const expiryMap = new Map();

const mockRedis = {
  get: async (key) => {
    const exp = expiryMap.get(key);
    if (exp && Date.now() > exp) { store.delete(key); expiryMap.delete(key); return null; }
    return store.get(key) ?? null;
  },
  set: async (key, val, mode, ttl) => {
    store.set(key, val);
    if (mode === 'EX' && typeof ttl === 'number') {
      expiryMap.set(key, Date.now() + ttl * 1000);
    }
    return 'OK';
  },
  del: async (key) => {
    store.delete(key);
    expiryMap.delete(key);
    return 1;
  },
  incr: async (key) => {
    const exp = expiryMap.get(key);
    if (exp && Date.now() > exp) { store.delete(key); expiryMap.delete(key); }
    const current = parseInt(store.get(key) || '0', 10);
    const next = isNaN(current) ? 1 : current + 1;
    store.set(key, String(next));
    return next;
  },
  expire: async (key, seconds) => {
    if (!store.has(key)) return 0;
    expiryMap.set(key, Date.now() + Number(seconds) * 1000);
    return 1;
  },
  ttl: async (key) => {
    const exp = expiryMap.get(key);
    if (!exp) return -1;
    const remaining = Math.ceil((exp - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  },
  on: () => {},
};

if (process.env.NO_REDIS === 'true' || process.env.NODE_ENV === 'production' || typeof globalThis.navigator !== 'undefined') {
  console.log('Redis: Using in-memory fallback');
  redis = mockRedis;
} else {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    retryStrategy: (times) => {
      if (times > 3) {
        if (!isFallback) {
          isFallback = true;
          console.log('Redis: connection failed — using in-memory fallback (no persistence)');
          Object.assign(redis, mockRedis);
        }
        return null;
      }
      return Math.min(times * 100, 1000);
    },
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2000,
  });

  redis.on('connect', () => { isFallback = false; console.log('Redis: connected'); });
  redis.on('error', (err) => {
    if (!isFallback) console.log('Redis error:', err.message);
  });
}

module.exports = redis;
