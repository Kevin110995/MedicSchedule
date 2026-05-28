const supabase = require('../config/supabase');

// ==========================================
// 1. CREAR ANUNCIO(S)
// ==========================================
const crearAnuncio = async (req, res) => {
    try {
        const { titulo, contenido, fecha_inicio, fecha_fin, alta_prioridad, sucursales_destino } = req.body;
        const { id_usuario, id_institucion, id_sucursal, rol } = req.user;

        // Determinamos a qué sucursales va. (sucursales_destino es un Array)
        let sucursalesAInsertar = [];
        if (rol === 'Super_Admin') {
            if (sucursales_destino.includes('GLOBAL')) {
                sucursalesAInsertar = [null]; // Null = Todas
            } else {
                sucursalesAInsertar = sucursales_destino; // Array de IDs: [1, 3, 5]
            }
        } else {
            sucursalesAInsertar = [id_sucursal]; // Administrador solo puede a la suya
        }

        // Armamos el arreglo para insertar múltiples filas de un solo golpe
        const inserts = sucursalesAInsertar.map(sucId => ({
            id_institucion,
            id_sucursal: sucId,
            titulo,
            contenido,
            fecha_inicio,
            fecha_fin,
            creado_por: id_usuario
        }));

        const { data: nuevosAnuncios, error: insertError } = await supabase
            .from('anuncios')
            .insert(inserts)
            .select();

        if (insertError) throw insertError;

        // Si es de alta prioridad, disparamos el Procedure en Postgres por CADA anuncio creado
        if (alta_prioridad === true) {
            for (const anuncio of nuevosAnuncios) {
                await supabase.rpc('generar_notificaciones_alta_prioridad', { p_id_anuncio: anuncio.id_anuncio });
            }
        }

        // 👇 EL ESLABÓN PERDIDO PARA WHATSAPP 👇
        if (req.body.alta_prioridad) {
            console.log("🚨 Generando alertas de alta prioridad...");
            
            // 1. DETERMINAR EL ALCANCE (NOMBRES DE LAS SUCURSALES)
            let textoAlcance = '';
            if (req.body.sucursales_destino && req.body.sucursales_destino.includes('GLOBAL')) {
                textoAlcance = '🌐 Todas las clínicas (Aviso Global)';
            } else if (req.body.sucursales_destino && req.body.sucursales_destino.length > 0) {
                // Buscamos los nombres reales de las sucursales seleccionadas
                const { data: sucs } = await supabase
                    .from('sucursales')
                    .select('nombre_sede')
                    .in('id_sucursal', req.body.sucursales_destino);
                
                if (sucs && sucs.length > 0) {
                    textoAlcance = '📍 ' + sucs.map(s => s.nombre_sede).join(', ');
                } else {
                    textoAlcance = '📍 Sucursales seleccionadas';
                }
            }

            // 2. BUSCAR PACIENTES VERIFICADOS
            const { data: pacientes } = await supabase
                .from('usuarios')
                .select('id_usuario')
                .eq('rol', 'Paciente')
                .eq('whatsapp_verificado', true);

            if (pacientes && pacientes.length > 0) {
                
                // 3. FORMATO DE FECHAS
                const fInicio = new Date(req.body.fecha_inicio).toLocaleDateString('es-MX', { timeZone: 'UTC' });
                const fFin = new Date(req.body.fecha_fin).toLocaleDateString('es-MX', { timeZone: 'UTC' });

                // 4. PLANTILLA MAESTRA ACTUALIZADA
                const mensajeFormateado = 
`🚨 *${req.body.titulo}*

${req.body.contenido}

🏢 *Aplica para:* ${textoAlcance}
📅 *Vigencia:* Del ${fInicio} al ${fFin}

_🏥 MedicSchedule_`;

                // 5. ENCOLAR MENSAJES
                const alertas = pacientes.map(paciente => ({
                    id_usuario: paciente.id_usuario,
                    tipo: 'ALERTA_URGENTE',
                    titulo: req.body.titulo,
                    mensaje: mensajeFormateado,
                    programada_para: new Date()
                }));

                const { error: errorNotif } = await supabase.from('notificaciones').insert(alertas);
                
                if (errorNotif) console.error("Error al encolar WhatsApps:", errorNotif);
                else console.log(`✅ Se encolaron ${alertas.length} mensajes de WhatsApp.`);
                
            } else {
                console.log("⚠️ No hay pacientes con WhatsApp verificado para alertar.");
            }
        }
        // 👆 FIN DEL ESLABÓN PERDIDO 👆
        
        res.status(201).json({ mensaje: 'Anuncio(s) publicado(s) exitosamente' });

    } catch (error) {
        console.error('Error en crearAnuncio:', error);
        res.status(500).json({ error: 'Error interno al crear el anuncio' });
    }
};

// ==========================================
// 2. OBTENER LISTA DE ANUNCIOS
// ==========================================
const getAnuncios = async (req, res) => {
    try {
        const { id_institucion, id_sucursal, rol } = req.user;
        
        // EN LA FUNCIÓN getAnuncios:
        let query = supabase.from('anuncios').select(`
            *,
            sucursales (nombre_sede) 
        `).eq('id_institucion', id_institucion).order('id_anuncio', { ascending: false });

        // El Super Admin ve todos los de su institución. El Admin normal solo ve los globales o de su sucursal.
        if (rol !== 'Super_Admin') {
            query = query.or(`id_sucursal.is.null,id_sucursal.eq.${id_sucursal}`);
        }

        const { data, error } = await query;
        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener anuncios' });
    }
};

// ==========================================
// 3. EDITAR ANUNCIO
// ==========================================
// ==========================================
// 3. EDITAR ANUNCIO
// ==========================================
const updateAnuncio = async (req, res) => {
    try {
        const { id } = req.params;
        const { titulo, contenido, fecha_inicio, fecha_fin, id_sucursal } = req.body;

        const { error } = await supabase
            .from('anuncios')
            .update({ 
                titulo, 
                contenido, 
                fecha_inicio, 
                fecha_fin, 
                id_sucursal, // <-- Agregamos el campo para permitir cambiar el destino
                fecha_actualizacion: new Date() 
            })
            .eq('id_anuncio', id);

        if (error) throw error;
        res.status(200).json({ mensaje: 'Anuncio actualizado correctamente' });
    } catch (error) {
        console.error("Error al actualizar:", error);
        res.status(500).json({ error: 'Error al actualizar anuncio' });
    }
};
// ==========================================
// 4. TERMINAR / ACTIVAR ANUNCIO (TOGGLE)
// ==========================================
const toggleEstatusAnuncio = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Obtenemos el estatus actual
        const { data: anuncio, error: getError } = await supabase.from('anuncios').select('activo').eq('id_anuncio', id).single();
        if (getError) throw getError;

        // Lo invertimos
        const { error } = await supabase.from('anuncios').update({ activo: !anuncio.activo }).eq('id_anuncio', id);
        if (error) throw error;

        res.status(200).json({ mensaje: 'Estatus cambiado exitosamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al cambiar estatus' });
    }
};

module.exports = { crearAnuncio, getAnuncios, updateAnuncio, toggleEstatusAnuncio };