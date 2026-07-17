const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const PREFIX = 'enc:';

function _key() {
  const raw = process.env.ENCRYPTION_KEY || '';
  if (raw.length !== 64) throw new Error('ENCRYPTION_KEY must be 64 hex characters');
  return Buffer.from(raw, 'hex');
}

function encrypt(value) {
  if (value === null || value === undefined) return null;
  const plaintext = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, _key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(ciphertext) {
  if (ciphertext === null || ciphertext === undefined) return null;
  const str = String(ciphertext);
  // Passthrough — pre-migration plaintext values are returned as-is
  if (!str.startsWith(PREFIX)) return ciphertext;
  const [, ivHex, tagHex, dataHex] = str.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, _key(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const plain = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  try { return JSON.parse(plain); } catch { return plain; }
}

module.exports = { encrypt, decrypt };
