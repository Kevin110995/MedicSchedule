const express = require('express');
const router = express.Router();
const institucionController = require('../controllers/institucion.controller');

// Ruta POST para registrar (Fase 0.4)
router.post('/registro', institucionController.registrarInstitucion);

// Ruta GET para cuando el usuario hace clic en el enlace del correo (Fase 0.5)
router.get('/verificar/:token', institucionController.verificarCorreo);

module.exports = router;