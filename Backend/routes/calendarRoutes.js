const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const { CalendarEvent } = require('../models/Extras');
router.get('/',    protect, async (req,res) => { const e = await CalendarEvent.find({user:req.user.id}).sort('startDate'); res.json({success:true,data:e}); });
router.post('/',   protect, async (req,res) => { const e = await CalendarEvent.create({user:req.user.id,...req.body}); res.status(201).json({success:true,data:e}); });
router.put('/:id', protect, async (req,res) => { const e = await CalendarEvent.findByIdAndUpdate(req.params.id,req.body,{new:true}); res.json({success:true,data:e}); });
router.delete('/:id', protect, async (req,res) => { await CalendarEvent.findByIdAndDelete(req.params.id); res.json({success:true}); });
module.exports = router;
