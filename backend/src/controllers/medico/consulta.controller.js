const supabase = require('../../config/supabase');
const crypto = require('crypto');

// 1. OBTENER DETALLES DE LA CONSULTA ACTUAL
const getDetallesConsulta = async (req, res) => {
    try {
        const { id_cita } = req.params;
        
        const { data, error } = await supabase
            .from('citas')
            .select(`
                id_cita, fecha_hora, notas_adicionales,
                pacientes ( 
                    id_paciente, fecha_nacimiento, sexo, alergias, grupo_sanguineo, tipo_sangre_factor,
                    usuarios ( nombre_completo ) 
                )
            `)
            .eq('id_cita', id_cita)
            .single();

        if (error) throw error;
        
        const nacimiento = new Date(data.pacientes.fecha_nacimiento);
        const edad = Math.floor((new Date() - nacimiento) / (365.25 * 24 * 60 * 60 * 1000));
        data.pacientes.edad = edad;

        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'No se pudieron cargar los datos del paciente.' });
    }
};

// 2. FINALIZAR CONSULTA Y GENERAR RECETA
const finalizarConsulta = async (req, res) => {
    try {
        const { id_cita } = req.params;
        const { signos_vitales, diagnostico, notas_internas, medicamentos, indicaciones_adicionales, dias_vigencia } = req.body;

        const { error: errorCita } = await supabase
            .from('citas')
            .update({ estado: 'Completada', fecha_actualizacion: new Date().toISOString() })
            .eq('id_cita', id_cita);

        if (errorCita) throw errorCita;

        const fechaVigencia = new Date();
        fechaVigencia.setDate(fechaVigencia.getDate() + parseInt(dias_vigencia || 3));
        const tokenQR = crypto.randomBytes(16).toString('hex');

        const payloadReceta = {
            id_cita, diagnostico, medicamentos_json: medicamentos, indicaciones_adicionales,
            vigencia_hasta: fechaVigencia.toISOString(), codigo_qr_token: tokenQR, signos_vitales, notas_internas
        };

        const { data: recetaGuardada, error: errorReceta } = await supabase
            .from('recetas')
            .insert([payloadReceta])
            .select('folio_unico, fecha_emision')
            .single();

        if (errorReceta) {
            await supabase.from('citas').update({ estado: 'En curso' }).eq('id_cita', id_cita);
            throw errorReceta;
        }

        res.status(201).json({ 
            mensaje: 'Consulta finalizada y receta generada.', qr_token: tokenQR,
            folio_unico: recetaGuardada.folio_unico, fecha_emision: recetaGuardada.fecha_emision,
            vigencia_hasta: fechaVigencia.toISOString()
        });

    } catch (error) {
        res.status(500).json({ error: error.message || 'Error al procesar la receta médica.' });
    }
};

// 3. OBTENER EL HISTORIAL CLÍNICO COMPLETO
const getHistorialPaciente = async (req, res) => {
    try {
        const { id_paciente } = req.params;
        
        const { data, error } = await supabase
            .from('recetas')
            .select(`
                id_receta, diagnostico, medicamentos_json, indicaciones_adicionales, 
                signos_vitales, notas_internas, fecha_emision,
                citas!inner( id_paciente, medicos ( usuarios ( nombre_completo ) ) )
            `)
            .eq('citas.id_paciente', id_paciente)
            .order('fecha_emision', { ascending: false });

        if (error) throw error;

        const formateado = data.map(r => ({
            id_receta: r.id_receta,
            fecha: new Date(r.fecha_emision).toLocaleDateString('es-MX'),
            medico: r.citas?.medicos?.usuarios?.nombre_completo || 'Desconocido',
            diagnostico: r.diagnostico,
            signos: r.signos_vitales || {},
            notas: r.notas_internas || 'Sin notas registradas.',
            medicamentos: r.medicamentos_json || [],
            indicaciones: r.indicaciones_adicionales || ''
        }));

        res.status(200).json(formateado);
    } catch (error) {
        res.status(500).json({ error: 'Error al cargar el historial del paciente.' });
    }
};

// 4. OBTENER PERFIL CLÍNICO DEL PACIENTE
// 4. OBTENER PERFIL CLÍNICO DEL PACIENTE
const getPerfilClinico = async (req, res) => {
    try {
        const { id_paciente } = req.params;
        
        // SOLO pedimos las columnas que SÍ existen en tu BD
        const { data, error } = await supabase
            .from('pacientes')
            .select('alergias, grupo_sanguineo, contacto_emergencia_nombre, contacto_emergencia_telefono')
            .eq('id_paciente', id_paciente)
            .single();

        if (error) throw error;

        // Armamos un objeto combinando tus datos reales con textos por defecto 
        // para los campos que aún no tienes en la BD, así el Frontend no falla.
        const perfilSeguro = {
            grupo_sanguineo: data.grupo_sanguineo,
            alergias: data.alergias,
            contacto_emergencia: `${data.contacto_emergencia_nombre} (${data.contacto_emergencia_telefono})`,
            tabaquismo: false,
            alcoholismo: false,
            antecedentes_familiares: 'Sin registro en el sistema actual.',
            antecedentes_patologicos: 'Sin registro en el sistema actual.',
            cirugias_previas: 'Sin registro en el sistema actual.'
        };

        res.status(200).json(perfilSeguro);
    } catch (error) {
        console.error("Error BD Perfil:", error);
        res.status(500).json({ error: 'Error al obtener perfil clínico.' });
    }
};

// EXPORTAMOS TODAS LAS FUNCIONES CORRECTAMENTE
module.exports = { 
    getDetallesConsulta, 
    finalizarConsulta, 
    getHistorialPaciente,
    getPerfilClinico 
};