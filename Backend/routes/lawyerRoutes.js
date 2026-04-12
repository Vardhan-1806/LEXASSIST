const express = require('express');
const router  = express.Router();
const { getLawyers, getLawyerById, registerAsLawyer, updateLawyerProfile, addReview, getSpecializations } = require('../controllers/lawyerController');
const { protect, authorize } = require('../middleware/auth');

router.get('/',                   getLawyers);
router.get('/specializations',    getSpecializations);
router.get('/:id',                getLawyerById);
router.post('/register',          protect, registerAsLawyer);
router.put('/profile',            protect, authorize('lawyer'), updateLawyerProfile);
router.post('/:id/review',        protect, authorize('citizen'), addReview);

module.exports = router;
