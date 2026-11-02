const { URL } = require('node:url');

function secureSupabaseConnectionString(connectionString) {
  if (!connectionString) return connectionString;

  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    return connectionString;
  }

  const hostname = parsed.hostname.toLowerCase();
  const isSupabaseHost = hostname.endsWith('.supabase.co') || hostname.endsWith('.supabase.com');
  if (!isSupabaseHost) return connectionString;

  // Force CA and hostname validation even when a copied provider URL contains
  // sslmode=no-verify or sslmode=require. pg honors sslmode from the URL over
  // an explicit Pool `ssl` option, so normalize it at the connection-string layer.
  parsed.searchParams.set('sslmode', 'verify-full');
  return parsed.toString();
}

module.exports = { secureSupabaseConnectionString };
