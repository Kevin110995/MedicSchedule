const express = require('express');
const router = express.Router();
const { login } = require('../controllers/auth.controller');

// Ruta: POST /api/auth/login
router.post('/login', login);

module.exports = router;