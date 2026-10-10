function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const managerAccess = roles.includes('ADMIN') &&
      ['PLATFORM_ADMIN', 'ORGANIZATION_MANAGER', 'SCHOOL_MANAGER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
    if (!roles.includes(req.user.role) && !managerAccess) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authorize };
