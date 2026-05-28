const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/auth.middleware');
const { auditar } = require('../middlewares/auditoria.middleware');
const { getPerfil, updatePerfil } = require('../controllers/perfil.controller');

router.get('/', verifyToken, getPerfil);
router.put('/', verifyToken, auditar('ACTUALIZAR_PERFIL_PROPIO', 'USUARIOS'), updatePerfil);

module.exports = router;