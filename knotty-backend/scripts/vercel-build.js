const { execSync } = require('child_process');

let dbUrl = process.env.DATABASE_URL;

if (dbUrl) {
  console.log('Original DATABASE_URL found.');
  try {
    // If database URL contains pooler port 6543, rewrite to session pooler port 5432
    if (dbUrl.includes(':6543')) {
      console.log('Detected transaction pooler port (6543). Rewriting to session pooler port (5432) for migrations...');
      dbUrl = dbUrl.replace(':6543', ':5432');
    }
    
    // Remove pgbouncer=true query param if present since migrations don't work with it
    if (dbUrl.includes('pgbouncer=true')) {
      console.log('Removing pgbouncer=true query parameter for migrations...');
      dbUrl = dbUrl.replace('?pgbouncer=true', '')
                   .replace('&pgbouncer=true', '');
    }
    
    process.env.DATABASE_URL = dbUrl;
    console.log('DATABASE_URL updated for migrations.');
  } catch (err) {
    console.error('Error rewriting DATABASE_URL:', err);
  }
} else {
  console.warn('DATABASE_URL environment variable is not defined.');
}

console.log('Generating Prisma client...');
execSync('npx prisma generate', { stdio: 'inherit' });

console.log('Running database schema push...');
try {
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
} catch (error) {
  console.error('Database push failed:', error);
  process.exit(1);
}

console.log('Build script completed successfully.');
