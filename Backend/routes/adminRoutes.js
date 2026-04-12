const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/adminController');

router.use(protect, authorize('admin'));

router.get('/stats',                   ctrl.getDashboardStats);
router.get('/analytics',               ctrl.getAnalytics);
router.get('/users',                   ctrl.getAllUsers);
router.put('/users/:id/toggle',        ctrl.toggleUserActive);
router.delete('/users/:id',            ctrl.deleteUser);
router.get('/lawyers',                 ctrl.getAllLawyers);
router.get('/lawyers/pending',         ctrl.getPendingLawyers);
router.get('/lawyers/:id',             ctrl.getLawyerDetails);
router.put('/lawyers/:id/verify',      ctrl.verifyLawyer);
router.put('/lawyers/:id/reject',      ctrl.rejectLawyer);
router.post('/broadcast',              ctrl.broadcastNotification);

module.exports = router;
