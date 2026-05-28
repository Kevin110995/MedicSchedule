const express = require('express');
const router = express.Router();

const verifyToken = require('../../middlewares/auth.middleware');
const { auditar } = require('../../middlewares/auditoria.middleware');

const { 
    getMedicos, 
    createMedico, 
    updateMedico, 
    toggleEstatusMedico,
    resendAcceso
} = require('../../controllers/admin/medicos.controller');

router.get('/', verifyToken, getMedicos);
router.post('/', verifyToken, auditar('CREAR_MEDICO', 'USUARIOS'), createMedico);
router.put('/:id_usuario', verifyToken, auditar('ACTUALIZAR_MEDICO', 'USUARIOS'), updateMedico);
router.patch('/:id_usuario/estatus', verifyToken, auditar('CAMBIAR_ESTATUS_MEDICO', 'USUARIOS'), toggleEstatusMedico);
router.post('/:id_usuario/resend', verifyToken, auditar('REENVIAR_ACCESO_MEDICO', 'USUARIOS'), resendAcceso);

module.exports = router;