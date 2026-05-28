const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/auth.middleware');
const { auditar } = require('../middlewares/auditoria.middleware');
const { getInstitucion, updateInstitucion } = require('../controllers/instituciones.controller');

router.get('/', verifyToken, getInstitucion);
router.put('/', verifyToken, auditar('ACTUALIZAR_INSTITUCION', 'INSTITUCIONES'), updateInstitucion);

module.exports = router;