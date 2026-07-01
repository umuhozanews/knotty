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
  on: () => {},
};

if (process.env.NO_REDIS === 'true') {
  console.log('Redis: Using in-memory fallback (NO_REDIS=true)');
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
