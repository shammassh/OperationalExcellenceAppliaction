/**
 * Security Employee (Security Department) Module
 * Contains apps for the Security Department category
 */

const express = require('express');
const router = express.Router();

// Import routes
const legalCasesRoutes = require('./legal-cases/routes');
const blacklistRoutes = require('./blacklist/routes');
const dailyReportingRoutes = require('./daily-reporting/routes');
const calendarRoutes = require('./calendar/routes');
const cameraRequestRoutes = require('./camera-request/routes');

// Mount routes
router.use('/legal-cases', legalCasesRoutes);
router.use('/blacklist', blacklistRoutes);
router.use('/daily-reporting', dailyReportingRoutes);
router.use('/calendar', calendarRoutes);
router.use('/camera-request', cameraRequestRoutes);

module.exports = router;
