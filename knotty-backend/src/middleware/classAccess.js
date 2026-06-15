const prisma = require('../config/database');

async function checkClassAccess(req, res, next) {
  // Admins have access to all classes
  if (req.user.role === 'ADMIN') {
    return next();
  }

  // Retrieve class ID from params, query, or body
  const classId = req.params.classId || req.params.id || req.query.classId || req.body.class_id || req.body.classId;

  if (!classId) {
    // If no class ID is present in the request context, proceed
    return next();
  }

  // If the user is a teacher, verify they are assigned to this class
  if (req.user.role === 'TEACHER') {
    try {
      const teacher = await prisma.teacher.findFirst({
        where: { user_id: req.user.id, school_id: req.user.school_id }
      });
      
      if (!teacher) {
        return res.status(403).json({ success: false, message: 'Teacher profile not found. Access denied.' });
      }

      const assignments = teacher.subjects_taught; // JSON column containing Array<{ class_id, class_name, subject }>
      if (!assignments || !Array.isArray(assignments)) {
        return res.status(403).json({ success: false, message: 'No classes assigned. Access denied.' });
      }

      const isAssigned = assignments.some(a => a.class_id === classId);
      if (!isAssigned) {
        return res.status(403).json({ success: false, message: 'Access denied: You are not assigned to this class.' });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  }

  // Other roles proceed
  next();
}

module.exports = { checkClassAccess };
