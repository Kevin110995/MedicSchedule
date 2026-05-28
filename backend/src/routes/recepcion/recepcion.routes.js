const express = require('express');
const router = express.Router();

// 1. Importar Controladores
const pacientesCtrl = require('../../controllers/recepcion/pacientes.controller');
const citasCtrl = require('../../controllers/recepcion/citas.controller');
const monitorCtrl = require('../../controllers/recepcion/monitor.controller'); // 👈 NUEVO: Controlador del Kanban

// 2. Importar Middlewares
const verifyToken = require('../../middlewares/auth.middleware'); 
const { auditar } = require('../../middlewares/auditoria.middleware'); 

// 🛡️ Protegemos TODA la ruta de recepción
router.use(verifyToken);

// =========================================================
// 📇 RUTAS DE MOSTRADOR (PACIENTES)
// =========================================================
router.get('/pacientes', pacientesCtrl.buscarPacientes); 
router.post('/pacientes', auditar('ALTA_RAPIDA_PACIENTE'), pacientesCtrl.altaRapida);

// =========================================================
// ⏱️ RUTAS DE AGENDA (LOCKS)
// =========================================================
router.post('/lock-cita', auditar('BLOQUEO_TEMPORAL_CITA'), citasCtrl.bloquearEspacioTemporal);

// =========================================================
// 🏥 RUTAS DEL MONITOR CLÍNICO Y TRIAGE (RFW-03 y RFW-04)
// =========================================================

// 1. Cargar el Tablero Kanban del día
router.get('/monitor/citas', monitorCtrl.obtenerCitasDelDia);

// 2. Mover paciente entre columnas o activar la emergencia 🔥 (Triage)
router.put('/monitor/citas/:id_cita', auditar('CAMBIO_ESTADO_CITA'), monitorCtrl.actualizarEstadoCita);

// 3. Disparar alerta masiva de WhatsApp por retraso
router.post('/monitor/retraso', auditar('ALERTA_RETRASO_MASIVO'), monitorCtrl.notificarRetrasoMasivo);

const medicosCtrl = require('../../controllers/recepcion/medicos.controller');
router.get('/medicos', medicosCtrl.obtenerMedicosActivos);

router.get('/disponibilidad', citasCtrl.obtenerDisponibilidad);
router.post('/citas', citasCtrl.crearCita)

module.exports = router;