const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/auth.middleware');
const { auditar } = require('../middlewares/auditoria.middleware');
const { crearAnuncio, getAnuncios, updateAnuncio, toggleEstatusAnuncio } = require('../controllers/anuncios.controller');

router.get('/', verifyToken, getAnuncios);
router.post('/', verifyToken, auditar('CREAR_ANUNCIO', 'ANUNCIOS'), crearAnuncio);
router.put('/:id', verifyToken, auditar('EDITAR_ANUNCIO', 'ANUNCIOS'), updateAnuncio);
router.patch('/:id/estatus', verifyToken, auditar('CAMBIAR_ESTATUS_ANUNCIO', 'ANUNCIOS'), toggleEstatusAnuncio);

module.exports = router;