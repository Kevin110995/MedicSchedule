const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth.middleware');
const { auditar } = require('../../middlewares/auditoria.middleware');

const { 
    getDetallesConsulta, 
    finalizarConsulta, 
    getHistorialPaciente,
    getPerfilClinico // <-- Lo importamos aquí
} = require('../../controllers/medico/consulta.controller');

// ==========================================
// 1. RUTAS ESPECÍFICAS (Deben ir primero)
// ==========================================
router.get('/historial/:id_paciente', verifyToken, getHistorialPaciente);
router.get('/perfil-clinico/:id_paciente', verifyToken, getPerfilClinico); // <-- La ruta que pide React

// ==========================================
// 2. RUTAS DINÁMICAS (Deben ir al final)
// ==========================================
router.get('/:id_cita', verifyToken, getDetallesConsulta);
router.post('/:id_cita/finalizar', verifyToken, auditar('FINALIZAR_CONSULTA', 'RECETAS'), finalizarConsulta);

// ¡ESTO ES LO QUE EXPRESS NECESITA PARA NO CRASHEAR!
module.exports = router;