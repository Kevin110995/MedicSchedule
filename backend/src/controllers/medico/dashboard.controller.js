const supabase = require('../../config/supabase');

const getAgendaHoy = async (req, res) => {
    try {
        // 1. Obtener el id_medico real basado en el id_usuario del token
        const { data: medicoData, error: errMedico } = await supabase
            .from('medicos')
            .select('id_medico')
            .eq('id_usuario', req.user.id_usuario)
            .single();

        if (errMedico || !medicoData) {
            return res.status(403).json({ error: 'No se encontró el perfil de médico asociado.' });
        }

        // ==========================================
        // 2. CORRECCIÓN DE ZONA HORARIA (El Fix)
        // ==========================================
        const ahora = new Date();
        const offset = ahora.getTimezoneOffset() * 60000;
        // Restamos el offset para forzar que el ISOString coincida con nuestra fecha local
        const fechaLocal = new Date(ahora.getTime() - offset).toISOString().split('T')[0];

        const inicioDia = `${fechaLocal}T00:00:00`;
        const finDia = `${fechaLocal}T23:59:59`;

        // 3. Buscar las citas de HOY en la base de datos
        const { data, error } = await supabase
            .from('citas')
            .select(`
                id_cita, id_paciente, fecha_hora, fecha_hora_fin, estado, triage_prioridad, notas_adicionales,
                pacientes ( id_paciente, sexo, fecha_nacimiento, usuarios ( nombre_completo, telefono ) )
            `)
            .eq('id_medico', medicoData.id_medico)
            .gte('fecha_hora', inicioDia)
            .lte('fecha_hora', finDia)
            .order('fecha_hora', { ascending: true });

        if (error) throw error;

        // Formateo para el frontend
        const agenda = data.map(cita => {
            // Calcular edad rápida con seguro anti-errores
            const nacimiento = cita.pacientes?.fecha_nacimiento ? new Date(cita.pacientes.fecha_nacimiento) : new Date();
            const edad = cita.pacientes?.fecha_nacimiento ? Math.floor((new Date() - nacimiento) / (365.25 * 24 * 60 * 60 * 1000)) : 0;

            return {
                id_cita: cita.id_cita,
                // AQUÍ ESTÁ EL DOBLE SEGURO:
                id_paciente: cita.id_paciente || cita.pacientes?.id_paciente,
                hora: cita.fecha_hora,
                estado: cita.estado,
                prioridad: cita.triage_prioridad,
                motivo: cita.notas_adicionales,
                paciente: cita.pacientes?.usuarios?.nombre_completo || 'Paciente Desconocido',
                edad: edad,
                sexo: cita.pacientes?.sexo || 'N/D'
            };
        });

        res.status(200).json(agenda);
    } catch (error) {
        console.error('Error cargando agenda del médico:', error);
        res.status(500).json({ error: 'Error al cargar la agenda.' });
    }
};

const cambiarEstadoCita = async (req, res) => {
    try {
        const { id_cita } = req.params;
        const { estado } = req.body; // Solo permitiremos 'En curso' o 'Completada'

        const { error } = await supabase
            .from('citas')
            .update({ estado, fecha_actualizacion: new Date().toISOString() })
            .eq('id_cita', id_cita);

        if (error) throw error;
        res.status(200).json({ mensaje: `Cita actualizada a ${estado}` });
    } catch (error) {
        res.status(500).json({ error: 'Error al cambiar estado de la cita.' });
    }
};

module.exports = { getAgendaHoy, cambiarEstadoCita };