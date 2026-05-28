const supabase = require('../../config/supabase');
const bcrypt = require('bcrypt');
const { sendInvitacionCredenciales } = require('../../services/email.service');

// Generador de contraseñas
const generarContrasenaTemporal = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 10; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

const getPersonal = async (req, res) => {
    try {
        const id_sucursal = req.user.id_sucursal;
        
        const { data, error } = await supabase
            .from('usuarios')
            .select(`
                id_usuario,
                nombre_completo,
                correo_electronico,
                telefono,
                estatus,
                email_verificado,
                fecha_registro
            `)
            .eq('id_sucursal', id_sucursal)
            .eq('rol', 'Recepcionista')
            .order('fecha_registro', { ascending: false });

        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        console.error('Error al obtener personal administrativo:', error);
        res.status(500).json({ error: 'Error interno al cargar el personal.' });
    }
};

const createPersonal = async (req, res) => {
    try {
        const { nombre_completo, correo_electronico, telefono } = req.body;
        const id_institucion = req.user.id_institucion;
        const id_sucursal = req.user.id_sucursal;

        // 1. Validar duplicados
        const { data: existente } = await supabase
            .from('usuarios')
            .select('id_usuario')
            .or(`correo_electronico.eq.${correo_electronico},telefono.eq.${telefono}`)
            .single();

        if (existente) return res.status(400).json({ error: 'El correo electrónico o teléfono ya están registrados.' });

        // 2. Generar y hashear contraseña
        const contrasenaTemporal = generarContrasenaTemporal();
        const salt = await bcrypt.genSalt(10);
        const contrasenaHash = await bcrypt.hash(contrasenaTemporal, salt);

        // 3. Insertar en tabla USUARIOS con rol Recepcionista
        const { data: nuevoUsuario, error: errorUsuario } = await supabase
            .from('usuarios')
            .insert([{
                id_institucion,
                id_sucursal,
                rol: 'Recepcionista',
                nombre_completo,
                correo_electronico,
                telefono,
                contrasena_hash: contrasenaHash,
                estatus: true,
                email_verificado: false
            }])
            .select('id_usuario')
            .single();

        if (errorUsuario) throw errorUsuario;

        // 4. Enviar correo
        try {
            await sendInvitacionCredenciales(correo_electronico, nombre_completo, contrasenaTemporal, 'Recepcionista');
        } catch (emailError) {
            console.error('El usuario se creó, pero falló el envío de correo:', emailError.message);
        }

        res.status(201).json({ 
            mensaje: 'Personal registrado exitosamente.',
            _passwordTemporal: contrasenaTemporal 
        });

    } catch (error) {
        console.error('Error al crear personal:', error);
        res.status(500).json({ error: 'No se pudo registrar al personal administrativo.' });
    }
};

const updatePersonal = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const { nombre_completo, telefono } = req.body;
        const id_sucursal_admin = req.user.id_sucursal;

        // Validar que pertenece a la sucursal del Admin
        const { data: validacion } = await supabase.from('usuarios').select('id_sucursal').eq('id_usuario', id_usuario).single();
        if (!validacion || validacion.id_sucursal !== id_sucursal_admin) {
            return res.status(403).json({ error: 'No tienes permiso para editar este usuario.' });
        }

        const payload = {
            nombre_completo,
            telefono,
            fecha_actualizacion: new Date().toISOString()
        };

        const { error } = await supabase.from('usuarios').update(payload).eq('id_usuario', id_usuario);
        if (error) throw error;

        res.status(200).json({ mensaje: 'Información actualizada correctamente.' });
    } catch (error) {
        console.error('Error al actualizar:', error);
        res.status(500).json({ error: 'No se pudo actualizar la información.' });
    }
};

const toggleEstatusPersonal = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const { estatus } = req.body;
        const id_sucursal_admin = req.user.id_sucursal;

        const { data: validacion } = await supabase.from('usuarios').select('id_sucursal').eq('id_usuario', id_usuario).single();
        if (!validacion || validacion.id_sucursal !== id_sucursal_admin) {
            return res.status(403).json({ error: 'No tienes permiso para modificar este usuario.' });
        }

        const { error } = await supabase.from('usuarios').update({ estatus }).eq('id_usuario', id_usuario);
        if (error) throw error;

        res.status(200).json({ mensaje: `El usuario ha sido ${estatus ? 'reactivado' : 'dado de baja'} correctamente.` });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo cambiar el estado.' });
    }
};

const resendAccesoPersonal = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const id_sucursal_admin = req.user.id_sucursal;

        const { data: personal } = await supabase
            .from('usuarios')
            .select('nombre_completo, correo_electronico, id_sucursal')
            .eq('id_usuario', id_usuario)
            .single();

        if (!personal || personal.id_sucursal !== id_sucursal_admin) {
            return res.status(403).json({ error: 'Acceso denegado.' });
        }

        const nuevaContrasena = generarContrasenaTemporal();
        const salt = await bcrypt.genSalt(10);
        const contrasenaHash = await bcrypt.hash(nuevaContrasena, salt);

        await supabase
            .from('usuarios')
            .update({ contrasena_hash: contrasenaHash, email_verificado: false })
            .eq('id_usuario', id_usuario);

        try {
            await sendInvitacionCredenciales(personal.correo_electronico, personal.nombre_completo, nuevaContrasena, 'Recepcionista');
        } catch (emailError) {
            console.error('Se generó la clave, pero falló el correo:', emailError.message);
        }

        res.status(200).json({ 
            mensaje: 'Nuevos accesos generados.',
            _passwordTemporal: nuevaContrasena
        });
    } catch (error) {
        res.status(500).json({ error: 'No se pudieron regenerar los accesos.' });
    }
};

module.exports = {
    getPersonal,
    createPersonal,
    updatePersonal,
    toggleEstatusPersonal,
    resendAccesoPersonal
};