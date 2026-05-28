const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth.middleware');
const { auditar } = require('../../middlewares/auditoria.middleware');

const { getAgendaHoy, cambiarEstadoCita } = require('../../controllers/medico/dashboard.controller');

// Obtener la agenda no requiere auditoría pesada, solo lectura
router.get('/agenda-hoy', verifyToken, getAgendaHoy);

// Aquí sí auditamos el cambio de estado en la clínica
router.patch('/cita/:id_cita/estado', verifyToken, auditar('CAMBIAR_ESTADO_CITA', 'CITAS'), cambiarEstadoCita);

module.exports = router;