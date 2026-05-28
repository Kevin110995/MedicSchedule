const express = require('express');
const router = express.Router();

// Importamos el middleware de seguridad para que solo médicos logueados puedan entrar
const verifyToken = require('../../middlewares/auth.middleware');

// Importamos las DOS funciones del controlador (Leer y Actualizar)
const { updateExpediente, getExpediente } = require('../../controllers/medico/pacientes.controller');

// ==========================================
// RUTAS DE EXPEDIENTE CLÍNICO
// ==========================================

// 1. Ruta para LEER el expediente (Se ejecuta al abrir el Modal)
router.get('/:id_paciente/expediente', verifyToken, getExpediente);

// 2. Ruta para GUARDAR/ACTUALIZAR el expediente (Se ejecuta al presionar Guardar)
router.put('/:id_paciente/expediente', verifyToken, updateExpediente);

module.exports = router;