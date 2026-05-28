const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth.middleware');
const { auditar } = require('../../middlewares/auditoria.middleware');

const { 
    getHorariosSucursal, upsertHorarioSucursal,
    getPersonalList, upsertHorarioPersonal,
    getPermisosPendientes, responderPermiso 
} = require('../../controllers/admin/horarios.controller');

// Sucursal
router.get('/sucursal', verifyToken, getHorariosSucursal);
router.post('/sucursal/bulk', verifyToken, auditar('CONFIGURAR_HORARIO_SUCURSAL', 'AGENDA'), upsertHorarioSucursal);

// Personal y Turnos
router.get('/personal', verifyToken, getPersonalList);
router.post('/personal/bulk', verifyToken, auditar('ASIGNAR_TURNO_PERSONAL', 'AGENDA'), upsertHorarioPersonal);

// Permisos
router.get('/permisos', verifyToken, getPermisosPendientes);
router.patch('/permisos/:id_bloqueo', verifyToken, auditar('RESPONDER_PERMISO', 'AGENDA'), responderPermiso);
router.get('/personal/:id/:rol', verifyToken, require('../../controllers/admin/horarios.controller').getHorarioPersonalEspecifico);

module.exports = router;