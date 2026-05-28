const supabase = require('../config/supabase');
const bcrypt = require('bcrypt');
const { sendInvitacionCredenciales } = require('../services/email.service');

// Generador de contraseñas
const generarContrasenaTemporal = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 10; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

const getAdministradores = async (req, res) => {
    try {
        if (req.user.rol !== 'Super_Admin') return res.status(403).json({ error: 'Acceso denegado.' });

        // Ahora solo leemos tu tabla 'usuarios', mucho más rápido y sin cruzar datos
        const { data: dbUsers, error } = await supabase
            .from('usuarios')
            .select(`
                id_usuario, nombre_completo, correo_electronico, telefono, estatus, fecha_registro, id_sucursal, email_verificado,
                sucursales ( nombre_sede, nombre_corto )
            `)
            .eq('id_institucion', req.user.id_institucion)
            .eq('rol', 'Administrador')
            .order('id_usuario', { ascending: false });

        if (error) throw error;

        // Formateamos para que el Frontend lo entienda igual que antes
        const usuariosFormateados = dbUsers.map(user => ({
            ...user,
            email: user.correo_electronico,
            verificado: user.email_verificado || false
        }));

        res.status(200).json(usuariosFormateados);
    } catch (err) {
        console.error("Error obteniendo administradores:", err);
        res.status(500).json({ error: 'Error obteniendo administradores' });
    }
};

const createAdministrador = async (req, res) => {
    try {
        if (req.user.rol !== 'Super_Admin') return res.status(403).json({ error: 'Acceso denegado.' });

        const { nombre_completo, email, telefono, id_sucursal } = req.body;
        
        if (!nombre_completo || !email || !id_sucursal) {
            return res.status(400).json({ error: 'Faltan campos obligatorios.' });
        }

        // 1. Validar que el correo no exista
        const { data: existente } = await supabase.from('usuarios').select('id_usuario').eq('correo_electronico', email).single();
        if (existente) return res.status(400).json({ error: 'El correo ya está registrado.' });

        // 2. Generar y hashear contraseña
        const contrasenaTemporal = generarContrasenaTemporal();
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(contrasenaTemporal, salt);

        // 3. Guardar en Base de Datos (email_verificado inicia en false)
        const payload = {
            id_institucion: req.user.id_institucion,
            id_sucursal: parseInt(id_sucursal),
            nombre_completo,
            correo_electronico: email,          
            telefono: telefono || null,
            contrasena_hash: hashedPassword,     
            rol: 'Administrador',
            estatus: true,
            email_verificado: false
        };

        const { data: dbData, error: dbError } = await supabase.from('usuarios').insert([payload]).select();
        if (dbError) throw dbError;

        // 4. Enviar correo de invitación
        try {
            await sendInvitacionCredenciales(email, nombre_completo, contrasenaTemporal, 'Administrador');
        } catch (emailError) {
            console.error('Admin creado, pero falló el correo:', emailError.message);
        }

        res.status(201).json({ 
            mensaje: 'Administrador creado y credenciales enviadas.', 
            _passwordTemporal: contrasenaTemporal // Solo para pruebas
        });

    } catch (err) {
        console.error("💥 ERROR AL CREAR:", err);
        res.status(500).json({ error: 'Error creando administrador' });
    }
};

const updateAdministrador = async (req, res) => {
    try {
        if (req.user.rol !== 'Super_Admin') return res.status(403).json({ error: 'Acceso denegado.' });

        const { nombre_completo, email, telefono, id_sucursal } = req.body;
        
        const payload = {
            nombre_completo,
            correo_electronico: email,
            telefono: telefono || null,
            id_sucursal: parseInt(id_sucursal),
            fecha_actualizacion: new Date().toISOString()
        };

        const { error } = await supabase
            .from('usuarios')
            .update(payload)
            .eq('id_usuario', req.params.id)
            .eq('id_institucion', req.user.id_institucion);

        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: 'El correo ya pertenece a otro usuario.' });
            throw error;
        }
        res.status(200).json({ mensaje: 'Administrador actualizado' });
    } catch (err) {
        console.error("💥 ERROR AL ACTUALIZAR:", err);
        res.status(500).json({ error: 'Error actualizando administrador' });
    }
};

const toggleEstatus = async (req, res) => {
    try {
        if (req.user.rol !== 'Super_Admin') return res.status(403).json({ error: 'Acceso denegado.' });
        const { error } = await supabase
            .from('usuarios')
            .update({ estatus: req.body.estatus })
            .eq('id_usuario', req.params.id)
            .eq('id_institucion', req.user.id_institucion);

        if (error) throw error;
        res.status(200).json({ mensaje: 'Estatus actualizado' });
    } catch (err) {
        res.status(500).json({ error: 'Error actualizando estatus' });
    }
};

// Se convierte en "Reset de Contraseña y Reenvío"
const reenviarCorreoVerificacion = async (req, res) => {
    try {
        if (req.user.rol !== 'Super_Admin') return res.status(403).json({ error: 'Acceso denegado.' });

        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Se requiere el correo.' });

        // 1. Obtener datos del admin
        const { data: admin } = await supabase.from('usuarios').select('id_usuario, nombre_completo').eq('correo_electronico', email).single();
        if (!admin) return res.status(404).json({ error: 'Usuario no encontrado.' });

        // 2. Generar nueva contraseña
        const nuevaContrasena = generarContrasenaTemporal();
        const salt = await bcrypt.genSalt(10);
        const contrasenaHash = await bcrypt.hash(nuevaContrasena, salt);

        // 3. Actualizar base de datos (y forzar que se vuelva a verificar)
        await supabase
            .from('usuarios')
            .update({ contrasena_hash: contrasenaHash, email_verificado: false })
            .eq('id_usuario', admin.id_usuario);

        // 4. Enviar correo
        try {
            await sendInvitacionCredenciales(email, admin.nombre_completo, nuevaContrasena, 'Administrador');
        } catch (emailError) {
            console.error('Se generó la contraseña, pero falló el correo:', emailError.message);
        }

        res.status(200).json({ 
            mensaje: 'Nuevos accesos generados exitosamente.',
            _passwordTemporal: nuevaContrasena
        });
    } catch (err) {
        console.error("Error al reenviar correo:", err);
        res.status(500).json({ error: 'Error al reenviar el correo.' });
    }
};

module.exports = { getAdministradores, createAdministrador, updateAdministrador, toggleEstatus, reenviarCorreoVerificacion };