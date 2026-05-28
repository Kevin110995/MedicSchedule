const supabase = require('../../config/supabase');

const obtenerMedicosActivos = async (req, res) => {
    try {
        // Consultamos médicos y traemos el nombre desde la tabla usuarios
        const { data, error } = await supabase
            .from('medicos')
            .select(`
                id_medico,
                usuarios (
                    nombre_completo
                )
            `);

        if (error) {
            console.error("❌ Error de Supabase:", error);
            throw error;
        }

        console.log("✅ Médicos encontrados:", data.length);
        res.status(200).json(data);
    } catch (error) {
        console.error("🔥 Error en el controlador obtenerMedicosActivos:", error);
        res.status(500).json({ 
            error: 'Error interno del servidor', 
            details: error.message 
        });
    }
};

module.exports = { obtenerMedicosActivos };