const Redis = require('ioredis');

let redis;
let isFallback = false;

const store = new Map();
const mockRedis = {
  get: async (key) => store.get(key) || null,
  set: async (key, val, mode, ttl) => {
    store.set(key, val);
    if (mode === 'EX' && typeof ttl === 'number') {
      setTimeout(() => store.delete(key), ttl * 1000);
    }
    return 'OK';
  },
  del: async (key) => {
    store.delete(key);
    return 1;
  },
  on: () => {}
};

if (process.env.NO_REDIS === 'true') {
  console.log('Redis: Using in-memory mock (NO_REDIS=true)');
  redis = mockRedis;
} else {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    retryStrategy: (times) => {
      if (times > 3) {
        if (!isFallback) {
          isFallback = true;
          console.log('Redis: connection failed. Falling back to in-memory mock.');
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

  redis.on('connect', () => console.log('Redis: connected'));
  redis.on('error', (err) => {
    if (!isFallback) {
      console.log('Redis error:', err.message);
    }
  });
}

module.exports = redis;
