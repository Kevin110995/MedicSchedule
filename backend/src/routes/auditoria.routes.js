const express = require('express');
const router = express.Router();
const verificarToken = require('../middlewares/auth.middleware');
const { getLogsAuditoria } = require('../controllers/auditoria.controller');

router.use(verificarToken);
router.get('/', getLogsAuditoria);

module.exports = router;