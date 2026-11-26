const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please wait 15 minutes and try again.'
  }
});

router.post('/register', authLimiter, asyncHandler(auth.register));
router.post('/login', authLimiter, asyncHandler(auth.login));
router.post('/forgot-password', authLimiter, asyncHandler(auth.forgotPassword));
router.post('/logout', authenticate, asyncHandler(auth.logout));
router.get('/me', authenticate, asyncHandler(auth.me));

module.exports = router;
