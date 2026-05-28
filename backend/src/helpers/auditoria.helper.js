const supabase = require('../config/supabase'); // Ajusta tu ruta si es diferente

const registrarAuditoria = async (req, accion, entidad_afectada, detalle = {}) => {
    // 🛑 EL APAGADOR: Si está en 'false' o no existe, ignoramos el registro silenciosamente
    if (process.env.ENABLE_AUDIT_LOGS !== 'true') {
        console.log(`[AUDITORÍA APAGADA] Se omitió: ${accion} en ${entidad_afectada}`);
        return;
    }

    try {
        const payload = {
            id_institucion: req.user.id_institucion,
            id_usuario: req.user.id_usuario,
            accion,
            entidad_afectada,
            detalle,
            // 👇 AGREGA ESTA LÍNEA PARA MANDAR LA HORA EXACTA
            fecha_hora: new Date().toISOString(),
            ip_origen: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Desconocida'
        };

        const { error } = await supabase.from('auditoria').insert([payload]);
        if (error) throw error;
        
    } catch (error) {
        console.error("💥 Error crítico escribiendo en Auditoría:", error);
        // No bloqueamos el sistema principal si la auditoría falla
    }
};

module.exports = { registrarAuditoria };