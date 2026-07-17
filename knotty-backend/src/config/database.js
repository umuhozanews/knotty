require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;
const isSupabase = connectionString && connectionString.includes('supabase.co');

// Serverless functions each create their own pool — keep it tiny to avoid
// exhausting DB connections when many instances run concurrently.
// On a dedicated server a larger pool is fine.
const isServerless = !!process.env.VERCEL;

const pool = new Pool({
  connectionString,
  max: isServerless ? 2 : 20,
  idleTimeoutMillis: isServerless ? 10000 : 30000,
  connectionTimeoutMillis: 5000,
  ...(isSupabase ? { ssl: { rejectUnauthorized: false } } : {}),
});
const adapter = new PrismaPg(pool);

const AUDIT_READ_OPS = new Set(['findUnique', 'findFirst', 'findMany', 'findUniqueOrThrow', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy', 'create', 'createMany']);

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
}).$extends({
  query: {
    auditLog: {
      $allOperations({ operation, args, query }) {
        if (!AUDIT_READ_OPS.has(operation)) {
          throw new Error(`AuditLog is immutable — ${operation} is not permitted`);
        }
        return query(args);
      },
    },
  },
});

module.exports = prisma;
