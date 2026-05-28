const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth.middleware');

// Asegúrate de que la ruta apunte al archivo donde guardaste la función
const { bloquearAgenda } = require('../../controllers/medico/agenda.controller');

// ==========================================
// RUTAS DE AGENDA Y BLOQUEOS
// ==========================================

// Ruta protegida para BLOQUEAR la agenda
router.post('/bloquear', verifyToken, bloquearAgenda);

module.exports = router;