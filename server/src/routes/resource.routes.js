const express = require('express');
const resources = require('../controllers/resource.controller');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

// Reference data is public so the landing page and student registration
// can load forms, manuals, events, cultural groups, and contact details
// before a user signs in. Administrative editing stays under /api/admin.
router.get('/', asyncHandler(resources.getResources));
router.get('/events', asyncHandler(resources.getEvents));
router.get('/cultural-groups', asyncHandler(resources.getCulturalGroups));
router.get('/contact', asyncHandler(resources.getContactDetails));

module.exports = router;
