const express = require('express');
const router = express.Router();

// Importación de Middlewares
const verifyToken = require('../middlewares/auth.middleware');
const { auditar } = require('../middlewares/auditoria.middleware');

// Importación unificada de Controladores (Sin verificarAdministrador)
const { 
    getAdministradores, 
    createAdministrador, 
    updateAdministrador, 
    toggleEstatus,
    reenviarCorreoVerificacion 
} = require('../controllers/administradores.controller');

// ==========================================
// RUTAS DE ADMINISTRADORES
// ==========================================

// Obtener lista
router.get('/', verifyToken, getAdministradores);

// Crear nuevo
router.post('/', verifyToken, auditar('CREAR_ADMINISTRADOR', 'USUARIOS'), createAdministrador);

// Reenviar accesos (reset de contraseña)
router.post('/reenviar-correo', verifyToken, auditar('REENVIAR_CORREO_ADMIN', 'USUARIOS'), reenviarCorreoVerificacion);

// Actualizar datos
router.put('/:id', verifyToken, auditar('ACTUALIZAR_ADMINISTRADOR', 'USUARIOS'), updateAdministrador);

// Activar / Suspender
router.patch('/:id/estatus', verifyToken, auditar('CAMBIAR_ESTATUS_ADMIN', 'USUARIOS'), toggleEstatus);

module.exports = router;