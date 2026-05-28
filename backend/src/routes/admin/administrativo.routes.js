const express = require('express');
const router = express.Router();

const verifyToken = require('../../middlewares/auth.middleware');
const { auditar } = require('../../middlewares/auditoria.middleware');

const { 
    getPersonal, 
    createPersonal, 
    updatePersonal, 
    toggleEstatusPersonal,
    resendAccesoPersonal
} = require('../../controllers/admin/administrativo.controller');

router.get('/', verifyToken, getPersonal);
router.post('/', verifyToken, auditar('CREAR_RECEPCIONISTA', 'USUARIOS'), createPersonal);
router.post('/:id_usuario/resend', verifyToken, auditar('REENVIAR_ACCESO_RECEPCIONISTA', 'USUARIOS'), resendAccesoPersonal);
router.put('/:id_usuario', verifyToken, auditar('ACTUALIZAR_RECEPCIONISTA', 'USUARIOS'), updatePersonal);
router.patch('/:id_usuario/estatus', verifyToken, auditar('CAMBIAR_ESTATUS_RECEPCIONISTA', 'USUARIOS'), toggleEstatusPersonal);

module.exports = router;