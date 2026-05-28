const supabase = require('../config/supabase');

const getInstitucion = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('instituciones')
            .select('*')
            .eq('id_institucion', req.user.id_institucion)
            .single();

        if (error) throw error;
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Error al cargar los datos de la institución' });
    }
};

const updateInstitucion = async (req, res) => {
    try {
        if (req.user.rol !== 'Super_Admin') return res.status(403).json({ error: 'Acceso denegado.' });

        // Extraemos exactamente lo que viene de tu BD
        // Agregamos las coordenadas a lo que extraemos del body
        const { 
            nombre_institucion, nombre_corto, rfc_institucion, 
            direccion, contacto_nombre, contacto_email, contacto_telefono,
            coordenadas_lat, coordenadas_lng // <- NUEVO
        } = req.body;

        const payload = {
            nombre_institucion, nombre_corto, rfc_institucion, 
            direccion, contacto_nombre, contacto_email, contacto_telefono,
            coordenadas_lat, coordenadas_lng, // <- NUEVO
            fecha_actualizacion: new Date().toISOString()
        };
        
        const { data, error } = await supabase
            .from('instituciones')
            .update(payload)
            .eq('id_institucion', req.user.id_institucion)
            .select();

        if (error) throw error;
        res.status(200).json({ mensaje: 'Institución actualizada', institucion: data[0] });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar la institución' });
    }
};

module.exports = { getInstitucion, updateInstitucion };