const supabase = require('../config/supabase'); // Usamos tu conexión centralizada

const getEspecialidades = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('especialidades')
            .select('id_especialidad, nombre_especialidad')
            .eq('activa', true)
            .order('nombre_especialidad', { ascending: true });

        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        console.error('Error al obtener especialidades:', error);
        res.status(500).json({ error: 'Error interno al cargar las especialidades.' });
    }
};

module.exports = {
    getEspecialidades
};