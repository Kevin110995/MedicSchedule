const express = require('express');
const router = express.Router();
const { getDashboardMetrics } = require('../controllers/dashboard.controller');
const verifyToken = require('../middlewares/auth.middleware');

// Ruta: GET /api/dashboard/metrics
// ¡Ojo! Pasamos por verifyToken ANTES de llegar al controlador
router.get('/metrics', verifyToken, getDashboardMetrics);

module.exports = router;