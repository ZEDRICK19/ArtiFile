const express = require('express');
const admin = require('../controllers/admin.controller');
const documents = require('../controllers/document.controller');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get('/dashboard', asyncHandler(admin.getDashboard));
router.get('/reports', asyncHandler(admin.getReports));
router.get('/activity-logs', asyncHandler(admin.getActivityLogs));

router.get('/applicants', asyncHandler(admin.getApplicants));
router.get('/applicants/:id', asyncHandler(admin.getApplicantById));
router.put('/applicants/:id/status', asyncHandler(admin.updateApplicantStatus));
router.post('/applicants/:id/archive', asyncHandler(admin.archiveApplicant));

router.get('/documents', asyncHandler(documents.adminListDocuments));
router.put('/documents/:id/review', asyncHandler(admin.reviewDocument));

router.get('/cultural-groups', asyncHandler(admin.getCulturalGroups));
router.post('/cultural-groups', asyncHandler(admin.createCulturalGroup));
router.put('/cultural-groups/:id', asyncHandler(admin.updateCulturalGroup));

router.get('/events', asyncHandler(admin.getEvents));
router.post('/events', asyncHandler(admin.createEvent));
router.put('/events/:id', asyncHandler(admin.updateEvent));
router.delete('/events/:id', asyncHandler(admin.deleteEvent));

router.get('/resources', asyncHandler(admin.getResources));
router.post('/resources', asyncHandler(admin.createResource));
router.put('/resources/:id', asyncHandler(admin.updateResource));
router.delete('/resources/:id', asyncHandler(admin.deleteResource));

module.exports = router;
