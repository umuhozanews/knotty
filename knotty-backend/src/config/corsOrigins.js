const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost',
  'https://localhost',
  'https://knotty-app.pages.dev',
  'https://ishuri-hub.pages.dev',
  'capacitor://localhost',
];

function getAllowedOrigins(frontendUrls = '') {
  const configuredOrigins = String(frontendUrls)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ORIGINS, ...configuredOrigins]);
}

function isAllowedOrigin(origin, allowedOrigins) {
  return !origin || allowedOrigins.has(origin);
}

module.exports = { DEFAULT_ORIGINS, getAllowedOrigins, isAllowedOrigin };
