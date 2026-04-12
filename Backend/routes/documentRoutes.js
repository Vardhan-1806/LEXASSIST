/**
 * LEXASSIST — Document Routes
 * Upload, list, delete, share documents with dates
 */
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const { Document, Notification } = require('../models/Extras');
const { protect } = require('../middleware/auth');

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/documents/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive:true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g,'-')}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf','.doc','.docx','.txt','.jpg','.jpeg','.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('File type not allowed. Use PDF, DOC, DOCX, TXT, JPG, PNG'));
  }
});

// @route GET /api/documents — Get all docs for current user
router.get('/', protect, async (req, res) => {
  try {
    const { caseId, page=1, limit=20 } = req.query;
    const filter = { uploadedBy: req.user.id };
    if (caseId) filter.case = caseId;

    const docs = await Document.find(filter)
      .populate('case', 'caseNumber title')
      .populate('uploadedBy', 'name')
      .sort('-createdAt')
      .skip((page-1)*limit)
      .limit(+limit);

    const total = await Document.countDocuments(filter);
    res.json({ success:true, count:docs.length, total, data:docs });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// @route POST /api/documents — Upload document
router.post('/', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success:false, message:'No file uploaded' });

    const doc = await Document.create({
      title:        req.body.title || req.file.originalname,
      description:  req.body.description || '',
      case:         req.body.caseId || undefined,
      uploadedBy:   req.user.id,
      fileUrl:      `/uploads/documents/${req.file.filename}`,
      fileType:     req.file.mimetype,
      fileSize:     req.file.size,
      originalName: req.file.originalname,
      tags:         req.body.tags ? req.body.tags.split(',').map(t=>t.trim()) : [],
    });

    await doc.populate('case', 'caseNumber title');
    await doc.populate('uploadedBy', 'name');

    // Notify user
    await Notification.create({
      user:    req.user.id,
      title:   '📄 Document Uploaded',
      message: `"${doc.title}" uploaded successfully.`,
      type:    'document',
      link:    '/documents',
    });

    res.status(201).json({ success:true, data:doc });
  } catch(err) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success:false, message:err.message });
  }
});

// @route GET /api/documents/:id — Get single document
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id)
      .populate('case','caseNumber title')
      .populate('uploadedBy','name email');
    if (!doc) return res.status(404).json({ success:false, message:'Document not found' });
    // Check access
    if (doc.uploadedBy._id.toString() !== req.user.id && !doc.isPublic && !doc.sharedWith.includes(req.user.id)) {
      return res.status(403).json({ success:false, message:'Access denied' });
    }
    res.json({ success:true, data:doc });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// @route DELETE /api/documents/:id — Delete document
router.delete('/:id', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ success:false, message:'Document not found' });
    if (doc.uploadedBy.toString() !== req.user.id) return res.status(403).json({ success:false, message:'Not authorized' });

    // Delete physical file
    const filePath = path.join(__dirname, '../../', doc.fileUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await doc.deleteOne();

    res.json({ success:true, message:'Document deleted' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// @route POST /api/documents/:id/share — Generate share link
router.post('/:id/share', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ success:false, message:'Document not found' });
    if (doc.uploadedBy.toString() !== req.user.id) return res.status(403).json({ success:false, message:'Not authorized' });

    // Generate unique share token
    const token   = crypto.randomBytes(32).toString('hex');
    const days    = parseInt(req.body.days) || 7;
    const expiry  = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    doc.shareToken  = token;
    doc.shareExpiry = expiry;
    doc.isPublic    = false;
    await doc.save();

    const shareUrl = `${process.env.CLIENT_URL || 'http://localhost:5000'}/documents/shared/${token}`;
    res.json({ success:true, data:{ shareUrl, shareToken:token, expiresAt:expiry, expiresIn:`${days} days` } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// @route GET /api/documents/shared/:token — Access shared document (public)
router.get('/shared/:token', async (req, res) => {
  try {
    const doc = await Document.findOne({ shareToken: req.params.token })
      .populate('uploadedBy','name')
      .populate('case','caseNumber title');

    if (!doc) return res.status(404).json({ success:false, message:'Invalid or expired share link' });
    if (doc.shareExpiry && doc.shareExpiry < new Date()) return res.status(410).json({ success:false, message:'Share link has expired' });

    // Increment download count
    doc.downloadCount += 1;
    await doc.save();

    res.json({ success:true, data:{ title:doc.title, fileUrl:doc.fileUrl, fileType:doc.fileType, fileSize:doc.fileSize, originalName:doc.originalName, uploadedBy:doc.uploadedBy?.name, uploadedAt:doc.createdAt, case:doc.case, expiresAt:doc.shareExpiry } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// @route GET /api/documents/case/:caseId — Get docs for a case
router.get('/case/:caseId', protect, async (req, res) => {
  try {
    const docs = await Document.find({ case:req.params.caseId }).populate('uploadedBy','name').sort('-createdAt');
    res.json({ success:true, data:docs });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

module.exports = router;
