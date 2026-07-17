// Application-level WAF: blocks common injection patterns before they reach route handlers.
const SQLI_PATTERN = /(\b(union|select|insert|update|delete|drop|truncate|exec|execute|xp_|declare|cast|convert|char|nchar)\b.*\b(from|into|table|where|set|values)\b)|('|--|;|\/\*|\*\/|0x[0-9a-f]+)/i;
const XSS_PATTERN = /<\s*(script|iframe|object|embed|link|meta|svg|img[^>]*on\w+)[^>]*>/i;
const PATH_TRAVERSAL = /(\.\.[/\\]){2,}/;
const NULL_BYTE = /\0/;

function scanValue(value) {
  if (typeof value !== 'string') return false;
  return SQLI_PATTERN.test(value) || XSS_PATTERN.test(value) || PATH_TRAVERSAL.test(value) || NULL_BYTE.test(value);
}

function scanObject(obj, depth = 0) {
  if (depth > 5) return false;
  if (typeof obj === 'string') return scanValue(obj);
  if (Array.isArray(obj)) return obj.some((v) => scanObject(v, depth + 1));
  if (obj && typeof obj === 'object') return Object.values(obj).some((v) => scanObject(v, depth + 1));
  return false;
}

function waf(req, res, next) {
  if (scanObject(req.body) || scanObject(req.query) || scanObject(req.params)) {
    return res.status(400).json({ success: false, message: 'Request contains disallowed content' });
  }
  next();
}

module.exports = { waf };
