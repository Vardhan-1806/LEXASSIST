const express = require('express');
const router  = express.Router();
const { getAppointments, bookAppointment, updateStatus, getAvailableSlots } = require('../controllers/appointmentController');
const { protect } = require('../middleware/auth');

router.get('/',                    protect, getAppointments);
router.post('/',                   protect, bookAppointment);
router.get('/slots',               protect, getAvailableSlots);
router.put('/:id/status',          protect, updateStatus);

module.exports = router;
