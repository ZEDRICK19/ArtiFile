const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');
const { AppError } = require('./error');
const { safeUnlink, assertRealFileType } = require('../utils/files');

fs.mkdirSync(env.uploadDir, { recursive: true });

const HARD_MAX_BYTES = 20 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, env.uploadDir),
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${crypto.randomUUID()}${extension}`);
  }
});

function makeUpload(fieldName, rulesProvider) {
  // Parse first, then resolve the requirement rules. Multipart fields such as
  // requirementKey are only available in req.body after multer has run.
  const upload = multer({
    storage,
    limits: { fileSize: HARD_MAX_BYTES, files: 1 }
  }).single(fieldName);

  return (req, res, next) => {
    upload(req, res, async (uploadError) => {
      if (uploadError) {
        if (req.file && req.file.path) safeUnlink(req.file.path);
        if (uploadError.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError('The uploaded file exceeds the maximum allowed size.', 400));
        }
        return next(new AppError(`Upload failed: ${uploadError.message}`, 400));
      }

      if (!req.file) {
        return next(new AppError('No file was selected. Please choose a document to upload.', 400));
      }

      try {
        const rules = await rulesProvider(req);
        const allowedMimeTypes = Array.isArray(rules.allowedMimeTypes) ? rules.allowedMimeTypes : [];
        const allowedExtensions = (Array.isArray(rules.allowedExtensions) ? rules.allowedExtensions : [])
          .map((value) => String(value).replace(/^\./, '').toLowerCase());
        const maxBytes = Number(rules.maxFileSizeMb || 5) * 1024 * 1024;
        const extension = path.extname(req.file.originalname).toLowerCase().replace('.', '');

        if (!allowedMimeTypes.includes(req.file.mimetype) || !allowedExtensions.includes(extension)) {
          throw new AppError(
            `Invalid file type. Allowed formats: ${allowedExtensions.map((ext) => `.${ext}`).join(', ')}.`,
            400
          );
        }

        if (req.file.size > maxBytes) {
          throw new AppError(`The file exceeds the ${rules.maxFileSizeMb} MB limit.`, 400);
        }

        assertRealFileType(req.file.path, allowedMimeTypes);
        return next();
      } catch (error) {
        if (req.file && req.file.path) safeUnlink(req.file.path);
        return next(error);
      }
    });
  };
}

module.exports = { makeUpload };
