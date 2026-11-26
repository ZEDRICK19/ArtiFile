const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const { AppError } = require('../middleware/error');

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('[ArtiFile] Could not remove temporary file:', error.message);
  }
}

function resolveStoredPath(fileKey) {
  const filePath = path.resolve(env.uploadDir, fileKey);
  const root = path.resolve(env.uploadDir) + path.sep;
  if (!filePath.startsWith(root)) {
    throw new AppError('Invalid file path.', 400);
  }
  return filePath;
}

function assertRealFileType(filePath, allowedMimeTypes) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(8);
    const bytesRead = fs.readSync(fd, buffer, 0, 8, 0);
    const bytes = buffer.subarray(0, bytesRead);

    const signatures = {
      'application/pdf': bytes.length >= 5 && bytes.subarray(0, 5).toString('latin1') === '%PDF-',
      'image/png': bytes.length >= 8 &&
        bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
        bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a,
      'image/jpeg': bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    };

    const isValid = allowedMimeTypes.some((mime) => signatures[mime] === true);
    if (!isValid) {
      safeUnlink(filePath);
      throw new AppError(
        'The file content does not match its declared type. Please upload a valid PDF, JPG, JPEG, or PNG file.',
        400
      );
    }
    return true;
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch (error) { /* descriptor already closed */ }
    }
  }
}

module.exports = { safeUnlink, resolveStoredPath, assertRealFileType };
