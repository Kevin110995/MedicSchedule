const supabase = require('../../config/supabase');
// 🎯 Importamos el servicio que busca los huecos (Asegúrate de haber creado este archivo)
const { encontrarProximoHueco } = require('../../services/agenda.service');

const bloquearAgenda = async (req, res) => {
    try {
        const { titulo, fecha_inicio, fecha_fin, tipo } = req.body;
        const idUsuarioToken = req.user.id_usuario || req.user.id;

        const { data: medicoData } = await supabase
            .from('medicos')
            .select('id_medico')
            .eq('id_usuario', idUsuarioToken)
            .single();

        if (!medicoData) return res.status(403).json({ error: 'Médico no encontrado.' });

        // 1. Insertamos el bloqueo con estatus "Pendiente" (o nulo, asumiendo que el default de tu BD requiere aprobación)
        const { error: errInsert } = await supabase
            .from('bloqueos_agenda')
            .insert([{
                id_medico: medicoData.id_medico,
                titulo,
                fecha_inicio, 
                fecha_fin,
                tipo,
                activo: true,
                estado_aprobacion: 'Pendiente' // Asegúrate de que tu BD acepte este estado
            }]);

        if (errInsert) throw errInsert;

        // ¡Listo! Ya no buscamos huecos ni mandamos WhatsApps desde aquí.
        res.status(200).json({
            mensaje: 'Solicitud de bloqueo enviada. Esperando autorización de recepción.'
        });

    } catch (error) {
        console.error('Error al solicitar bloqueo:', error);
        res.status(500).json({ error: 'Error interno.' });
    }
};

module.exports = { bloquearAgenda };