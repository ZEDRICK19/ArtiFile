const express = require('express');
const notifications = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

router.use(authenticate);

router.get('/', asyncHandler(notifications.list));
router.put('/read-all', asyncHandler(notifications.markAllRead));
router.put('/:id/read', asyncHandler(notifications.markRead));

module.exports = router;
