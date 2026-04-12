const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getCases, getCaseStats, createCase, updateCase,
  updateStage, addTimeline, rateLawyer, deleteCase, searchCase
} = require('../controllers/caseController');

router.get   ('/stats',              protect, getCaseStats);
router.get   ('/search',             protect, searchCase);
router.get   ('/',                   protect, getCases);
router.post  ('/',                   protect, createCase);
router.put   ('/:id',                protect, updateCase);
router.delete('/:id',                protect, deleteCase);
router.put   ('/:id/stage/:stageIndex', protect, updateStage);
router.post  ('/:id/timeline',       protect, addTimeline);
router.post  ('/:id/rate-lawyer',    protect, authorize('citizen'), rateLawyer);

module.exports = router;
