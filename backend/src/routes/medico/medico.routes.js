const express = require('express');
const router = express.Router();

const verifyToken = require('../../middlewares/auth.middleware');
const { auditar } = require('../../middlewares/auditoria.middleware');
const { updatePerfilMedico } = require('../../controllers/medico/medico.controller');

// Ruta protegida y auditada
router.put('/', verifyToken, auditar('ACTUALIZAR_PERFIL', 'USUARIOS'), updatePerfilMedico);

module.exports = router;