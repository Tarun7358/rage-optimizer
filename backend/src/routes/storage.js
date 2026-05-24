const express = require('express');
const router = express.Router();
const multer = require('multer');
const storageService = require('../services/storageService');
const authMiddleware = require('../middleware/authMiddleware');

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// POST /api/storage/upload - Upload file to a bucket
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { bucket } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const allowedBuckets = ['transcripts', 'backups', 'media', 'welcomes', 'logs'];
    if (!bucket || !allowedBuckets.includes(bucket)) {
      return res.status(400).json({ error: `Invalid bucket. Allowed buckets: ${allowedBuckets.join(', ')}` });
    }

    // Generate unique name
    const ext = file.originalname.split('.').pop();
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

    const result = await storageService.uploadFile(bucket, file.buffer, uniqueName, file.mimetype);

    res.json({
      success: true,
      path: result.path,
      publicUrl: result.publicUrl
    });
  } catch (error) {
    console.error('[Storage Route Error]', error);
    res.status(500).json({ error: 'Failed to upload file to storage' });
  }
});

// GET /api/storage/signed-url - Generate temporary signed URL for a file path
router.get('/signed-url', authMiddleware, async (req, res) => {
  try {
    const { bucket, path: filePath, expires } = req.query;

    const allowedBuckets = ['transcripts', 'backups', 'media', 'welcomes', 'logs'];
    if (!bucket || !allowedBuckets.includes(bucket)) {
      return res.status(400).json({ error: 'Invalid bucket' });
    }
    if (!filePath) {
      return res.status(400).json({ error: 'Missing file path' });
    }

    const expiresIn = expires ? parseInt(expires) : 3600;
    const signedUrl = await storageService.getSignedUrl(bucket, filePath, expiresIn);

    res.json({ success: true, signedUrl });
  } catch (error) {
    console.error('[Storage Signed URL Error]', error);
    res.status(500).json({ error: 'Failed to get signed URL' });
  }
});

module.exports = router;
