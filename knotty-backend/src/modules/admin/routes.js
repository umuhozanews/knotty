const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { runBackup, runBackupAllSchools } = require('./backup.service');

// Manual backup trigger — ADMIN only
router.post('/backup', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const result = await runBackup(req.user.school_id);
    res.json({ success: true, backup: result });
  } catch (err) {
    next(err);
  }
});

// Vercel Cron endpoint — authenticated by CRON_SECRET, backs up all schools
router.post('/cron/backup', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  try {
    const results = await runBackupAllSchools();
    const failed = results.filter((r) => r.status === 'error');
    res.status(failed.length > 0 ? 207 : 200).json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
