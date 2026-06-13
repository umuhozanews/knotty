function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const details = error.details.map((d) => d.message);
      console.error('[VALIDATION ERROR]', details, 'for body:', req.body);
      return res.status(400).json({ success: false, message: 'Validation error', details });
    }
    req.body = value;
    next();
  };
}

module.exports = validate;
