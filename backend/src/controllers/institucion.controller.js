const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { enviarCorreoVerificacion } = require('../config/mailer');

const registrarInstitucion = async (req, res) => {
    // 1. Extraer los datos del body (Fase 0.2 y 0.3 de tu documento)
    const { 
        // Datos de Institución
        nombre_institucion, nombre_corto, rfc_institucion, tipo_institucion, 
        sector, nivel_atencion, direccion, coordenadas_lat, coordenadas_lng, 
        id_estado, contacto_nombre, contacto_email, contacto_telefono,
        // Datos del Super Admin
        admin_nombre_completo, admin_curp, admin_correo, admin_password, admin_telefono 
    } = req.body;

    try {
        // 2. Insertar la Institución
        const { data: institucion, error: errorInst } = await supabase
            .from('instituciones')
            .insert([{
                nombre_institucion, nombre_corto, rfc_institucion, tipo_institucion,
                sector, nivel_atencion, direccion, coordenadas_lat, coordenadas_lng,
                id_estado, contacto_nombre, contacto_email, contacto_telefono
            }])
            .select()
            .single();

        if (errorInst) throw new Error(`Error al crear institución: ${errorInst.message}`);

        // 3. Preparar datos del Super Admin (Encriptar pass y crear token)
        const salt = await bcrypt.genSalt(10);
        const contrasena_hash = await bcrypt.hash(admin_password, salt);
        const tokenVerificacion = uuidv4(); // Token único para validar el correo

        // 4. Insertar el Super Admin atado al id_institucion
        const { data: usuario, error: errorUser } = await supabase
            .from('usuarios')
            .insert([{
                id_institucion: institucion.id_institucion,
                rol: 'Super_Admin',
                nombre_completo: admin_nombre_completo,
                curp: admin_curp,
                correo_electronico: admin_correo,
                contrasena_hash: contrasena_hash,
                telefono: admin_telefono,
                email_verificado: false,
                token_recuperacion: tokenVerificacion, // Usamos este campo temporalmente para la verificación
                estatus: true
            }])
            .select()
            .single();

        // Si falla el usuario, hacemos un "Rollback" manual borrando la institución
        if (errorUser) {
            await supabase.from('instituciones').delete().eq('id_institucion', institucion.id_institucion);
            throw new Error(`Error al crear el administrador: ${errorUser.message}`);
        }

        // 5. Auditar el registro
        await supabase.from('auditoria').insert([{
            id_usuario: usuario.id_usuario,
            accion: 'Registro de institución y Super Admin',
            entidad_afectada: 'instituciones',
            id_entidad_afectada: institucion.id_institucion
        }]);

        // 6. Simular el envío de correo (Aquí conectaremos Resend o Nodemailer después)
        // 6. Enviar correo real con Nodemailer
        await enviarCorreoVerificacion(admin_correo, tokenVerificacion);

        // 7. Responder al cliente
        res.status(201).json({
            mensaje: 'Institución registrada exitosamente. Revisa tu correo para verificar la cuenta.',
            institucion: {
                id: institucion.id_institucion,
                nombre: institucion.nombre_institucion
            }
        });

    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
};

// Controlador para cuando el usuario hace clic en el correo
const verificarCorreo = async (req, res) => {
    const { token } = req.params;

    try {
        // Buscar al usuario con ese token
        const { data: usuario, error: errorBusqueda } = await supabase
            .from('usuarios')
            .select('id_usuario, email_verificado')
            .eq('token_recuperacion', token)
            .single();

        if (errorBusqueda || !usuario) {
            return res.status(404).json({ error: 'Token inválido o expirado' });
        }

        if (usuario.email_verificado) {
            return res.status(400).json({ error: 'El correo ya fue verificado anteriormente' });
        }

        // Actualizar el usuario como verificado y limpiar el token
        const { error: errorUpdate } = await supabase
            .from('usuarios')
            .update({ 
                email_verificado: true,
                token_recuperacion: null 
            })
            .eq('id_usuario', usuario.id_usuario);

        if (errorUpdate) throw errorUpdate;

        res.json({ mensaje: '✅ Correo verificado exitosamente. Ya puedes iniciar sesión.' });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    registrarInstitucion,
    verificarCorreo
};