const supabase = require('../../config/supabase');

const updateExpediente = async (req, res) => {
    try {
        const { id_paciente } = req.params;
        const {
            id_estado, id_institucion_preferida, id_sucursal_preferida,
            contacto_emergencia_nombre, contacto_emergencia_telefono,
            grupo_sanguineo, alergias,
            tabaquismo, alcoholismo,
            antecedentes_familiares, antecedentes_patologicos, cirugias_previas
        } = req.body;

        const { error } = await supabase
            .from('pacientes')
            .update({
                id_estado: id_estado ? parseInt(id_estado) : null,
                id_institucion_preferida: id_institucion_preferida ? parseInt(id_institucion_preferida) : null,
                id_sucursal_preferida: id_sucursal_preferida ? parseInt(id_sucursal_preferida) : null,
                contacto_emergencia_nombre,
                contacto_emergencia_telefono,
                grupo_sanguineo,
                alergias,
                tabaquismo,
                alcoholismo,
                antecedentes_familiares,
                antecedentes_patologicos,
                cirugias_previas,
                fecha_actualizacion: new Date().toISOString()
            })
            .eq('id_paciente', id_paciente);

        if (error) throw error;

        res.status(200).json({ mensaje: 'Expediente actualizado correctamente.' });
    } catch (error) {
        console.error("🚨 Error al actualizar expediente:", error);
        res.status(500).json({ error: 'Error al actualizar el expediente del paciente.' });
    }
};

const getExpediente = async (req, res) => {
    try {
        const { id_paciente } = req.params;

        const { data, error } = await supabase
            .from('pacientes')
            .select(`
                id_estado, id_institucion_preferida, id_sucursal_preferida,
                contacto_emergencia_nombre, contacto_emergencia_telefono,
                grupo_sanguineo, alergias,
                tabaquismo, alcoholismo,
                antecedentes_familiares, antecedentes_patologicos, cirugias_previas
            `)
            .eq('id_paciente', id_paciente)
            .single();

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        console.error("🚨 Error al obtener expediente:", error);
        res.status(500).json({ error: 'Error al obtener el expediente del paciente.' });
    }
};

module.exports = { updateExpediente, getExpediente };