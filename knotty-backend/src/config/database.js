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

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

module.exports = prisma;
