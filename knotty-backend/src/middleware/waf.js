const SQLI_PATTERN = /(\b(union(\s+all)?\s+select|insert\s+into|update\s+\w+\s+set|delete\s+from|drop\s+(table|database)|truncate\s+table|exec|execute|xp_)\b)|('[\s\S]*?\b(or|and)\b[\s\S]*?(=|>|<|like))|(--\s*|\/\*[\s\S]*?\*\/|;\s*(drop|delete|insert|update|select|truncate|exec|execute|alter)\b)/i;
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
