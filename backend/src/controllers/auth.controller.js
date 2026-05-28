const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const login = async (req, res) => {
    try {
        const { correo, password } = req.body;

        if (!correo || !password) {
            return res.status(400).json({ error: 'El correo y la contraseña son obligatorios' });
        }

        // 1. Buscar al usuario por correo_electronico
        const { data: usuario, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('correo_electronico', correo)
            .single();

        if (error || !usuario) {
            return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
        }

        // 2. Verificar si está suspendido (Se mantiene esta regla estricta)
        if (usuario.estatus === false) {
            return res.status(403).json({ 
                error: 'Tu cuenta ha sido suspendida. Contacta al administrador general para recuperar el acceso.' 
            });
        }

        // 3. Comparar la contraseña encriptada ANTES de verificar el correo
        const passwordValida = await bcrypt.compare(password, usuario.contrasena_hash);
        
        if (!passwordValida) {
            return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
        }

        // ==========================================
        // 4. VERIFICACIÓN SILENCIOSA
        // ==========================================
        // Si llegó hasta aquí, significa que tiene la contraseña correcta.
        // Si su cuenta no estaba verificada, la activamos automáticamente.
        if (usuario.email_verificado === false) {
            const { error: updateError } = await supabase
                .from('usuarios')
                .update({ email_verificado: true })
                .eq('id_usuario', usuario.id_usuario);

            if (updateError) {
                console.error('Error al verificar el correo silenciosamente:', updateError);
            } else {
                // Actualizamos el objeto en memoria para que React sepa que ya está activo
                usuario.email_verificado = true; 
            }
        }

        // 5. Generar el Token (JWT)
        const token = jwt.sign(
            { 
                id_usuario: usuario.id_usuario, 
                rol: usuario.rol, 
                id_institucion: usuario.id_institucion,
                id_sucursal: usuario.id_sucursal 
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        // 6. Quitar datos sensibles
        delete usuario.contrasena_hash;

        // 7. Enviar respuesta exitosa
        res.status(200).json({
            mensaje: 'Inicio de sesión exitoso',
            token: token,
            usuario: usuario
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor al intentar iniciar sesión' });
    }
};

module.exports = { login };