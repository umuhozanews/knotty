const test = require('node:test');
const assert = require('node:assert/strict');
const { secureSupabaseConnectionString } = require('./secureConnectionString');

test('forces verified TLS for Supabase direct and pooler connection URLs', () => {
  for (const host of ['db.project.supabase.co', 'aws-0-eu-central-1.pooler.supabase.com']) {
    const result = new URL(secureSupabaseConnectionString(`postgresql://user:pass@${host}:5432/postgres?sslmode=require`));
    assert.equal(result.searchParams.get('sslmode'), 'verify-full');
  }
});

test('overrides an explicit no-verify Supabase URL mode', () => {
  const result = new URL(secureSupabaseConnectionString('postgresql://user:pass@db.project.supabase.co/postgres?sslmode=no-verify'));
  assert.equal(result.searchParams.get('sslmode'), 'verify-full');
});

test('leaves non-Supabase database URLs unchanged', () => {
  const connectionString = 'postgresql://user:pass@db.example.com/postgres?sslmode=no-verify';
  assert.equal(secureSupabaseConnectionString(connectionString), connectionString);
});

test('leaves local or missing database URLs unchanged', () => {
  assert.equal(secureSupabaseConnectionString('postgresql://postgres:postgres@127.0.0.1:5432/postgres'), 'postgresql://postgres:postgres@127.0.0.1:5432/postgres');
  assert.equal(secureSupabaseConnectionString(undefined), undefined);
});
