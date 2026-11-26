const express = require('express');
const documents = require('../controllers/document.controller');
const { authenticate } = require('../middleware/auth');
const { requireAdmin, requireStudent } = require('../middleware/rbac');
const { makeUpload } = require('../middleware/upload');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

router.use(authenticate);

router.get('/', requireAdmin, asyncHandler(documents.adminListDocuments));
router.get('/my-documents', requireStudent, asyncHandler(documents.myDocuments));

router.post(
  '/upload',
  requireStudent,
  makeUpload('file', documents.rulesFromBody),
  asyncHandler(documents.uploadPre)
);

router.post(
  '/post/upload',
  requireStudent,
  makeUpload('file', documents.rulesFromBody),
  asyncHandler(documents.uploadPost)
);

router.put(
  '/:id/replace',
  requireStudent,
  makeUpload('file', documents.rulesFromParams),
  asyncHandler(documents.replace)
);

router.get('/:id/download', asyncHandler(documents.downloadDocument));
router.get('/:id', asyncHandler(documents.getDocument));

module.exports = router;
