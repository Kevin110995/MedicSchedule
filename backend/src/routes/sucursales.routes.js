const express = require('express');
const router = express.Router();
const { getSucursales, createSucursal, toggleEstatus, updateSucursal } = require('../controllers/sucursales.controller');
const verifyToken = require('../middlewares/auth.middleware');
const { auditar } = require('../middlewares/auditoria.middleware');

// Todas las rutas protegidas por verifyToken
router.get('/', verifyToken, getSucursales);
router.post('/', verifyToken, auditar('CREAR_SUCURSAL', 'SUCURSALES'), createSucursal);
router.put('/:id', verifyToken, auditar('ACTUALIZAR_SUCURSAL', 'SUCURSALES'), updateSucursal);
router.patch('/:id/estatus', verifyToken, auditar('CAMBIAR_ESTATUS_SUCURSAL', 'SUCURSALES'), toggleEstatus);


module.exports = router;