const { registrarAuditoria } = require('../helpers/auditoria.helper');

const auditar = (accion, entidad) => {
    return (req, res, next) => {
        // Esperamos a que el controlador termine de responder
        res.on('finish', async () => {
            // Solo registramos si la acción fue exitosa (Códigos 200 al 299)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                
                // Limpiamos los datos para no guardar contraseñas por seguridad
                const { password, contrasena, ...datosSeguros } = req.body || {};
                const detalle = { ...datosSeguros, ...req.params };

                await registrarAuditoria(req, accion, entidad, detalle);
            }
        });
        
        next(); // Deja pasar la petición al controlador
    };
};

module.exports = { auditar };