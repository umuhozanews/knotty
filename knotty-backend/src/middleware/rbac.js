function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
}

// Ensure user belongs to same school as the resource
function sameSchool(req, res, next) {
  const schoolId = req.params.schoolId || req.body.school_id || req.query.schoolId;
  if (schoolId && req.user.role !== 'ADMIN' && schoolId !== req.user.school_id) {
    return res.status(403).json({ success: false, message: 'Cross-school access denied' });
  }
  next();
}

module.exports = { authorize, sameSchool };
