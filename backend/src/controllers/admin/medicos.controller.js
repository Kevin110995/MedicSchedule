const supabase = require('../../config/supabase'); 
const { sendInvitacionCredenciales } = require('../../services/email.service');
const bcrypt = require('bcrypt');

// ==========================================
// UTILIDAD: Generador de contraseñas seguras
// ==========================================
const generarContrasenaTemporal = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 10; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

const getMedicos = async (req, res) => {
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
                medicos (
                    id_medico,
                    cedula_profesional,
                    costo_consulta,
                    especialidades (id_especialidad, nombre_especialidad)
                )
            `)
            .eq('id_sucursal', id_sucursal)
            .eq('rol', 'Medico')
            .order('fecha_registro', { ascending: false });

        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        console.error('Error al obtener médicos:', error);
        res.status(500).json({ error: 'Error interno del servidor al cargar el directorio.' });
    }
};

const createMedico = async (req, res) => {
    try {
        const { nombre_completo, correo_electronico, telefono, id_especialidad, cedula_profesional, costo_consulta } = req.body;
        const id_institucion = req.user.id_institucion;
        const id_sucursal = req.user.id_sucursal;

        // 🔥 MODIFICACIÓN: Ahora SOLO busca si el correo ya existe. Ignora el teléfono.
        const { data: existente } = await supabase
            .from('usuarios')
            .select('id_usuario')
            .eq('correo_electronico', correo_electronico)
            .single();

        if (existente) return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });

        const contrasenaTemporal = generarContrasenaTemporal();
        const salt = await bcrypt.genSalt(10);
        const contrasenaHash = await bcrypt.hash(contrasenaTemporal, salt);

        const { data: nuevoUsuario, error: errorUsuario } = await supabase
            .from('usuarios')
            .insert([{
                id_institucion,
                id_sucursal,
                rol: 'Medico',
                nombre_completo,
                correo_electronico,
                telefono,
                contrasena_hash: contrasenaHash,
                estatus: true,
                estado_registro: 'incompleto'
            }])
            .select('id_usuario')
            .single();

        if (errorUsuario) throw errorUsuario;

        await sendInvitacionCredenciales(correo_electronico, nombre_completo, contrasenaTemporal, 'Médico');

        const { error: errorMedico } = await supabase
            .from('medicos')
            .insert([{
                id_usuario: nuevoUsuario.id_usuario,
                id_especialidad,
                cedula_profesional,
                costo_consulta
            }]);

        if (errorMedico) throw errorMedico;

        res.status(201).json({ 
            mensaje: 'Médico registrado exitosamente. Se ha enviado un correo con sus credenciales.',
            _passwordTemporal: contrasenaTemporal 
        });

    } catch (error) {
        console.error('Error durante la creación del médico:', error.message || error);
        res.status(500).json({ error: 'No se pudo registrar al médico.' });
    }
};

const updateMedico = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const { telefono, costo_consulta, id_especialidad } = req.body;
        const id_sucursal_admin = req.user.id_sucursal;

        const { data: validacion } = await supabase.from('usuarios').select('id_sucursal').eq('id_usuario', id_usuario).single();
        if (!validacion || validacion.id_sucursal !== id_sucursal_admin) {
            return res.status(403).json({ error: 'No tienes permiso para editar este médico.' });
        }

        if (telefono) await supabase.from('usuarios').update({ telefono }).eq('id_usuario', id_usuario);

        if (costo_consulta || id_especialidad) {
            const updatesMedico = {};
            if (costo_consulta) updatesMedico.costo_consulta = costo_consulta;
            if (id_especialidad) updatesMedico.id_especialidad = id_especialidad;
            await supabase.from('medicos').update(updatesMedico).eq('id_usuario', id_usuario);
        }

        res.status(200).json({ mensaje: 'Información actualizada correctamente.' });
    } catch (error) {
        console.error('Error al actualizar:', error);
        res.status(500).json({ error: 'No se pudo actualizar la información.' });
    }
};

const toggleEstatusMedico = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const { estatus } = req.body;
        const id_sucursal_admin = req.user.id_sucursal;

        const { data: validacion } = await supabase.from('usuarios').select('id_sucursal').eq('id_usuario', id_usuario).single();
        if (!validacion || validacion.id_sucursal !== id_sucursal_admin) {
            return res.status(403).json({ error: 'No tienes permiso para modificar este médico.' });
        }

        const { error } = await supabase.from('usuarios').update({ estatus }).eq('id_usuario', id_usuario);
        if (error) throw error;

        res.status(200).json({ mensaje: `El médico ha sido ${estatus ? 'reactivado' : 'dado de baja'} correctamente.` });
    } catch (error) {
        console.error('Error al cambiar estatus:', error);
        res.status(500).json({ error: 'No se pudo cambiar el estado del médico.' });
    }
};

const resendAcceso = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const id_sucursal_admin = req.user.id_sucursal;

        const { data: medico } = await supabase
            .from('usuarios')
            .select('nombre_completo, correo_electronico, id_sucursal')
            .eq('id_usuario', id_usuario)
            .single();

        if (!medico || medico.id_sucursal !== id_sucursal_admin) {
            return res.status(403).json({ error: 'Acceso denegado a este perfil.' });
        }

        const nuevaContrasena = generarContrasenaTemporal();
        const salt = await bcrypt.genSalt(10);
        const contrasenaHash = await bcrypt.hash(nuevaContrasena, salt);

        await supabase
            .from('usuarios')
            .update({ contrasena_hash: contrasenaHash, estado_registro: 'incompleto' })
            .eq('id_usuario', id_usuario);

        await sendInvitacionCredenciales(medico.correo_electronico, medico.nombre_completo, nuevaContrasena, 'Médico');
        
        res.status(200).json({ 
            mensaje: 'Nuevos accesos generados y enviados.',
            _passwordTemporal: nuevaContrasena
        });
    } catch (error) {
        console.error('Error al reenviar accesos:', error.message || error);
        res.status(500).json({ error: 'No se pudieron regenerar los accesos.' });
    }
};

module.exports = {
    getMedicos,
    createMedico,
    updateMedico,
    toggleEstatusMedico,
    resendAcceso
};