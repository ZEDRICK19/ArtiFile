const express = require('express');
const student = require('../controllers/student.controller');
const { authenticate } = require('../middleware/auth');
const { requireStudent } = require('../middleware/rbac');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

router.use(authenticate, requireStudent);

router.get('/dashboard', asyncHandler(student.getDashboard));
router.get('/profile', asyncHandler(student.getProfile));
router.put('/profile', asyncHandler(student.updateProfile));
router.get('/application', asyncHandler(student.getApplication));
router.get('/requirements', asyncHandler(student.getRequirements));

module.exports = router;
