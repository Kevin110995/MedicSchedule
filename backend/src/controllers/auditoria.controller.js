const supabase = require('../config/supabase');

const getLogsAuditoria = async (req, res) => {
    try {
        if (req.user.rol !== 'Super_Admin') {
            return res.status(403).json({ error: 'Acceso denegado.' });
        }

        const { id_institucion } = req.user;

        const { data, error } = await supabase
            .from('auditoria')
            .select(`
                id_auditoria,
                accion,
                entidad_afectada,
                detalle,
                fecha_hora,
                ip_origen,
                usuarios ( nombre_completo, correo_electronico )
            `)
            .eq('id_institucion', id_institucion)
            .order('fecha_hora', { ascending: false })
            .limit(100); // Subí un poco el límite por si hay mucha actividad

        if (error) throw error;
        res.status(200).json(data);
    } catch (err) {
        console.error("Error obteniendo auditoría:", err);
        res.status(500).json({ error: 'Error al cargar los registros de auditoría' });
    }
};

module.exports = { getLogsAuditoria };