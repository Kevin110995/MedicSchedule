const express = require('express');
const router = express.Router();

const verifyToken = require('../../middlewares/auth.middleware');
const { auditar } = require('../../middlewares/auditoria.middleware');

const { 
    getCitas,
    updateEstadoCita,
    aprobarBloqueo,  // 👈 IMPORTACIÓN CORREGIDA
    rechazarBloqueo  // 👈 NUEVA IMPORTACIÓN
} = require('../../controllers/admin/agendas.controller');

// Obtener todas las citas (soporta query params ?fecha_inicio=X&fecha_fin=Y)
router.get('/', verifyToken, getCitas);

// Cambiar el estado de la cita rápida (Ej. a "En sala de espera", "Cancelada")
router.patch('/:id_cita/estado', verifyToken, auditar('CAMBIAR_ESTADO_CITA', 'CITAS'), updateEstadoCita);

// Rutas para gestionar las solicitudes de Bloqueo de Agenda
router.put('/bloqueos/:id_bloqueo/aprobar', verifyToken, auditar('APROBAR_BLOQUEO', 'AGENDA'), aprobarBloqueo);
router.put('/bloqueos/:id_bloqueo/rechazar', verifyToken, auditar('RECHAZAR_BLOQUEO', 'AGENDA'), rechazarBloqueo);

module.exports = router;