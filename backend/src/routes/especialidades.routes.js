const express = require('express');
const router = express.Router();

const verifyToken = require('../middlewares/auth.middleware');
const { getEspecialidades } = require('../controllers/especialidades.controller');

router.get('/', verifyToken, getEspecialidades);

module.exports = router;