const supabase = require('../../config/supabase');
const bcrypt = require('bcrypt');

const updatePerfilMedico = async (req, res) => {
    try {
        console.log("=== INICIANDO ACTUALIZACIÓN DE PERFIL ===");
        console.log("1. Datos recibidos:", req.body);
        
        const { nombre_completo, password_actual, password_nuevo } = req.body;

        // 🚨 BLINDAJE DEL TOKEN: Buscamos dónde guardó tu middleware el ID
        const tokenData = req.user || req.usuario || req.body; 
        console.log("2. Datos del token:", tokenData);

        const id_usuario = tokenData?.id_usuario || tokenData?.id;
        if (!id_usuario) {
            throw new Error("No se pudo extraer el ID del usuario desde el Token.");
        }

        // 1. Si va a cambiar contraseña, verificar la actual
        if (password_nuevo && password_nuevo.trim() !== '') {
            console.log("3. Intentando cambiar contraseña...");
            const { data: user, error: userError } = await supabase
                .from('usuarios')
                .select('contrasena_hash')
                .eq('id_usuario', id_usuario)
                .single();

            if (userError) throw new Error("Error al buscar usuario en BD: " + userError.message);

            const validPassword = await bcrypt.compare(password_actual, user.contrasena_hash);
            if (!validPassword) return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });

            const salt = await bcrypt.genSalt(10);
            const nuevoHash = await bcrypt.hash(password_nuevo, salt);
            
            const { error: updatePassError } = await supabase.from('usuarios').update({ contrasena_hash: nuevoHash }).eq('id_usuario', id_usuario);
            if (updatePassError) throw new Error("Error al actualizar hash: " + updatePassError.message);
        }

        // 2. Actualizar el nombre
        console.log("4. Actualizando nombre en BD...");
        const { error: updateNameError } = await supabase.from('usuarios').update({ nombre_completo }).eq('id_usuario', id_usuario);
        if (updateNameError) throw new Error("Error al actualizar nombre: " + updateNameError.message);

        console.log("=== PERFIL ACTUALIZADO CON ÉXITO ===");
        res.status(200).json({ mensaje: 'Perfil actualizado con éxito.' });
        
    } catch (error) {
        // AHORA SÍ, LA TERMINAL VA A GRITAR EL ERROR EXACTO
        console.error("🚨 ERROR FATAL EN UPDATE PERFIL:", error.message || error);
        res.status(500).json({ error: error.message || 'Error interno del servidor al actualizar perfil.' });
    }
};

module.exports = { updatePerfilMedico };