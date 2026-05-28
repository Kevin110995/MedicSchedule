const supabase = require('../config/supabase');
const bcrypt = require('bcrypt');

const getPerfil = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id_usuario', req.user.id_usuario)
            .single();

        if (error) throw error;
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener perfil' });
    }
};

const updatePerfil = async (req, res) => {
    try {
        // 1. AQUÍ ESTÁ EL TRUCO: Agregamos foto_url para extraerla de lo que manda React
        const { nombre_completo, correo_electronico, telefono, nueva_contrasena, avatar_url } = req.body;

        const payload = {
            nombre_completo,
            correo_electronico,
            telefono,
            avatar_url, // 2. Y la agregamos al paquete que se va a guardar en PostgreSQL
            fecha_actualizacion: new Date().toISOString()
        };

        if (nueva_contrasena && nueva_contrasena.trim() !== "") {
            const salt = await bcrypt.genSalt(10);
            // 👇 AQUÍ ESTÁ LA CORRECCIÓN: Usamos 'contrasena_hash' que es el nombre real en tu BD
            payload.contrasena_hash = await bcrypt.hash(nueva_contrasena, salt);
        }

        const { data, error } = await supabase
            .from('usuarios')
            .update(payload)
            .eq('id_usuario', req.user.id_usuario) 
            .select();

        if (error) throw error;

        res.status(200).json({ 
            mensaje: 'Perfil actualizado con éxito', 
            usuario: data[0] 
        });
    } catch (err) {
        console.error("Error al actualizar perfil:", err);
        res.status(500).json({ error: 'No se pudo actualizar la información' });
    }
};

module.exports = { getPerfil, updatePerfil };