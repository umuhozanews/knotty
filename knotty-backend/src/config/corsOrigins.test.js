const test = require('node:test');
const assert = require('node:assert/strict');
const { getAllowedOrigins, isAllowedOrigin } = require('./corsOrigins');

test('accepts only configured exact origins, including explicit preview hosts', () => {
  const allowed = getAllowedOrigins('https://preview.ishurihub.rw, https://school-a.pages.dev');
  assert.equal(isAllowedOrigin('https://preview.ishurihub.rw', allowed), true);
  assert.equal(isAllowedOrigin('https://school-a.pages.dev', allowed), true);
  assert.equal(isAllowedOrigin('https://ishuri-hub.pages.dev', allowed), true);
});

test('rejects arbitrary provider subdomains and lookalike hosts', () => {
  const allowed = getAllowedOrigins('https://app.ishurihub.rw');
  assert.equal(isAllowedOrigin('https://attacker.pages.dev', allowed), false);
  assert.equal(isAllowedOrigin('https://attacker.vercel.app', allowed), false);
  assert.equal(isAllowedOrigin('https://app.ishurihub.rw.attacker.example', allowed), false);
});

test('allows requests without an Origin header for non-browser clients', () => {
  assert.equal(isAllowedOrigin(undefined, getAllowedOrigins()), true);
});
